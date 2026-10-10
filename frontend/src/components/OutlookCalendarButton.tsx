import { useState } from "react";
import { CalendarPlus } from "react-bootstrap-icons";
import { getOutlookCalendarLink } from "../api";

export default function OutlookCalendarButton({ listingId }: { listingId: string }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function openCalendar() {
        if (loading) return;
        setLoading(true);
        setError("");
        try {
            const url = await getOutlookCalendarLink(listingId);
            window.location.assign(url);
        } catch {
            setError("Could not open Outlook. Please try again.");
            setLoading(false);
        }
    }

    return (
        <div className="event-page__calendar">
            <button className="form-primary-button" type="button" onClick={openCalendar} disabled={loading}>
                <CalendarPlus aria-hidden="true" />
                {loading ? "Opening Outlook…" : "Add to Outlook"}
            </button>
            {error && <p role="alert">{error}</p>}
        </div>
    );
}
