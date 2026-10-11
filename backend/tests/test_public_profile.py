"""Public-profile API privacy checks without a live database."""

import unittest
from datetime import date
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

import app as api
from models import User


MEMBER_ID = "00000000-0000-0000-0000-000000000002"


class PublicProfileTests(unittest.TestCase):
    def setUp(self):
        self.member = User(
            id=MEMBER_ID,
            fullName="Ada Lovelace",
            emailAddress="private@ethz.ch",
            dateOfBirth=date(2000, 1, 1),
            description="I enjoy collaborative mathematics.",
        )
        self.db = MagicMock()
        self.db.get_user_by_id.return_value = self.member
        self.db_patch = patch.object(api, "db", self.db)
        self.db_patch.start()

    def tearDown(self):
        self.db_patch.stop()

    def test_profile_exposes_only_public_fields(self):
        profile = api.get_public_profile(MEMBER_ID)

        self.assertEqual(profile.model_dump(), {
            "fullName": "Ada Lovelace",
            "description": "I enjoy collaborative mathematics.",
        })
        self.db.get_user_by_id.assert_called_once_with(MEMBER_ID)

    def test_missing_profile_returns_not_found(self):
        self.db.get_user_by_id.return_value = None

        with self.assertRaises(HTTPException) as raised:
            api.get_public_profile(MEMBER_ID)
        self.assertEqual(raised.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
