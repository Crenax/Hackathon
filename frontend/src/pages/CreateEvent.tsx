import { useState, useEffect, type FormEvent  } from "react";
import "../FormLayout.css";
import "./HomePage.css";
import AutocompleteInputField from "../components/AutocompleteInputField";
import { createListing, type Listing, type ListingForCreate } from "../api";

import { XCircle } from "react-bootstrap-icons";
import { compareEventsFutureToPast } from "../eventSorting";






// util functions
function formatLocalDateTime(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}





export default function CreateEvent() {

    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [courses, setCourses] = useState<string[]>([]);
    const [location, setLocation] = useState("");
    const [description, setDescription] = useState("");
    const [newCourse, setNewCourse] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [minimumStartTime, setMinimumStartTime] = useState(() => formatLocalDateTime(new Date()));




    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const defaultStartTime = formatLocalDateTime(startsAt);

    setMinimumStartTime(defaultStartTime);
    setStartTime(defaultStartTime);
    setEndTime(formatLocalDateTime(endsAt));
    setSubmitError("");



    function updateStartTime(value: string) {
        const previousStart = new Date(startTime);
        const previousEnd = new Date(endTime);
        const previousInterval = previousEnd.getTime() - previousStart.getTime();
        const interval = Number.isFinite(previousInterval) && previousInterval > 0
            ? previousInterval
            : 60 * 60 * 1000;

        setStartTime(value);

        const nextStart = new Date(value);
        if (!Number.isNaN(nextStart.getTime())) {
            setEndTime(formatLocalDateTime(new Date(nextStart.getTime() + interval)));
        }
    }



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

        setSubmitError("");
        if (courses.length === 0) {
            setSubmitError("Add at least one course before creating an event.");
            return;
        }
        const startsAt = new Date(startTime);
        const endsAt = new Date(endTime);
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
            setSubmitError("Enter a valid start and end time.");
            return;
        }
        if (endsAt <= startsAt) {
            setSubmitError("End time must be later than start time.");
            return;
        }

        const newEvent: ListingForCreate = {
            description: description.trim(),
            startTime: startsAt.toISOString(),
            endTime: endsAt.toISOString(),
            location: location.trim(),
            courses,
            isPrivate,
        };

        setIsSubmitting(true);
        try {
            const createdEvent = await createListing(newEvent);
            setEvents((current) =>
                sortListings([...current.filter((event) => event.id !== createdEvent.id), createdEvent]),
            );
            setStartTime("");
            setEndTime("");
            setLocation("");
            setDescription("");
            setCourses([]);
            setNewCourse("");
            setIsPrivate(false);
            setIsAdding(false);
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : "Could not create the event.");
        } finally {
            setIsSubmitting(false);
        }
    }




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

                        <label className="form-field" htmlFor="study-event-description">
                            <span>Title <span className="form-required">*</span></span>
                            <input id="study-event-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will you work on?" maxLength={120} required />
                        </label>


                        <div className="form-row">
                            <label className="form-field" htmlFor="study-event-start-time">
                                <span>Starts <span className="form-required">*</span></span>
                                <input id="study-event-start-time" type="datetime-local" min={minimumStartTime} value={startTime} onChange={(event) => updateStartTime(event.target.value)} required />
                            </label>
                            <label className="form-field" htmlFor="study-event-end-time">
                                <span>Ends <span className="form-required">*</span></span>
                                <input id="study-event-end-time" type="datetime-local" min={startTime || minimumStartTime} value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
                            </label>
                        </div>

                        <div className="form-field">
                            <label htmlFor="study-event-courses">Courses <span className="form-required">*</span></label>
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

                        <fieldset className="event-visibility-fieldset">
                            <legend>Visibility</legend>
                            <div className="event-visibility-options">
                                <label className="event-visibility-option">
                                    <input type="radio" name="event-visibility" value="public" checked={!isPrivate} onChange={() => setIsPrivate(false)} />
                                    <span>
                                        <strong>Public</strong>
                                        <small>Anyone can discover this event.</small>
                                    </span>
                                </label>
                                <label className="event-visibility-option">
                                    <input type="radio" name="event-visibility" value="private" checked={isPrivate} onChange={() => setIsPrivate(true)} />
                                    <span>
                                        <strong>Private</strong>
                                        <small>Only members with the invite code can discover this event.</small>
                                    </span>
                                </label>
                            </div>
                        </fieldset>

                        {submitError && <p className="event-submit-error" role="alert">{submitError}</p>}

                        <div className="form-actions">
                            <button className="form-primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Publishing…" : "Add event"}</button>
                            <button className="form-link-button" type="button" onClick={() => setIsAdding(false)} disabled={isSubmitting}>Cancel</button>
                        </div>
                    </form>
                </section>
            </div>
        </main>
    );
}