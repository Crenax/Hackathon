import { Link } from "react-router-dom";

import type { Listing } from "../api";
import { getEventTitle } from "../eventTitle";
import "./EventList.css";

export interface EventListProps {
    events: Listing[];
    emptyMessage?: string;
    getStatusLabel?: (event: Listing) => string | undefined;
    isDimmed?: (event: Listing) => boolean;
}

export default function EventList({
    events,
    emptyMessage = "No events found.",
    getStatusLabel,
    isDimmed,
}: EventListProps) {
    if (events.length === 0) {
        return <p className="event-empty">{emptyMessage}</p>;
    }

    return (
        <div className="event-list">
            {events.map((event) => {
                const eventTitle = getEventTitle(event.courses);
                const eventDate = new Date(event.startTime ?? "");
                const hasValidDate = !Number.isNaN(eventDate.getTime());
                const statusLabel = getStatusLabel?.(event);
                const eventTime = hasValidDate
                    ? eventDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                    : "Time TBD";

                return (
                    <article className={`event-item${isDimmed?.(event) ? " event-item--dimmed" : ""}`} key={event.id}>
                        <Link
                            className="event-item__link"
                            to={`/event?id=${encodeURIComponent(event.id)}`}
                            aria-label={`Open ${eventTitle}`}
                        >
                            <div className="event-date-badge">
                                <span>{hasValidDate ? eventDate.toLocaleDateString(undefined, { month: "short" }) : "TBD"}</span>
                                <strong>{hasValidDate ? eventDate.getDate() : "—"}</strong>
                            </div>
                            <div className="event-details">
                                <div className="event-title-row">
                                    <h3>{eventTitle}</h3>
                                    {statusLabel && <span className="event-status">{statusLabel}</span>}
                                </div>
                                <p className="event-meta">{eventTime} | {event.location}</p>
                                {event.description && <p className="event-description">{event.description}</p>}
                            </div>
                        </Link>
                    </article>
                );
            })}
        </div>
    );
}
