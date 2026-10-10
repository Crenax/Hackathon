import { useEffect, useRef, useState } from "react";
import { House, List, PersonBadge } from "react-bootstrap-icons";
import "./AppHeader.css";

const AppHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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
          style={{cursor: "pointer"}}
        >
          App-Title
        </strong>
      </div>

      <div className="app-header-menu">
        <button
          className="app-header-menu-button"
          type="button"
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-controls="app-header-navigation"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
          onMouseEnter={() => setIsMenuOpen(true)}
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
              <a href="/profile">
                <PersonBadge aria-hidden="true" />
                Profile
              </a>
            </nav>
          </aside>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
