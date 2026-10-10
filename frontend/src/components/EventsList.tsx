import { useEffect, useState, type FormEvent } from "react";
import { PlusCircleFill } from "react-bootstrap-icons";

import "../FormLayout.css";
import "./EventsList.css";
import AutocompleteInputField from "./AutocompleteInputField";

interface StudyEvent {
    id: string;
    title: string;
    date: string;
    time: string;
    courses: string[];
    location: string;
    description: string;
}

const STORAGE_KEY = "viscon-study-events";

function readEvents(): StudyEvent[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? (JSON.parse(saved) as StudyEvent[]) : [];
    } catch {
        return [];
    }
}

function today(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function EventsList() {
    const [events, setEvents] = useState<StudyEvent[]>(readEvents);
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [courses, setCourses] = useState<string[]>([]);
    const [location, setLocation] = useState("");
    const [description, setDescription] = useState("");
    const [newCourse, setNewCourse] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    }, [events]);

    function addCourse() {
        const trimmedCourse = newCourse.trim();
        if (trimmedCourse && !courses.some((course) => course.toLowerCase() === trimmedCourse.toLowerCase())) {
            setCourses((current) => [...current, trimmedCourse]);
        }
        setNewCourse("");
    }

    function addEvent(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        const newEvent: StudyEvent = {
            id: crypto.randomUUID(),
            title: title.trim(),
            date,
            time,
            courses,
            location: location.trim(),
            description: description.trim(),
        };

        setEvents((current) =>
            [...current, newEvent].sort((a, b) =>
                `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
            ),
        );
        setTitle("");
        setDate("");
        setTime("");
        setLocation("");
        setDescription("");
        setCourses([]);
        setNewCourse("");
        setIsAdding(false);
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
                                                <button type="button" aria-label={`Remove ${course}`} onClick={() => setCourses((current) => current.filter((item) => item !== course))}>Remove</button>
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
                        <p className="event-empty">No events yet. You can be the first!</p>
                    ) : (
                        <div className="event-list">
                            {events.map((studyEvent) => {
                                const eventDate = new Date(`${studyEvent.date}T12:00:00`);

                                return (
                                    <article className="event-item" key={studyEvent.id}>
                                        <div className="event-date-badge">
                                            <span>{eventDate.toLocaleDateString(undefined, { month: "short" })}</span>
                                            <strong>{eventDate.getDate()}</strong>
                                        </div>
                                        <div className="event-details">
                                            <h3>{studyEvent.title}</h3>
                                            <p className="event-meta">{studyEvent.time} | {studyEvent.location}</p>
                                            {studyEvent.description && <p className="event-description">{studyEvent.description}</p>}
                                        </div>
                                        <button
                                            className="event-delete"
                                            type="button"
                                            onClick={() => setEvents((current) => current.filter((item) => item.id !== studyEvent.id))}
                                            aria-label={`Delete ${studyEvent.title}`}
                                        >
                                            Delete
                                        </button>
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
