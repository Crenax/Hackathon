# Join request messages

Before deploying the join-request message feature, run
`20261011_join_request_message.sql` in the project's Supabase SQL editor.
It adds a non-null `request_message` column to `listing_members`, defaults
existing rows to an empty message, and limits messages to 1,000 characters.
The migration is safe to rerun.

Then deploy/restart the backend and rebuild the frontend. Without this migration,
sending requests will fail because the backend writes the new column.

Messages are returned only by `GET /api/listings/{id}/requests`, which checks
`listing.createdBy.id` against the authenticated user. Other admins, members,
and applicants cannot read that endpoint. Ordinary membership and personal
request responses do not include the message. Approval clears the stored text;
deleting a request deletes its message with the membership row. The frontend
displays incoming requests only on the creator's event detail page.

Database access uses the existing server-only Supabase service-role connection.
Do not expose that key or grant clients direct access to membership data.

Run the focused API/privacy checks from `backend`:

```sh
python -m unittest discover -s tests -p test_join_request_privacy.py
```
