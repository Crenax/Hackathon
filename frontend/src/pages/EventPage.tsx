import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
    ArrowLeft,
    Book,
    Calendar3,
    Clock,
    GeoAltFill,
    LockFill,
    Map,
    PersonCircle,
} from "react-bootstrap-icons";

import {
    approveListingRequest,
    deleteListing,
    declineListingRequest,
    getJoinRequests,
    getListing,
    getListingMembers,
    getMe,
    getMyFriendIds,
    getMyListings,
    getMyRequests,
    MemberRole,
    removeListingMember,
    updateListing,
} from "../api";
import type { JoinRequest, Listing, ListingMember } from "../api";
import ChatBox from "../components/ChatBox";
import EditListingForm from "../components/EditListingForm";
import JoinEventButton from "../components/JoinEventButton";
import OutlookCalendarButton from "../components/OutlookCalendarButton";
import FriendTag from "../components/FriendTag";
import UserLink from "../components/UserLink";
import { findLocationRoom } from "../map/rooms";
import "../FormLayout.css";
import "./EventPage.css";

// Shortens text to maxLength characters, ending with "…" if it was cut
function truncate(text: string, maxLength: number): string {
    const characters = Array.from(text);  // counts emoji etc. as one character
    return characters.length > maxLength ? `${characters.slice(0, maxLength).join("").trimEnd()}…` : text;
}

function formatDateTime(value: string | null): string {
    if (!value) return "To be confirmed";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "To be confirmed";

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "full",
        timeStyle: "short",
    }).format(date);
}

function useIsPastEvent(event: Listing): boolean {
    const [isPast, setIsPast] = useState(() => {
        const endsAt = new Date(event.endTime ?? event.startTime ?? "").getTime();
        return Number.isFinite(endsAt) && endsAt < Date.now();
    });

    useEffect(() => {
        const endsAt = new Date(event.endTime ?? event.startTime ?? "").getTime();
        let timeoutId: number;

        function refresh() {
            const now = Date.now();
            const eventHasPassed = Number.isFinite(endsAt) && endsAt < now;
            setIsPast(eventHasPassed);

            if (!eventHasPassed && Number.isFinite(endsAt)) {
                timeoutId = window.setTimeout(
                    refresh,
                    Math.min(Math.max(endsAt - now + 50, 0), 2_147_483_647),
                );
            }
        }

        timeoutId = window.setTimeout(refresh, 0);
        return () => window.clearTimeout(timeoutId);
    }, [event.startTime, event.endTime]);

    return isPast;
}

interface EventLoadState {
    listingId: string;
    event?: Listing;
    creatorName?: string;
    members?: ListingMember[];
    membersError?: string;
    isOwner?: boolean;
    // Ids of my accepted friends, for the "Friend" tags
    friendIds?: string[];
    myUserId?: string;
    // Admins (creator or promoted) can edit the event
    isAdmin?: boolean;
    requests?: JoinRequest[];
    requestsError?: string;
    hasJoined?: boolean;
    pending?: boolean;
    error?: string;
}

export default function EventPage() {
    const [searchParams] = useSearchParams();
    const listingId = searchParams.get("id")?.trim() ?? "";
    const [loadState, setLoadState] = useState<EventLoadState>({ listingId: "" });

    useEffect(() => {
        if (!listingId) return;

        let active = true;
        // The membership endpoints resolve the authenticated user's ID on the server.
        // If they fail, the event is still shown, just as if the user hadn't joined or requested.
        Promise.all([
            getListing(listingId),
            getMyListings().catch((): Listing[] => []),
            getMyRequests().catch((): ListingMember[] => []),
            getMe().catch(() => null),
            getMyFriendIds().catch((): string[] => []),
        ])
            .then(async ([event, memberships, requests, user, friendIds]) => {
                if (!active) return;
                const hasJoined = memberships.some((listing) => listing.id === listingId);
                const isOwner = user !== null && event.createdBy?.id === user.id;
                setLoadState({
                    listingId,
                    event,
                    hasJoined,
                    isOwner,
                    friendIds,
                    myUserId: user?.id,
                    pending: requests.some((request) => request.listing.id === listingId),
                    // createdBy is the full user, even if the creator has left the event
                    creatorName: event.createdBy?.fullName.trim() || "Name unavailable",
                });

                const details: Promise<void>[] = [];
                if (hasJoined) details.push(
                    getListingMembers(listingId)
                        .then((allMembers) => {
                            const members = allMembers.filter(
                                (member) => member.role === MemberRole.admin || member.role === MemberRole.member,
                            );
                            const isAdmin = user !== null && members.some(
                                (member) => member.user.id === user.id && member.role === MemberRole.admin,
                            );
                            if (active) setLoadState((current) => ({ ...current, members, isAdmin }));
                        })
                        .catch(() => {
                            if (active) setLoadState((current) => ({
                                ...current,
                                membersError: "Could not load members. Please try refreshing.",
                            }));
                        }),
                );
                if (hasJoined && isOwner) details.push(
                    getJoinRequests(listingId)
                        .then((joiningRequests) => {
                            if (active) setLoadState((current) => ({ ...current, requests: joiningRequests }));
                        })
                        .catch(() => {
                            if (active) setLoadState((current) => ({
                                ...current,
                                requestsError: "Could not load join requests. Please try refreshing.",
                            }));
                        }),
                );
                await Promise.all(details);
            })
            .catch((error: unknown) => {
                if (!active) return;
                const message = error instanceof Error ? error.message : "Unknown error";
                setLoadState({ listingId, error: `Could not load this event: ${message}` });
            });

        return () => {
            active = false;
        };
    }, [listingId]);

    if (!listingId) {
        return <EventPageStatus role="alert">No event id was provided in the URL.</EventPageStatus>;
    }

    if (loadState.listingId !== listingId) {
        return <EventPageStatus role="status">Loading event…</EventPageStatus>;
    }

    if (loadState.error) {
        return <EventPageStatus role="alert">{loadState.error}</EventPageStatus>;
    }

    if (!loadState.event) {
        return <EventPageStatus role="status">Loading event…</EventPageStatus>;
    }

    return <EventPageContent
        event={loadState.event}
        creatorName={loadState.creatorName}
        members={loadState.members}
        membersError={loadState.membersError}
        isOwner={loadState.isOwner === true}
        canEdit={loadState.isOwner === true || loadState.isAdmin === true}
        friendIds={loadState.friendIds ?? []}
        myUserId={loadState.myUserId}
        onMemberRemoved={(userId) => setLoadState((current) => current.listingId !== listingId ? current : {
            ...current,
            members: current.members?.filter(({ user }) => user.id !== userId),
            event: current.event && {
                ...current.event,
                memberIds: current.event.memberIds.filter((id) => id !== userId),
            },
        })}
        requests={loadState.requests}
        requestsError={loadState.requestsError}
        hasJoined={loadState.hasJoined === true}
        pending={loadState.pending === true}
        onUpdated={(updatedEvent) => setLoadState((current) =>
            current.listingId === listingId ? { ...current, event: updatedEvent } : current
        )}
        onRequested={() => setLoadState((current) =>
            current.listingId === listingId ? { ...current, pending: true } : current
        )}
        onRequestDecided={(request, decision) => setLoadState((current) => {
            if (current.listingId !== listingId) return current;
            return {
                ...current,
                requests: current.requests?.filter(({ user }) => user.id !== request.user.id),
                members: decision === "approve" && current.members
                    ? [...current.members, {
                        user: request.user,
                        listing: request.listing,
                        role: MemberRole.member,
                        joinedAt: request.joinedAt,
                    }]
                    : current.members,
            };
        })}
    />;
}

function EventBackButton() {
    const navigate = useNavigate();
    const location = useLocation();

    function goBack() {
        // "default" means this page was opened directly (e.g. a shared link), with no in-app page to go back to
        if (location.key !== "default") {
            navigate(-1);
        } else {
            navigate("/", { replace: true });
        }
    }

    return (
        <button className="event-page__back" type="button" onClick={goBack} aria-label="Go back to the previous page" title="Back">
            <ArrowLeft aria-hidden="true" />
        </button>
    );
}

function EventPageStatus({ children, role }: { children: string; role: "alert" | "status" }) {
    return (
        <main className="form-page event-page">
            <div className="form-container">
                <EventBackButton />
                <p className="form-card" role={role}>{children}</p>
            </div>
        </main>
    );
}

interface EventPageContentProps {
    event: Listing;
    creatorName?: string;
    members?: ListingMember[];
    membersError?: string;
    isOwner: boolean;
    canEdit: boolean;
    friendIds: string[];
    myUserId?: string;
    onMemberRemoved: (userId: string) => void;
    requests?: JoinRequest[];
    requestsError?: string;
    hasJoined: boolean;
    pending: boolean;
    onUpdated: (event: Listing) => void;
    onRequested: () => void;
    onRequestDecided: (request: JoinRequest, decision: RequestDecision) => void;
}

type RequestDecision = "approve" | "decline";

function EventPageContent({
    event,
    creatorName,
    members,
    membersError,
    isOwner,
    canEdit,
    friendIds,
    myUserId,
    onMemberRemoved,
    requests,
    requestsError,
    hasJoined,
    pending,
    onUpdated,
    onRequested,
    onRequestDecided,
}: EventPageContentProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set());
    const [removeError, setRemoveError] = useState("");

    // Admins can remove other members; the backend appoints a new admin if needed
    async function removeMember(userId: string, name: string) {
        if (removingIds.has(userId)) return;
        if (!window.confirm(`Remove ${name.trim() || "this member"} from the event?`)) return;
        setRemovingIds((current) => new Set(current).add(userId));
        setRemoveError("");
        try {
            await removeListingMember(event.id, userId);
            onMemberRemoved(userId);
        } catch (error) {
            setRemoveError(error instanceof Error ? error.message : "Could not remove this member.");
        } finally {
            setRemovingIds((current) => {
                const next = new Set(current);
                next.delete(userId);
                return next;
            });
        }
    }
    const isPast = useIsPastEvent(event);
    const mappedRoom = findLocationRoom(event.location);
    const directionsUrl = mappedRoom
        ? `/map?${new URLSearchParams({ destination: "room", room: mappedRoom }).toString()}`
        : undefined;

    return (
        <main className="form-page event-page">
            <article className="form-container" aria-labelledby="event-title">
                <div className="event-page__header-row">
                    <EventBackButton />
                    <header className="form-page-header event-page__header">
                        <div className="event-page__heading">
                            <p className="form-eyebrow">Study session</p>
                            <div className="event-page__title-row">
                                <h1 id="event-title">{event.description.trim() || "Study event"}</h1>
                                {event.isPrivate && (
                                    <span className="event-page__private" title="Private event" aria-label="Private event">
                                        <LockFill aria-hidden="true" />
                                        <span>Private</span>
                                    </span>
                                )}
                            </div>
                            {isPast && (
                                <p className="event-page__past-subtitle">This event has already ended.</p>
                            )}
                        </div>
                        {canEdit ? (
                            <OwnerEventActions key={event.id} event={event} onTerminated={onUpdated}
                                isEditing={isEditing} onEdit={() => setIsEditing(true)} />
                        ) : !hasJoined && (
                            <JoinEventButton key={event.id} event={event} pending={pending} onRequested={onRequested} />
                        )}
                    </header>
                </div>

                {isEditing && (
                    <EditListingForm
                        key={`edit-${event.id}`}
                        event={event}
                        onSaved={(updatedEvent) => {
                            onUpdated(updatedEvent);
                            setIsEditing(false);
                        }}
                        onCancel={() => setIsEditing(false)}
                    />
                )}
                <section className="form-card event-page__card" aria-label="Event details">
                    <section className="event-page__detail event-page__schedule" aria-label="Schedule">
                        <dl className="event-page__times">
                            <div>
                                <dt><Calendar3 aria-hidden="true" /> Starts</dt>
                                <dd>{formatDateTime(event.startTime)}</dd>
                            </div>
                            <div>
                                <dt><Clock aria-hidden="true" /> Ends</dt>
                                <dd>{formatDateTime(event.endTime)}</dd>
                            </div>
                        </dl>
                        {hasJoined && <OutlookCalendarButton key={event.id} listingId={event.id} />}
                    </section>
                    <dl className="event-page__details">
                        {hasJoined && event.location && (
                            <div className="event-page__detail">
                                <dt><GeoAltFill aria-hidden="true" /> Location</dt>
                                <dd className="event-page__location">
                                    <span>{event.location}</span>
                                    {directionsUrl && (
                                        <Link className="event-page__directions" to={directionsUrl}>
                                            <Map aria-hidden="true" /> Get directions
                                        </Link>
                                    )}
                                </dd>
                            </div>
                        )}
                        {hasJoined && event.createdBy && (
                            <div className="event-page__detail">
                                <dt><PersonCircle aria-hidden="true" /> Created by</dt>
                                <dd><UserLink userId={event.createdBy.id} name={creatorName ?? event.createdBy.fullName} /></dd>
                            </div>
                        )}
                    </dl>

                    {event.courses.length > 0 && (
                        <section className="event-page__section" aria-labelledby="event-courses-heading">
                            <div className="event-page__courses-row">
                                <div className="event-page__courses">
                                    <h2 id="event-courses-heading"><Book aria-hidden="true" /> Courses</h2>
                                    <ul className="event-page__tags">
                                        {event.courses.map((course) => <li key={course}>{course}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </section>
                    )}

                </section>
                {hasJoined && (
                    <section className="form-card event-page__attendance-card" aria-label="Event attendance">
                        <section className="event-page__section" aria-labelledby="event-members-heading">
                            <h2 id="event-members-heading"><PersonCircle aria-hidden="true" /> Members</h2>
                            {membersError ? (
                                <p role="alert">{membersError}</p>
                            ) : members === undefined ? (
                                <p role="status">Loading members…</p>
                            ) : members.length === 0 ? (
                                <p>No accepted members yet.</p>
                            ) : (
                                <ul className="event-page__members" aria-label="Accepted event members">
                                    {members.map(({ user, role }) => (
                                        <li className="event-page__member" key={user.id}>
                                            <span className="event-page__member-name">
                                                <UserLink userId={user.id} name={user.fullName} />
                                            </span>
                                            {friendIds.includes(user.id) && <FriendTag />}
                                            <span className={`event-page__member-role${role === MemberRole.admin ? " event-page__member-role--admin" : ""}`}>
                                                {role === MemberRole.admin ? "Admin" : "Member"}
                                            </span>
                                            {canEdit && user.id !== myUserId && (
                                                <button className="event-page__member-remove" type="button"
                                                    disabled={removingIds.has(user.id)}
                                                    onClick={() => void removeMember(user.id, user.fullName)}
                                                    aria-label={`Remove ${user.fullName.trim() || "member"} from the event`}>
                                                    {removingIds.has(user.id) ? "Removing…" : "Remove"}
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {removeError && <p className="event-page__owner-error" role="alert">{removeError}</p>}
                        </section>
                        {isOwner && (
                            <PendingJoinRequests
                                key={event.id}
                                listingId={event.id}
                                friendIds={friendIds}
                                requests={requests}
                                error={requestsError}
                                onDecided={onRequestDecided}
                            />
                        )}
                    </section>
                )}
                {hasJoined && <ChatBox key={event.id} listingId={event.id} />}
            </article>
        </main>
    );
}

interface OwnerEventActionsProps {
    event: Listing;
    onTerminated: (event: Listing) => void;
    isEditing: boolean;
    onEdit: () => void;
}

function OwnerEventActions({ event, onTerminated, isEditing, onEdit }: OwnerEventActionsProps) {
    const navigate = useNavigate();
    const actionInProgress = useRef(false);
    const [activeAction, setActiveAction] = useState<"terminate" | "delete" | null>(null);
    const [isTerminated, setIsTerminated] = useState(false);
    const [canTerminate, setCanTerminate] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const startsAt = event.startTime === null ? Number.NaN : new Date(event.startTime).getTime();
        const endsAt = event.endTime === null ? Number.NaN : new Date(event.endTime).getTime();
        let timeoutId: number;

        function refreshAvailability() {
            const now = Date.now();
            setCanTerminate(Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= now && now < endsAt);

            const nextBoundary = [startsAt, endsAt]
                .filter((boundary) => Number.isFinite(boundary) && boundary > now)
                .sort((left, right) => left - right)[0];
            if (nextBoundary !== undefined) {
                timeoutId = window.setTimeout(
                    refreshAvailability,
                    Math.min(nextBoundary - now + 50, 2_147_483_647),
                );
            }
        }

        timeoutId = window.setTimeout(refreshAvailability, 0);
        return () => window.clearTimeout(timeoutId);
    }, [event.startTime, event.endTime]);

    async function terminateEvent() {
        if (actionInProgress.current || isTerminated) return;
        if (!window.confirm("Terminate this event now? Its end time will be changed to the current time.")) return;

        actionInProgress.current = true;
        setActiveAction("terminate");
        setError("");
        try {
            const updatedEvent = await updateListing(event.id, { newEndTime: new Date().toISOString() });
            onTerminated(updatedEvent);
            setIsTerminated(true);
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : "Could not terminate the event.");
        } finally {
            actionInProgress.current = false;
            setActiveAction(null);
        }
    }

    async function removeEvent() {
        if (actionInProgress.current) return;
        if (!window.confirm(`Delete “${event.description.trim() || "Study event"}”? This cannot be undone.`)) return;

        actionInProgress.current = true;
        setActiveAction("delete");
        setError("");
        try {
            await deleteListing(event.id);
            navigate("/", { replace: true });
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : "Could not delete the event.");
            actionInProgress.current = false;
            setActiveAction(null);
        }
    }

    return (
        <div className="event-page__owner-controls">
            <div className="event-page__owner-actions" aria-label="Event owner actions">
                {!isEditing && (
                    <button className="event-page__owner-button" type="button"
                        disabled={activeAction !== null} onClick={onEdit}>
                        Edit event
                    </button>
                )}
                {canTerminate && !isTerminated && (
                    <button className="event-page__owner-button" type="button"
                        disabled={activeAction !== null} onClick={() => void terminateEvent()}>
                        {activeAction === "terminate" ? "Terminating…" : "Terminate event"}
                    </button>
                )}
                <button className="event-page__owner-button event-page__owner-button--delete" type="button"
                    disabled={activeAction !== null} onClick={() => void removeEvent()}>
                    {activeAction === "delete" ? "Deleting…" : "Delete event"}
                </button>
            </div>
            {error && <p className="event-page__owner-error" role="alert">{error}</p>}
        </div>
    );
}

interface PendingJoinRequestsProps {
    listingId: string;
    friendIds: string[];
    requests?: JoinRequest[];
    error?: string;
    onDecided: (request: JoinRequest, decision: RequestDecision) => void;
}

function PendingJoinRequests({ listingId, friendIds, requests, error, onDecided }: PendingJoinRequestsProps) {
    const deciding = useRef(new Set<string>());
    const [activeUserIds, setActiveUserIds] = useState<Set<string>>(() => new Set());
    const [requestErrors, setRequestErrors] = useState<Record<string, string>>({});

    async function decide(request: JoinRequest, decision: RequestDecision) {
        const userId = request.user.id;
        if (deciding.current.has(userId)) return;

        deciding.current.add(userId);
        setActiveUserIds((current) => new Set(current).add(userId));
        setRequestErrors((current) => {
            const next = { ...current };
            delete next[userId];
            return next;
        });

        try {
            if (decision === "approve") {
                await approveListingRequest(listingId, userId);
            } else {
                await declineListingRequest(listingId, userId);
            }
            onDecided(request, decision);
        } catch {
            setRequestErrors((current) => ({
                ...current,
                [userId]: `Could not ${decision === "approve" ? "approve" : "refuse"} this request. Please try again.`,
            }));
        } finally {
            deciding.current.delete(userId);
            setActiveUserIds((current) => {
                const next = new Set(current);
                next.delete(userId);
                return next;
            });
        }
    }

    return (
        <section className="event-page__section" aria-labelledby="event-requests-heading">
            <h2 id="event-requests-heading"><PersonCircle aria-hidden="true" /> Join requests</h2>
            {error ? (
                <p role="alert">{error}</p>
            ) : requests === undefined ? (
                <p role="status">Loading join requests…</p>
            ) : requests.length === 0 ? (
                <p>No pending join requests.</p>
            ) : (
                <div className="event-page__table-scroll">
                    <table className="event-page__attendance-table">
                        <caption className="event-page__table-caption">
                            {requests.length} pending {requests.length === 1 ? "request" : "requests"}
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col">Requester</th>
                                <th scope="col">Message</th>
                                <th scope="col">Requested</th>
                                <th scope="col">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map((request) => {
                                const userId = request.user.id;
                                const isDeciding = activeUserIds.has(userId);
                                return (
                                    <tr key={userId}>
                                        <td>
                                            <span className="event-page__requester-name">
                                                <UserLink userId={request.user.id} name={request.user.fullName} />
                                                {friendIds.includes(request.user.id) && <FriendTag />}
                                            </span>
                                            {request.user.description.trim() && (
                                                <span className="event-page__requester-description"
                                                    title={request.user.description.trim()}>
                                                    {truncate(request.user.description.trim(), 50)}
                                                </span>
                                            )}
                                        </td>
                                        <td>{request.requestReason.trim() || "No message provided."}</td>
                                        <td>{formatDateTime(request.joinedAt)}</td>
                                        <td>
                                            <div className="event-page__attendance-actions">
                                                <button type="button" disabled={isDeciding}
                                                    onClick={() => void decide(request, "approve")}>
                                                    {isDeciding ? "Working…" : "Allow"}
                                                </button>
                                                <button className="event-page__request-refuse" type="button" disabled={isDeciding}
                                                    onClick={() => void decide(request, "decline")}>
                                                    Refuse
                                                </button>
                                            </div>
                                            {requestErrors[userId] && (
                                                <p className="event-page__request-error" role="alert">
                                                    {requestErrors[userId]}
                                                </p>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
