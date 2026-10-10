"""Exercise startup selection and real API workflows without Supabase."""

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import app as api
from courses import Course
from memoryDatabase import MemoryDatabaseManager
from models import ListingForCreate, ListingForUpdate, MemberRole, MessageForCreate


class StartupTests(unittest.TestCase):
    def tearDown(self):
        api.get_database.cache_clear()

    def test_missing_partial_and_blank_configuration(self):
        for env in ({}, {"SUPABASE_URL": "https://example.supabase.co"},
                    {"SUPABASE_SERVICE_ROLE_KEY": "key"},
                    {"SUPABASE_URL": " ", "SUPABASE_SERVICE_ROLE_KEY": "key"}):
            with self.subTest(env=env), patch.dict("os.environ", env, clear=True):
                api.get_database.cache_clear()
                with self.assertLogs("uvicorn.error", level="WARNING") as logs:
                    with TestClient(api.app):
                        self.assertIsInstance(api.get_database(), MemoryDatabaseManager)
                        self.assertIs(api.get_database(), api.get_database())
                self.assertEqual(len(logs.records), 1)
                self.assertIn("RAM-ONLY MOCK DATABASE", logs.output[0])
                self.assertIn("ALL DATA WILL BE LOST", logs.output[0])
                self.assertIn("!" * 88, logs.output[0])
                self.assertEqual(api.get_database.cache_info().currsize, 0)

    def test_configured_supabase_selected_and_errors_not_hidden(self):
        with patch.dict("os.environ", {"SUPABASE_URL": "https://example.supabase.co",
                                      "SUPABASE_SERVICE_ROLE_KEY": "key"}), \
                patch.object(api, "DatabaseManager") as manager:
            with TestClient(api.app):
                self.assertIs(api.get_database(), manager.return_value)
            manager.assert_called_once_with()
            manager.side_effect = RuntimeError("connection failed")
            with self.assertRaisesRegex(RuntimeError, "connection failed"):
                with TestClient(api.app):
                    pass

    def test_api_workflow_in_ram_and_restart_reset(self):
        admin = {"X-User-Id": "admin@example.com", "X-User-Name": "Admin User"}
        member = {"X-User-Id": "member@example.com", "X-User-Name": "Member User"}
        with patch.dict("os.environ", {}, clear=True):
            with TestClient(api.app) as client:
                self.assertEqual(client.get("/api/me").status_code, 401)
                uid = client.get("/api/me", headers=member).json()["id"]
                response = client.post("/api/listings", headers=admin,
                                       json={"subject": "Linear Algebra", "isPrivate": True})
                self.assertEqual(response.status_code, 201)
                listing = response.json()
                path = f'/api/listings/{listing["id"]}'
                self.assertEqual(client.get(path, headers=member).status_code, 404)
                response = client.post("/api/join-by-invite", headers=member,
                                       json={"inviteCode": listing["inviteCode"].lower()})
                self.assertEqual(response.status_code, 201)
                self.assertIsNone(response.json()["inviteCode"])
                self.assertEqual(len(client.get("/api/me/requests", headers=member).json()), 1)
                self.assertEqual(client.post(path + f"/requests/{uid}/approve", headers=admin).status_code, 204)
                self.assertEqual(client.patch(path, headers=member, json={"subject": "Analysis I"}).status_code, 403)
                self.assertEqual(client.post(path + "/messages", headers=member, json={"content": "Hello"}).status_code, 201)
                self.assertEqual(client.get(path + "/messages", headers=admin).json()[0]["content"], "Hello")
                self.assertEqual(client.patch("/api/me", headers=member, json={"firstName": "New"}).status_code, 200)
                self.assertEqual(client.get(path + "/messages", headers=admin).json()[0]["author"]["firstName"], "New")
                self.assertEqual(client.delete(path + "/members/me", headers=admin).status_code, 204)
                self.assertEqual(client.get(path, headers=member).json()["inviteCode"], listing["inviteCode"])
                self.assertEqual(client.delete(path, headers=member).status_code, 204)
                self.assertEqual(client.get(path, headers=member).status_code, 404)
                old_id = client.get("/api/me", headers=admin).json()["id"]
            with TestClient(api.app) as client:
                self.assertNotEqual(client.get("/api/me", headers=admin).json()["id"], old_id)


class MemoryDatabaseTests(unittest.TestCase):
    def test_api_search_across_courses_preserves_filters_and_privacy(self):
        db = MemoryDatabaseManager()
        api.app.dependency_overrides[api.get_database] = lambda: db
        self.addCleanup(api.app.dependency_overrides.clear)
        headers = {"X-User-Id": "reader@example.com", "X-User-Name": "Reader"}
        owner = db.create_user("owner@example.com", "Owner")
        from models import FilterType, ListingFilter
        wanted = ListingFilter(filterType=FilterType.degree, value="master")
        first = db.create_listing(owner.id, ListingForCreate(subject=Course.linearAlgebra, filters=[wanted]))
        second = db.create_listing(owner.id, ListingForCreate(subject=Course.analysisI))
        db.create_listing(owner.id, ListingForCreate(subject=Course.analysisI, isPrivate=True, filters=[wanted]))
        with TestClient(api.app) as client:
            response = client.get("/api/listings", headers=headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual({item["id"] for item in response.json()}, {first.id, second.id})
            self.assertTrue(all(item["inviteCode"] is None for item in response.json()))
            response = client.get("/api/listings", headers=headers, params={"degree": "master"})
            self.assertEqual([item["id"] for item in response.json()], [first.id])
            response = client.get("/api/listings", headers=headers, params={"course": "Analysis I"})
            self.assertEqual([item["id"] for item in response.json()], [second.id])

    def test_public_search_filters_updates_and_cascade(self):
        db = MemoryDatabaseManager()
        owner = db.create_user("owner@example.com", "Owner")
        guest = db.create_user("guest@example.com", "Guest")
        course = next(iter(Course))
        from models import FilterType, ListingFilter
        wanted = ListingFilter(filterType=FilterType.degree, value="master")
        listing = db.create_listing(owner.id, ListingForCreate(subject=course, filters=[wanted, wanted]))
        self.assertEqual(db.get_listings_by_course(course, [wanted])[0].filters, [wanted])
        db.update_listing(listing.id, owner.id, ListingForUpdate(subject=Course.linearAlgebra))
        self.assertEqual(db.get_listings_by_course(course), [])
        self.assertEqual(db.get_listings_by_course(Course.linearAlgebra)[0].subject, Course.linearAlgebra)
        db.update_listing(listing.id, owner.id, ListingForUpdate(subject=course))
        listing.subject = "External mutation"
        self.assertEqual(db.get_listing_by_id(listing.id).subject, course)
        db.request_to_join(listing.id, guest.id)
        with self.assertRaises(ValueError):
            db.request_to_join(listing.id, guest.id)
        with self.assertRaises(PermissionError):
            db.send_message(listing.id, guest.id, MessageForCreate(content="No"))
        db.approve_request(listing.id, guest.id, owner.id)
        db.set_member_role(listing.id, owner.id, MemberRole.member, owner.id)
        self.assertTrue(any(m.role == MemberRole.admin for m in db.get_users_by_listing(listing.id)))
        admin = next(m.user.id for m in db.get_users_by_listing(listing.id) if m.role == MemberRole.admin)
        db.update_listing(listing.id, admin, ListingForUpdate(isPrivate=True))
        self.assertEqual(db.get_listings_by_course(course), [])
        db.set_listing_filters(listing.id, admin, [])
        self.assertEqual(db.get_listing_by_id(listing.id).filters, [])
        db.send_message(listing.id, owner.id, MessageForCreate(content="Hello"))
        db.leave_listing(listing.id, owner.id)
        db.leave_listing(listing.id, guest.id)
        self.assertIsNone(db.get_listing_by_id(listing.id))
        self.assertEqual(db.get_messages_by_listing(listing.id), [])
        self.assertEqual(db.get_role(listing.id, guest.id), None)
