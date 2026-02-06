-- Add Customer.io Track API credentials to events table
ALTER TABLE events
ADD COLUMN customerio_site_id text,
ADD COLUMN customerio_track_api_key text;

-- Add comments for documentation
COMMENT ON COLUMN events.customerio_site_id IS 'Customer.io Site ID for Track API integration (used for identify calls)';
COMMENT ON COLUMN events.customerio_track_api_key IS 'Customer.io Track API Key (used with Site ID for Basic Auth in Track API calls)';

