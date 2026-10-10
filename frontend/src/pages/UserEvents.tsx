import { useEffect, useMemo, useState } from "react";

import {
    getMe,
    getMyListings,
    getMyRequests,
    type Listing,
} from "../api";
import EventList from "../components/EventList";
import { compareEventsFutureToPast } from "../eventSorting";
import "../FormLayout.css";
import "./EventsList.css";
import "./UserEvents.css";

type EventRelationship = "Published" | "Joined" | "Requested";

interface UserEvent {
    listing: Listing;
    relationship: EventRelationship;
}

export default function UserEvents() {
    const [events, setEvents] = useState<UserEvent[]>([]);
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
                        relationship: listing.createdBy?.id === user.id ? "Published" : "Joined",
                    });
                });
                requests.forEach(({ listing }) => {
                    if (!userEvents.has(listing.id)) {
                        userEvents.set(listing.id, { listing, relationship: "Requested" });
                    }
                });

                setEvents([...userEvents.values()]);
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

    const { membershipEvents, requestedEvents, relationships } = useMemo(() => {
        const memberships: UserEvent[] = [];
        const requests: UserEvent[] = [];
        const labels = new Map<string, EventRelationship>();

        events.forEach((event) => {
            labels.set(event.listing.id, event.relationship);
            if (event.relationship === "Requested") {
                requests.push(event);
            } else {
                memberships.push(event);
            }
        });

        memberships.sort((a, b) => compareEventsFutureToPast(a.listing, b.listing));
        requests.sort((a, b) => compareEventsFutureToPast(a.listing, b.listing));

        return {
            membershipEvents: memberships.map(({ listing }) => listing),
            requestedEvents: requests.map(({ listing }) => listing),
            relationships: labels,
        };
    }, [events]);

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
                        <section className="form-card" aria-labelledby="membership-events-heading">
                            <div className="form-section-header">
                                <h2 id="membership-events-heading">Published and joined events</h2>
                                <span className="event-count">{membershipEvents.length}</span>
                            </div>
                            <EventList
                                events={membershipEvents}
                                emptyMessage="You have not published or joined any events."
                                getStatusLabel={getStatusLabel}
                            />
                        </section>

                        <section className="form-card" aria-labelledby="requested-events-heading">
                            <div className="form-section-header">
                                <h2 id="requested-events-heading">Requested to join</h2>
                                <span className="event-count">{requestedEvents.length}</span>
                            </div>
                            <EventList
                                events={requestedEvents}
                                emptyMessage="You have no pending join requests."
                                getStatusLabel={getStatusLabel}
                            />
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
