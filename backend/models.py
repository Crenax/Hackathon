from datetime import date, datetime
from enum import Enum

from pydantic import AliasChoices, BaseModel, Field, field_validator

from courses import Course



# Enums
class Gender(str, Enum):
    preferNotToSay = "prefer_not_to_say"
    male = "male"
    female = "female"
    nonBinary = "non_binary"


class Major(str, Enum):
    ComputerScience = "computer_science"


class Degree(str, Enum):
    Bachelor = "bachelor"
    Master = "master"
    PHD = "phd"


class FilterType(str, Enum):
    gender = "gender"
    degree = "degree"


class MemberRole(str, Enum):
    admin = "admin"
    member = "member"
    requestPending = "request_pending"


class User(BaseModel):
    id: str
    firstName: str = Field(
        default="",
        validation_alias=AliasChoices("firstName", "name")
    )
    lastName: str = ""
    emailAddress: str | None = None
    dateOfBirth: date | None = None
    gender: Gender | None = None
    major: Major | None = None
    degree: Degree | None = None
    pfp: str | None = None
    description: str = ""


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
    pfp: str | None = None
    description: str | None = None


class ListingFilter(BaseModel):
    filterType: FilterType
    value: str  # e.g. "female" for gender, "master" for degree


class Listing(BaseModel):
    id: str
    createdBy: str | None = None
    subject: Course
    description: str = ""
    startTime: datetime | None = None
    endTime: datetime | None = None
    location: str | None = None
    courses: list[Course] = []
    isPrivate: bool = False
    inviteCode: str | None = None
    filters: list[ListingFilter] = []


class ListingForCreate(BaseModel):
    subject: Course
    description: str = ""
    startTime: datetime | None = None
    endTime: datetime | None = None
    location: str | None = None
    courses: list[Course] = []
    isPrivate: bool = False
    filters: list[ListingFilter] = []


class ListingForUpdate(BaseModel):
    # Only the fields that are sent get updated; send null to unset start/end time or location
    subject: Course | None = None
    description: str | None = Field(default=None, validation_alias=AliasChoices("description", "newDescription"))
    startTime: datetime | None = Field(default=None, validation_alias=AliasChoices("startTime", "newStartTime"))
    endTime: datetime | None = Field(default=None, validation_alias=AliasChoices("endTime", "newEndTime"))
    location: str | None = Field(default=None, validation_alias=AliasChoices("location", "newLocation"))
    courses: list[Course] | None = Field(default=None, validation_alias=AliasChoices("courses", "newCourses"))
    isPrivate: bool | None = Field(default=None, validation_alias=AliasChoices("isPrivate", "newIsPrivate"))

    @field_validator("subject")
    @classmethod
    def subject_cannot_be_null(cls, value: Course | None) -> Course:
        if value is None:
            raise ValueError("subject must be a course name")
        return value


class ListingMember(BaseModel):
    user: User
    role: MemberRole
    joinedAt: datetime


class PendingRequest(BaseModel):
    listing: Listing
    user: User
    requestedAt: datetime


class Message(BaseModel):
    id: str
    listingId: str
    author: User | None = None  # None if the author deleted their account
    sentAt: datetime
    subject: str | None = None
    content: str


class MessageForCreate(BaseModel):
    subject: str | None = None
    content: str


class TodoItem(BaseModel):
    id: int
    title: str
    description: str
    deadline: datetime


class TodoItemForCreate(BaseModel):
    title: str
    description: str
    deadline: datetime
