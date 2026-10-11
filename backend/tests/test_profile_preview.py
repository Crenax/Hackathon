"""Profile previews require admin access and a pending request on that listing."""
import unittest
from unittest.mock import patch

import httpx
import app as api
from models import Listing, MemberRole, User


class ProfilePreviewTests(unittest.IsolatedAsyncioTestCase):
    async def test_profile_access(self):
        admin = User(id="admin")
        applicant = User(id="applicant", fullName="Ada Lovelace", description="Maths")
        headers = {"X-User-Id": "admin@ethz.ch", "X-User-Name": "Admin"}
        path = "/api/listings/listing/requests/applicant/profile"
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=api.app), base_url="http://test") as client:
            with patch.object(api.db, "get_user_by_email", return_value=admin), \
                 patch.object(api.db, "get_listing_by_id", return_value=Listing(id="listing")), \
                 patch.object(api.db, "get_user_by_id", return_value=applicant) as get_profile, \
                 patch.object(api.db, "get_role_by_user_id_and_listing_id") as get_role:
                self.assertEqual((await client.get(path)).status_code, 401)
                for caller_role, applicant_role, expected in [
                    (MemberRole.admin, MemberRole.requestPending, 200),
                    (MemberRole.member, MemberRole.requestPending, 403),
                    (None, MemberRole.requestPending, 403),
                    (MemberRole.admin, MemberRole.member, 404),
                    (MemberRole.admin, None, 404),
                ]:
                    with self.subTest(caller=caller_role, applicant=applicant_role):
                        get_profile.reset_mock()
                        get_role.side_effect = lambda uid, lid: caller_role if uid == "admin" else applicant_role
                        response = await client.get(path, headers=headers)
                        self.assertEqual(response.status_code, expected)
                        if expected == 200:
                            self.assertEqual(response.json(), applicant.model_dump(mode="json"))
                        else:
                            get_profile.assert_not_called()
                get_role.side_effect = lambda uid, lid: MemberRole.admin if uid == "admin" else MemberRole.requestPending
                get_profile.return_value = None
                self.assertEqual((await client.get(path, headers=headers)).status_code, 404)
