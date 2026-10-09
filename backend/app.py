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
        self.listings: dict[str, list[Listing]] = defaultdict(list)

    def get_listings(self, user_id: str) -> list[Listing]:
        return self.listings[user_id]

    def create_listing(self, user_id: str, listing: Listing) -> Listing:
        self.listings[user_id].append(listing)
        return listing

    def delete_listing(self, user_id: str, listing_id: str):
        self.listings[user_id] = [
            listing for listing in self.listings[user_id] if listing.id != listing_id
        ]


state = State()

listings_manager = ManageListings()

# Open live update streams per user id (one queue per open tab)
listeners: dict[str, set[asyncio.Queue]] = defaultdict(set)


# Only call this from async endpoints: asyncio queues are not thread-safe
def notify_todos_changed(user_id: str):
    for queue in listeners[user_id]:
        queue.put_nowait({"type": "todos_changed"})


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






""" class State:
    def __init__(self):
        # Mapping from user id to their todo items (in memory, lost on restart)
        self.todos_by_user_id: dict[str, list[TodoItem]] = {}

    def get_todos(self, user_id: str) -> list[TodoItem]:
        # When a new user id is seen, initialize with the default todos
        return self.todos_by_user_id.setdefault(user_id, default_todos())

    def create_todo(self, user_id: str, item: TodoItemForCreate) -> TodoItem:
        todos = self.get_todos(user_id)
        next_id = max((todo.id for todo in todos), default=0) + 1
        new_todo = TodoItem(
            id=next_id,
            title=item.title,
            description=item.description,
            deadline=item.deadline,
        )
        todos.append(new_todo)
        return new_todo

    def delete_todo(self, user_id: str, todo_id: int):
        todos = self.get_todos(user_id)
        self.todos_by_user_id[user_id] = [todo for todo in todos if todo.id != todo_id]

state = State()

@app.get("/api/todos", response_model=list[TodoItem])
def get_todos(request: Request):
    user = extract_user(request)
    return state.get_todos(user.id)


@app.post("/api/todos", response_model=TodoItem, status_code=status.HTTP_201_CREATED)
async def create_todo(request: Request, item: TodoItemForCreate):
    user = extract_user(request)
    todo = state.create_todo(user.id, item)
    notify_todos_changed(user.id)
    return todo


@app.delete("/api/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_todo(request: Request, todo_id: int):
    user = extract_user(request)
    state.delete_todo(user.id, todo_id)
    notify_todos_changed(user.id)


# Server-Sent Events: the response stays open and every yield sends an event to the browser.
@app.get("/api/todos/events", response_class=EventSourceResponse)
async def todo_events(request: Request):
    user = extract_user(request)
    queue = asyncio.Queue()
    listeners[user.id].add(queue)
    try:
        # Send something right away, as some proxies (like Vite's) hold the response until then
        yield ServerSentEvent(comment="connected")
        while True:
            yield await queue.get()
    finally:
        listeners[user.id].discard(queue)


@app.get("/api/todos/generate", response_model=TodoItemForCreate)
def generate_todo(prompt: str):
    try:
        todo = ai.generate_todo(prompt)
        if todo is not None:
            return todo
    except Exception as e:
        print(f"AI todo generation failed: {e!r}")

    # Fail gracefully: return a prefilled todo the user can complete by hand
    return TodoItemForCreate(title=prompt, description="", deadline=datetime.now())
 """

if __name__ == "__main__":
    print("Starting server")
    uvicorn.run(
        "__main__:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
