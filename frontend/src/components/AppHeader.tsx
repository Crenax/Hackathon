import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Calendar3, House, List, Map, People, PersonBadge, PencilSquare } from "react-bootstrap-icons";
import { getMyNotifications, markNotificationRead, type Notification } from "../api";
import "./AppHeader.css";

// How often the bell checks for new notifications
const NOTIFICATION_REFRESH_MS = 30 * 1000;

function notificationText(notification: Notification): string {
    const who = notification.actorName?.trim() || "Someone";
    const event = notification.listingTitle?.trim() ? `“${notification.listingTitle.trim()}”` : "an event";
    switch (notification.type) {
        case "message": return `${who} wrote in ${event}`;
        case "join_request": return `${who} wants to join ${event}`;
        case "friend_request": return `${who} sent you a friend request`;
        case "new_listing": return `Your friend ${who} created ${event}`;
    }
}

function relativeTime(value: string): string {
    const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
    if (Number.isNaN(minutes)) return "";
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    return new Date(value).toLocaleDateString();
}

const AppHeader = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [areNotificationsOpen, setAreNotificationsOpen] = useState(false);
    // Only unread notifications; clicking one marks it read and removes it from the list
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const notificationsButtonRef = useRef<HTMLButtonElement>(null);

    const refreshNotifications = useCallback(() => {
        getMyNotifications()
            .then(setNotifications)
            .catch(() => { /* e.g. not logged in or profile incomplete: keep the bell quiet */ });
    }, []);

    useEffect(() => {
        refreshNotifications();
        const timer = window.setInterval(refreshNotifications, NOTIFICATION_REFRESH_MS);
        return () => window.clearInterval(timer);
    }, [refreshNotifications]);

    async function openNotification(notification: Notification) {
        setNotifications((current) => current.filter(({ id }) => id !== notification.id));
        try {
            await markNotificationRead(notification.id);
        } catch {
            // Still open the event; the notification will show up again on the next refresh
        }
        // Friend requests open the sender's profile; everything else the event page (chat, join requests, joining)
        if (notification.type === "friend_request" && notification.actorId) {
            window.location.assign(`/user?id=${encodeURIComponent(notification.actorId)}`);
        } else {
            window.location.assign(notification.listingId
                ? `/event?id=${encodeURIComponent(notification.listingId)}`
                : "/");
        }
    }

    function goToHome() {
        window.location.href = "/";
    }

    useEffect(() => {
        if (!isMenuOpen) return;

        const closeOnOutsideClick = (event: PointerEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsMenuOpen(false);
                menuButtonRef.current?.focus();
            }
        };

        document.addEventListener("pointerdown", closeOnOutsideClick);
        document.addEventListener("keydown", closeOnEscape);

        return () => {
            document.removeEventListener("pointerdown", closeOnOutsideClick);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [isMenuOpen]);

    useEffect(() => {
        if (!areNotificationsOpen) return;

        const closeOnOutsideClick = (event: PointerEvent) => {
            if (!notificationsRef.current?.contains(event.target as Node)) {
                setAreNotificationsOpen(false);
            }
        };

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setAreNotificationsOpen(false);
                notificationsButtonRef.current?.focus();
            }
        };

        document.addEventListener("pointerdown", closeOnOutsideClick);
        document.addEventListener("keydown", closeOnEscape);

        return () => {
            document.removeEventListener("pointerdown", closeOnOutsideClick);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [areNotificationsOpen]);

    return (
        <header className="app-header">

            <div>
                <strong
                    onClick={goToHome}
                    style={{ cursor: "pointer" }}
                >
                    meETHZ
                </strong>
            </div>

            <div className="app-header-menu" ref={menuRef}>
                <button
                    ref={menuButtonRef}
                    className="app-header-menu-button"
                    type="button"
                    aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                    aria-controls="app-header-navigation"
                    aria-expanded={isMenuOpen}
                    onClick={() => {
                        setIsMenuOpen((isOpen) => !isOpen);
                        setAreNotificationsOpen(false);
                    }}
                    onMouseEnter={() => {
                        setIsMenuOpen(true);
                        setAreNotificationsOpen(false);
                    }}
                >
                    <List aria-hidden="true" />
                </button>

                {isMenuOpen && (
                    <aside
                        id="app-header-navigation"
                        className="app-sidebar"
                        aria-label="Main navigation"
                        onMouseLeave={() => setIsMenuOpen(false)}
                    >
                        <nav className="app-sidebar-navigation">
                            <a href="/">
                                <House aria-hidden="true" />
                                Home
                            </a>
                            <a href="/map">
                                <Map aria-hidden="true" />
                                Map
                            </a>
                            <a href="/create-event">
                                <PencilSquare />
                                Add an Event
                            </a>
                            <a href="/my-events">
                                <Calendar3 aria-hidden="true" />
                                My Events
                            </a>
                            <a href="/friends">
                                <People aria-hidden="true" />
                                Friends
                            </a>
                            <a href="/my-profile">
                                <PersonBadge aria-hidden="true" />
                                My Profile
                            </a>
                        </nav>
                    </aside>
                )}
            </div>

            <div className="app-header-notifications" ref={notificationsRef}>
                <button
                    ref={notificationsButtonRef}
                    className="app-header-notifications-button"
                    type="button"
                    aria-label={areNotificationsOpen ? "Close notifications" : "Open notifications"}
                    aria-controls="app-header-notification-list"
                    aria-expanded={areNotificationsOpen}
                    aria-haspopup="true"
                    onClick={() => {
                        if (!areNotificationsOpen) refreshNotifications();
                        setAreNotificationsOpen((isOpen) => !isOpen);
                        setIsMenuOpen(false);
                    }}
                >
                    <Bell aria-hidden="true" />
                    {notifications.length > 0 && (
                        <span className="app-header-notification-dot" aria-label={`${notifications.length} unread notifications`} />
                    )}
                </button>

                {areNotificationsOpen && (
                    <section
                        id="app-header-notification-list"
                        className="app-notification-panel"
                        aria-label="Notifications"
                    >
                        <h2>Notifications</h2>
                        {notifications.length > 0 ? (
                            <ul>
                                {notifications.map((notification) => (
                                    <li className="is-unread" key={notification.id}>
                                        <button
                                            type="button"
                                            className="app-notification-link"
                                            onClick={() => void openNotification(notification)}
                                        >
                                            <span className="app-notification-message">
                                                {notificationText(notification)}
                                            </span>
                                            <time dateTime={notification.createdAt}>{relativeTime(notification.createdAt)}</time>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="app-notification-empty">You're all caught up.</p>
                        )}
                    </section>
                )}
            </div>
        </header>
    );
};

export default AppHeader;
