import { useState } from "react";
import { CalendarPlus } from "react-bootstrap-icons";
import { getOutlookCalendarLink } from "../api";

export default function OutlookCalendarButton({ listingId }: { listingId: string }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function openCalendar() {
        if (loading) return;
        setError("");
        // Open during the click so browsers do not block the tab after the API call.
        const calendarTab = window.open("about:blank", "_blank");
        if (!calendarTab) {
            setError("Please allow pop-ups to open Outlook in a new tab.");
            return;
        }
        calendarTab.opener = null;
        setLoading(true);
        try {
            const url = await getOutlookCalendarLink(listingId);
            if (!calendarTab.closed) calendarTab.location.replace(url);
        } catch {
            calendarTab.close();
            setError("Could not open Outlook. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="event-page__calendar">
            <button className="form-primary-button" type="button" onClick={openCalendar} disabled={loading} aria-label="Add to Outlook (opens in a new tab)">
                <CalendarPlus aria-hidden="true" />
                {loading ? "Opening Outlook…" : "Add to Outlook"}
            </button>
            {error && <p role="alert">{error}</p>}
        </div>
    );
}
