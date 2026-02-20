-- Add show_discount_code column to forms table
-- Migration created: 2025-11-13
-- Adds show_discount_code column to control discount code visibility on forms

-- Add show_discount_code column (default true for backward compatibility)
ALTER TABLE forms 
  ADD COLUMN IF NOT EXISTS show_discount_code boolean DEFAULT true;

-- Backfill: Set existing forms to show discount code
UPDATE forms
SET show_discount_code = true
WHERE show_discount_code IS NULL;

