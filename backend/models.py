from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel

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
    firstName: str = ""
    lastName: str = ""
    emailAddress: str = ""
    dateOfBirth: date | None = None
    gender: Gender | None = None
    major: Major | None = None
    degree: Degree | None = None
    description: str = ""

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

#Models for interaction with db:
class UserForCreate(BaseModel):
    firstName: str = ""
    lastName: str = ""
    emailAddress: str = ""
    dateOfBirth: date | None = None
    gender: Gender | None = None
    major: Major | None = None
    degree: Degree | None = None
    description: str = ""

class UserForUpdate(BaseModel):
    # Only the fields that are sent get updated
    firstName: str | None = None
    lastName: str | None = None
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
