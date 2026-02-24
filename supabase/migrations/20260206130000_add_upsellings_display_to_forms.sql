-- Add upsellings_display column to forms table
-- Migration created: 2026-02-06
-- Adds upsellings_display column to control how upsellings are displayed in the checkout flow

-- Add upsellings_display column (default 'LIST' for backward compatibility)
ALTER TABLE forms 
  ADD COLUMN IF NOT EXISTS upsellings_display text DEFAULT 'LIST';

-- Backfill: Set existing forms to use list display
UPDATE forms
SET upsellings_display = 'LIST'
WHERE upsellings_display IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN forms.upsellings_display IS 'Display mode for upsellings: LIST or CAROUSEL';
