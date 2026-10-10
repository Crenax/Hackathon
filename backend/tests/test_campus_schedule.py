"""Schedule boundary checks without upstream network access."""
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import campus_schedule as schedule


class AvailabilityTests(unittest.TestCase):
    def test_free_busy_unknown_and_half_hour_boundary(self):
        now = datetime(2026, 10, 10, 10, tzinfo=timezone.utc)
        rooms = [schedule.Room(f'TEST E {index}', 20) for index in range(5)]
        bookings = {
            rooms[0].name: [],
            rooms[1].name: [(now + timedelta(minutes=29), now + timedelta(hours=1))],
            rooms[2].name: [(now + timedelta(minutes=30), now + timedelta(hours=1))],
            rooms[3].name: [(now - timedelta(hours=1), now)],
        }
        def fetch(room, day):
            if room.name not in bookings:
                raise OSError('Upstream unavailable')
            return bookings[room.name]
        with patch.object(schedule, 'ROOMS', rooms), patch.object(schedule, 'fetch_schedule', fetch), patch.object(schedule, 'datetime', wraps=datetime) as clock:
            clock.now.return_value = now
            result = schedule.availability('TEST')
        self.assertEqual([r['status'] for r in result['rooms']], ['free', 'busy', 'free', 'free', 'unknown'])
        self.assertEqual(result['rooms'][2]['freeUntil'], (now + timedelta(minutes=30)).isoformat())
        self.assertTrue(result['rooms'][0]['freeForRestOfDay'])
        self.assertFalse(result['rooms'][4]['freeForRestOfDay'])
        self.assertEqual(result['windowEndsAt'], (now + timedelta(minutes=30)).isoformat())

    def test_unknown_building_does_not_fetch(self):
        with patch.object(schedule, 'fetch_schedule') as fetch:
            with self.assertRaises(ValueError):
                schedule.availability('MISSING')
            fetch.assert_not_called()

    def test_zurich_and_overnight_allocation(self):
        bookings = schedule.parse_allocations([{'date_from': '2026-10-09T23:00:00', 'date_to': '2026-10-10T02:00:00'}])
        self.assertEqual(bookings[0][0], datetime(2026, 10, 9, 21, tzinfo=timezone.utc))
        self.assertEqual(bookings[0][1], datetime(2026, 10, 10, 0, tzinfo=timezone.utc))
