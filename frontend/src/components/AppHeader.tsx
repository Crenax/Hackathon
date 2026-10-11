import { useEffect, useRef, useState } from "react";
import { Calendar3, House, List, Map, PersonBadge, PencilSquare } from "react-bootstrap-icons";
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
        </header>
    );
};

export default AppHeader;
