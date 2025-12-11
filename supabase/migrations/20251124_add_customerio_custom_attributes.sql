-- Add Customer.io custom attribute fields to events table
-- These allow configuring custom key/value pairs to be sent to Customer.io
-- instead of hard-coding attributes like ftw2026: true
ALTER TABLE events
ADD COLUMN customerio_custom_attribute_key text,
ADD COLUMN customerio_custom_attribute_value text;

-- Add comments for documentation
COMMENT ON COLUMN events.customerio_custom_attribute_key IS 'Custom attribute key to send to Customer.io when identifying customers (e.g., "ftw2026", "event_tag", etc.). Leave empty to skip custom attributes.';
COMMENT ON COLUMN events.customerio_custom_attribute_value IS 'Custom attribute value to send to Customer.io (e.g., "true", "DVLPR2026", etc.). Only used if customerio_custom_attribute_key is set.';

