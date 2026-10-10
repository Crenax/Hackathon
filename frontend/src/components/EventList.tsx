import { Trash3 } from "react-bootstrap-icons";
import { Link } from "react-router-dom";

import type { Listing } from "../api";
import "./EventList.css";

export interface EventListProps {
    events: Listing[];
    emptyMessage?: string;
    getStatusLabel?: (event: Listing) => string | undefined;
    onDelete?: (event: Listing) => void;
}

export default function EventList({
    events,
    emptyMessage = "No events found.",
    getStatusLabel,
    onDelete,
}: EventListProps) {
    if (events.length === 0) {
        return <p className="event-empty">{emptyMessage}</p>;
    }

    return (
        <div className="event-list">
            {events.map((event) => {
                const eventDate = new Date(event.startTime ?? "");
                const hasValidDate = !Number.isNaN(eventDate.getTime());
                const statusLabel = getStatusLabel?.(event);
                const eventTime = hasValidDate
                    ? eventDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                    : "Time TBD";

                return (
                    <article className="event-item" key={event.id}>
                        <Link
                            className="event-item__link"
                            to={`/event?id=${encodeURIComponent(event.id)}`}
                            aria-label={`Open ${event.subject}`}
                        >
                            <div className="event-date-badge">
                                <span>{hasValidDate ? eventDate.toLocaleDateString(undefined, { month: "short" }) : "TBD"}</span>
                                <strong>{hasValidDate ? eventDate.getDate() : "—"}</strong>
                            </div>
                            <div className="event-details">
                                <div className="event-title-row">
                                    <h3>{event.subject}</h3>
                                    {statusLabel && <span className="event-status">{statusLabel}</span>}
                                </div>
                                <p className="event-meta">{eventTime} | {event.location}</p>
                                {event.description && <p className="event-description">{event.description}</p>}
                            </div>
                        </Link>

                        {onDelete && (
                            <button
                                className="event-delete"
                                type="button"
                                onClick={() => onDelete(event)}
                                aria-label={`Delete ${event.subject}`}
                            >
                                <Trash3 aria-hidden="true" />
                            </button>
                        )}
                    </article>
                );
            })}
        </div>
    );
}
