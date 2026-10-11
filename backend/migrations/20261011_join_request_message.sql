-- Apply in the Supabase SQL editor before deploying the updated backend.
BEGIN;
ALTER TABLE public.listing_members
    ADD COLUMN IF NOT EXISTS request_message text NOT NULL DEFAULT ''
    CHECK (char_length(request_message) <= 1000);
COMMENT ON COLUMN public.listing_members.request_message IS
    'Private join-request message. Exposed only by the creator-only requests API; cleared on approval.';
COMMIT;
