import { useEffect, useRef, useState } from "react";
import { Bell, Calendar3, House, List, Map, PersonBadge, PencilSquare } from "react-bootstrap-icons";
import "./AppHeader.css";

const notifications = [
    {
        id: 1,
        message: "Your study session starts in 30 minutes.",
        time: "30 min ago",
        unread: true,
    },
    {
        id: 2,
        message: "A new participant joined your event.",
        time: "2 hours ago",
        unread: true,
    },
    {
        id: 3,
        message: "Tomorrow's coffee meetup changed location.",
        time: "Yesterday",
        unread: false,
    },
];

const AppHeader = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [areNotificationsOpen, setAreNotificationsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const notificationsButtonRef = useRef<HTMLButtonElement>(null);
    const hasUnreadNotifications = notifications.some((notification) => notification.unread);

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
                        setAreNotificationsOpen((isOpen) => !isOpen);
                        setIsMenuOpen(false);
                    }}
                >
                    <Bell aria-hidden="true" />
                    {hasUnreadNotifications && (
                        <span className="app-header-notification-dot" aria-label="Unread notifications" />
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
                                    <li
                                        className={notification.unread ? "is-unread" : undefined}
                                        key={notification.id}
                                    >
                                        <span className="app-notification-message">
                                            {notification.message}
                                        </span>
                                        <time>{notification.time}</time>
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
