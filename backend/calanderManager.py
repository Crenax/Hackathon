from datetime import datetime, timezone
from urllib.parse import quote, urlencode

from models import Listing

OUTLOOK_COMPOSE_URL = "https://outlook.live.com/calendar/0/deeplink/compose"


def to_outlook_time(value: datetime) -> str:
    # Lokale Zeitzone automatisch verwenden
    if value.tzinfo is None:
        value = value.replace(tzinfo=datetime.now().astimezone().tzinfo)
    return value.astimezone(datetime.now().astimezone().tzinfo).strftime("%Y-%m-%dT%H:%M:%S")


def get_outlook_calendar_link(listing: Listing) -> str:
    # Opens Outlook's "new event" form prefilled with the listing.
    # Missing start/end time or location are left out, Outlook then uses its defaults.
    title = "Study Session: " + listing.description
    if listing.courses:
        title += ": " + ", ".join(course.value for course in listing.courses)

    params = {
        "path": "/calendar/action/compose",
        "rru": "addevent",
        "subject": title,
    }
    if listing.startTime is not None:
        params["startdt"] = to_outlook_time(listing.startTime)
    if listing.endTime is not None:
        params["enddt"] = to_outlook_time(listing.endTime)
    if listing.location:
        params["location"] = listing.location
    if listing.description:
        params["body"] = listing.description

    # quote (not quote_plus): Outlook shows "+" literally instead of as a space
    return f"{OUTLOOK_COMPOSE_URL}?{urlencode(params, quote_via=quote)}"
