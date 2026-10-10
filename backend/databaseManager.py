from os import getenv

from supabase import Client, create_client

from courses import Course
from models import *

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
        courses=row["courses"] or [],
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

def get_pending_requests_by_listing_id(listing_id: str) -> list[ListingMember]:
    # Oldest request first
    rows = (
        client.table("listing_members")
        .select("*")
        .eq("listing_id", listing_id)
        .eq("role", MemberRole.requestPending.value)
        .order("joined_at")
        .execute()
        .data
    )
    return [listingMember_from_row(row) for row in rows]

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

def create_request(userId: str, listingId: str) -> ListingMember:
    # joined_at is set by the database (time of the request)
    row = (
        client.table("listing_members")
        .insert({
            "listing_id": listingId,
            "user_id": userId,
            "role": MemberRole.requestPending.value,
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
        .update({"role": MemberRole.member.value})
        .eq("user_id", user_id)
        .eq("listing_id", listing_id)
        .eq("role", MemberRole.requestPending.value)
        .execute()
        .data
    )
    return listingMember_from_row(rows[0]) if rows else None


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

def delete_messages_by_listing(listing_id: str):
    client.table("messages").delete().eq("listing_id", listing_id).execute()
