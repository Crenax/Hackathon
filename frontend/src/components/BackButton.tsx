import { ArrowLeft } from "react-bootstrap-icons";
import { useLocation, useNavigate } from "react-router-dom";
import "./BackButton.css";

export default function BackButton() {
    const navigate = useNavigate();
    const location = useLocation();

    function goBack() {
        if (location.key !== "default") {
            navigate(-1);
        } else {
            navigate("/", { replace: true });
        }
    }

    return (
        <button className="page-back-button" type="button" onClick={goBack}
            aria-label="Go back to the previous page" title="Back">
            <ArrowLeft aria-hidden="true" />
        </button>
    );
}
