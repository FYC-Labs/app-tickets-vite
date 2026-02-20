-- Add show_tickets_remaining column to forms table
-- Migration created: 2025-11-14
-- Adds show_tickets_remaining column to control tickets remaining visibility on forms

-- Add show_tickets_remaining column (default true for backward compatibility)
ALTER TABLE forms 
  ADD COLUMN IF NOT EXISTS show_tickets_remaining boolean DEFAULT true;

-- Backfill: Set existing forms to show tickets remaining
UPDATE forms
SET show_tickets_remaining = true
WHERE show_tickets_remaining IS NULL;

