-- Add Slack webhook URL field to events table
-- This allows events to send notifications to Slack channels when orders are created
ALTER TABLE events
ADD COLUMN slack_webhook_url text;

-- Add comment for documentation
COMMENT ON COLUMN events.slack_webhook_url IS 'Slack webhook URL for sending order notifications. When configured, new orders will trigger a Slack notification to this webhook.';
