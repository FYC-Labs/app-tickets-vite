-- Add Customer.io integration fields to events table
ALTER TABLE events
ADD COLUMN customerio_app_api_key text,
ADD COLUMN customerio_transactional_template_id text;

-- Add comment for documentation
COMMENT ON COLUMN events.customerio_app_api_key IS 'Customer.io App API Key for transactional email integration (use Bearer token auth)';
COMMENT ON COLUMN events.customerio_transactional_template_id IS 'Customer.io transactional email template ID to trigger';

