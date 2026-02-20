-- Add available_upselling_ids column to forms table
-- Migration created: 2026-02-06
-- Adds available_upselling_ids column to store selected upselling IDs for each form

-- Add available_upselling_ids column to store selected upselling IDs for each form
ALTER TABLE forms 
  ADD COLUMN IF NOT EXISTS available_upselling_ids uuid[] DEFAULT ARRAY[]::uuid[];

-- Add index for faster lookups when filtering by upselling IDs
CREATE INDEX IF NOT EXISTS idx_forms_available_upselling_ids ON forms USING GIN(available_upselling_ids);

-- Add comment for documentation
COMMENT ON COLUMN forms.available_upselling_ids IS 'Array of upselling IDs that are available for this form';
