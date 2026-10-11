from datetime import date, datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, StringConstraints

from courses import Course


# Enums:
class Gender(str, Enum):
    preferNotToSay = "prefer_not_to_say"
    male = "male"
    female = "female"
    nonBinary = "non_binary"


class Major(str, Enum):
    ComputerScience = "computer_science"
    #TODO, Scape


class Degree(str, Enum):
    Bachelor = "bachelor"
    Master = "master"
    PHD = "phd"


class MemberRole(str, Enum):
    admin = "admin"
    member = "member"
    requestPending = "request_pending"


#Base Models:
class User(BaseModel):
    id: str
    fullName: str = ""
    emailAddress: str = ""
    dateOfBirth: date | None = None
    gender: Gender | None = None
    major: Major | None = None
    degree: Degree | None = None
    description: str = ""

class FriendStatus(str, Enum):
    # Relation between the viewer and a profile
    self_ = "self"                        # it's my own profile
    none = "none"
    requestSent = "request_sent"          # I sent a request, not accepted yet
    requestReceived = "request_received"  # they sent me a request I can accept
    friends = "friends"


class PublicUser(BaseModel):
    # What other users may see of a profile: only what users enter on their profile page, no email
    id: str
    fullName: str = ""
    dateOfBirth: date | None = None
    gender: Gender | None = None
    description: str = ""
    friendStatus: FriendStatus = FriendStatus.none

class Listing(BaseModel):
    id: str
    createdBy: User | None = None
    description: str = ""
    startTime: datetime | None = None
    endTime: datetime | None = None
    location: str | None = None
    courses: list[Course] = []
    isPrivate: bool = False
    memberIds: list[str] = []

class Message(BaseModel):
    id: str
    listingId: str
    author: User | None = None  # None if the author deleted their account
    sentAt: datetime
    content: str

class ListingMember(BaseModel):
    user: User
    listing: Listing
    role: MemberRole
    joinedAt: datetime  # time of the request while the role is request_pending


class JoinRequest(ListingMember):
    # Stored in listing_members.request_reason; only the creator-only requests endpoint serializes this field.
    requestReason: str = ""


class JoinRequestForCreate(BaseModel):
    requestReason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""

#Models for interaction with db:
class UserForCreate(BaseModel):
    fullName: str = ""
    emailAddress: str = ""
    dateOfBirth: date | None = None
    gender: Gender | None = None
    major: Major | None = None
    degree: Degree | None = None
    description: str = ""

class UserForUpdate(BaseModel):
    # Only the fields that are sent get updated
    fullName: str | None = None
    dateOfBirth: date | None = None
    gender: Gender | None = None
    major: Major | None = None
    degree: Degree | None = None
    description: str | None = None

class ListingForCreate(BaseModel):
    createdBy: User | None = None  # set by the backend to the current user
    description: str = ""
    startTime: datetime | None = None
    endTime: datetime | None = None
    location: str | None = None
    courses: list[Course] = []
    isPrivate: bool = False

class ListingForUpdate(BaseModel):
    # Only the fields that are sent get updated; send null to unset start/end time or location
    newDescription: str | None = None
    newStartTime: datetime | None = None
    newEndTime: datetime | None = None
    newLocation: str | None = None
    newCourses: list[Course] | None = None
    newIsPrivate: bool | None = None

class MessageForCreate(BaseModel):
    # listing and author are set by the backend; clients only send content
    listing: Listing | None = None
    author: User | None = None
    content: str


class NotificationType(str, Enum):
    message = "message"            # new message in the chat of one of my listings
    joinRequest = "join_request"   # someone asked to join a listing I'm admin of
    friendRequest = "friend_request"  # someone sent me a friend request -> links to their profile
    newListing = "new_listing"        # a friend created a listing -> links to the listing


class Notification(BaseModel):
    id: str
    type: NotificationType
    listingId: str | None = None
    listingTitle: str | None = None  # the listing's description, which is shown as its title
    actorId: str | None = None       # who caused it (message author, requester, friend); None if deleted
    actorName: str | None = None
    isRead: bool = False
    createdAt: datetime
