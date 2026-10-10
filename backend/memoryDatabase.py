"""Process-local, RAM-only implementation of the application's database contract."""

from datetime import datetime, timezone
from functools import wraps
from threading import RLock
from uuid import uuid4

from courses import Course
from databaseManager import DatabaseManager
from models import (
    Listing, ListingFilter, ListingForCreate, ListingForUpdate, ListingMember,
    MemberRole, Message, MessageForCreate, PendingRequest, User, UserForUpdate,
)


def locked(method):
    @wraps(method)
    def call(self, *args, **kwargs):
        with self._lock:
            return method(self, *args, **kwargs)
    return call


class MemoryDatabaseManager(DatabaseManager):
    """Preserves permissions and membership behavior without writing any files."""

    def __init__(self):
        self._lock = RLock()
        self._users: dict[str, User] = {}
        self._listings: dict[str, Listing] = {}
        self._members: dict[tuple[str, str], tuple[MemberRole, datetime]] = {}
        self._messages: dict[str, list[Message]] = {}

    @locked
    def get_user_by_id(self, user_id: str) -> User | None:
        user = self._users.get(user_id)
        return user.model_copy(deep=True) if user else None

    @locked
    def get_user_by_email(self, email: str) -> User | None:
        return next((u.model_copy(deep=True) for u in self._users.values()
                     if u.emailAddress == email.strip().lower()), None)

    @locked
    def create_user(self, email: str, first_name: str, last_name: str = "") -> User:
        if self.get_user_by_email(email):
            raise ValueError("User already exists")
        user = User(id=str(uuid4()), emailAddress=email.strip().lower(),
                    firstName=first_name, lastName=last_name)
        self._users[user.id] = user
        return user.model_copy(deep=True)

    @locked
    def get_or_create_user(self, email: str, full_name: str) -> User:
        return super().get_or_create_user(email, full_name)

    @locked
    def update_user(self, user_id: str, update: UserForUpdate) -> User:
        user = self._users.get(user_id)
        if user is None:
            raise ValueError("User not found")
        data = user.model_dump()
        data.update(update.model_dump(exclude_unset=True))
        data["description"] = data["description"] or ""
        self._users[user_id] = User.model_validate(data)
        return self.get_user_by_id(user_id)

    @locked
    def get_users_by_listing(self, listing_id: str) -> list[ListingMember]:
        return [ListingMember(user=self.get_user_by_id(uid), role=role, joinedAt=joined)
                for (lid, uid), (role, joined) in self._members.items()
                if lid == listing_id and role != MemberRole.requestPending]

    @locked
    def get_listing_by_id(self, listing_id: str) -> Listing | None:
        listing = self._listings.get(listing_id)
        return listing.model_copy(deep=True) if listing else None

    @locked
    def get_listings_by_course(self, course: Course, filters: list[ListingFilter] | None = None) -> list[Listing]:
        return [item.model_copy(deep=True) for item in self._listings.values()
                if not item.isPrivate and course in item.courses
                and all(f in item.filters for f in filters or [])]

    @locked
    def get_listings_by_user_id(self, user_id: str) -> list[Listing]:
        return [self.get_listing_by_id(lid) for (lid, uid), (role, _) in self._members.items()
                if uid == user_id and role != MemberRole.requestPending]

    @locked
    def create_listing(self, creator_id: str, listing: ListingForCreate) -> Listing:
        if creator_id not in self._users:
            raise ValueError("User not found")
        item = Listing(id=str(uuid4()), createdBy=creator_id,
                       inviteCode=uuid4().hex.upper(), **listing.model_dump(exclude={"filters"}))
        self._listings[item.id] = item
        self._members[item.id, creator_id] = (MemberRole.admin, datetime.now(timezone.utc))
        self.insert_filters(item.id, listing.filters)
        return self.get_listing_by_id(item.id)

    @locked
    def update_listing(self, listing_id: str, admin_id: str, update: ListingForUpdate) -> Listing:
        self.require_admin(listing_id, admin_id)
        data = self._listings[listing_id].model_dump()
        data.update(update.model_dump(exclude_unset=True))
        data["description"] = data["description"] or ""
        data["courses"] = data["courses"] or []
        self._listings[listing_id] = Listing.model_validate(data)
        return self.get_listing_by_id(listing_id)

    @locked
    def set_listing_filters(self, listing_id: str, admin_id: str, filters: list[ListingFilter]) -> Listing:
        self.require_admin(listing_id, admin_id)
        self._listings[listing_id].filters = []
        self.insert_filters(listing_id, filters)
        return self.get_listing_by_id(listing_id)

    @locked
    def insert_filters(self, listing_id: str, filters: list[ListingFilter]):
        listing = self._listings.get(listing_id)
        if listing is None:
            raise ValueError("Listing not found")
        for item in filters:
            if item not in listing.filters:
                listing.filters.append(item.model_copy(deep=True))

    @locked
    def delete_listing(self, listing_id: str, admin_id: str):
        self.require_admin(listing_id, admin_id)
        self._delete_listing(listing_id)

    def _delete_listing(self, listing_id: str):
        self._listings.pop(listing_id, None)
        self._members = {key: value for key, value in self._members.items() if key[0] != listing_id}
        self._messages.pop(listing_id, None)

    @locked
    def get_role(self, listing_id: str, user_id: str) -> MemberRole | None:
        membership = self._members.get((listing_id, user_id))
        return membership[0] if membership else None

    def _pending_requests(self, *, user_id=None, listing_id=None) -> list[PendingRequest]:
        return [PendingRequest(listing=self.get_listing_by_id(lid),
                               user=self.get_user_by_id(uid), requestedAt=joined)
                for (lid, uid), (role, joined) in self._members.items()
                if role == MemberRole.requestPending
                and (user_id is None or uid == user_id)
                and (listing_id is None or lid == listing_id)]

    @locked
    def get_pending_requests_by_user_id(self, user_id: str) -> list[PendingRequest]:
        return self._pending_requests(user_id=user_id)

    @locked
    def get_pending_requests_by_listing(self, listing_id: str) -> list[PendingRequest]:
        return self._pending_requests(listing_id=listing_id)

    @locked
    def request_to_join(self, listing_id: str, user_id: str):
        super().request_to_join(listing_id, user_id)

    @locked
    def request_to_join_by_invite_code(self, invite_code: str, user_id: str) -> Listing:
        listing = next((item for item in self._listings.values()
                        if item.inviteCode == invite_code.strip().upper()), None)
        if listing is None:
            raise ValueError("Invalid invite code")
        self.insert_request(listing.id, user_id)
        return listing.model_copy(deep=True)

    @locked
    def insert_request(self, listing_id: str, user_id: str):
        if listing_id not in self._listings or user_id not in self._users:
            raise ValueError("Listing or user not found")
        if self.get_role(listing_id, user_id) is not None:
            raise ValueError("Already a member or request already sent")
        self._members[listing_id, user_id] = (MemberRole.requestPending, datetime.now(timezone.utc))

    @locked
    def approve_request(self, listing_id: str, user_id: str, admin_id: str):
        self.require_admin(listing_id, admin_id)
        if self.get_role(listing_id, user_id) != MemberRole.requestPending:
            raise ValueError("No pending request from this user")
        self._members[listing_id, user_id] = (MemberRole.member, self._members[listing_id, user_id][1])

    @locked
    def set_member_role(self, listing_id: str, user_id: str, role: MemberRole, admin_id: str):
        self.require_admin(listing_id, admin_id)
        if role == MemberRole.requestPending:
            raise ValueError("Use remove_member to remove someone")
        if not self.is_listing_member(listing_id, user_id):
            raise ValueError("User is not a member of this listing")
        self._members[listing_id, user_id] = (role, self._members[listing_id, user_id][1])
        self._ensure_admin(listing_id)

    @locked
    def remove_member(self, listing_id: str, user_id: str, admin_id: str):
        self.require_admin(listing_id, admin_id)
        self.leave_listing(listing_id, user_id)

    @locked
    def leave_listing(self, listing_id: str, user_id: str):
        if self._members.pop((listing_id, user_id), None) is not None:
            self._ensure_admin(listing_id)

    def _ensure_admin(self, listing_id: str):
        members = [(uid, role, joined) for (lid, uid), (role, joined) in self._members.items()
                   if lid == listing_id and role != MemberRole.requestPending]
        if not members:
            self._delete_listing(listing_id)
        elif not any(role == MemberRole.admin for _, role, _ in members):
            uid, _, joined = min(members, key=lambda item: item[2])
            self._members[listing_id, uid] = (MemberRole.admin, joined)

    @locked
    def get_messages_by_listing(self, listing_id: str) -> list[Message]:
        return [item.model_copy(deep=True, update={"author": self.get_user_by_id(item.author.id)})
                for item in self._messages.get(listing_id, [])]

    @locked
    def send_message(self, listing_id: str, user_id: str, message: MessageForCreate) -> Message:
        if not self.is_listing_member(listing_id, user_id):
            raise PermissionError("Only members of this listing can write in the chat")
        item = Message(id=str(uuid4()), listingId=listing_id, author=self.get_user_by_id(user_id),
                       sentAt=datetime.now(timezone.utc), content=message.content)
        self._messages.setdefault(listing_id, []).append(item)
        return item.model_copy(deep=True)
