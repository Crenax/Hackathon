import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    Book,
    Calendar3,
    Clock,
    GeoAltFill,
    LockFill,
    PersonCircle,
} from "react-bootstrap-icons";

import { getListing, getListingMembers, getMyListings, getMyRequests, MemberRole } from "../api";
import type { Listing, ListingMember } from "../api";
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
        Promise.all([getListing(listingId), getMyListings(), getMyRequests()])
            .then(async ([event, memberships, requests]) => {
                if (!active) return;
                const hasJoined = memberships.some((listing) => listing.id === listingId);
                setLoadState({
                    listingId,
                    event,
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
                                ? `${creator.firstName} ${creator.lastName}`.trim() || "Name unavailable"
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

function EventPageStatus({ children, role }: { children: string; role: "alert" | "status" }) {
    return (
        <main className="form-page event-page">
            <div className="form-container">
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
}

function EventPageContent({ event, creatorName, members, membersError, hasJoined, pending, onRequested }: EventPageContentProps) {
    return (
        <main className="form-page event-page">
            <article className="form-container" aria-labelledby="event-title">
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

                <section className="form-card event-page__card" aria-label="Event details">
                    <dl className="event-page__details">
                        <div className="event-page__detail">
                            <dt><Calendar3 aria-hidden="true" /> Starts</dt>
                            <dd>{formatDateTime(event.startTime)}</dd>
                        </div>
                        <div className="event-page__detail">
                            <dt><Clock aria-hidden="true" /> Ends</dt>
                            <dd>{formatDateTime(event.endTime)}</dd>
                        </div>
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
                    {hasJoined && (
                        <section className="event-page__section" aria-label="Calendar">
                            <OutlookCalendarButton key={event.id} listingId={event.id} />
                        </section>
                    )}

                </section>
                {hasJoined && (
                    <section className="form-card event-page__section" aria-labelledby="event-members-heading">
                        <h2 id="event-members-heading"><PersonCircle aria-hidden="true" /> Members</h2>
                        {membersError ? (
                            <p role="alert">{membersError}</p>
                        ) : members === undefined ? (
                            <p role="status">Loading members…</p>
                        ) : members.length === 0 ? (
                            <p>No accepted members yet.</p>
                        ) : (
                            <div className="event-page__member-groups">
                                {[MemberRole.admin, MemberRole.member].map((groupRole) => {
                                    const group = members.filter(({ role }) => role === groupRole);
                                    if (group.length === 0) return null;
                                    return (
                                        <ul className="event-page__members" key={groupRole}
                                            aria-label={groupRole === MemberRole.admin ? "Admins" : "Members"}>
                                            {group.map(({ user, role }) => (
                                                <li className="event-page__member" key={user.id}>
                                                    <span className="event-page__member-name">
                                                        {`${user.firstName} ${user.lastName}`.trim() || "Name unavailable"}
                                                    </span>
                                                    <span className={`event-page__member-role${role === MemberRole.admin ? " event-page__member-role--admin" : ""}`}>
                                                        {role === MemberRole.admin ? "Admin" : "Member"}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}
                {hasJoined && <ChatBox key={event.id} listingId={event.id} />}
            </article>
        </main>
    );
}
