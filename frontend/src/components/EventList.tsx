import { Link } from "react-router-dom";

import type { Listing } from "../api";
import { compareEventsFutureToPast } from "../eventSorting";
import { formatEventSchedule } from "../eventSchedule";
import { localDayTimestamp, useScrollToToday } from "../useScrollToToday";
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
    const sortedEvents = [...events].sort(compareEventsFutureToPast);
    const eventSequence = sortedEvents.map((event) => `${event.id}:${event.startTime ?? ""}`).join("|");
    const listRef = useScrollToToday(eventSequence);

    if (events.length === 0) {
        return <p className="event-empty">{emptyMessage}</p>;
    }

    return (
        <div className="event-list" ref={listRef} tabIndex={0}>
            {sortedEvents.map((event) => {
                const eventTitle = event.description.trim() || "Study event";
                const eventDate = new Date(event.startTime ?? "");
                const hasValidDate = !Number.isNaN(eventDate.getTime());
                const statusLabel = getStatusLabel?.(event);

                return (
                    <article
                        className={`event-item${isDimmed?.(event) ? " event-item--dimmed" : ""}`}
                        data-event-day={hasValidDate ? localDayTimestamp(eventDate) : undefined}
                        key={event.id}
                    >
                        <Link
                            className="event-item__link"
                            to={`/event?id=${encodeURIComponent(event.id)}`}
                            aria-label={`Open ${eventTitle}`}
                        >
                            <div className="event-details">
                                <div className="event-title-row">
                                    <h3>{eventTitle}</h3>
                                    {statusLabel && <span className="event-status">{statusLabel}</span>}
                                </div>
                                {event.courses.length > 0 && (
                                    <div className="event-course-viewport">
                                        <ul className="event-course-tags" aria-label="Courses">
                                            {event.courses.map((course) => <li key={course}>{course}</li>)}
                                        </ul>
                                    </div>
                                )}
                                <p className="event-location">{event.location?.trim() || "Location to be confirmed"}</p>
                                <p className="event-schedule">{formatEventSchedule(event.startTime, event.endTime)}</p>
                            </div>
                        </Link>
                    </article>
                );
            })}
        </div>
    );
}
