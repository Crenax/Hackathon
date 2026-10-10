import asyncio
from collections import defaultdict
from datetime import datetime, timedelta
from urllib.parse import unquote

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Request, status
from fastapi.sse import EventSourceResponse, ServerSentEvent

import ai
from models import TodoItem, TodoItemForCreate, User

# Load the .env file from the project root (Docker passes the variables in directly)
load_dotenv()

# Requests without login headers (public access, local development) share this user
GUEST_USER = User(
    id="guest",
    firstName="Guest",
    lastName=""
)


class ManageListings:
    def __init__(self):
        self.listings: dict[int, list[Listing]] = defaultdict(list) # TODO: Import from database

    def syncronize_data(self):
        pass  # TODO: Implement data synchronization betweem the backend and the database

    def get_listings(self, user_id:int, course_ids:list[int]) -> list[Listing]:
        return self.listings

    def create_listing(self, user_id:int, listing:Listing) -> Listing:
        self.listings.append(listing)
        self.syncronize_data()
        return listing

    def delete_listing(self, user_id:int, listing_id:int):
        self.listings = [
            listing for listing in self.listings[user_id] if listing.id != listing_id
        ]
        self.syncronize_data()

listings_manager = ManageListings()





# Open live update streams per user id (one queue per open tab)
listeners: dict[str, set[asyncio.Queue]] = defaultdict(set)

app = FastAPI(docs_url="/api/docs", openapi_url="/api/openapi.json")


# Every endpoint that needs the current user calls this with its request
def extract_user(request: Request) -> User:
    id = request.headers.get("X-User-Id", "").strip()
    if not id:
        return GUEST_USER

    name = request.headers.get("X-User-Name")
    # The VIScon proxy percent-encodes non-ASCII characters (e.g. "Zo%C3%AB" -> "Zoë")
    name = unquote(name) if name else id

    return User(id=id, name=name)


@app.get("/api/me", response_model=User)
def auth_me(request: Request):
    return extract_user(request)



# TODO: Manage API requests for listings (create, delete, get)



if __name__ == "__main__":
    print("Starting server")
    uvicorn.run(
        "__main__:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
