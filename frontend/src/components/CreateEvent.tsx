import { useEffect, useState, type FormEvent } from "react";
import "./CreateEvent.css";

interface StudyEvent {
  id: string;
  title: string;
  date: string;
  time: string;
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

export default function CreateEvent() {
  const [events, setEvents] = useState<StudyEvent[]>(readEvents);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  function addEvent(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    const newEvent: StudyEvent = {
      id: crypto.randomUUID(),
      title: title.trim(),
      date,
      time,
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
  }

  return (
    <main className="create-event-page">
      <section className="create-event-card" aria-labelledby="create-event-heading">
        <h2 id="create-event-heading">Create a study event</h2>
        <p className="create-event-intro">Set up a session and share the details with your group.</p>

        <form className="create-event-form" onSubmit={addEvent}>
          <div className="create-event-field">
            <label htmlFor="study-event-title">Event name</label>
            <input id="study-event-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Exam prep session" maxLength={80} required />
          </div>

          <div className="create-event-row">
            <div className="create-event-field">
              <label htmlFor="study-event-date">Date</label>
              <input id="study-event-date" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="create-event-field">
              <label htmlFor="study-event-time">Start time</label>
              <input id="study-event-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>

          <div className="create-event-field">
            <label htmlFor="study-event-location">Location</label>
            <input id="study-event-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room or meeting link" maxLength={120} required />
          </div>

          <div className="create-event-field">
            <label htmlFor="study-event-description">Description <span>(optional)</span></label>
            <textarea id="study-event-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will you work on?" rows={3} maxLength={500} />
          </div>

          <button className="create-event-submit" type="submit">Add event</button>
        </form>
      </section>

      <section className="create-event-list" aria-labelledby="upcoming-events-heading">
        <div className="create-event-list-heading">
          <h2 id="upcoming-events-heading">Upcoming events</h2>
          <span>{events.length}</span>
        </div>
        {events.length === 0 ? (
          <p className="create-event-empty">No events yet. Add one above to get started.</p>
        ) : (
          <div>
            {events.map((studyEvent) => {
              const eventDate = new Date(`${studyEvent.date}T12:00:00`);
              return (
                <article className="create-event-item" key={studyEvent.id}>
                  <div className="create-event-date-badge">
                    <span>{eventDate.toLocaleDateString(undefined, { month: "short" })}</span>
                    <strong>{eventDate.getDate()}</strong>
                  </div>
                  <div className="create-event-details">
                    <h3>{studyEvent.title}</h3>
                    <p className="create-event-meta">{studyEvent.time} | {studyEvent.location}</p>
                    {studyEvent.description && <p className="create-event-description">{studyEvent.description}</p>}
                  </div>
                  <button
                    className="create-event-delete"
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
    </main>
  );
}
