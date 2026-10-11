import { useEffect, useState } from "react";
import { getJoinRequests, type JoinRequest } from "../api";
import "./JoinRequests.css";

export default function JoinRequests({ listingId }: { listingId: string }) {
    const [requests, setRequests] = useState<JoinRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        let active = true;
        getJoinRequests(listingId)
            .then((items) => {
                if (active) { setRequests(items); setError(""); }
            })
            .catch(() => {
                if (active) setError("Could not load join requests. Please try again.");
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [listingId, refresh]);

    return (
        <section className="form-card join-requests" aria-labelledby="join-requests-heading">
            <div className="form-heading-row">
                <h2 id="join-requests-heading">Join requests</h2>
                <button className="form-secondary-button" type="button" disabled={loading}
                    onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}>Refresh</button>
            </div>
            <p className="join-requests__privacy">Only you, as the event creator, can see these requests and messages.</p>
            {loading ? <p role="status">Loading requests…</p> : error ? <p role="alert">{error}</p> : requests.length === 0 ? (
                <p>No pending join requests.</p>
            ) : (
                <ul className="join-requests__list">
                    {requests.map((request) => (
                        <li key={request.user.id}>
                            <h3>{request.user.fullName.trim() || "Participant"}</h3>
                            <p className="join-requests__message">{request.message || "No message provided."}</p>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
