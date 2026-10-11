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
    declineListingRequest,
    getJoinRequests,
    getListing,
    getListingMembers,
    getMe,
    getMyListings,
    getMyRequests,
    MemberRole,
} from "../api";
import type { JoinRequest, Listing, ListingMember } from "../api";
import ChatBox from "../components/ChatBox";
import JoinEventButton from "../components/JoinEventButton";
import OutlookCalendarButton from "../components/OutlookCalendarButton";
import { findLocationRoom } from "../map/rooms";
import "../FormLayout.css";
import "./EventPage.css";

function formatDateTime(value: string | null): string {
    if (!value) return "To be confirmed";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "To be confirmed";

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "full",
        timeStyle: "short",
    }).format(date);
}

interface EventLoadState {
    listingId: string;
    event?: Listing;
    creatorName?: string;
    members?: ListingMember[];
    membersError?: string;
    isOwner?: boolean;
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
        ])
            .then(async ([event, memberships, requests, user]) => {
                if (!active) return;
                const hasJoined = memberships.some((listing) => listing.id === listingId);
                const isOwner = user !== null && event.createdBy?.id === user.id;
                setLoadState({
                    listingId,
                    event,
                    hasJoined,
                    isOwner,
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
                            if (active) setLoadState((current) => ({ ...current, members }));
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
        requests={loadState.requests}
        requestsError={loadState.requestsError}
        hasJoined={loadState.hasJoined === true}
        pending={loadState.pending === true}
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
    requests?: JoinRequest[];
    requestsError?: string;
    hasJoined: boolean;
    pending: boolean;
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
    requests,
    requestsError,
    hasJoined,
    pending,
    onRequested,
    onRequestDecided,
}: EventPageContentProps) {
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
                        </div>
                        {!hasJoined && <JoinEventButton key={event.id} event={event} pending={pending} onRequested={onRequested} />}
                    </header>
                </div>

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
                                <dd>{creatorName ?? "Loading name…"}</dd>
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
                                                {user.fullName.trim() || "Name unavailable"}
                                            </span>
                                            <span className={`event-page__member-role${role === MemberRole.admin ? " event-page__member-role--admin" : ""}`}>
                                                {role === MemberRole.admin ? "Admin" : "Member"}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                        {isOwner && (
                            <PendingJoinRequests
                                key={event.id}
                                listingId={event.id}
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

interface PendingJoinRequestsProps {
    listingId: string;
    requests?: JoinRequest[];
    error?: string;
    onDecided: (request: JoinRequest, decision: RequestDecision) => void;
}

function PendingJoinRequests({ listingId, requests, error, onDecided }: PendingJoinRequestsProps) {
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
                                                {request.user.fullName.trim() || "Name unavailable"}
                                            </span>
                                            {request.user.description.trim() && (
                                                <span className="event-page__requester-description">
                                                    {request.user.description.trim()}
                                                </span>
                                            )}
                                        </td>
                                        <td>{request.message.trim() || "No message provided."}</td>
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
