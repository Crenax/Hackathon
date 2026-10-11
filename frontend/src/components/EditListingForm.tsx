import { useEffect, useState, type FormEvent } from "react";
import { XCircle } from "react-bootstrap-icons";

import { getCourses, updateListing, type Listing } from "../api";
import { locationRooms } from "../map/rooms";
import AutocompleteInputField from "./AutocompleteInputField";
import "../FormLayout.css";
import "../pages/HomePage.css";

// ISO string from the API -> value for a datetime-local input (local time)
function toLocalInput(value: string | null): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

interface EditListingFormProps {
    event: Listing;
    onSaved: (event: Listing) => void;
    onCancel: () => void;
}

// Lets a listing admin change title, times, location, courses and visibility
export default function EditListingForm({ event, onSaved, onCancel }: EditListingFormProps) {
    const [description, setDescription] = useState(event.description);
    const [startTime, setStartTime] = useState(toLocalInput(event.startTime));
    const [endTime, setEndTime] = useState(toLocalInput(event.endTime));
    const [location, setLocation] = useState(event.location ?? "");
    const [courses, setCourses] = useState<string[]>(event.courses);
    const [newCourse, setNewCourse] = useState("");
    const [isPrivate, setIsPrivate] = useState(event.isPrivate);
    // Valid course names; null while loading or if they couldn't be loaded (the backend still validates)
    const [knownCourses, setKnownCourses] = useState<string[] | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let isActive = true;
        getCourses()
            .then((courseNames) => { if (isActive) setKnownCourses(courseNames); })
            .catch(() => { /* fall back to backend validation */ });
        return () => {
            isActive = false;
        };
    }, []);

    function addCourse() {
        const trimmedCourse = newCourse.trim();
        if (!trimmedCourse) return;
        // Only exact course names are accepted by the backend, so use the official spelling
        const officialCourse = knownCourses
            ? knownCourses.find((course) => course.toLowerCase() === trimmedCourse.toLowerCase())
            : trimmedCourse;
        if (!officialCourse) {
            setError(`"${trimmedCourse}" is not a known course. Please pick one from the suggestions.`);
            return;
        }
        setError("");
        if (!courses.some((course) => course.toLowerCase() === officialCourse.toLowerCase())) {
            setCourses((current) => [...current, officialCourse]);
        }
        setNewCourse("");
    }

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (isSaving) return;
        setError("");

        if (courses.length === 0) {
            setError("Add at least one course.");
            return;
        }
        const startsAt = startTime ? new Date(startTime) : null;
        const endsAt = endTime ? new Date(endTime) : null;
        if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) {
            setError("Enter a valid start and end time.");
            return;
        }
        if (startsAt && endsAt && endsAt <= startsAt) {
            setError("End time must be later than start time.");
            return;
        }
        if (isPrivate && !event.isPrivate
            && !window.confirm("Make this event private? Open join requests will be declined.")) {
            return;
        }

        setIsSaving(true);
        try {
            // Empty time or location fields clear the value
            const updated = await updateListing(event.id, {
                newDescription: description.trim(),
                newStartTime: startsAt ? startsAt.toISOString() : null,
                newEndTime: endsAt ? endsAt.toISOString() : null,
                newLocation: location.trim() || null,
                newCourses: courses,
                newIsPrivate: isPrivate,
            });
            onSaved(updated);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Could not save the changes.");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <section className="form-card" aria-labelledby="edit-event-heading">
            <h2 id="edit-event-heading">Edit event</h2>
            <form className="form-stack" autoComplete="off" onSubmit={save}>
                <label className="form-field" htmlFor="edit-event-description">
                    <span>Title <span className="form-required">*</span></span>
                    <input id="edit-event-description" value={description} onChange={(e) => setDescription(e.target.value)}
                        placeholder="What will you work on?" maxLength={120} required />
                </label>

                <div className="form-row">
                    <label className="form-field" htmlFor="edit-event-start-time">
                        <span>Starts</span>
                        <input id="edit-event-start-time" type="datetime-local" value={startTime}
                            onChange={(e) => setStartTime(e.target.value)} />
                    </label>
                    <label className="form-field" htmlFor="edit-event-end-time">
                        <span>Ends</span>
                        <input id="edit-event-end-time" type="datetime-local" min={startTime || undefined} value={endTime}
                            onChange={(e) => setEndTime(e.target.value)} />
                    </label>
                </div>

                <div className="form-field">
                    <label htmlFor="edit-event-courses">Courses <span className="form-required">*</span></label>
                    <div className="form-inline-entry">
                        <AutocompleteInputField
                            id="edit-event-courses"
                            value={newCourse}
                            onValueChange={setNewCourse}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    addCourse();
                                }
                            }}
                            placeholder="Start typing a course name"
                        />
                        <button className="form-secondary-button" type="button" onClick={addCourse}>Add course</button>
                    </div>
                    {courses.length > 0 && (
                        <ul className="course-tags" aria-label="Event courses">
                            {courses.map((course) => (
                                <li key={course}>
                                    {course}
                                    <button type="button" aria-label={`Remove ${course}`}
                                        onClick={() => setCourses((current) => current.filter((item) => item !== course))}>
                                        <XCircle aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="form-field">
                    <label htmlFor="edit-event-location">Location</label>
                    <AutocompleteInputField
                        id="edit-event-location"
                        value={location}
                        onValueChange={setLocation}
                        suggestions={locationRooms}
                        suggestionType="room"
                        placeholder="Room or meeting link"
                        maxLength={120}
                    />
                    <small>Leave empty if the location isn't decided yet.</small>
                </div>

                <fieldset className="event-visibility-fieldset">
                    <legend>Visibility</legend>
                    <div className="event-visibility-options">
                        <label className="event-visibility-option">
                            <input type="radio" name="edit-event-visibility" value="public" checked={!isPrivate} onChange={() => setIsPrivate(false)} />
                            <span>
                                <strong>Public</strong>
                                <small>Anyone can discover this event.</small>
                            </span>
                        </label>
                        <label className="event-visibility-option">
                            <input type="radio" name="edit-event-visibility" value="private" checked={isPrivate} onChange={() => setIsPrivate(true)} />
                            <span>
                                <strong>Private</strong>
                                <small>Hidden from search. Nobody new can request to join.</small>
                            </span>
                        </label>
                    </div>
                </fieldset>

                {error && <p className="event-submit-error" role="alert">{error}</p>}

                <div className="form-actions">
                    <button className="form-primary-button" type="submit" disabled={isSaving}>
                        {isSaving ? "Saving…" : "Save changes"}
                    </button>
                    <button className="form-secondary-button" type="button" onClick={onCancel} disabled={isSaving}>
                        Cancel
                    </button>
                </div>
            </form>
        </section>
    );
}
