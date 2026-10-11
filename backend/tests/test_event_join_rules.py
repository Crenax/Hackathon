"""Join-request time-window checks without a live database."""

import unittest
from datetime import date, datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

import app as api
from models import JoinRequestForCreate, Listing, User


LISTING_ID = "00000000-0000-0000-0000-000000000001"
USER_ID = "00000000-0000-0000-0000-000000000002"


class EventJoinRuleTests(unittest.TestCase):
    def setUp(self):
        self.user = User(id=USER_ID, fullName="Student", dateOfBirth=date(2000, 1, 1))
        self.listing = Listing(id=LISTING_ID, endTime=datetime.now(timezone.utc))
        self.db = MagicMock()
        self.db.get_listing_by_id.return_value = self.listing
        self.db.get_role_by_user_id_and_listing_id.return_value = None
        self.db_patch = patch.object(api, "db", self.db)
        self.db_patch.start()

    def tearDown(self):
        self.db_patch.stop()

    def test_ended_event_rejects_join_request(self):
        with self.assertRaises(HTTPException) as raised:
            api.request_to_join(LISTING_ID, self.user, JoinRequestForCreate())

        self.assertEqual(raised.exception.status_code, 409)
        self.db.create_request.assert_not_called()

    def test_future_event_accepts_join_request(self):
        self.listing.endTime = datetime.now(timezone.utc) + timedelta(hours=1)

        response = api.request_to_join(LISTING_ID, self.user, JoinRequestForCreate())

        self.assertEqual(response.status_code, 204)
        self.db.create_request.assert_called_once_with(USER_ID, LISTING_ID, "")


if __name__ == "__main__":
    unittest.main()
