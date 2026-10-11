import { useEffect, useMemo, useState } from "react";

import { type Listing, getListings } from "../api";
import EventList from "../components/EventList";
import { compareEventsFutureToPast } from "../eventSorting";
import "../FormLayout.css";
import "./HomePage.css";



const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;


function eventEndTimestamp(event: Listing): number | undefined {
    const timestamp = new Date(event.endTime ?? event.startTime ?? "").getTime();
    return Number.isNaN(timestamp) ? undefined : timestamp;
}

function isPastEvent(event: Listing, referenceTime: number): boolean {
    const endsAt = eventEndTimestamp(event);
    return endsAt !== undefined && endsAt < referenceTime;
}


function sortListings(listings: Listing[]): Listing[] {
    return [...listings].sort(compareEventsFutureToPast);
}









export default function HomePage() {
    const [events, setEvents] = useState<Listing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [referenceTime, setReferenceTime] = useState(() => Date.now());



    useEffect(() => {
        let isActive = true;

        getListings()
            .then((publishedEvents) => {
                if (isActive) {
                    setEvents(sortListings(publishedEvents));
                    setLoadError("");
                }
            })
            .catch((error: unknown) => {
                if (isActive) {
                    setLoadError(error instanceof Error ? error.message : "Could not load published events.");
                }
            })
            .finally(() => {
                if (isActive) {
                    setIsLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, []);


    useEffect(() => {
        const timer = window.setInterval(() => setReferenceTime(Date.now()), 60 * 1000);
        return () => window.clearInterval(timer);
    }, []);



    const visibleEvents = useMemo(() => events.filter((event) => {
        const endsAt = eventEndTimestamp(event);
        return endsAt === undefined || endsAt >= referenceTime - ONE_DAY_IN_MILLISECONDS;
    }), [events, referenceTime]);


    


    return (
        <main className="form-page">
            <div className="form-container">
                <header className="form-page-header">
                    <p className="form-eyebrow">Study sessions</p>
                    <div className="form-heading-row">
                        <div>
                            <h1 id="upcoming-events-heading">Upcoming events</h1>
                            <p className="form-page-description">Find your next study session or create a new one.</p>
                        </div>
                        <button className="form-primary-button" type="button" onClick={() => (window.location.href = "/create-event")} aria-label="Create a study event">
                            Add Event
                        </button>
                    </div>
                </header>

                <section className="form-card" aria-labelledby="upcoming-events-heading">
                    <div className="form-section-header">
                        <h2>Events</h2>
                        <span className="event-count">{visibleEvents.length}</span>
                    </div>

                    <EventList
                        events={visibleEvents}
                        emptyMessage={isLoading ? "Loading events…" : loadError || "No upcoming or recently ended events. You can create one!"}
                        getStatusLabel={(event) => isPastEvent(event, referenceTime) ? "Past" : undefined}
                        isDimmed={(event) => isPastEvent(event, referenceTime)}
                    />
                </section>
            </div>
        </main>
    );
}