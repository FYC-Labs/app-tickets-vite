-- Add display options for forms
-- Migration created: 2025-11-02
-- Adds show_title and show_description columns to control form rendering

-- Add show_title column (default true for backward compatibility)
ALTER TABLE forms 
  ADD COLUMN IF NOT EXISTS show_title boolean DEFAULT true;

-- Add show_description column (default true for backward compatibility)
ALTER TABLE forms 
  ADD COLUMN IF NOT EXISTS show_description boolean DEFAULT true;

-- Backfill: Set existing forms to show both title and description
UPDATE forms
SET 
  show_title = true,
  show_description = true
WHERE show_title IS NULL OR show_description IS NULL;

