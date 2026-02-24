-- Add request_phone_number column to forms table
-- Migration created: 2026-02-06
-- Adds request_phone_number column to control whether to request phone number from customers

-- Add request_phone_number column (default false for backward compatibility)
ALTER TABLE forms 
  ADD COLUMN IF NOT EXISTS request_phone_number boolean DEFAULT false;

-- Backfill: Set existing forms to not request phone number
UPDATE forms
SET request_phone_number = false
WHERE request_phone_number IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN forms.request_phone_number IS 'Whether to request phone number from customers during checkout';
