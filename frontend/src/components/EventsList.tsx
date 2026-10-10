import { useEffect, useState, type FormEvent } from "react";
import { PlusCircleFill, XCircle, Trash3 } from "react-bootstrap-icons";

import { createListing, getListings, type Listing, type ListingForCreate } from "../api";
import "../FormLayout.css";
import "./EventsList.css";
import AutocompleteInputField from "./AutocompleteInputField";

function sortListings(listings: Listing[]): Listing[] {
    return [...listings].sort((a, b) =>
        (a.startTime ?? "").localeCompare(b.startTime ?? ""),
    );
}

function today(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function EventsList() {
    const [events, setEvents] = useState<Listing[]>([]);
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [courses, setCourses] = useState<string[]>([]);
    const [location, setLocation] = useState("");
    const [description, setDescription] = useState("");
    const [newCourse, setNewCourse] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

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

    function addCourse() {
        const trimmedCourse = newCourse.trim();
        if (trimmedCourse && !courses.some((course) => course.toLowerCase() === trimmedCourse.toLowerCase())) {
            setCourses((current) => [...current, trimmedCourse]);
        }
        setNewCourse("");
    }

    async function addEvent(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (isSubmitting) return;

        const startsAt = new Date(`${date}T${time}:00`);
        const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
        const newEvent: ListingForCreate = {
            subject: courses[0] ?? (newCourse.trim() || title.trim()),
            description: description.trim(),
            startTime: startsAt.toISOString(),
            endTime: endsAt.toISOString(),
            location: location.trim(),
            courses,
            isPrivate: false,
            filters: [{ filterType: "degree", value: "master" }],
        };

        setIsSubmitting(true);
        try {
            const createdEvent = await createListing(newEvent);
            setEvents((current) =>
                sortListings([...current.filter((event) => event.id !== createdEvent.id), createdEvent]),
            );
            setTitle("");
            setDate("");
            setTime("");
            setLocation("");
            setDescription("");
            setCourses([]);
            setNewCourse("");
            setIsAdding(false);
        } catch (error) {
            window.alert(error instanceof Error ? error.message : "Could not create the event.");
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isAdding) {
        return (
            <main className="form-page">
                <div className="form-container">
                    <header className="form-page-header">
                        <p className="form-eyebrow">Study sessions</p>
                        <h1 id="create-event-heading">Create a study event</h1>
                        <p className="form-page-description">Set up a session and share the details with your group.</p>
                    </header>

                    <section className="form-card" aria-labelledby="create-event-heading">
                        <form className="form-stack" onSubmit={addEvent}>
                            <label className="form-field" htmlFor="study-event-title">
                                <span>Event name <span className="form-required">*</span></span>
                                <input id="study-event-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Exam prep session" maxLength={80} required />
                            </label>

                            <div className="form-row">
                                <label className="form-field" htmlFor="study-event-date">
                                    <span>Date <span className="form-required">*</span></span>
                                    <input id="study-event-date" type="date" min={today()} value={date} onChange={(event) => setDate(event.target.value)} required />
                                </label>
                                <label className="form-field" htmlFor="study-event-time">
                                    <span>Start time <span className="form-required">*</span></span>
                                    <input id="study-event-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
                                </label>
                            </div>

                            <div className="form-field">
                                <label htmlFor="study-event-courses">Courses</label>
                                <div className="form-inline-entry">
                                    <AutocompleteInputField
                                        id="study-event-courses"
                                        value={newCourse}
                                        onValueChange={setNewCourse}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                addCourse();
                                            }
                                        }}
                                        placeholder="Start typing a course name"
                                    />
                                    <button className="form-secondary-button" type="button" onClick={addCourse}>Add course</button>
                                </div>
                                {courses.length > 0 && (
                                    <ul className="course-tags" aria-label="Added courses">
                                        {courses.map((course) => (
                                            <li key={course}>
                                                {course}
                                                <button type="button" aria-label={`Remove ${course}`} onClick={() => setCourses((current) => current.filter((item) => item !== course))}>
                                                    <XCircle aria-hidden="true" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <label className="form-field" htmlFor="study-event-location">
                                <span>Location <span className="form-required">*</span></span>
                                <input id="study-event-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Room or meeting link" maxLength={120} required />
                            </label>

                            <label className="form-field" htmlFor="study-event-description">
                                <span>Description <span className="form-optional">(optional)</span></span>
                                <textarea id="study-event-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will you work on?" rows={3} maxLength={500} />
                            </label>

                            <div className="form-actions">
                                <button className="form-primary-button" type="submit">Add event</button>
                                <button className="form-link-button" type="button" onClick={() => setIsAdding(false)}>Cancel</button>
                            </div>
                        </form>
                    </section>
                </div>
            </main>
        );
    }

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
                        <button className="form-icon-button" type="button" onClick={() => setIsAdding(true)} aria-label="Create a study event">
                            <PlusCircleFill aria-hidden="true" />
                        </button>
                    </div>
                </header>

                <section className="form-card" aria-labelledby="upcoming-events-heading">
                    <div className="form-section-header">
                        <h2>Events</h2>
                        <span className="event-count">{events.length}</span>
                    </div>

                    {events.length === 0 ? (
                        <p className="event-empty">
                            {isLoading ? "Loading events…" : loadError || "No events yet. You can be the first!"}
                        </p>
                    ) : (
                        <div className="event-list">
                            {events.map((studyEvent) => {
                                const eventDate = new Date(studyEvent.startTime ?? "");
                                const eventTime = Number.isNaN(eventDate.getTime())
                                    ? "Time TBD"
                                    : eventDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

                                return (
                                    <article className="event-item" key={studyEvent.id}>
                                        <div className="event-date-badge">
                                            <span>{Number.isNaN(eventDate.getTime()) ? "TBD" : eventDate.toLocaleDateString(undefined, { month: "short" })}</span>
                                            <strong>{Number.isNaN(eventDate.getTime()) ? "—" : eventDate.getDate()}</strong>
                                        </div>
                                        <div className="event-details">
                                            <h3>{studyEvent.subject}</h3>
                                            <p className="event-meta">{eventTime} | {studyEvent.location}</p>
                                            {studyEvent.description && <p className="event-description">{studyEvent.description}</p>}
                                        </div>
                                        <div
                                            style={{ display: "flex", alignItems: "space-around", justifyContent: "space-around", fontSize: "1.2rem", height: "auto", padding: "0 0.5rem", color: "#dc3545", background: "none", border: "none", cursor: "pointer" }}
                                        >                                     
                                            <button
                                                className="event-delete"
                                                type="button"
                                                onClick={() => setEvents((current) => current.filter((item) => item.id !== studyEvent.id))}
                                                aria-label={`Delete ${studyEvent.subject}`}
                                            >
                                                <Trash3 aria-hidden="true" />
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
