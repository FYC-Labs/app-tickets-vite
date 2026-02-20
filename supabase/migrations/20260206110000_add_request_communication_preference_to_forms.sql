-- Add request_communication_preference column to forms table
-- Migration created: 2026-02-06
-- Adds request_communication_preference column to control whether to request communication preferences from customers

-- Add request_communication_preference column (default false for backward compatibility)
ALTER TABLE forms 
  ADD COLUMN IF NOT EXISTS request_communication_preference boolean DEFAULT false;

-- Backfill: Set existing forms to not request communication preference
UPDATE forms
SET request_communication_preference = false
WHERE request_communication_preference IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN forms.request_communication_preference IS 'Whether to request communication preference (email/SMS/WhatsApp) from customers during checkout';
