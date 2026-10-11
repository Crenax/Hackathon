import { useEffect, useState } from "react";

import { acceptFriendRequest, getMyFriendRequests, getMyFriends, type PublicUser } from "../api";
import UserLink from "../components/UserLink";
import "../FormLayout.css";
import "./HomePage.css";
import "./Friends.css";

// All accepted friends; each name opens the friend's profile
export default function Friends() {
    const [friends, setFriends] = useState<PublicUser[] | null>(null);
    const [requests, setRequests] = useState<PublicUser[] | null>(null);
    const [error, setError] = useState("");
    const [acceptingIds, setAcceptingIds] = useState<Set<string>>(() => new Set());
    const [acceptErrors, setAcceptErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        let isActive = true;
        Promise.all([getMyFriends(), getMyFriendRequests()])
            .then(([friendProfiles, requestProfiles]) => {
                if (!isActive) return;
                setFriends(friendProfiles);
                setRequests(requestProfiles);
            })
            .catch((loadError: unknown) => {
                if (isActive) setError(loadError instanceof Error ? loadError.message : "Could not load your friends.");
            });
        return () => {
            isActive = false;
        };
    }, []);

    // Accepting moves the person from the requests into the (name-sorted) friends list
    async function accept(sender: PublicUser) {
        if (acceptingIds.has(sender.id)) return;
        setAcceptingIds((current) => new Set(current).add(sender.id));
        setAcceptErrors((current) => {
            const next = { ...current };
            delete next[sender.id];
            return next;
        });
        try {
            const friend = await acceptFriendRequest(sender.id);
            setRequests((current) => current?.filter(({ id }) => id !== sender.id) ?? null);
            setFriends((current) => [...(current ?? []), friend]
                .sort((a, b) => a.fullName.toLowerCase().localeCompare(b.fullName.toLowerCase())));
        } catch (acceptError) {
            setAcceptErrors((current) => ({
                ...current,
                [sender.id]: acceptError instanceof Error ? acceptError.message : "Could not accept this request.",
            }));
        } finally {
            setAcceptingIds((current) => {
                const next = new Set(current);
                next.delete(sender.id);
                return next;
            });
        }
    }

    return (
        <main className="form-page">
            <div className="form-container">
                <header className="form-page-header">
                    <p className="form-eyebrow">Your account</p>
                    <h1 id="friends-heading">Friends</h1>
                    <p className="form-page-description">People you are friends with. Open a profile to see more.</p>
                </header>

                {requests && requests.length > 0 && (
                    <section className="form-card" aria-labelledby="friend-requests-heading">
                        <div className="form-section-header">
                            <h2 id="friend-requests-heading">Friend requests</h2>
                            <span className="event-count">{requests.length}</span>
                        </div>
                        <ul className="friends-list">
                            {requests.map((sender) => (
                                <li key={sender.id} className="friends-list__request">
                                    <div className="friends-list__person">
                                        <UserLink userId={sender.id} name={sender.fullName} />
                                        {sender.description.trim() && (
                                            <span className="friends-list__description">{sender.description.trim()}</span>
                                        )}
                                        {acceptErrors[sender.id] && (
                                            <span className="friends-message friends-message--error" role="alert">{acceptErrors[sender.id]}</span>
                                        )}
                                    </div>
                                    <button className="form-primary-button friends-list__accept" type="button"
                                        disabled={acceptingIds.has(sender.id)} onClick={() => void accept(sender)}>
                                        {acceptingIds.has(sender.id) ? "Accepting…" : "Accept"}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <section className="form-card" aria-labelledby="friends-heading">
                    <div className="form-section-header">
                        <h2>All friends</h2>
                        {friends && <span className="event-count">{friends.length}</span>}
                    </div>
                    {error ? (
                        <p className="friends-message friends-message--error" role="alert">{error}</p>
                    ) : friends === null ? (
                        <p className="friends-message" role="status">Loading friends…</p>
                    ) : friends.length === 0 ? (
                        <p className="friends-message">
                            No friends yet. Open someone's profile from an event and send a friend request.
                        </p>
                    ) : (
                        <ul className="friends-list">
                            {friends.map((friend) => (
                                <li key={friend.id}>
                                    <UserLink userId={friend.id} name={friend.fullName} />
                                    {friend.description.trim() && (
                                        <span className="friends-list__description">{friend.description.trim()}</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </main>
    );
}
