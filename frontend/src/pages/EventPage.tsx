import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    ArrowLeft,
    Book,
    Calendar3,
    Clock,
    GeoAltFill,
    LockFill,
    PersonCircle,
} from "react-bootstrap-icons";

import { getListing, getListingMembers, getMyListings, getMyRequests, getMe, getPendingRequestProfile, MemberRole } from "../api";
import type { Listing, ListingMember, User } from "../api";
import ChatBox from "../components/ChatBox";
import JoinEventButton from "../components/JoinEventButton";
import OutlookCalendarButton from "../components/OutlookCalendarButton";
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
    currentUserId?: string;
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
        // Both /me endpoints resolve the authenticated user's ID on the server.
        Promise.all([getListing(listingId), getMyListings(), getMyRequests(), getMe()])
            .then(async ([event, memberships, requests, me]) => {
                if (!active) return;
                const hasJoined = memberships.some((listing) => listing.id === listingId);
                setLoadState({
                    listingId,
                    event,
                    currentUserId: me.id,
                    hasJoined,
                    pending: requests.some((request) => request.listing.id === listingId),
                });

                if (hasJoined) {
                    try {
                        const members = (await getListingMembers(listingId)).filter(
                            (member) => member.role === MemberRole.admin || member.role === MemberRole.member,
                        );
                        const creator = members.find((member) => member.user.id === event.createdBy?.id)?.user;
                        if (active) setLoadState((current) => ({
                            ...current,
                            members,
                            creatorName: creator
                                ? creator.fullName.trim() || "Name unavailable"
                                : "Name unavailable",
                        }));
                    } catch {
                        if (active) setLoadState((current) => ({
                            ...current,
                            creatorName: "Name unavailable",
                            membersError: "Could not load members. Please try refreshing.",
                        }));
                    }
                }
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
        key={listingId}
        currentUserId={loadState.currentUserId}
        creatorName={loadState.creatorName}
        members={loadState.members}
        membersError={loadState.membersError}
        hasJoined={loadState.hasJoined === true}
        pending={loadState.pending === true}
        onRequested={() => setLoadState((current) =>
            current.listingId === listingId ? { ...current, pending: true } : current
        )}
    />;
}

function EventBackButton() {
    const navigate = useNavigate();

    function goBack() {
        if (window.history.length > 1) {
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
    hasJoined: boolean;
    pending: boolean;
    onRequested: () => void;
    currentUserId?: string;
}

function EventPageContent({ event, creatorName, members, membersError, hasJoined, pending, onRequested, currentUserId }: EventPageContentProps) {
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
                                <dd>{event.location}</dd>
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
                <Attendance event={event} members={members} membersError={membersError}
                    hasJoined={hasJoined} currentUserId={currentUserId} />
                {hasJoined && <ChatBox key={event.id} listingId={event.id} />}
            </article>
        </main>
    );
}

function displayValue(value: string | null) {
    if (!value) return "Not provided";
    if (value === "phd") return "PhD";
    return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function attendanceRequest<T>(eventId: string, path: string, method = "GET"): Promise<T> {
    const response = await fetch(`/api/listings/${encodeURIComponent(eventId)}/${path}`, { method });
    if (!response.ok) throw new Error(`Request failed (${response.status}). Please try again.`);
    return response.status === 204 ? undefined as T : response.json();
}

function Attendance({ event, members, membersError, hasJoined, currentUserId }: {
    event: Listing;
    members?: ListingMember[];
    membersError?: string;
    hasJoined: boolean;
    currentUserId?: string;
}) {
    const [previewUserId, setPreviewUserId] = useState<string | null>(null);
    const [updatedMembers, setUpdatedMembers] = useState<ListingMember[]>();
    const [requests, setRequests] = useState<ListingMember[]>();
    const [requestsError, setRequestsError] = useState("");
    const [actionError, setActionError] = useState("");
    const [busy, setBusy] = useState(false);
    const attendees = updatedMembers ?? members;
    const isAdmin = attendees?.some(({ user, role }) => user.id === currentUserId && role === MemberRole.admin) === true;

    useEffect(() => {
        if (!isAdmin) return;
        let active = true;
        attendanceRequest<ListingMember[]>(event.id, "requests")
            .then((items) => { if (active) { setRequests(items); setRequestsError(""); } })
            .catch(() => { if (active) setRequestsError("Could not load pending requests. Please refresh to try again."); });
        return () => { active = false; };
    }, [event.id, isAdmin]);

    async function act(member: ListingMember, action: "accept" | "deny" | "remove") {
        if (busy || !isAdmin || member.user.id === currentUserId) return;
        setBusy(true);
        setActionError("");
        try {
            const id = encodeURIComponent(member.user.id);
            await attendanceRequest<void>(event.id,
                action === "accept" ? `requests/${id}/approve` : `members/${id}`,
                action === "accept" ? "POST" : "DELETE");
            if (action === "accept") {
                setUpdatedMembers((previous) => [...(previous ?? members ?? []), { ...member, role: MemberRole.member }]);
            } else if (action === "remove") {
                setUpdatedMembers((previous) => (previous ?? members ?? []).filter(({ user }) => user.id !== member.user.id));
            }
            if (action !== "remove") setRequests((previous) => previous?.filter(({ user }) => user.id !== member.user.id));
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "Could not complete the action. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    function table(items: ListingMember[], pendingRequests = false) {
        return <div className="event-page__table-scroll">
            <table className="event-page__attendance-table">
                <caption className="event-page__table-caption">{pendingRequests ? "People requesting to join" : "People attending this event"}</caption>
                <thead><tr><th scope="col">First name</th><th scope="col">Last name</th><th scope="col">Major</th><th scope="col">Degree</th>
                    {isAdmin && <th scope="col">Actions</th>}
                </tr></thead>
                <tbody>{items.map((member) => {
                    const [firstName, ...lastName] = member.user.fullName.trim().split(/\s+/);
                    return <tr key={member.user.id}
                        className={pendingRequests ? "event-page__request-row" : undefined}
                        onClick={pendingRequests ? () => setPreviewUserId(member.user.id) : undefined}>
                        <td>{pendingRequests ? <button type="button" className="event-page__profile-link"
                            onClick={(event) => { event.stopPropagation(); setPreviewUserId(member.user.id); }}
                            aria-label={`Preview profile of ${member.user.fullName || "requesting user"}`}>
                            {firstName || "Not provided"}</button> : firstName || "Not provided"}</td><td>{lastName.join(" ") || "Not provided"}</td>
                        <td>{displayValue(member.user.major)}</td><td>{displayValue(member.user.degree)}</td>
                        {isAdmin && <td onClick={(event) => event.stopPropagation()}><div className="event-page__attendance-actions">
                            {member.user.id === currentUserId ? <span aria-label="No actions available">—</span> : pendingRequests ? <>
                                <button type="button" disabled={busy} onClick={() => void act(member, "accept")}>Accept</button>
                                <button type="button" disabled={busy} onClick={() => void act(member, "deny")}>Deny</button>
                            </> : <button type="button" disabled={busy} onClick={() => void act(member, "remove")}>Remove</button>}
                        </div></td>}
                    </tr>;
                })}</tbody>
            </table>
        </div>;
    }

    return <section className="form-card event-page__section" aria-labelledby="event-members-heading" aria-busy={busy}>
        <h2 id="event-members-heading"><PersonCircle aria-hidden="true" /> Attendance</h2>
        <p aria-live="polite">{attendees?.length ?? event.memberIds.length} people attending</p>
        {hasJoined && (membersError ? <p role="alert">{membersError}</p>
            : attendees === undefined ? <p role="status">Loading attendees…</p>
            : attendees.length === 0 ? <p>No attendees yet.</p> : table(attendees))}
        {isAdmin && <section className="event-page__pending" aria-labelledby="event-requests-heading">
            <h2 id="event-requests-heading">Pending requests</h2>
            {requestsError ? <p role="alert">{requestsError}</p> : requests === undefined ? <p role="status">Loading requests…</p>
                : requests.length === 0 ? <p>No pending requests.</p> : table(requests, true)}
        </section>}
        {actionError && <p role="alert">{actionError}</p>}
        {previewUserId && <ProfilePreview key={previewUserId} listingId={event.id} userId={previewUserId}
            onClose={() => setPreviewUserId(null)} /> }
    </section>;
}

function ProfilePreview({ listingId, userId, onClose }: {
    listingId: string; userId: string; onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [profile, setProfile] = useState<User>();
    const [error, setError] = useState("");

    useEffect(() => {
        const element = dialog.current;
        const previousFocus = document.activeElement;
        element?.showModal();
        let active = true;
        getPendingRequestProfile(listingId, userId)
            .then((user) => { if (active) setProfile(user); })
            .catch(() => { if (active) setError("Could not load this profile. The request may no longer be pending. Close and try again."); });
        return () => {
            active = false;
            element?.close();
            if (previousFocus instanceof HTMLElement) previousFocus.focus();
        };
    }, [listingId, userId]);

    return <dialog ref={dialog} className="event-page__profile-preview" aria-labelledby="profile-preview-title"
        onCancel={(event) => { event.preventDefault(); onClose(); }}>
        <div className="event-page__profile-header">
            <h2 id="profile-preview-title">Profile overview</h2>
            <button type="button" onClick={onClose} autoFocus>Close</button>
        </div>
        {error ? <p role="alert">{error}</p> : !profile ? <p role="status">Loading profile…</p> : <>
            <h3>{profile.fullName.trim() || "Name unavailable"}</h3>
            <dl>
                <dt>Email</dt><dd>{profile.emailAddress || "Not provided"}</dd>
                <dt>Major</dt><dd>{displayValue(profile.major)}</dd>
                <dt>Degree</dt><dd>{displayValue(profile.degree)}</dd>
                <dt>Gender</dt><dd>{displayValue(profile.gender)}</dd>
                <dt>Date of birth</dt><dd>{profile.dateOfBirth || "Not provided"}</dd>
            </dl>
            <h4>About</h4><p className="event-page__profile-description">{profile.description.trim() || "No description provided."}</p>
        </>}
    </dialog>;
}
