
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel
from pydantic import BaseModel, Field, AliasChoices



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


class Course(str, Enum):
    linearAlgebra = "linear_algebra"



class User(BaseModel):
    id: str
    firstName: str = Field(
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


class Listing(BaseModel):
    id: str
    startTime: datetime
    endTime: datetime
    location: str
    members: list[User]
    admin: User


class TodoItem(BaseModel):
    id: int
    title: str
    description: str
    deadline: datetime


class TodoItemForCreate(BaseModel):
    title: str
    description: str
    deadline: datetime

