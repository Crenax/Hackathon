import "./AppFooter.css";
import { House, PersonBadge } from 'react-bootstrap-icons';

const AppFooter = () => {
    return (
        <footer className="app-footer">
            <a href=""><House /></a>
            <a href=""><PersonBadge /></a>
        </footer>
    );
};

export default AppFooter;
