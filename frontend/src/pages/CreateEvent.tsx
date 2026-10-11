import { useEffect, useState, type FormEvent  } from "react";
import "../FormLayout.css";
import "./HomePage.css";
import AutocompleteInputField from "../components/AutocompleteInputField";
import { createListing, getMyFriends, type Listing, type ListingForCreate, type PublicUser } from "../api";
import { locationRooms } from "../map/rooms";

import { XCircle } from "react-bootstrap-icons";
import { compareEventsFutureToPast } from "../components/eventSorting";






// util functions
function formatLocalDateTime(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function sortListings(listings: Listing[]): Listing[] {
    return [...listings].sort(compareEventsFutureToPast);
}



export default function CreateEvent() {
    const [, setEvents] = useState<Listing[]>([]);
    const [courses, setCourses] = useState<string[]>([]);
    const [location, setLocation] = useState("");
    const [description, setDescription] = useState("");
    const [newCourse, setNewCourse] = useState("");
    const [friends, setFriends] = useState<PublicUser[]>([]);
    const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(true);
    const [friendsError, setFriendsError] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");



    const [startTime, setStartTime] = useState(() => formatLocalDateTime(new Date()));
    const [minimumStartTime] = useState(() => formatLocalDateTime(new Date()));
    const [endTime, setEndTime] = useState(() => formatLocalDateTime(new Date(Date.now() + 60 * 60 * 1000)));


    useEffect(() => {
        let isActive = true;
        getMyFriends()
            .then((acceptedFriends) => {
                if (isActive) {
                    setFriends(acceptedFriends);
                    setFriendsError("");
                }
            })
            .catch((error: unknown) => {
                if (isActive) {
                    setFriendsError(error instanceof Error ? error.message : "Could not load your friends.");
                }
            })
            .finally(() => {
                if (isActive) setIsLoadingFriends(false);
            });

        return () => {
            isActive = false;
        };
    }, []);



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



    function addCourse(courseName: string = newCourse) {
        const trimmedCourse = courseName.trim();
        if (trimmedCourse && !courses.some((course) => course.toLowerCase() === trimmedCourse.toLowerCase())) {
            setCourses((current) => [...current, trimmedCourse]);
        }
        setNewCourse("");
    }


    function toggleFriend(friendId: string) {
        const nextSelectedFriendIds = selectedFriendIds.includes(friendId)
            ? selectedFriendIds.filter((id) => id !== friendId)
            : [...selectedFriendIds, friendId];
        setSelectedFriendIds(nextSelectedFriendIds);
        if (nextSelectedFriendIds.length === 0) setIsPrivate(false);
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
            memberIds: selectedFriendIds,
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
            setSelectedFriendIds([]);
            setIsPrivate(false);
            window.location.href = "/";
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
                    <form className="form-stack" autoComplete="off" onSubmit={addEvent}>

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
                                    onSuggestionSelect={addCourse}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            addCourse();
                                        }
                                    }}
                                    placeholder="Start typing a course name"
                                />
                                <button className="form-secondary-button" type="button" onClick={() => addCourse()}>Add course</button>
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

                        <div className="form-field" aria-labelledby="study-event-friends-label">
                            <span id="study-event-friends-label">Add friends <span className="form-optional">(optional)</span></span>
                            {isLoadingFriends ? (
                                <small className="friend-options-status" role="status">Loading friends…</small>
                            ) : friendsError ? (
                                <small className="friend-options-status friend-options-status--error" role="alert">{friendsError}</small>
                            ) : friends.length === 0 ? (
                                <small className="friend-options-status">You do not have any friends to add yet.</small>
                            ) : (
                                <ul className="friend-options" aria-label="Friends available to add">
                                    {friends.map((friend) => {
                                        const isSelected = selectedFriendIds.includes(friend.id);
                                        return (
                                            <li key={friend.id}>
                                                <button
                                                    className="friend-option"
                                                    type="button"
                                                    aria-pressed={isSelected}
                                                    onClick={() => toggleFriend(friend.id)}
                                                >
                                                    {friend.fullName || "Unnamed friend"}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {selectedFriendIds.length > 0 && (
                            <label className="event-private-option">
                                <input
                                    type="checkbox"
                                    checked={isPrivate}
                                    onChange={(event) => setIsPrivate(event.target.checked)}
                                />
                                <span>
                                    <strong>Do you want this event to be private?</strong>
                                    <small>Only members you add now will be able to access it.</small>
                                </span>
                            </label>
                        )}

                        <div className="form-field">
                            <label htmlFor="study-event-location">Location <span className="form-required">*</span></label>
                            <AutocompleteInputField
                                id="study-event-location"
                                value={location}
                                onValueChange={setLocation}
                                suggestions={locationRooms}
                                suggestionType="room"
                                placeholder="Room or meeting link"
                                maxLength={120}
                                required
                            />
                        </div>

                        {submitError && <p className="event-submit-error" role="alert">{submitError}</p>}

                        <div className="form-actions">
                            <button className="form-primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Publishing…" : "Add event"}</button>
                        </div>
                    </form>
                </section>
            </div>
        </main>
    );
}
