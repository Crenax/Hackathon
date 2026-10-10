import { Links } from "react-router-dom";
import "./AppFooter.css";
import { Calendar3, House, PersonBadge, Map } from 'react-bootstrap-icons';

const AppFooter = () => {
    return (
        <footer className="app-footer">
            <a href="/">
                <House aria-hidden="true" />
            </a>
            <a href="/map">
                <Map aria-hidden="true" />
            </a>
            <a href="/my-events">
                <Calendar3 aria-hidden="true" />
            </a>
            <a href="/my-profile">
                <PersonBadge aria-hidden="true" />
            </a>
        </footer>
    );
};

export default AppFooter;
