"""Join-request API privacy and persistence checks, without a live database.

Run from backend: python -m unittest discover -s tests -p test_join_request_privacy.py
"""
import unittest
from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch

import httpx

import app as api
import databaseManager as database
from models import JoinRequest, Listing, MemberRole, User


LISTING_ID = "00000000-0000-0000-0000-000000000001"
CREATOR_ID = "00000000-0000-0000-0000-000000000002"
APPLICANT_ID = "00000000-0000-0000-0000-000000000003"
HEADERS = {"X-User-Id": "student@ethz.ch", "X-User-Name": "Student"}


class JoinRequestPrivacyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.creator = User(id=CREATOR_ID, fullName="Creator", dateOfBirth=date(2000, 1, 1))
        self.applicant = User(id=APPLICANT_ID, fullName="Applicant", dateOfBirth=date(2000, 1, 1))
        self.listing = Listing(id=LISTING_ID, createdBy=self.creator)
        self.join_request = JoinRequest(
            user=self.applicant, listing=self.listing, role=MemberRole.requestPending,
            joinedAt=datetime.now(timezone.utc), message="I would like to revise calculus.",
        )
        self.viewer = self.applicant
        self.db = MagicMock()
        self.db.get_listing_by_id.return_value = self.listing
        self.db.get_role_by_user_id_and_listing_id.return_value = None
        self.db.get_pending_requests_by_listing_id.return_value = [self.join_request]
        self.db_patch = patch.object(api, "db", self.db)
        self.db_patch.start()
        api.app.dependency_overrides[api.current_user] = lambda: self.viewer
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=api.app), base_url="https://test", headers=HEADERS,
        )

    async def asyncTearDown(self):
        await self.client.aclose()
        api.app.dependency_overrides.clear()
        self.db_patch.stop()

    async def test_submit_saves_trimmed_message_for_authenticated_applicant(self):
        response = await self.client.post(
            f"/api/listings/{LISTING_ID}/requests", json={"message": "  Let's study together.  "},
        )
        self.assertEqual(response.status_code, 204)
        self.db.create_request.assert_called_once_with(APPLICANT_ID, LISTING_ID, "Let's study together.")

    async def test_message_is_optional_for_existing_clients(self):
        response = await self.client.post(f"/api/listings/{LISTING_ID}/requests")
        self.assertEqual(response.status_code, 204)
        self.db.create_request.assert_called_once_with(APPLICANT_ID, LISTING_ID, "")

    async def test_overlong_and_non_text_messages_are_rejected(self):
        for message in ("x" * 1001, 123, {"content": "hello"}):
            with self.subTest(message_type=type(message)):
                response = await self.client.post(
                    f"/api/listings/{LISTING_ID}/requests", json={"message": message},
                )
                self.assertEqual(response.status_code, 422)
        self.db.create_request.assert_not_called()

    async def test_only_creator_can_read_messages(self):
        self.viewer = self.creator
        response = await self.client.get(f"/api/listings/{LISTING_ID}/requests")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["message"], self.join_request.message)
        self.db.get_pending_requests_by_listing_id.reset_mock()

        self.viewer = self.applicant
        for role in (None, MemberRole.requestPending, MemberRole.member, MemberRole.admin):
            with self.subTest(role=role):
                self.db.get_role_by_user_id_and_listing_id.return_value = role
                response = await self.client.get(f"/api/listings/{LISTING_ID}/requests")
                self.assertEqual(response.status_code, 403)
        self.db.get_pending_requests_by_listing_id.assert_not_called()

    async def test_message_never_leaks_through_my_requests_or_members(self):
        self.db.get_pending_requests_by_user_id.return_value = [self.join_request]
        response = await self.client.get("/api/me/requests")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("message", response.json()[0])

        self.db.get_role_by_user_id_and_listing_id.return_value = MemberRole.member
        self.db.get_listingMembers_by_listing.return_value = [
            self.join_request.model_copy(update={"role": MemberRole.member}),
        ]
        response = await self.client.get(f"/api/listings/{LISTING_ID}/members")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("message", response.json()[0])

    async def test_other_admin_cannot_approve_request(self):
        self.db.get_role_by_user_id_and_listing_id.return_value = MemberRole.admin
        response = await self.client.post(f"/api/listings/{LISTING_ID}/requests/{APPLICANT_ID}/approve")
        self.assertEqual(response.status_code, 403)
        self.db.accept_request_by_user_id_and_listing_id.assert_not_called()
        self.viewer = self.creator
        response = await self.client.post(f"/api/listings/{LISTING_ID}/requests/{APPLICANT_ID}/approve")
        self.assertEqual(response.status_code, 204)

    async def test_private_and_duplicate_requests_still_fail(self):
        self.db.get_role_by_user_id_and_listing_id.return_value = MemberRole.requestPending
        response = await self.client.post(f"/api/listings/{LISTING_ID}/requests", json={"message": "Hi"})
        self.assertEqual(response.status_code, 400)
        self.listing.isPrivate = True
        self.db.get_role_by_user_id_and_listing_id.return_value = None
        response = await self.client.post(f"/api/listings/{LISTING_ID}/requests", json={"message": "Hi"})
        self.assertEqual(response.status_code, 404)
        self.db.create_request.assert_not_called()


class JoinRequestStorageTests(unittest.TestCase):
    def test_regular_membership_conversion_drops_private_message(self):
        creator = User(id=CREATOR_ID)
        listing = Listing(id=LISTING_ID, createdBy=creator)
        row = {
            "user_id": APPLICANT_ID, "listing_id": LISTING_ID, "role": "request_pending",
            "joined_at": datetime.now(timezone.utc).isoformat(), "request_message": "Private reason",
        }
        with patch.object(database, "get_user_by_id", return_value=User(id=APPLICANT_ID)), \
             patch.object(database, "get_listing_by_id", return_value=listing):
            member = database.listingMember_from_row(row)
            self.assertNotIn("message", member.model_dump())
            self.assertNotIn("request_message", member.model_dump())

    def test_approval_clears_stored_message(self):
        client = MagicMock()
        query = client.table.return_value
        query.update.return_value = query
        query.eq.return_value = query
        query.execute.return_value.data = []
        with patch.object(database, "client", client):
            database.accept_request_by_user_id_and_listing_id(APPLICANT_ID, LISTING_ID)
        query.update.assert_called_once_with({"role": "member", "request_message": ""})
