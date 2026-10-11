#!/usr/bin/env python3
"""ETH booking checks for the campus API, adapted from map/lecturehalls.py."""
from concurrent.futures import ThreadPoolExecutor, wait
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
import logging
import re
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ZURICH = ZoneInfo('Europe/Zurich')
# Per room request and for the whole check, so a slow ETH service can't block the API for long
ROOM_TIMEOUT_SECONDS = 4
TOTAL_TIMEOUT_SECONDS = 8

logger = logging.getLogger('uvicorn.error')


class ScheduleUnavailableError(Exception):
    """No room schedule could be loaded from ETH."""
# Canonical booking names, seats, and optional room nicknames, as supplied.
ROOM_DATA = """CAB G 11|193
CAB G 51|90
CAB G 59|42
CAB G 61|193
CHN C 14|172
ETA F 5|516|Scherrer Hörsaal
ETF C 1|301
ETF E 1|301
ETZ E 6|73
ETZ E 7|40
ETZ E 8|61
ETZ E 9|40
HCI D 2|66
HCI D 8|66
HCI G 3|302
HCI G 7|302
HCI H 2.1|51
HCI H 8.1|51
HCI J 3|178
HCI J 4|118
HCI J 6|118
HCI J 7|178
HG D 1.1|158
HG D 1.2|158
HG D 3.2|90
HG D 5.2|94
HG D 7.1|158
HG D 7.2|158
HG D 16.2|80
HG E 1.1|172
HG E 1.2|172
HG E 3|243
HG E 5|255
HG E 7|346
HG F 1|346
HG F 3|279|Hilti Hörsaal
HG F 5|273
HG F 7|346
HG F 30|421|AudiMax
HG G 3|278
HG G 5|279
HIL E 1|256
HIL E 3|256
HIL E 4|256
HIL E 6|136
HIL E 7|136
HIL E 8|136
HIL E 9|136
HPH G 1|502
HPH G 2|368
HPH G 3|368
HPV G 4|222
HPV G 5|176
IFW A 32.1|72
IFW A 36|176
LEE E 101|62
LFO C 13|87
LFW B 1|82
LFW C 5|78
ML D 28|308
ML E 12|121
ML F 34|61
ML F 36|123
ML F 38|62
ML F 39|83
ML H 44|199
NO C 6|71
NO C 44|71
NO C 60|275
SLA B 91|100
Y17 M 5|104
ZUE G 1|30"""

@dataclass(frozen=True)
class Room:
    name: str
    seats: int
    nickname: str = ''

    @property
    def building(self):
        return self.name.split()[0]

    @property
    def area(self):
        if self.building in {'HCI', 'HIL', 'HPH', 'HPV'}:
            return 'Zürich Hönggerberg'
        return {'SLA': 'Schwerzenbach', 'Y17': 'Zürich Universität'}.get(self.building, 'Zürich Zentrum')

ROOMS = tuple(Room(parts[0], int(parts[1]), parts[2] if len(parts) > 2 else '')
              for parts in (line.split('|') for line in ROOM_DATA.splitlines()))


def parse_time(value, end=False):
    """ETH wall times are Zurich times. Resolve DST ambiguity conservatively."""
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?', value):
        raise ValueError('Invalid allocation timestamp')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc)
    candidates = []
    for fold in (0, 1):
        candidate = parsed.replace(tzinfo=ZURICH, fold=fold).astimezone(timezone.utc)
        if candidate.astimezone(ZURICH).replace(tzinfo=None) == parsed:
            candidates.append(candidate)
    if not candidates:
        raise ValueError('Invalid Zurich wall time')
    return max(candidates) if end else min(candidates)


def parse_allocations(data):
    if not isinstance(data, list):
        raise ValueError('Unexpected ETH schedule response')
    bookings = []
    for row in data:
        if not isinstance(row, dict):
            raise ValueError('Invalid allocation')
        start, end = parse_time(row.get('date_from')), parse_time(row.get('date_to'), end=True)
        if end <= start:
            raise ValueError('Invalid allocation interval')
        bookings.append((start, end))
    # Back-to-back or overlapping bookings remain one occupied period.
    merged = []
    for start, end in sorted(bookings):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(end, merged[-1][1]))
        else:
            merged.append((start, end))
    return merged


def fetch_schedule(room, day):
    query = urlencode({'path': f'/rooms/{room.name}/allocations',
                       'from': (day - timedelta(days=1)).isoformat(),
                       'to': (day + timedelta(days=1)).isoformat()}, quote_via=quote)
    request = Request('https://ethz.ch/bin/ethz/roominfo?' + query,
                      headers={'Accept': 'application/json', 'User-Agent': 'ETH-Lecture-Halls/1.0'})
    with urlopen(request, timeout=ROOM_TIMEOUT_SECONDS) as response:
        return parse_allocations(json.load(response))



def availability(building):
    """Check booking availability for the next half hour; failed checks stay unknown."""
    rooms = [room for room in ROOMS if room.building == building]
    if not rooms:
        raise ValueError("No lecture halls in this building")
    day = datetime.now(ZURICH).date()
    # All rooms in parallel; whatever isn't back after TOTAL_TIMEOUT_SECONDS stays unknown
    pool = ThreadPoolExecutor(max_workers=len(rooms))
    futures = {pool.submit(fetch_schedule, room, day): room for room in rooms}
    done, _ = wait(futures, timeout=TOTAL_TIMEOUT_SECONDS)
    pool.shutdown(wait=False, cancel_futures=True)
    schedules = []
    for future, room in futures.items():
        bookings = None
        if future in done:
            try:
                bookings = future.result()
            except Exception as error:
                logger.warning('Could not load the schedule of %s: %r', room.name, error)
        schedules.append((room, bookings))
    if all(bookings is None for _, bookings in schedules):
        raise ScheduleUnavailableError('ETH room schedules are currently unavailable')
    now = datetime.now(timezone.utc)
    until = now + timedelta(minutes=30)
    results = []
    for room, bookings in schedules:
        status, next_booking = 'unknown', None
        if bookings is not None:
            status = 'busy' if any(start < until and end > now for start, end in bookings) else 'free'
            next_booking = min((start for start, _ in bookings if start >= until), default=None)
        results.append(dict(name=room.name, status=status,
                            freeUntil=next_booking.isoformat() if next_booking else None,
                            freeForRestOfDay=status == 'free' and (next_booking is None or next_booking.astimezone(ZURICH).date() > now.astimezone(ZURICH).date())))
    return dict(checkedAt=now.isoformat(), windowEndsAt=until.isoformat(), timeZone='Europe/Zurich', rooms=results)
