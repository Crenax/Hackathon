import {
    Book,
    Calendar3,
    Clock,
    Funnel,
    GeoAltFill,
    LockFill,
    PersonCircle,
} from "react-bootstrap-icons";

import type { Listing } from "../api";
import "../FormLayout.css";
import "./EventPage.css";

export interface EventPageProps {
    /** The listing returned by the API. */
    event: Listing;
    /** Set this only for approved members, never pending join requests. */
    hasJoined?: boolean;
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

export default function EventPage({ event, hasJoined = false }: EventPageProps) {
    return (
        <main className="form-page event-page">
            <article className="form-container" aria-labelledby="event-title">
                <header className="form-page-header">
                    <p className="form-eyebrow">Study session</p>
                    <div className="event-page__title-row">
                        <h1 id="event-title">{event.subject}</h1>
                        {event.isPrivate && (
                            <span className="event-page__private" title="Private event" aria-label="Private event">
                                <LockFill aria-hidden="true" />
                                <span>Private</span>
                            </span>
                        )}
                    </div>
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
                                <dd>{event.createdBy}</dd>
                            </div>
                        )}
                    </dl>

                    {event.description && (
                        <section className="event-page__section" aria-labelledby="event-description-heading">
                            <h2 id="event-description-heading">About this session</h2>
                            <p>{event.description}</p>
                        </section>
                    )}

                    {event.courses.length > 0 && (
                        <section className="event-page__section" aria-labelledby="event-courses-heading">
                            <h2 id="event-courses-heading"><Book aria-hidden="true" /> Courses</h2>
                            <ul className="event-page__tags">
                                {event.courses.map((course) => <li key={course}>{course}</li>)}
                            </ul>
                        </section>
                    )}

                    {event.filters.length > 0 && (
                        <section className="event-page__section" aria-labelledby="event-requirements-heading">
                            <h2 id="event-requirements-heading"><Funnel aria-hidden="true" /> Participation preferences</h2>
                            <ul className="event-page__preferences">
                                {event.filters.map((filter) => (
                                    <li key={`${filter.filterType}-${filter.value}`}>
                                        {filter.filterType}: {filter.value.replaceAll("_", " ")}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </section>
            </article>
        </main>
    );
}
