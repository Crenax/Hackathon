from os import getenv
from uuid import uuid4

from supabase import Client, create_client

from courses import Course
from models import *

COURSE_NAMES = {course.value for course in Course}

# Model field name -> database column name
USER_COLUMNS = {
    "fullName": "full_name",
    "dateOfBirth": "date_of_birth",
    "gender": "gender",
    "major": "major",
    "degree": "degree",
    "description": "description",
}

# ListingForUpdate field -> listings column
LISTING_UPDATE_COLUMNS = {
    "newDescription": "description",
    "newStartTime": "start_time",
    "newEndTime": "end_time",
    "newLocation": "location",
    "newCourses": "courses",
    "newIsPrivate": "is_private",
}

# Listings are always loaded with their member ids
LISTING_SELECT = "*, listing_members(user_id, role)"

client: Client | None = None

def initDatabaseManager():
    global client
    url = getenv("SUPABASE_URL")
    key = getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    client = create_client(url, key)


#turns rows into Models form models.py
def user_from_row(row: dict) -> User:
    return User(
        id=row["id"],
        fullName=row["full_name"] or "",
        emailAddress=row["email"] or "",
        dateOfBirth=row["date_of_birth"],
        gender=row["gender"],
        major=row["major"],
        degree=row["degree"],
        description=row["description"] or "",
    )


def listing_from_row(row: dict) -> Listing:
    return Listing(
        id=row["id"],
        createdBy=get_user_by_id(row["created_by"]) if row["created_by"] else None,
        description=row["description"] or "",
        startTime=row["start_time"],
        endTime=row["end_time"],
        location=row["location"],
        # Skip course names that are no longer in courses.py, instead of failing the whole request
        courses=[course for course in row["courses"] or [] if course in COURSE_NAMES],
        isPrivate=row["is_private"],
        memberIds=[
            m["user_id"]
            for m in row.get("listing_members") or []
            if m["role"] != MemberRole.requestPending.value
        ],
    )


def listingMember_from_row(row: dict) -> ListingMember:
    return ListingMember(
        user=get_user_by_id(row["user_id"]),
        listing=get_listing_by_id(row["listing_id"]),
        role=row["role"],
        joinedAt=row["joined_at"],
    )

def message_from_row(row: dict) -> Message:
    return Message(
        id=row["id"],
        listingId=row["listing_id"],
        author=get_user_by_id(row["user_id"]) if row["user_id"] else None,
        sentAt=row["sent_at"],
        content=row["content"],
    )


#get-functions
#user
def get_user_by_id(user_id: str) -> User | None:
    rows = client.table("users").select("*").eq("id", user_id).limit(1).execute().data
    return user_from_row(rows[0]) if rows else None

def get_user_by_email(email: str) -> User | None:
    rows = client.table("users").select("*").eq("email", email.strip().lower()).limit(1).execute().data
    return user_from_row(rows[0]) if rows else None

#listings
def get_listing_by_id(listing_id: str) -> Listing | None:
    rows = (
        client.table("listings")
        .select(LISTING_SELECT)
        .eq("id", listing_id)
        .limit(1)
        .execute()
        .data
    )
    return listing_from_row(rows[0]) if rows else None

def get_listings_by_course(course: Course | None = None) -> list[Listing]:
    #Public listings, optionally only those whose courses contain the course
    query = client.table("listings").select(LISTING_SELECT).eq("is_private", False)
    if course is not None:
        query = query.contains("courses", [course.value])

    return [listing_from_row(row) for row in query.execute().data]

def get_listings_by_user_id(user_id: str) -> list[Listing]:
    #Listings the user is admin or member of (pending requests: see get_pending_requests_by_user_id)
    rows = (
        client.table("listing_members")
        .select(f"listings({LISTING_SELECT})")
        .eq("user_id", user_id)
        .neq("role", MemberRole.requestPending.value)
        .execute()
        .data
    )
    return [listing_from_row(row["listings"]) for row in rows]

#listing Members
def get_listingMembers_by_userid(user_id: str) -> list[ListingMember]:
    #alle listingMembers where user has really joined
    rows = (
        client.table("listing_members")
        .select("*")
        .eq("user_id", user_id)
        .neq("role", MemberRole.requestPending.value)
        .execute()
        .data
    )
    return [listingMember_from_row(row) for row in rows]

def get_listingMembers_by_listing(listing_id: str) -> list[ListingMember]:
    # Admins und Mitglieder einer Listing (keine pending requests), längste Mitglieder zuerst
    rows = (
        client.table("listing_members")
        .select("*")
        .eq("listing_id", listing_id)
        .neq("role", MemberRole.requestPending.value)
        .order("joined_at")
        .execute()
        .data
    )
    return [listingMember_from_row(row) for row in rows]

#messages
def get_messages_by_listing(listing_id: str) -> list[Message]:
    # Oldest message first
    rows = (
        client.table("messages")
        .select("*")
        .eq("listing_id", listing_id)
        .order("sent_at")
        .execute()
        .data
    )
    return [message_from_row(row) for row in rows]


#various
def get_role_by_user_id_and_listing_id(user_id: str, listing_id: str) -> MemberRole | None:
    #includes pending requests
    rows = (
        client.table("listing_members")
        .select("role")
        .eq("user_id", user_id)
        .eq("listing_id", listing_id)
        .limit(1)
        .execute()
        .data
    )
    return MemberRole(rows[0]["role"]) if rows else None

def get_pending_requests_by_listing_id(listing_id: str) -> list[JoinRequest]:
    # Oldest request first, including the applicant's reason (only for the listing admin)
    rows = (
        client.table("listing_members")
        .select("*")
        .eq("listing_id", listing_id)
        .eq("role", MemberRole.requestPending.value)
        .order("joined_at")
        .execute()
        .data
    )
    return [
        JoinRequest(**listingMember_from_row(row).model_dump(), requestReason=row.get("request_reason") or "")
        for row in rows
    ]

def get_pending_requests_by_user_id(user_id: str) -> list[ListingMember]:
    # Oldest request first
    rows = (
        client.table("listing_members")
        .select("*")
        .eq("user_id", user_id)
        .eq("role", MemberRole.requestPending.value)
        .order("joined_at")
        .execute()
        .data
    )
    return [listingMember_from_row(row) for row in rows]


#create
def create_user_From_External_Info(fullName: str, email: str) -> User:
    row = (
        client.table("users")
        .insert({
            # Generated here, so it works even if the id column has no database default
            "id": str(uuid4()),
            "full_name": fullName.strip(),
            "email": email.strip().lower(),
        })
        .execute()
        .data[0]
    )
    return user_from_row(row)


def create_listing(listingForCreate: ListingForCreate) -> Listing:
    # The database makes createdBy the admin of the new listing
    fields = listingForCreate.model_dump(mode="json")
    row = (
        client.table("listings")
        .insert({
            "created_by": listingForCreate.createdBy.id if listingForCreate.createdBy else None,
            "description": fields["description"],
            "start_time": fields["startTime"],
            "end_time": fields["endTime"],
            "location": fields["location"],
            "courses": fields["courses"],
            "is_private": fields["isPrivate"],
        })
        .execute()
        .data[0]
    )
    return get_listing_by_id(row["id"])

def createMessage(messageForCreate: MessageForCreate) -> Message:
    row = (
        client.table("messages")
        .insert({
            "listing_id": messageForCreate.listing.id,
            "user_id": messageForCreate.author.id,
            "content": messageForCreate.content,
        })
        .execute()
        .data[0]
    )
    return message_from_row(row)

def create_request(userId: str, listingId: str, requestReason: str = "") -> ListingMember:
    # joined_at is set by the database (time of the request)
    row = (
        client.table("listing_members")
        .insert({
            "listing_id": listingId,
            "user_id": userId,
            "role": MemberRole.requestPending.value,
            "request_reason": requestReason,
        })
        .execute()
        .data[0]
    )
    return listingMember_from_row(row)


#update
def update_user_by_id(user_id: str, userForUpdate: UserForUpdate) -> User | None:
    # Only fields that were set get updated
    fields = userForUpdate.model_dump(mode="json", exclude_unset=True)
    columns = {USER_COLUMNS[key]: value for key, value in fields.items() if key in USER_COLUMNS}
    if "full_name" in columns and columns["full_name"] is None:
        columns["full_name"] = ""
    if not columns:
        return get_user_by_id(user_id)

    rows = client.table("users").update(columns).eq("id", user_id).execute().data
    return user_from_row(rows[0]) if rows else None

def update_listing_by_id(listing_id: str, listingForUpdate: ListingForUpdate) -> Listing | None:
    # Only fields that were set get updated; set a field to None to unset start/end time or location
    fields = listingForUpdate.model_dump(mode="json", exclude_unset=True)
    columns = {LISTING_UPDATE_COLUMNS[key]: value for key, value in fields.items() if key in LISTING_UPDATE_COLUMNS}
    if "description" in columns and columns["description"] is None:
        columns["description"] = ""
    if "courses" in columns and columns["courses"] is None:
        columns["courses"] = []
    if "is_private" in columns and columns["is_private"] is None:
        del columns["is_private"]
    if columns:
        client.table("listings").update(columns).eq("id", listing_id).execute()

    return get_listing_by_id(listing_id)

def update_role_by_user_id_and_listing_id(user_id: str, listing_id: str, role: MemberRole) -> ListingMember | None:
    # Promote a member to admin or demote an admin to member. None if the user isn't a member
    # If the last admin is demoted, the database assigns a new one
    rows = (
        client.table("listing_members")
        .update({"role": role.value})
        .eq("user_id", user_id)
        .eq("listing_id", listing_id)
        .neq("role", MemberRole.requestPending.value)
        .execute()
        .data
    )
    return listingMember_from_row(rows[0]) if rows else None

def accept_request_by_user_id_and_listing_id(user_id: str, listing_id: str) -> ListingMember | None:
    # Pending request -> member. None if there was no pending request
    rows = (
        client.table("listing_members")
        .update({"role": MemberRole.member.value, "request_reason": ""})
        .eq("user_id", user_id)
        .eq("listing_id", listing_id)
        .eq("role", MemberRole.requestPending.value)
        .execute()
        .data
    )
    return listingMember_from_row(rows[0]) if rows else None


#notifications
def create_notifications(recipient_ids: list[str], type: NotificationType, listing_id: str | None, actor_id: str | None):
    # One unread notification per recipient
    if not recipient_ids:
        return
    client.table("notifications").insert([
        {"user_id": recipient_id, "type": type.value, "listing_id": listing_id, "actor_id": actor_id}
        for recipient_id in recipient_ids
    ]).execute()

def get_unread_notifications_by_user_id(user_id: str) -> list[Notification]:
    # Newest first
    rows = (
        client.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_read", False)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    notifications = []
    for row in rows:
        listing = get_listing_by_id(row["listing_id"]) if row["listing_id"] else None
        actor = get_user_by_id(row["actor_id"]) if row["actor_id"] else None
        notifications.append(Notification(
            id=row["id"],
            type=row["type"],
            listingId=row["listing_id"],
            listingTitle=listing.description if listing else None,
            actorId=actor.id if actor else None,
            actorName=actor.fullName if actor else None,
            isRead=row["is_read"],
            createdAt=row["created_at"],
        ))
    return notifications

def mark_notification_read_by_id(notification_id: str, user_id: str) -> bool:
    # Only the recipient can mark it; False if it isn't theirs
    rows = (
        client.table("notifications")
        .update({"is_read": True})
        .eq("id", notification_id)
        .eq("user_id", user_id)
        .execute()
        .data
    )
    return bool(rows)


#friendships
def get_friendship_between(user_id: str, other_id: str) -> dict | None:
    # The friendship row between two users in either direction, or None
    for sender, receiver in ((user_id, other_id), (other_id, user_id)):
        rows = (
            client.table("friendships")
            .select("*")
            .eq("sender_id", sender)
            .eq("receiver_id", receiver)
            .limit(1)
            .execute()
            .data
        )
        if rows:
            return rows[0]
    return None

def get_friend_status(user_id: str, other_id: str) -> FriendStatus:
    if user_id == other_id:
        return FriendStatus.self_
    friendship = get_friendship_between(user_id, other_id)
    if friendship is None:
        return FriendStatus.none
    if friendship["is_accepted"]:
        return FriendStatus.friends
    return FriendStatus.requestSent if friendship["sender_id"] == user_id else FriendStatus.requestReceived

def create_friend_request(sender_id: str, receiver_id: str):
    client.table("friendships").insert({"sender_id": sender_id, "receiver_id": receiver_id}).execute()

def accept_friend_request(sender_id: str, receiver_id: str) -> bool:
    # Only the receiver accepts; False if there is no open request from sender to receiver
    rows = (
        client.table("friendships")
        .update({"is_accepted": True})
        .eq("sender_id", sender_id)
        .eq("receiver_id", receiver_id)
        .eq("is_accepted", False)
        .execute()
        .data
    )
    return bool(rows)

def delete_friendship_between(user_id: str, other_id: str):
    # Removes the friendship (accepted or still a request) in either direction,
    # plus the friend-request notifications between the two users
    for sender, receiver in ((user_id, other_id), (other_id, user_id)):
        client.table("friendships").delete().eq("sender_id", sender).eq("receiver_id", receiver).execute()
        (
            client.table("notifications").delete()
            .eq("type", NotificationType.friendRequest.value)
            .eq("actor_id", sender).eq("user_id", receiver)
            .execute()
        )

def get_pending_friend_request_sender_ids(user_id: str) -> list[str]:
    # Ids of users whose friend request to this user is still open, oldest first
    rows = (
        client.table("friendships").select("sender_id")
        .eq("receiver_id", user_id).eq("is_accepted", False)
        .order("created_at")
        .execute().data
    )
    return [row["sender_id"] for row in rows]

def get_friend_ids_by_user_id(user_id: str) -> list[str]:
    # Ids of all accepted friends, whoever sent the request
    sent = (
        client.table("friendships").select("receiver_id")
        .eq("sender_id", user_id).eq("is_accepted", True).execute().data
    )
    received = (
        client.table("friendships").select("sender_id")
        .eq("receiver_id", user_id).eq("is_accepted", True).execute().data
    )
    return [row["receiver_id"] for row in sent] + [row["sender_id"] for row in received]


#delete
def delete_user_by_id(user_id: str):
    # The database also removes the user's memberships/requests and keeps their messages without author
    client.table("users").delete().eq("id", user_id).execute()

def delete_listing_by_id(listing_id: str):
    delete_messages_by_listing(listing_id)

    rows = (
        client.table("listing_members")
        .select("user_id, role")
        .eq("listing_id", listing_id)
        .execute()
        .data
    )
    # Admins last, so the database doesn't promote a new admin while members are being removed
    rows.sort(key=lambda row: row["role"] == MemberRole.admin.value)
    for row in rows:
        delete_listing_member_by_user_id_and_listing_id(row["user_id"], listing_id)

    client.table("listings").delete().eq("id", listing_id).execute()

def delete_listing_member_by_user_id_and_listing_id(user_id: str, listing_id: str):
    # Removes a member/admin or declines a pending request
    # If the last admin is removed, the database assigns a new one (or deletes the empty listing)
    (
        client.table("listing_members")
        .delete()
        .eq("user_id", user_id)
        .eq("listing_id", listing_id)
        .execute()
    )

def delete_pending_requests_by_listing_id(listing_id: str):
    # Declines all open join requests of the listing
    (
        client.table("listing_members")
        .delete()
        .eq("listing_id", listing_id)
        .eq("role", MemberRole.requestPending.value)
        .execute()
    )

def delete_messages_by_listing(listing_id: str):
    client.table("messages").delete().eq("listing_id", listing_id).execute()
