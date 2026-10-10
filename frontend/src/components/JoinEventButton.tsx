import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { hasPendingJoinRequest, requestToJoin } from "../api";
import type { Listing } from "../api";

export default function JoinEventButton({ event }: { event: Listing }) {
    // Private events reach this component only after their invite request is verified.
    const [pending, setPending] = useState(event.isPrivate);
    const [checking, setChecking] = useState(!event.isPrivate);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const submitting = useRef(false);

    useEffect(() => {
        if (event.isPrivate) return;
        let active = true;
        hasPendingJoinRequest(event.id)
            .then((hasPendingRequest) => {
                if (active) setPending(hasPendingRequest);
            })
            .catch(() => {
                if (active) setError("Could not check existing requests. You can still try joining.");
            })
            .finally(() => {
                if (active) setChecking(false);
            });
        return () => { active = false; };
    }, [event.id, event.isPrivate]);

    async function handleJoin(submitEvent: SubmitEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (submitting.current || checking || pending || event.isPrivate) return;
        submitting.current = true;
        setSending(true);
        setError("");
        try {
            await requestToJoin(event.id);
            setPending(true);
        } catch {
            setError("Could not request to join. You may already have a request pending. Please refresh and try again.");
        } finally {
            submitting.current = false;
            setSending(false);
        }
    }

    return (
        <form className="form-stack event-page__join" onSubmit={handleJoin}>
            <div className="form-actions">
                <button className="form-primary-button" type="submit"
                    disabled={checking || sending || pending || event.isPrivate}>
                    {checking ? "Checking request…" : pending ? "Request pending" : sending ? "Requesting…" : "Join event"}
                </button>
            </div>
            {pending && <p className="event-page__join-status" role="status">Your request is awaiting approval.</p>}
            {error && <p className="event-page__join-error" role="alert">{error}</p>}
        </form>
    );
}
