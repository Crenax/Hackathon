"""API boundary tests; no Supabase credentials or network requests required."""

import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import httpx
from postgrest.exceptions import APIError

import app as api
from courses import Course
from databaseManager import DatabaseManager, LISTING_COLUMNS, listing_from_row, to_columns
from models import Listing, ListingForCreate, MemberRole, PendingRequest, User


HEADERS = {"X-User-Id": "einstein@ethz.ch", "X-User-Name": "Albert Einstein"}


class APITests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.user = User(id="database-user-id", firstName="Albert", lastName="Einstein")
        self.listing = Listing(id="listing-1", subject="Linear Algebra", inviteCode="SECRET")
        self.db = DatabaseManager.__new__(DatabaseManager)
        self.db.client = MagicMock()
        self.db.get_or_create_user = MagicMock(return_value=self.user)
        self.db.get_listing_by_id = MagicMock(return_value=self.listing)
        self.db.get_role = MagicMock(return_value=None)
        api.app.dependency_overrides[api.get_database] = lambda: self.db
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=api.app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()
        api.app.dependency_overrides.clear()

    async def test_every_endpoint_rejects_missing_auth_before_database(self):
        for route in api.app.routes:
            path = route.path.replace("{listing_id}", "listing-1").replace("{user_id}", "other-user")
            for method in route.methods:
                with self.subTest(path=path, method=method):
                    response = await self.client.request(method, path)
                    self.assertEqual(response.status_code, 401)
        self.db.get_or_create_user.assert_not_called()
        self.db.client.table.assert_not_called()

    async def test_missing_blank_duplicate_and_malformed_headers_rejected(self):
        cases = [
            {"X-User-Id": HEADERS["X-User-Id"]},
            {"X-User-Name": HEADERS["X-User-Name"]},
            {**HEADERS, "X-User-Name": "   "},
            {**HEADERS, "X-User-Id": " "},
            {**HEADERS, "X-User-Id": "guest"},
            {**HEADERS, "X-User-Id": "a@b@c"},
            {**HEADERS, "X-User-Name": "%20"},
            {**HEADERS, "X-User-Name": "%0Aadmin"},
            {**HEADERS, "X-User-Name": "%FF"},
            list(HEADERS.items()) + [("X-User-Id", "attacker@ethz.ch")],
            list(HEADERS.items()) + [("X-User-Name", "Attacker")],
        ]
        for headers in cases:
            with self.subTest(headers=headers):
                response = await self.client.get("/api/me", headers=headers)
                self.assertEqual(response.status_code, 401)
        self.db.get_or_create_user.assert_not_called()

    async def test_unknown_urls_and_invalid_bodies_require_auth(self):
        self.assertEqual((await self.client.get("/unknown")).status_code, 401)
        self.assertEqual((await self.client.post("/api/listings", content="bad json")).status_code, 401)
        self.assertEqual((await self.client.options("/api/me")).status_code, 401)

    async def test_identity_is_resolved_to_database_user(self):
        response = await self.client.get("/api/me", headers=HEADERS)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], self.user.id)
        self.db.get_or_create_user.assert_called_once_with("einstein@ethz.ch", "Albert Einstein")
        self.assertEqual(response.headers["cache-control"], "no-store")

    async def test_proxy_name_is_decoded_and_email_normalized(self):
        response = await self.client.get("/api/me", headers={
            "X-User-Id": " EINSTEIN@ETHZ.CH ", "X-User-Name": "Zo%C3%AB Einstein",
        })
        self.assertEqual(response.status_code, 200)
        self.db.get_or_create_user.assert_called_once_with("einstein@ethz.ch", "Zoë Einstein")

    async def test_create_uses_authenticated_database_id(self):
        self.db.create_listing = MagicMock(return_value=self.listing)
        response = await self.client.post("/api/listings", headers=HEADERS, json={
            "subject": "Linear Algebra", "creator_id": "attacker", "createdBy": "attacker",
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.db.create_listing.call_args.args[0], self.user.id)
        self.db.get_or_create_user.assert_called_once()

    async def test_create_and_update_reject_invalid_subject_without_writes(self):
        self.db.get_role.return_value = MemberRole.admin
        self.db.create_listing = MagicMock(return_value=self.listing)
        for method, path in (("POST", "/api/listings"), ("PATCH", "/api/listings/listing-1")):
            for subject in ("Study", "linear algebra", "linearAlgebra", "", None, 123):
                with self.subTest(method=method, subject=subject):
                    response = await self.client.request(method, path, headers=HEADERS, json={"subject": subject})
                    self.assertEqual(response.status_code, 422)
        response = await self.client.post("/api/listings", headers=HEADERS, json={})
        self.assertEqual(response.status_code, 422)
        self.db.create_listing.assert_not_called()
        self.db.client.table.assert_not_called()

    async def test_patch_can_omit_subject(self):
        self.db.get_role.return_value = MemberRole.admin
        response = await self.client.patch("/api/listings/listing-1", headers=HEADERS,
                                           json={"location": "Library"})
        self.assertEqual(response.status_code, 200)
        self.db.client.table.return_value.update.assert_called_once_with({"location": "Library"})

    async def test_profile_updates_only_authenticated_user(self):
        self.db.update_user = MagicMock(return_value=self.user)
        response = await self.client.patch("/api/me", headers=HEADERS, json={"description": "Physics"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.db.update_user.call_args.args[0], self.user.id)

    async def test_private_listing_hidden_from_nonmember_and_pending_user(self):
        self.listing.isPrivate = True
        for role in (None, MemberRole.requestPending):
            self.db.get_role.return_value = role
            response = await self.client.get("/api/listings/listing-1", headers=HEADERS)
            self.assertEqual(response.status_code, 404)

    async def test_member_can_read_private_listing_but_not_invite(self):
        self.listing.isPrivate = True
        self.db.get_role.return_value = MemberRole.member
        response = await self.client.get("/api/listings/listing-1", headers=HEADERS)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["inviteCode"])
        self.assertEqual(self.listing.inviteCode, "SECRET")

    async def test_admin_can_read_invite(self):
        self.db.get_role.return_value = MemberRole.admin
        response = await self.client.get("/api/listings/listing-1", headers=HEADERS)
        self.assertEqual(response.json()["inviteCode"], "SECRET")

    async def test_public_search_filters_and_redacts_invites(self):
        self.db.get_listings_by_course = MagicMock(return_value=[self.listing])
        response = await self.client.get("/api/listings", headers=HEADERS, params={
            "course": "Linear Algebra", "gender": "female", "degree": "master",
        })
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()[0]["inviteCode"])
        filters = self.db.get_listings_by_course.call_args.args[1]
        self.assertEqual([item.value for item in filters], ["female", "master"])

    async def test_nonadmin_cannot_mutate_listing_or_members(self):
        self.db.get_role.return_value = MemberRole.member
        operations = [
            ("PATCH", "/api/listings/listing-1", {"subject": "Analysis I"}),
            ("DELETE", "/api/listings/listing-1", None),
            ("PUT", "/api/listings/listing-1/filters", []),
            ("POST", "/api/listings/listing-1/requests/other/approve", None),
            ("PATCH", "/api/listings/listing-1/members/other", {"role": "admin"}),
            ("DELETE", "/api/listings/listing-1/members/other", None),
            ("GET", "/api/listings/listing-1/requests", None),
        ]
        for method, path, body in operations:
            with self.subTest(method=method, path=path):
                response = await self.client.request(method, path, headers=HEADERS, json=body)
                self.assertEqual(response.status_code, 403)
        self.db.client.table.assert_not_called()

    async def test_admin_update_preserves_subject_mapping(self):
        self.db.get_role.return_value = MemberRole.admin
        response = await self.client.patch("/api/listings/listing-1", headers=HEADERS, json={"subject": "Analysis I"})
        self.assertEqual(response.status_code, 200)
        self.db.client.table.return_value.update.assert_called_once_with({"subject": "Analysis I"})

    async def test_chat_and_member_list_require_membership(self):
        for role in (None, MemberRole.requestPending):
            self.db.get_role.return_value = role
            for method, suffix, body in (("GET", "messages", None), ("POST", "messages", {"content": "Hi"}), ("GET", "members", None)):
                response = await self.client.request(method, f"/api/listings/listing-1/{suffix}", headers=HEADERS, json=body)
                self.assertEqual(response.status_code, 403)
        self.db.client.table.assert_not_called()

    async def test_member_can_send_message_with_own_id(self):
        self.db.get_role.return_value = MemberRole.member
        now = datetime.now(timezone.utc).isoformat()
        self.db.client.table.return_value.insert.return_value.execute.return_value.data = [
            {"id": "msg-1", "listing_id": "listing-1", "content": "Hello", "sent_at": now}
        ]
        self.db.client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"id": self.user.id, "first_name": "Albert", "last_name": "Einstein"}
        ]
        response = await self.client.post("/api/listings/listing-1/messages", headers=HEADERS, json={"content": "Hello", "user_id": "attacker"})
        self.assertEqual(response.status_code, 201)
        payload = self.db.client.table.return_value.insert.call_args.args[0]
        self.assertEqual(payload["user_id"], self.user.id)

    async def test_invite_creates_request_using_own_id(self):
        self.db.request_to_join_by_invite_code = MagicMock(return_value=self.listing)
        response = await self.client.post("/api/join-by-invite", headers=HEADERS, json={"inviteCode": "SECRET"})
        self.assertEqual(response.status_code, 201)
        self.db.request_to_join_by_invite_code.assert_called_once_with("SECRET", self.user.id)
        self.assertIsNone(response.json()["inviteCode"])

    async def test_pending_private_member_can_cancel_own_request(self):
        self.listing.isPrivate = True
        self.db.get_role.return_value = MemberRole.requestPending
        self.db.leave_listing = MagicMock()
        response = await self.client.delete("/api/listings/listing-1/members/me", headers=HEADERS)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.content, b"")
        self.db.leave_listing.assert_called_once_with("listing-1", self.user.id)

    async def test_missing_listing_returns_404(self):
        self.db.get_listing_by_id.return_value = None
        response = await self.client.get("/api/listings/missing", headers=HEADERS)
        self.assertEqual(response.status_code, 404)

    async def test_database_errors_are_sanitized(self):
        self.db.get_or_create_user.side_effect = APIError({"message": "sensitive internal data", "code": "XX000", "details": "secret", "hint": None})
        response = await self.client.get("/api/me", headers=HEADERS)
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("secret", response.text)
        self.assertNotIn("sensitive", response.text)

    async def test_auth_checked_before_database_configuration(self):
        api.app.dependency_overrides.clear()
        api.get_database.cache_clear()
        with patch.dict("os.environ", {}, clear=True):
            self.assertEqual((await self.client.get("/api/me")).status_code, 401)
            response = await self.client.get("/api/me", headers=HEADERS)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["emailAddress"], HEADERS["X-User-Id"])
        api.get_database.cache_clear()


class MappingTests(unittest.TestCase):
    def test_every_course_is_a_valid_subject(self):
        for course in Course:
            listing = ListingForCreate(subject=course.value)
            self.assertEqual(listing.subject, course)
            self.assertEqual(listing.model_dump(mode="json")["subject"], course.value)

    def test_supabase_search_uses_subject(self):
        db = DatabaseManager.__new__(DatabaseManager)
        db.client = MagicMock()
        db.client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        self.assertEqual(db.get_listings_by_course(Course.linearAlgebra), [])
        db.client.table.return_value.select.return_value.eq.assert_called_once_with("subject", "Linear Algebra")

    def test_database_constraint_matches_course_enum(self):
        from scripts.generate_subject_migration import ROOT, render_migration
        migration = (ROOT / "migrations" / "20261010_listing_subject_course.sql").read_text()
        self.assertEqual(migration, render_migration())

    def test_listing_subject_roundtrip(self):
        listing = ListingForCreate(subject="Linear Algebra")
        self.assertEqual(to_columns(listing.model_dump(mode="json"), LISTING_COLUMNS)["subject"], "Linear Algebra")
        self.assertEqual(listing_from_row({"id": "1", "subject": "Linear Algebra", "is_private": False}).subject, "Linear Algebra")


if __name__ == "__main__":
    unittest.main()
