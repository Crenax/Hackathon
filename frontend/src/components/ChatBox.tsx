import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { getMessages, sendMessage } from "../api";
import type { Message } from "../api";
import UserLink from "./UserLink";
import "./ChatBox.css";

function mergeMessages(previous: Message[], incoming: Message[]): Message[] {
    const messages = new Map(previous.map((message) => [message.id, message]));
    incoming.forEach((message) => messages.set(message.id, message));
    return [...messages.values()].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
}

export default function ChatBox({ listingId }: { listingId: string }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [sendError, setSendError] = useState("");
    const sendingRef = useRef(false);

    useEffect(() => {
        let active = true;
        let inFlight = false;
        let timeoutId: number | undefined;

        async function refreshMessages() {
            if (!active || inFlight || document.hidden) return;
            window.clearTimeout(timeoutId);
            inFlight = true;
            try {
                const incoming = await getMessages(listingId);
                if (active) {
                    setMessages((previous) => mergeMessages(previous, incoming));
                    setLoadError("");
                }
            } catch {
                if (active) setLoadError("Could not load messages. Retrying automatically…");
            } finally {
                inFlight = false;
                if (active) {
                    setLoading(false);
                    if (!document.hidden) {
                        timeoutId = window.setTimeout(() => void refreshMessages(), 3000);
                    }
                }
            }
        }

        function handleVisibilityChange() {
            window.clearTimeout(timeoutId);
            if (!document.hidden) void refreshMessages();
        }

        document.addEventListener("visibilitychange", handleVisibilityChange);
        void refreshMessages();
        return () => {
            active = false;
            window.clearTimeout(timeoutId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [listingId]);

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        const text = content.trim();
        if (!text || sendingRef.current) return;
        sendingRef.current = true;
        setSending(true);
        setSendError("");
        try {
            const message = await sendMessage(listingId, { content: text });
            setMessages((previous) => mergeMessages(previous, [message]));
            setContent("");
        } catch {
            setSendError("Could not send your message. Please try again.");
        } finally {
            sendingRef.current = false;
            setSending(false);
        }
    }

    return (
        <section className="form-card chat-box" aria-labelledby="event-chat-heading">
            <header className="chat-box__header">
                <h2 id="event-chat-heading">Event chat</h2>
            </header>
            {loading && <p role="status">Loading messages…</p>}
            {loadError && <p className="chat-box__error" role="alert">{loadError}</p>}
            <div className="chat-box__messages" role="log" aria-label="Event messages" aria-busy={loading} tabIndex={0}>
                {!loading && !loadError && messages.length === 0 && <p>No messages yet. Start the conversation!</p>}
                {messages.map((message) => (
                    <article className="chat-box__message" key={message.id}>
                        <header>
                            <strong>{message.author
                                ? <UserLink userId={message.author.id} name={message.author.fullName} />
                                : "Deleted user"}</strong>
                            <time dateTime={message.sentAt}>{new Date(message.sentAt).toLocaleString()}</time>
                        </header>
                        <p>{message.content}</p>
                    </article>
                ))}
            </div>
            <form className="form-stack" autoComplete="off" onSubmit={handleSubmit}>
                <label className="form-field" htmlFor="event-chat-message">
                    Message
                    <textarea id="event-chat-message" value={content} required disabled={sending}
                        placeholder="Write to the other participants…"
                        onChange={(event) => setContent(event.target.value)} />
                </label>
                {sendError && <p className="chat-box__error" role="alert">{sendError}</p>}
                <div className="form-actions">
                    <button className="form-primary-button" type="submit" disabled={sending || !content.trim()}>
                        {sending ? "Sending…" : "Send message"}
                    </button>
                </div>
            </form>
        </section>
    );
}
