import { useId, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { requestToJoin } from "../api";
import type { Listing } from "../api";
import "./JoinEventButton.css";

interface JoinEventButtonProps {
    event: Listing;
    pending: boolean;
    onRequested: () => void;
}

export default function JoinEventButton({ event, pending, onRequested }: JoinEventButtonProps) {
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const dialogRef = useRef<HTMLDialogElement>(null);
    const messageId = useId();
    const submitting = useRef(false);

    async function handleJoin(submitEvent: SubmitEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (submitting.current || pending || event.isPrivate) return;
        submitting.current = true;
        setSending(true);
        setError("");
        try {
            await requestToJoin(event.id, message.trim());
            dialogRef.current?.close();
            setMessage("");
            onRequested();
        } catch {
            setError("Could not request to join. You may already have a request pending. Please refresh and try again.");
        } finally {
            submitting.current = false;
            setSending(false);
        }
    }

    return (
        <div className="form-stack event-page__join">
            <div className="form-actions">
                <button className="form-primary-button" type="button"
                    onClick={() => { setError(""); dialogRef.current?.showModal(); }}
                    disabled={sending || pending || event.isPrivate}>
                    {pending ? "Request pending" : sending ? "Requesting…" : "Request to join"}
                </button>
            </div>
            {pending && <p className="event-page__join-status" role="status">Your request is awaiting approval.</p>}
            <dialog ref={dialogRef} className="join-request-dialog" aria-labelledby={`${messageId}-title`}
                onCancel={(cancelEvent) => { if (submitting.current) cancelEvent.preventDefault(); }}>
                <form className="form-stack" autoComplete="off" onSubmit={handleJoin}>
                    <h2 id={`${messageId}-title`}>Request to join</h2>
                    <p className="join-request-dialog__event">{event.description.trim() || "Study session"}</p>
                    <label className="form-field" htmlFor={messageId}>
                        Why would you like to join? <span className="form-optional">(optional)</span>
                        <textarea id={messageId} value={message} onChange={(changeEvent) => setMessage(changeEvent.target.value)}
                            rows={4} maxLength={1000} disabled={sending}
                            placeholder="Introduce yourself and tell the host what you would like to study."
                            aria-describedby={`${messageId}-privacy`} />
                    </label>
                    <p id={`${messageId}-privacy`} className="join-request-dialog__privacy">
                        Only the person who created this event can read your message.
                    </p>
                    {error && <p className="event-page__join-error" role="alert">{error}</p>}
                    <div className="form-actions">
                        <button className="form-secondary-button" type="button" disabled={sending}
                            onClick={() => dialogRef.current?.close()}>Cancel</button>
                        <button className="form-primary-button" type="submit" disabled={sending || pending}>
                            {sending ? "Sending…" : "Send request"}
                        </button>
                    </div>
                </form>
            </dialog>
        </div>
    );
}
