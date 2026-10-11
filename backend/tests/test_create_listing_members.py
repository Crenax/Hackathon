"""Direct friend membership during listing creation, without a live database."""

import unittest
from datetime import date
from unittest.mock import MagicMock, patch

import app as api
import databaseManager as database
from models import FriendStatus, Listing, ListingForCreate, MemberRole, User


CREATOR_ID = "00000000-0000-0000-0000-000000000001"
FRIEND_ID = "00000000-0000-0000-0000-000000000002"
STRANGER_ID = "00000000-0000-0000-0000-000000000003"
LISTING_ID = "00000000-0000-0000-0000-000000000004"
class CreateListingMembersAPITests(unittest.TestCase):
    def setUp(self):
        self.creator = User(id=CREATOR_ID, fullName="Creator", dateOfBirth=date(2000, 1, 1))
        self.friend = User(id=FRIEND_ID, fullName="Study Friend", dateOfBirth=date(2000, 1, 2))
        self.listing = Listing(id=LISTING_ID, createdBy=self.creator, memberIds=[CREATOR_ID, FRIEND_ID])
        self.db = MagicMock()
        self.db.get_friend_ids_by_user_id.return_value = [FRIEND_ID]
        self.db.get_user_by_id.return_value = self.friend
        self.db.get_friend_status.return_value = FriendStatus.friends
        self.db.create_listing.return_value = self.listing
        self.db_patch = patch.object(api, "db", self.db)
        self.db_patch.start()

    def tearDown(self):
        self.db_patch.stop()

    def test_accepted_friend_is_forwarded_as_direct_member(self):
        response = api.create_listing(ListingForCreate(
            description="Revision", memberIds=[FRIEND_ID, FRIEND_ID],
        ), self.creator)
        create_input = self.db.create_listing.call_args.args[0]
        self.assertEqual(create_input.createdBy.id, CREATOR_ID)
        self.assertEqual(create_input.memberIds, [FRIEND_ID])
        self.assertEqual(response.memberIds, [CREATOR_ID, FRIEND_ID])
        self.db.create_notifications.assert_called_once_with(
            [FRIEND_ID], api.NotificationType.newListing, LISTING_ID, CREATOR_ID,
        )

    def test_added_friend_is_notified_about_private_listing(self):
        self.listing.isPrivate = True
        api.create_listing(ListingForCreate(
            isPrivate=True, memberIds=[FRIEND_ID],
        ), self.creator)
        self.db.create_notifications.assert_called_once_with(
            [FRIEND_ID], api.NotificationType.newListing, LISTING_ID, CREATOR_ID,
        )

    def test_non_friend_is_rejected_before_listing_creation(self):
        with self.assertRaises(ValueError):
            api.create_listing(ListingForCreate(memberIds=[STRANGER_ID]), self.creator)
        self.db.create_listing.assert_not_called()

    def test_friend_profiles_supply_picker_display_names(self):
        response = api.get_my_friends(self.creator)
        self.assertEqual(response[0].id, FRIEND_ID)
        self.assertEqual(response[0].fullName, "Study Friend")
        self.assertEqual(response[0].friendStatus, FriendStatus.friends)


class CreateListingMembersStorageTests(unittest.TestCase):
    def test_selected_friends_are_inserted_as_members(self):
        creator = User(id=CREATOR_ID)
        client = MagicMock()
        query = client.table.return_value
        query.insert.return_value = query
        query.execute.return_value.data = [{"id": LISTING_ID}]
        created = Listing(id=LISTING_ID, createdBy=creator, memberIds=[CREATOR_ID, FRIEND_ID])

        with patch.object(database, "client", client), \
             patch.object(database, "get_listing_by_id", return_value=created):
            result = database.create_listing(ListingForCreate(
                createdBy=creator, memberIds=[FRIEND_ID, FRIEND_ID],
            ))

        self.assertEqual(result, created)
        self.assertEqual(query.insert.call_args_list[1].args[0], [{
            "listing_id": LISTING_ID,
            "user_id": FRIEND_ID,
            "role": MemberRole.member.value,
        }])


if __name__ == "__main__":
    unittest.main()
