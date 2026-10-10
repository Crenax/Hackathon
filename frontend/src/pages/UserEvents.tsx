import { useEffect, useMemo, useState } from "react";

import {
    getMe,
    getMyListings,
    getMyRequests,
    type Listing,
} from "../api";
import EventList from "../components/EventList";
import "../FormLayout.css";
import "./EventsList.css";
import "./UserEvents.css";

type EventRelationship = "Published" | "Joined" | "Requested";

interface UserEvent {
    listing: Listing;
    relationship: EventRelationship;
}

function validTimestamp(value: string | null): number | undefined {
    if (!value) return undefined;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? undefined : timestamp;
}

function eventEndTimestamp(event: Listing): number | undefined {
    return validTimestamp(event.endTime) ?? validTimestamp(event.startTime);
}

function eventStartTimestamp(event: Listing): number {
    return validTimestamp(event.startTime) ?? Number.POSITIVE_INFINITY;
}

export default function UserEvents() {
    const [events, setEvents] = useState<UserEvent[]>([]);
    const [referenceTime, setReferenceTime] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        let isActive = true;

        Promise.all([getMe(), getMyListings(), getMyRequests()])
            .then(([user, memberships, requests]) => {
                if (!isActive) return;

                const userEvents = new Map<string, UserEvent>();
                memberships.forEach((listing) => {
                    userEvents.set(listing.id, {
                        listing,
                        relationship: listing.createdBy === user.id ? "Published" : "Joined",
                    });
                });
                requests.forEach(({ listing }) => {
                    if (!userEvents.has(listing.id)) {
                        userEvents.set(listing.id, { listing, relationship: "Requested" });
                    }
                });

                setEvents([...userEvents.values()]);
                setReferenceTime(Date.now());
                setLoadError("");
            })
            .catch((error: unknown) => {
                if (isActive) {
                    setLoadError(error instanceof Error ? error.message : "Could not load your events.");
                }
            })
            .finally(() => {
                if (isActive) setIsLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, []);

    const { currentEvents, pastEvents, relationships } = useMemo(() => {
        const current: UserEvent[] = [];
        const past: UserEvent[] = [];
        const labels = new Map<string, EventRelationship>();

        events.forEach((event) => {
            labels.set(event.listing.id, event.relationship);
            const endsAt = eventEndTimestamp(event.listing);
            if (endsAt !== undefined && endsAt < referenceTime) {
                past.push(event);
            } else {
                current.push(event);
            }
        });

        current.sort((a, b) => eventStartTimestamp(a.listing) - eventStartTimestamp(b.listing));
        past.sort((a, b) => (eventEndTimestamp(b.listing) ?? 0) - (eventEndTimestamp(a.listing) ?? 0));

        return {
            currentEvents: current.map(({ listing }) => listing),
            pastEvents: past.map(({ listing }) => listing),
            relationships: labels,
        };
    }, [events, referenceTime]);

    const getStatusLabel = (event: Listing) => relationships.get(event.id);

    return (
        <main className="form-page user-events-page">
            <div className="form-container">
                <header className="form-page-header">
                    <p className="form-eyebrow">Study sessions</p>
                    <h1>My events</h1>
                    <p className="form-page-description">
                        Events you published, joined, or requested to join.
                    </p>
                </header>

                {isLoading ? (
                    <p className="form-card user-events-message" role="status">Loading your events…</p>
                ) : loadError ? (
                    <p className="form-card user-events-message user-events-message--error" role="alert">
                        Could not load your events: {loadError}
                    </p>
                ) : (
                    <>
                        <section className="form-card" aria-labelledby="current-events-heading">
                            <div className="form-section-header">
                                <h2 id="current-events-heading">Current and upcoming</h2>
                                <span className="event-count">{currentEvents.length}</span>
                            </div>
                            <EventList
                                events={currentEvents}
                                emptyMessage="You have no current or upcoming events."
                                getStatusLabel={getStatusLabel}
                            />
                        </section>

                        <section className="form-card" aria-labelledby="past-events-heading">
                            <div className="form-section-header">
                                <h2 id="past-events-heading">Past events</h2>
                                <span className="event-count">{pastEvents.length}</span>
                            </div>
                            <EventList
                                events={pastEvents}
                                emptyMessage="You have no past events."
                                getStatusLabel={getStatusLabel}
                            />
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
