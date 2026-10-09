from datetime import date, datetime

from pydantic import BaseModel

class Gender(Enum):
    prefferNotToSay,
    male,
    female,
    nonBinary

class Major(Enum):
    ComputerScience

class Degree(Enum):
    Bachelor,
    Master,
    PHD

class course(Enum):
    linearAlgebra

class User(BaseModel):
    id: str
    firstName: str
    lastName: str
    emailAdress: str
    dateOfBirth: date
    gender: Gender
    major: Major
    degree: Degree
    strengths: list[course]
    weaknesses: list[course]
    pfp: str
    description: str
    blockedEmails: list[str]
    buddies: list[int] #IDs of the buddies
    


class TodoItem(BaseModel):
    id: int
    title: str
    description: str
    deadline: datetime


class TodoItemForCreate(BaseModel):
    title: str
    description: str
    deadline: datetime
