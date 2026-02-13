-- Add API key column to events table for public order confirmation endpoint
-- Each event gets a unique API key that can only access orders from that event

-- Add api_key column with default empty string temporarily to handle existing rows
ALTER TABLE events
ADD COLUMN api_key text DEFAULT '';

-- Update any existing events with NULL or empty api_key to have a temporary placeholder
-- These will be generated properly when the event is next updated via the edge function
UPDATE events 
SET api_key = 'evt_' || gen_random_uuid()::text 
WHERE api_key = '' OR api_key IS NULL;

-- Now make the column NOT NULL and UNIQUE
ALTER TABLE events
ALTER COLUMN api_key SET NOT NULL,
ADD CONSTRAINT events_api_key_unique UNIQUE (api_key);

-- Remove the default now that existing rows are handled
ALTER TABLE events
ALTER COLUMN api_key DROP DEFAULT;

-- Add index for fast lookups by API key
CREATE INDEX idx_events_api_key ON events(api_key);

-- Add comment for documentation
COMMENT ON COLUMN events.api_key IS 'Unique API key for public order confirmation endpoint. Allows external websites to fetch order details for this event only.';

