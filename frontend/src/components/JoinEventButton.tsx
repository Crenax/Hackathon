import { useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { requestToJoin } from "../api";
import type { Listing } from "../api";

interface JoinEventButtonProps {
    event: Listing;
    pending: boolean;
    onRequested: () => void;
}

export default function JoinEventButton({ event, pending, onRequested }: JoinEventButtonProps) {
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const submitting = useRef(false);

    async function handleJoin(submitEvent: SubmitEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (submitting.current || pending || event.isPrivate) return;
        submitting.current = true;
        setSending(true);
        setError("");
        try {
            await requestToJoin(event.id);
            onRequested();
        } catch {
            setError("Could not request to join. You may already have a request pending. Please refresh and try again.");
        } finally {
            submitting.current = false;
            setSending(false);
        }
    }

    return (
        <form className="form-stack event-page__join" autoComplete="off" onSubmit={handleJoin}>
            <div className="form-actions">
                <button className="form-primary-button" type="submit"
                    disabled={sending || pending || event.isPrivate}>
                    {pending ? "Request pending" : sending ? "Requesting…" : "Request to join"}
                </button>
            </div>
            {pending && <p className="event-page__join-status" role="status">Your request is awaiting approval.</p>}
            {error && <p className="event-page__join-error" role="alert">{error}</p>}
        </form>
    );
}
