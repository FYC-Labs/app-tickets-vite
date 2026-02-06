-- Add AccruPay environment override to events table
ALTER TABLE events
ADD COLUMN accrupay_environment text CHECK (accrupay_environment IN ('production', 'sandbox'));

-- Add comment for documentation
COMMENT ON COLUMN events.accrupay_environment IS 'Override AccruPay environment for this event. NULL = use global ENV_TAG default, "production" = force production, "sandbox" = force sandbox/qa';

