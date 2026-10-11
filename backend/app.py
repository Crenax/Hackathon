"""Authenticated API behind the VIScon identity proxy."""

from contextlib import asynccontextmanager
from ipaddress import ip_address
import logging
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import unquote, urlsplit

import httpx
import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Path as PathParam, Request, Response
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError
from pydantic import BaseModel, ValidationError

import calanderManager
import databaseManager as db
from campus_schedule import ScheduleUnavailableError, availability
from courses import Course
from models import *

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger("uvicorn.error")

# Postgres error code for a unique/primary key violation
UNIQUE_VIOLATION = "23505"

# Listing and user ids are UUIDs; anything else is rejected with 422 before reaching the database
Id = Annotated[str, PathParam(pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")]

def is_user_complete(user: User) -> bool:
    return (
		user.Name != "" and
		str.Name is not None and
        user.dateOfBirth is not None 
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.initDatabaseManager()
    yield

async def require_proxy_identity(request: Request, call_next):
    def is_localhost(host: str | None) -> bool:
        if host == "localhost":
            return True
        try:
            return ip_address(host or "").is_loopback
        except ValueError:
            return False

    identity = {}
    for header in ("X-User-Id", "X-User-Name"):
        values = request.headers.getlist(header)
        if len(values) != 1:
            return JSONResponse({"detail": "Both proxy authentication headers are required"}, status_code=401)
        try:
            value = unquote(values[0], errors="strict")
        except UnicodeDecodeError:
            return JSONResponse({"detail": "Invalid proxy authentication headers"}, status_code=401)
        if not value.strip() or any(ord(c) < 32 or ord(c) == 127 for c in value):
            return JSONResponse({"detail": "Invalid proxy authentication headers"}, status_code=401)
        identity[header] = value.strip()

    email = identity["X-User-Id"]
    local, separator, domain = email.partition("@")
    if not separator or not local or not domain or "@" in domain or any(c.isspace() for c in email):
        return JSONResponse({"detail": "X-User-Id must contain the proxy user's email"}, status_code=401)

    request.state.proxy_email = email.lower()
    request.state.proxy_name = identity["X-User-Name"]

    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


def current_user(request: Request) -> User:
    # The proxy email identifies the account; permissions use its database ID.
    user = db.get_user_by_email(request.state.proxy_email)
    if user is not None:
        return user
    try:
        return db.create_user_From_External_Info(request.state.proxy_name, request.state.proxy_email)
    except APIError as error:
        # A parallel first request already created this user
        if error.code != UNIQUE_VIOLATION:
            raise
        return db.get_user_by_email(request.state.proxy_email)


CurrentUser = Annotated[User, Depends(current_user)]


def require_complete_user(user: CurrentUser) -> User:
    # Date of birth, degree and major must be set; /api/me stays open so the profile can be completed
    if not is_user_complete(user):
        raise HTTPException(403, "User profile incomplete")
    return user


CompleteUser = Annotated[User, Depends(require_complete_user)]
app = FastAPI(
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
    dependencies=[Depends(current_user)],
)
app.middleware("http")(require_proxy_identity)


@app.exception_handler(PermissionError)
async def permission_error(request: Request, exc: PermissionError):
    return JSONResponse({"detail": str(exc)}, status_code=403)


@app.exception_handler(ValueError)
async def invalid_operation(request: Request, exc: ValueError):
    # pydantic's ValidationError is also a ValueError: there it means bad data on the server, not a bad request
    if isinstance(exc, ValidationError):
        logger.error("Invalid data while building a response", exc_info=exc)
        return JSONResponse({"detail": "Internal server error"}, status_code=500)
    return JSONResponse({"detail": "Invalid operation or conflicting resource state"}, status_code=400)


@app.exception_handler(APIError)
async def database_error(request: Request, exc: APIError):
    # Do not expose database internals or credentials to clients.
    return JSONResponse({"detail": "Database operation failed"}, status_code=502)


@app.exception_handler(httpx.HTTPError)
async def database_connection_error(request: Request, exc: httpx.HTTPError):
    return JSONResponse({"detail": "Database is unavailable"}, status_code=503)


def is_listing_admin(listing_id: str, user: User) -> bool:
    return db.get_role_by_user_id_and_listing_id(user.id, listing_id) == MemberRole.admin


def is_listing_member(listing_id: str, user: User) -> bool:
    # Admins and members, not pending requests
    return db.get_role_by_user_id_and_listing_id(user.id, listing_id) in (MemberRole.admin, MemberRole.member)


def visible_listing(listing_id: str, user: User) -> Listing:
    listing = db.get_listing_by_id(listing_id)
    if listing is None or (listing.isPrivate and not is_listing_member(listing_id, user)):
        raise HTTPException(404, "Listing not found")
    return listing


def require_member(listing_id: str, user: User) -> Listing:
    listing = visible_listing(listing_id, user)
    if not is_listing_member(listing_id, user):
        raise HTTPException(403, "Listing membership is required")
    return listing


def require_admin(listing_id: str, user: User) -> Listing:
    listing = visible_listing(listing_id, user)
    if not is_listing_admin(listing_id, user):
        raise PermissionError("Only admins of this listing can do this")
    return listing


class RoleUpdate(BaseModel):
    role: Literal[MemberRole.admin, MemberRole.member]


class CalendarLink(BaseModel):
    url: str


@app.get("/api/me", response_model=User, dependencies=[Depends(current_user)])
def get_me(user: CurrentUser):
    return user


@app.patch("/api/me", response_model=User, dependencies=[Depends(current_user)])
def update_me(update: UserForUpdate, user: CurrentUser):
    return db.update_user_by_id(user.id, update)


@app.get("/api/lecture-halls")
def get_lecture_halls(building: str, user: CompleteUser):
    try:
        return availability(building.strip().upper().removeprefix("ETH."))
    except ValueError as error:
        raise HTTPException(404, str(error)) from error
    except ScheduleUnavailableError as error:
        raise HTTPException(503, str(error)) from error


@app.get("/api/courses", response_model=list[Course])
def get_courses():
    return list(Course)


@app.get("/api/me/listings", response_model=list[Listing])
def get_my_listings(user: CompleteUser):
    return db.get_listings_by_user_id(user.id)


@app.get("/api/me/requests", response_model=list[ListingMember])
def get_my_requests(user: CompleteUser):
    return db.get_pending_requests_by_user_id(user.id)


@app.get("/api/listings", response_model=list[Listing])
def get_listings(user: CompleteUser, course: Course | None = None):
    return db.get_listings_by_course(course)


@app.post("/api/listings", response_model=Listing, status_code=201)
def create_listing(listing: ListingForCreate, user: CompleteUser):
    return db.create_listing(listing.model_copy(update={"createdBy": user}))


@app.get("/api/listings/{listing_id}", response_model=Listing)
def get_listing(listing_id: Id, user: CompleteUser):
    return visible_listing(listing_id, user)


@app.get("/api/listings/{listing_id}/calendar", response_model=CalendarLink)
def get_calendar_link(listing_id: Id, user: CompleteUser):
    # Outlook deep link that opens a prefilled "new event" form for the listing
    listing = visible_listing(listing_id, user)
    return CalendarLink(url=calanderManager.get_outlook_calendar_link(listing))


@app.patch("/api/listings/{listing_id}", response_model=Listing)
def update_listing(listing_id: Id, update: ListingForUpdate, user: CompleteUser):
    require_admin(listing_id, user)
    if update.newIsPrivate:
        # Nobody can join a private listing, so open requests are declined (and stop seeing it)
        db.delete_pending_requests_by_listing_id(listing_id)
    return db.update_listing_by_id(listing_id, update)


@app.delete("/api/listings/{listing_id}", status_code=204)
def delete_listing(listing_id: Id, user: CompleteUser):
    require_admin(listing_id, user)
    db.delete_listing_by_id(listing_id)
    return Response(status_code=204)


@app.get("/api/listings/{listing_id}/members", response_model=list[ListingMember])
def get_members(listing_id: Id, user: CompleteUser):
    require_member(listing_id, user)
    return db.get_listingMembers_by_listing(listing_id)


@app.get("/api/listings/{listing_id}/requests", response_model=list[ListingMember])
def get_requests(listing_id: Id, user: CompleteUser):
    require_admin(listing_id, user)
    return db.get_pending_requests_by_listing_id(listing_id)


@app.post("/api/listings/{listing_id}/requests", status_code=204)
def request_to_join(listing_id: Id, user: CompleteUser):
    listing = visible_listing(listing_id, user)
    if listing.isPrivate:
        raise PermissionError("This listing is private")
    if db.get_role_by_user_id_and_listing_id(user.id, listing_id) is not None:
        raise ValueError("Already a member or request already sent")
    try:
        db.create_request(user.id, listing_id)
    except APIError as error:
        # e.g. a double click sent the request twice
        if error.code != UNIQUE_VIOLATION:
            raise
        raise ValueError("Already a member or request already sent") from error
    return Response(status_code=204)


@app.post("/api/listings/{listing_id}/requests/{user_id}/approve", status_code=204)
def approve_request(listing_id: Id, user_id: Id, user: CompleteUser):
    require_admin(listing_id, user)
    if db.accept_request_by_user_id_and_listing_id(user_id, listing_id) is None:
        raise ValueError("No pending request from this user")
    return Response(status_code=204)


@app.patch("/api/listings/{listing_id}/members/{user_id}", status_code=204)
def set_member_role(listing_id: Id, user_id: Id, update: RoleUpdate, user: CompleteUser):
    require_admin(listing_id, user)
    if db.update_role_by_user_id_and_listing_id(user_id, listing_id, update.role) is None:
        raise ValueError("User is not a member of this listing")
    return Response(status_code=204)


@app.delete("/api/listings/{listing_id}/members/me", status_code=204)
def leave_listing(listing_id: Id, user: CompleteUser):
    # Pending users must also be able to cancel their request to a private listing.
    if db.get_role_by_user_id_and_listing_id(user.id, listing_id) is None:
        raise HTTPException(404, "Membership or request not found")
    db.delete_listing_member_by_user_id_and_listing_id(user.id, listing_id)
    return Response(status_code=204)


@app.delete("/api/listings/{listing_id}/members/{user_id}", status_code=204)
def remove_member(listing_id: Id, user_id: Id, user: CompleteUser):
    require_admin(listing_id, user)
    db.delete_listing_member_by_user_id_and_listing_id(user_id, listing_id)
    return Response(status_code=204)


@app.get("/api/listings/{listing_id}/messages", response_model=list[Message])
def get_messages(listing_id: Id, user: CompleteUser):
    require_member(listing_id, user)
    return db.get_messages_by_listing(listing_id)


@app.post("/api/listings/{listing_id}/messages", response_model=Message, status_code=201)
def send_message(listing_id: Id, message: MessageForCreate, user: CompleteUser):
    listing = require_member(listing_id, user)
    return db.createMessage(message.model_copy(update={"listing": listing, "author": user}))


if __name__ == "__main__":
    db.initDatabaseManager()
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
