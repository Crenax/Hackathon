"""Authenticated API behind the VIScon identity proxy."""

from contextlib import asynccontextmanager
from functools import lru_cache
import logging
from os import getenv
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import unquote

import httpx
import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from courses import Course
from databaseManager import DatabaseManager
from memoryDatabase import MemoryDatabaseManager
from models import (
    Degree, FilterType, Gender, Listing, ListingFilter, ListingForCreate,
    ListingForUpdate, ListingMember, MemberRole, Message, MessageForCreate,
    PendingRequest, User, UserForUpdate,
)

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


@lru_cache(maxsize=1)
def get_database() -> DatabaseManager:
    if (getenv("SUPABASE_URL") or "").strip() and (getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip():
        return DatabaseManager()
    logging.getLogger("uvicorn.error").warning(
        "\n\n" + "!" * 88 + "\n"
        "!!! WARNING: SUPABASE IS NOT CONFIGURED — USING A RAM-ONLY MOCK DATABASE !!!\n"
        "!!! ALL DATA WILL BE LOST WHEN THE SERVER RESTARTS.                     !!!\n"
        "!!! EACH SERVER WORKER HAS ITS OWN SEPARATE DATABASE.                  !!!\n"
        "!!! Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for persistent data. !!!\n"
        + "!" * 88 + "\n"
    )
    return MemoryDatabaseManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_database()
    try:
        yield
    finally:
        get_database.cache_clear()


Database = Annotated[DatabaseManager, Depends(get_database)]


def current_user(request: Request, db: Database) -> User:
    # The proxy email identifies the account; permissions use its database ID.
    return db.get_or_create_user(request.state.proxy_email, request.state.proxy_name)


CurrentUser = Annotated[User, Depends(current_user)]
app = FastAPI(
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
    dependencies=[Depends(current_user)],
)


@app.middleware("http")
async def require_proxy_identity(request: Request, call_next):
    # Run before routing/body validation, including docs, redirects and unknown URLs.
    identity = {}
    for header in ("X-User-Id", "X-User-Name"):
        values = request.headers.getlist(header)
        if len(values) != 1:
            return JSONResponse({"detail": "Both proxy authentication headers are required"}, status_code=401)
        try:
            value = unquote(values[0], errors="strict")
        except UnicodeDecodeError:
            return JSONResponse({"detail": "Invalid proxy authentication headers"}, status_code=401)
        if not value.strip() or any(ord(char) < 32 or ord(char) == 127 for char in value):
            return JSONResponse({"detail": "Invalid proxy authentication headers"}, status_code=401)
        identity[header] = value.strip()
    email = identity["X-User-Id"]
    local, separator, domain = email.partition("@")
    if not separator or not local or not domain or "@" in domain or any(c.isspace() for c in email):
        return JSONResponse({"detail": "X-User-Id must contain the proxy user's email"}, status_code=401)
    request.state.proxy_email = email.lower()
    request.state.proxy_name = identity["X-User-Name"]
    response = await call_next(request)
    # Authenticated responses must not be reused across users by a proxy/cache.
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(PermissionError)
async def permission_error(request: Request, exc: PermissionError):
    return JSONResponse({"detail": str(exc)}, status_code=403)


@app.exception_handler(ValueError)
async def invalid_operation(request: Request, exc: ValueError):
    return JSONResponse({"detail": "Invalid operation or conflicting resource state"}, status_code=400)


@app.exception_handler(APIError)
async def database_error(request: Request, exc: APIError):
    # Do not expose database internals or credentials to clients.
    return JSONResponse({"detail": "Database operation failed"}, status_code=502)


@app.exception_handler(httpx.HTTPError)
async def database_connection_error(request: Request, exc: httpx.HTTPError):
    return JSONResponse({"detail": "Database is unavailable"}, status_code=503)


def listing_for_user(listing: Listing, user: User, db: DatabaseManager) -> Listing:
    if db.is_listing_admin(listing.id, user.id):
        return listing
    return listing.model_copy(update={"inviteCode": None})


def visible_listing(listing_id: str, user: User, db: DatabaseManager) -> Listing:
    listing = db.get_listing_by_id(listing_id)
    if listing is None or (listing.isPrivate and not db.is_listing_member(listing_id, user.id)):
        raise HTTPException(404, "Listing not found")
    return listing


def require_member(listing_id: str, user: User, db: DatabaseManager):
    visible_listing(listing_id, user, db)
    if not db.is_listing_member(listing_id, user.id):
        raise HTTPException(403, "Listing membership is required")


class InviteRequest(BaseModel):
    inviteCode: str = Field(min_length=1, max_length=128)


class RoleUpdate(BaseModel):
    role: Literal[MemberRole.admin, MemberRole.member]


@app.get("/api/me", response_model=User)
def get_me(user: CurrentUser):
    return user


@app.patch("/api/me", response_model=User)
def update_me(update: UserForUpdate, user: CurrentUser, db: Database):
    return db.update_user(user.id, update)


@app.get("/api/courses", response_model=list[Course])
def get_courses():
    return list(Course)


@app.get("/api/me/listings", response_model=list[Listing])
def get_my_listings(user: CurrentUser, db: Database):
    return [listing_for_user(item, user, db) for item in db.get_listings_by_user_id(user.id)]


@app.get("/api/me/requests", response_model=list[PendingRequest])
def get_my_requests(user: CurrentUser, db: Database):
    return [
        item.model_copy(update={"listing": listing_for_user(item.listing, user, db)})
        for item in db.get_pending_requests_by_user_id(user.id)
    ]


@app.get("/api/listings", response_model=list[Listing])
def get_listings(
    user: CurrentUser, db: Database, course: Course | None = None,
    gender: Gender | None = None, degree: Degree | None = None,
):
    filters = []
    if gender is not None:
        filters.append(ListingFilter(filterType=FilterType.gender, value=gender.value))
    if degree is not None:
        filters.append(ListingFilter(filterType=FilterType.degree, value=degree.value))
    return [listing_for_user(item, user, db) for item in db.get_listings_by_course(course, filters)]


@app.post("/api/listings", response_model=Listing, status_code=201)
def create_listing(listing: ListingForCreate, user: CurrentUser, db: Database):
    return db.create_listing(user.id, listing)


@app.post("/api/join-by-invite", response_model=Listing, status_code=201)
def join_by_invite(invite: InviteRequest, user: CurrentUser, db: Database):
    listing = db.request_to_join_by_invite_code(invite.inviteCode, user.id)
    return listing_for_user(listing, user, db)


@app.get("/api/listings/{listing_id}", response_model=Listing)
def get_listing(listing_id: str, user: CurrentUser, db: Database):
    return listing_for_user(visible_listing(listing_id, user, db), user, db)


@app.patch("/api/listings/{listing_id}", response_model=Listing)
def update_listing(listing_id: str, update: ListingForUpdate, user: CurrentUser, db: Database):
    visible_listing(listing_id, user, db)
    return db.update_listing(listing_id, user.id, update)


@app.put("/api/listings/{listing_id}/filters", response_model=Listing)
def set_filters(listing_id: str, filters: list[ListingFilter], user: CurrentUser, db: Database):
    visible_listing(listing_id, user, db)
    return db.set_listing_filters(listing_id, user.id, filters)


@app.delete("/api/listings/{listing_id}", status_code=204)
def delete_listing(listing_id: str, user: CurrentUser, db: Database):
    visible_listing(listing_id, user, db)
    db.delete_listing(listing_id, user.id)
    return Response(status_code=204)


@app.get("/api/listings/{listing_id}/members", response_model=list[ListingMember])
def get_members(listing_id: str, user: CurrentUser, db: Database):
    require_member(listing_id, user, db)
    return db.get_users_by_listing(listing_id)


@app.get("/api/listings/{listing_id}/requests", response_model=list[PendingRequest])
def get_requests(listing_id: str, user: CurrentUser, db: Database):
    visible_listing(listing_id, user, db)
    db.require_admin(listing_id, user.id)
    return db.get_pending_requests_by_listing(listing_id)


@app.post("/api/listings/{listing_id}/requests", status_code=204)
def request_to_join(listing_id: str, user: CurrentUser, db: Database):
    visible_listing(listing_id, user, db)
    db.request_to_join(listing_id, user.id)
    return Response(status_code=204)


@app.post("/api/listings/{listing_id}/requests/{user_id}/approve", status_code=204)
def approve_request(listing_id: str, user_id: str, user: CurrentUser, db: Database):
    visible_listing(listing_id, user, db)
    db.approve_request(listing_id, user_id, user.id)
    return Response(status_code=204)


@app.patch("/api/listings/{listing_id}/members/{user_id}", status_code=204)
def set_member_role(listing_id: str, user_id: str, update: RoleUpdate, user: CurrentUser, db: Database):
    visible_listing(listing_id, user, db)
    db.set_member_role(listing_id, user_id, update.role, user.id)
    return Response(status_code=204)


@app.delete("/api/listings/{listing_id}/members/me", status_code=204)
def leave_listing(listing_id: str, user: CurrentUser, db: Database):
    # Pending users must also be able to cancel their request to a private listing.
    if db.get_role(listing_id, user.id) is None:
        raise HTTPException(404, "Membership or request not found")
    db.leave_listing(listing_id, user.id)
    return Response(status_code=204)


@app.delete("/api/listings/{listing_id}/members/{user_id}", status_code=204)
def remove_member(listing_id: str, user_id: str, user: CurrentUser, db: Database):
    visible_listing(listing_id, user, db)
    db.remove_member(listing_id, user_id, user.id)
    return Response(status_code=204)


@app.get("/api/listings/{listing_id}/messages", response_model=list[Message])
def get_messages(listing_id: str, user: CurrentUser, db: Database):
    require_member(listing_id, user, db)
    return db.get_messages_by_listing(listing_id)


@app.post("/api/listings/{listing_id}/messages", response_model=Message, status_code=201)
def send_message(listing_id: str, message: MessageForCreate, user: CurrentUser, db: Database):
    require_member(listing_id, user, db)
    return db.send_message(listing_id, user.id, message)


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
