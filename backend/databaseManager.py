from os import getenv
from uuid import uuid4

from supabase import Client, create_client

from courses import Course
from models import (
    Listing,
    ListingFilter,
    ListingForCreate,
    ListingForUpdate,
    ListingMember,
    MemberRole,
    Message,
    MessageForCreate,
    PendingRequest,
    User,
    UserForUpdate,
)

# Model field name -> database column name
USER_COLUMNS = {
    "firstName": "first_name",
    "lastName": "last_name",
    "dateOfBirth": "date_of_birth",
    "gender": "gender",
    "major": "major",
    "degree": "degree",
    "pfp": "profile_picture",
    "description": "description",
}

LISTING_COLUMNS = {
    "description": "description",
    "startTime": "start_time",
    "endTime": "end_time",
    "location": "location",
    "courses": "courses",
    "isPrivate": "is_private",
}

# Listings are always loaded together with their filters
LISTING_SELECT = "*, listing_filters(filter_type, value)"
REQUEST_SELECT = f"joined_at, users(*), listings({LISTING_SELECT})"


def to_columns(data: dict, mapping: dict[str, str]) -> dict:
    return {mapping[key]: value for key, value in data.items() if key in mapping}


def listing_courses(subject: str, courses: list[str] | None) -> list[str]:
    """Keep the API's primary subject first in the database course array."""
    return list(dict.fromkeys([subject, *(courses or [])]))


def user_from_row(row: dict) -> User:
    return User(
        id=row["id"],
        firstName=row.get("first_name") or "",
        lastName=row.get("last_name") or "",
        emailAddress=row.get("email"),
        dateOfBirth=row.get("date_of_birth"),
        gender=row.get("gender"),
        major=row.get("major"),
        degree=row.get("degree"),
        pfp=row.get("profile_picture"),
        description=row.get("description") or "",
    )


def listing_from_row(row: dict) -> Listing:
    return Listing(
        id=row["id"],
        createdBy=row.get("created_by"),
        subject=(row.get("courses") or [None])[0],
        description=row.get("description") or "",
        startTime=row.get("start_time"),
        endTime=row.get("end_time"),
        location=row.get("location"),
        courses=row.get("courses") or [],
        isPrivate=row["is_private"],
        inviteCode=row.get("invite_code"),
        filters=[
            ListingFilter(filterType=f["filter_type"], value=f["value"])
            for f in row.get("listing_filters") or []
        ],
    )


def request_from_row(row: dict) -> PendingRequest:
    return PendingRequest(
        listing=listing_from_row(row["listings"]),
        user=user_from_row(row["users"]),
        requestedAt=row["joined_at"],
    )


def message_from_row(row: dict) -> Message:
    return Message(
        id=row["id"],
        listingId=row["listing_id"],
        author=user_from_row(row["users"]) if row.get("users") else None,
        sentAt=row["sent_at"],
        content=row["content"],
    )


class DatabaseManager:
    """Talks to Supabase.

    Uses the service role key, which bypasses Row Level Security. Every function that
    changes data therefore checks permissions itself (raises PermissionError).
    Read functions don't: the endpoints decide who may read what.
    """

    def __init__(self):
        url = getenv("SUPABASE_URL")
        key = getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        self.client: Client = create_client(url, key)

    # ===== Users =====

    def get_user_by_id(self, user_id: str) -> User | None:
        rows = self.client.table("users").select("*").eq("id", user_id).limit(1).execute().data
        return user_from_row(rows[0]) if rows else None

    def get_user_by_email(self, email: str) -> User | None:
        rows = (
            self.client.table("users")
            .select("*")
            .eq("email", email.strip().lower())
            .limit(1)
            .execute()
            .data
        )
        return user_from_row(rows[0]) if rows else None

    def create_user(self, email: str, first_name: str, last_name: str = "") -> User:
        row = (
            self.client.table("users")
            .insert({"id": str(uuid4()), "email": email.strip().lower(), "first_name": first_name, "last_name": last_name})
            .execute()
            .data[0]
        )
        return user_from_row(row)

    def get_or_create_user(self, email: str, full_name: str) -> User:
        """For the portal login headers (X-User-Id = email, X-User-Name = full name)."""
        user = self.get_user_by_email(email)
        if user is not None:
            return user
        first_name, _, last_name = full_name.strip().partition(" ")
        return self.create_user(email, first_name, last_name)

    def update_user(self, user_id: str, update: UserForUpdate) -> User:
        columns = to_columns(update.model_dump(mode="json", exclude_unset=True), USER_COLUMNS)
        if columns:
            self.client.table("users").update(columns).eq("id", user_id).execute()
        user = self.get_user_by_id(user_id)
        if user is None:
            raise ValueError("User not found")
        return user

    def get_users_by_listing(self, listing_id: str) -> list[ListingMember]:
        """Admins and members of a listing (no pending requests), longest members first."""
        rows = (
            self.client.table("listing_members")
            .select("role, joined_at, users(*)")
            .eq("listing_id", listing_id)
            .in_("role", [MemberRole.admin.value, MemberRole.member.value])
            .order("joined_at")
            .execute()
            .data
        )
        return [
            ListingMember(user=user_from_row(row["users"]), role=row["role"], joinedAt=row["joined_at"])
            for row in rows
        ]

    # ===== Listings =====

    def get_listing_by_id(self, listing_id: str) -> Listing | None:
        rows = (
            self.client.table("listings")
            .select(LISTING_SELECT)
            .eq("id", listing_id)
            .limit(1)
            .execute()
            .data
        )
        return listing_from_row(rows[0]) if rows else None

    def get_listings_by_course(
        self, course: Course | None = None, filters: list[ListingFilter] | None = None
    ) -> list[Listing]:
        """Public listings, optionally limited to a course, with every given filter."""
        query = self.client.table("listings").select(LISTING_SELECT)
        if course is not None:
            query = query.contains("courses", [course.value])
        rows = query.eq("is_private", False).execute().data
        listings = [listing_from_row(row) for row in rows]
        return [
            listing
            for listing in listings
            if all(wanted in listing.filters for wanted in filters or [])
        ]

    def get_listings_by_user_id(self, user_id: str) -> list[Listing]:
        """Listings the user is admin or member of (pending requests: see get_pending_requests_by_user_id)."""
        rows = (
            self.client.table("listing_members")
            .select(f"listings({LISTING_SELECT})")
            .eq("user_id", user_id)
            .in_("role", [MemberRole.admin.value, MemberRole.member.value])
            .execute()
            .data
        )
        return [listing_from_row(row["listings"]) for row in rows]

    def create_listing(self, creator_id: str, listing: ListingForCreate) -> Listing:
        """The creator becomes admin automatically (database trigger)."""
        columns = to_columns(listing.model_dump(mode="json"), LISTING_COLUMNS)
        columns["courses"] = listing_courses(listing.subject.value, columns.get("courses"))
        columns["created_by"] = creator_id
        row = self.client.table("listings").insert(columns).execute().data[0]
        self.insert_filters(row["id"], listing.filters)
        return self.get_listing_by_id(row["id"])

    def update_listing(self, listing_id: str, admin_id: str, update: ListingForUpdate) -> Listing:
        self.require_admin(listing_id, admin_id)
        columns = to_columns(update.model_dump(mode="json", exclude_unset=True), LISTING_COLUMNS)
        # Preserve null handling from the function-based implementation.
        if "description" in columns and columns["description"] is None:
            columns["description"] = ""
        if "is_private" in columns and columns["is_private"] is None:
            del columns["is_private"]
        if "subject" in update.model_fields_set or "courses" in update.model_fields_set:
            existing = self.get_listing_by_id(listing_id)
            if existing is None:
                raise ValueError("Listing not found")
            subject = update.subject or existing.subject
            courses = columns.get("courses") if "courses" in update.model_fields_set else existing.courses[1:]
            columns["courses"] = listing_courses(subject.value, courses)
        if columns:
            self.client.table("listings").update(columns).eq("id", listing_id).execute()
        return self.get_listing_by_id(listing_id)

    def set_listing_filters(self, listing_id: str, admin_id: str, filters: list[ListingFilter]) -> Listing:
        """Replaces all filters of a listing."""
        self.require_admin(listing_id, admin_id)
        self.client.table("listing_filters").delete().eq("listing_id", listing_id).execute()
        self.insert_filters(listing_id, filters)
        return self.get_listing_by_id(listing_id)

    def delete_listing(self, listing_id: str, admin_id: str):
        """Also deletes its filters, members and messages (cascade)."""
        self.require_admin(listing_id, admin_id)
        self.client.table("listings").delete().eq("id", listing_id).execute()

    def insert_filters(self, listing_id: str, filters: list[ListingFilter]):
        # dict.fromkeys removes duplicates (the table has a unique constraint)
        unique = dict.fromkeys((f.filterType.value, f.value) for f in filters)
        if unique:
            self.client.table("listing_filters").insert(
                [{"listing_id": listing_id, "filter_type": t, "value": v} for t, v in unique]
            ).execute()

    # ===== Membership & join requests =====

    def get_role(self, listing_id: str, user_id: str) -> MemberRole | None:
        """None if the user has no relation to the listing."""
        rows = (
            self.client.table("listing_members")
            .select("role")
            .eq("listing_id", listing_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data
        )
        return MemberRole(rows[0]["role"]) if rows else None

    def is_listing_admin(self, listing_id: str, user_id: str) -> bool:
        return self.get_role(listing_id, user_id) == MemberRole.admin

    def is_listing_member(self, listing_id: str, user_id: str) -> bool:
        """True for admins and members, False for pending requests."""
        return self.get_role(listing_id, user_id) in (MemberRole.admin, MemberRole.member)

    def require_admin(self, listing_id: str, user_id: str):
        if not self.is_listing_admin(listing_id, user_id):
            raise PermissionError("Only admins of this listing can do this")

    def get_pending_requests_by_user_id(self, user_id: str) -> list[PendingRequest]:
        rows = (
            self.client.table("listing_members")
            .select(REQUEST_SELECT)
            .eq("user_id", user_id)
            .eq("role", MemberRole.requestPending.value)
            .order("joined_at")
            .execute()
            .data
        )
        return [request_from_row(row) for row in rows]

    def get_pending_requests_by_listing(self, listing_id: str) -> list[PendingRequest]:
        rows = (
            self.client.table("listing_members")
            .select(REQUEST_SELECT)
            .eq("listing_id", listing_id)
            .eq("role", MemberRole.requestPending.value)
            .order("joined_at")
            .execute()
            .data
        )
        return [request_from_row(row) for row in rows]

    def request_to_join(self, listing_id: str, user_id: str):
        listing = self.get_listing_by_id(listing_id)
        if listing is None:
            raise ValueError("Listing not found")
        if listing.isPrivate:
            raise PermissionError("This listing is private, join requests need an invite code")
        self.insert_request(listing_id, user_id)

    def request_to_join_by_invite_code(self, invite_code: str, user_id: str) -> Listing:
        """Works for private listings too. The admin still has to approve the request."""
        rows = (
            self.client.table("listings")
            .select(LISTING_SELECT)
            .eq("invite_code", invite_code.strip().upper())
            .limit(1)
            .execute()
            .data
        )
        if not rows:
            raise ValueError("Invalid invite code")
        listing = listing_from_row(rows[0])
        self.insert_request(listing.id, user_id)
        return listing

    def insert_request(self, listing_id: str, user_id: str):
        if self.get_role(listing_id, user_id) is not None:
            raise ValueError("Already a member or request already sent")
        self.client.table("listing_members").insert(
            {"listing_id": listing_id, "user_id": user_id, "role": MemberRole.requestPending.value}
        ).execute()

    def approve_request(self, listing_id: str, user_id: str, admin_id: str):
        self.require_admin(listing_id, admin_id)
        updated = (
            self.client.table("listing_members")
            .update({"role": MemberRole.member.value})
            .eq("listing_id", listing_id)
            .eq("user_id", user_id)
            .eq("role", MemberRole.requestPending.value)
            .execute()
            .data
        )
        if not updated:
            raise ValueError("No pending request from this user")

    def set_member_role(self, listing_id: str, user_id: str, role: MemberRole, admin_id: str):
        """Promote a member to admin or demote an admin to member.
        If the last admin is demoted, the database assigns a new one."""
        self.require_admin(listing_id, admin_id)
        if role == MemberRole.requestPending:
            raise ValueError("Use remove_member to remove someone")
        updated = (
            self.client.table("listing_members")
            .update({"role": role.value})
            .eq("listing_id", listing_id)
            .eq("user_id", user_id)
            .in_("role", [MemberRole.admin.value, MemberRole.member.value])
            .execute()
            .data
        )
        if not updated:
            raise ValueError("User is not a member of this listing")

    def remove_member(self, listing_id: str, user_id: str, admin_id: str):
        """Reject a pending request or kick a member/admin."""
        self.require_admin(listing_id, admin_id)
        self.client.table("listing_members").delete().eq("listing_id", listing_id).eq("user_id", user_id).execute()

    def leave_listing(self, listing_id: str, user_id: str):
        """Leave a listing or cancel an own pending request.
        If the last admin leaves, the database assigns a new one (or deletes the empty listing)."""
        self.client.table("listing_members").delete().eq("listing_id", listing_id).eq("user_id", user_id).execute()

    # ===== Messages =====

    def get_messages_by_listing(self, listing_id: str) -> list[Message]:
        """Oldest message first."""
        rows = (
            self.client.table("messages")
            .select("*, users(*)")
            .eq("listing_id", listing_id)
            .order("sent_at")
            .execute()
            .data
        )
        return [message_from_row(row) for row in rows]

    def send_message(self, listing_id: str, user_id: str, message: MessageForCreate) -> Message:
        if not self.is_listing_member(listing_id, user_id):
            raise PermissionError("Only members of this listing can write in the chat")
        row = (
            self.client.table("messages")
            .insert(
                {
                    "listing_id": listing_id,
                    "user_id": user_id,
                    "content": message.content,
                }
            )
            .execute()
            .data[0]
        )
        row["users"] = self.client.table("users").select("*").eq("id", user_id).execute().data[0]
        return message_from_row(row)
