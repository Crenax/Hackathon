from contextlib import asynccontextmanager
from ipaddress import ip_address
from urllib.parse import unquote, urlsplit
from pathlib import Path
from typing import Annotated

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Depends, HTTPException, Response
from fastapi.responses import JSONResponse

import databaseManager as db
from models import User, UserForUpdate, MemberRole, Listing, ListingForCreate, ListingForUpdate, ListingMember, Message, MessageForCreate
from courses import Course
from campus_schedule import availability
import calanderManager

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.initDatabaseManager()
    yield


app = FastAPI(
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)


@app.middleware("http")
async def require_proxy_identity(request: Request, call_next):
    def is_localhost(host: str | None) -> bool:
        if host == "localhost":
            return True
        try:
            return ip_address(host or "").is_loopback
        except ValueError:
            return False

    origin = request.headers.get("origin")
    try:
        local_origin = origin is None or is_localhost(urlsplit(origin).hostname)
    except ValueError:
        local_origin = False

    local_guest = (
        request.client is not None
        and is_localhost(request.client.host)
        and is_localhost(request.url.hostname)
        and local_origin
        and "X-User-Id" not in request.headers
        and "X-User-Name" not in request.headers
    )

    guest_headers = {
        "X-User-Id": "guest@ethz.ch",
        "X-User-Name": "guest guest"
    }

    identity = {}

    for header in ("X-User-Id", "X-User-Name"):
        values = [guest_headers[header]] if local_guest else request.headers.getlist(header)
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
    local, sep, domain = email.partition("@")
    if not sep or not local or not domain or "@" in domain or any(c.isspace() for c in email):
        return JSONResponse({"detail": "X-User-Id must contain the proxy user's email"}, status_code=401)

    request.state.proxy_email = email.lower()
    request.state.proxy_name = identity["X-User-Name"]

    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


def current_user(request: Request) -> User:
    email = request.state.proxy_email
    name = request.state.proxy_name
    user = db.get_user_by_email(email)
    if user is not None:
        return user
    return db.create_user_From_External_Info(name, email)


CurrentUser = Annotated[User, Depends(current_user)]


def is_user_complete(user: User) -> bool:
    return (
        user.date_of_birth is not None and
        user.degree is not None and
        user.major is not None
    )


def require_complete_user(user: CurrentUser):
    if not is_user_complete(user):
        raise HTTPException(403, "User profile incomplete")
    return user


CompleteUser = Annotated[User, Depends(require_complete_user)]


@app.exception_handler(PermissionError)
async def permission_error(request: Request, exc: PermissionError):
    return JSONResponse({"detail": str(exc)}, status_code=403)


@app.exception_handler(ValueError)
async def invalid_operation(request: Request, exc: ValueError):
    return JSONResponse({"detail": "Invalid operation or conflicting resource state"}, status_code=400)


@app.exception_handler(httpx.HTTPError)
async def database_connection_error(request: Request, exc: httpx.HTTPError):
    return JSONResponse({"detail": "Database is unavailable"}, status_code=503)


@app.get("/api/me", response_model=User, dependencies=[Depends(current_user)])
def get_me(user: CurrentUser):
    return user


@app.patch("/api/me", response_model=User, dependencies=[Depends(current_user)])
def update_me(update: UserForUpdate, user: CurrentUser):
    return db.update_user_by_id(user.id, update)


@app.get("/api/courses", response_model=list[Course])
def get_courses(user: CompleteUser):
    return list(Course)


@app.get("/api/lecture-halls")
def get_lecture_halls(building: str, user: CompleteUser):
    return availability(building.strip().upper().removeprefix("ETH."))


@app.get("/api/me/listings", response_model=list[Listing])
def get_my_listings(user: CompleteUser):
    return db.get_listings_by_user_id(user.id)


@app.get("/api/listings", response_model=list[Listing])
def get_listings(course: Course | None = None, user: CompleteUser):
    return db.get_listings_by_course(course)


@app.post("/api/listings", response_model=Listing, status_code=201)
def create_listing(listing: ListingForCreate, user: CompleteUser):
    return db.create_listing(listing.model_copy(update={"createdBy": user}))


@app.get("/api/listings/{listing_id}", response_model=Listing)
def get_listing(listing_id: str, user: CompleteUser):
    listing = db.get_listing_by_id(listing_id)
    if listing is None:
        raise HTTPException(404, "Listing not found")
    return listing


@app.get("/api/listings/{listing_id}/calendar")
def get_calendar_link(listing_id: str, user: CompleteUser):
    listing = db.get_listing_by_id(listing_id)
    if listing is None:
        raise HTTPException(404, "Listing not found")
    return {"url": calanderManager.get_outlook_calendar_link(listing)}


if __name__ == "__main__":
    db.initDatabaseManager()
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
