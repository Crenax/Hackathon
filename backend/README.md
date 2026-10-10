# Backend

FastAPI API backed by `DatabaseManager` and Supabase. There is no guest mode or
in-memory listing storage. Every HTTP request, including documentation and
unknown URLs, requires both proxy headers:

```http
X-User-Id: einstein@ethz.ch
X-User-Name: Albert Einstein
```

Missing, empty, duplicate, or invalid identity headers return `401` before any
database access. Percent-encoded names are decoded. The email is normalized and
used to find or create a database user; all permissions and writes use that
user's database ID. Clients cannot supply the acting user's ID in request bodies.

## Deployment trust boundary

These headers are identity assertions from the VIScon authentication proxy.
The backend does not verify a password or token itself. The proxy must remove
client-supplied `X-User-Id` and `X-User-Name` headers and replace them with the
verified identity. The backend and any forwarding frontend must only be reachable
through that trusted proxy in production. Direct access with forged headers can
impersonate a user. The current Docker Compose setup keeps the backend port
internal; the published frontend port must also be restricted to the proxy.

## Configuration and startup

Put these values in the repository root `.env`, or provide environment variables:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

The service-role key must stay on the server. The manager expects the existing
Supabase tables `users`, `listings`, `listing_filters`, `listing_members`, and
`messages`, their relationship definitions, and the triggers/cascades described
in `databaseManager.py`. This backend does not create or migrate the schema.
Listings require a `subject` column. Creator-admin assignment, last-admin
replacement, and deletion of dependent rows are handled by database triggers
and cascades.

```sh
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

Database initialization is lazy. Authenticated API requests return `503` if the
configuration is missing. Unauthenticated requests continue to return `401`.
There is no fallback identity or storage mode when the database fails.

## API

Interactive documentation: `/api/docs`; OpenAPI schema: `/api/openapi.json`.
Both require proxy headers. Browsing through the authenticated portal supplies
them automatically. For local development, send headers explicitly:

```sh
curl http://localhost:8000/api/me \
  -H 'X-User-Id: einstein@ethz.ch' \
  -H 'X-User-Name: Albert Einstein'
```

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET / PATCH | `/api/me` | Read or update the authenticated user's profile |
| GET | `/api/courses` | List course names |
| GET | `/api/me/listings` | List the user's memberships |
| GET | `/api/me/requests` | List the user's pending requests |
| GET | `/api/listings?course=Linear%20Algebra` | Search public listings; optional `gender` and `degree` filters |
| POST | `/api/listings` | Create a listing; current user becomes admin |
| GET / PATCH / DELETE | `/api/listings/{listing_id}` | Read, update, or delete a listing |
| PUT | `/api/listings/{listing_id}/filters` | Replace filters with an array of `{filterType, value}` objects |
| POST | `/api/join-by-invite` | Request membership using `{ "inviteCode": "..." }` |
| GET | `/api/listings/{listing_id}/members` | List members |
| GET / POST | `/api/listings/{listing_id}/requests` | List pending requests or submit the current user's request |
| POST | `/api/listings/{listing_id}/requests/{user_id}/approve` | Approve a request |
| PATCH | `/api/listings/{listing_id}/members/{user_id}` | Set `{ "role": "admin" }` or `{ "role": "member" }` |
| DELETE | `/api/listings/{listing_id}/members/{user_id}` | Reject a request or remove a member |
| DELETE | `/api/listings/{listing_id}/members/me` | Leave or cancel the current user's pending request |
| GET / POST | `/api/listings/{listing_id}/messages` | Read chat or send `{ "content": "..." }` |

All endpoints require authentication. Private listings are visible only to
members/admins; an invite can submit a request but does not immediately grant
membership. Invite codes are returned only to listing admins. Members and chat
are visible only to members/admins. Listing changes, request approval, member
removal, role changes, and pending-request lists require admin membership.
Users can update only their own profile, send requests/messages as themselves,
and leave/cancel only their own membership/request.

A missing or inaccessible listing returns `404`; a denied action returns `403`;
invalid request data returns `422`; invalid/conflicting database operations
return `400`. Database failures return sanitized `502`/`503` errors.
Authenticated responses use `Cache-Control: no-store`.

The old todo endpoints are not part of this API. The existing frontend API client
still contains todo calls and needs to use these listing endpoints.

## Tests

```sh
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m unittest discover -s tests -v
```

Tests use an injected database double and make no database/network requests.
They cover authentication on every route, identity resolution, authorization,
private listings, invite-code visibility, and database error handling. Live
Supabase schema/triggers need integration testing against a configured project.

The API uses FastAPI [middleware](https://fastapi.tiangolo.com/tutorial/middleware/)
to enforce the header requirement before route handling.
