-- Add order_confirmation_url to forms
-- Migration created: 2025-11-02
-- Adds order_confirmation_url column to allow custom redirect URLs after payment

-- Add order_confirmation_url column (nullable)
ALTER TABLE forms 
  ADD COLUMN IF NOT EXISTS order_confirmation_url text;

-- Add check constraint to validate URL format (allows localhost)
-- This validates that if a URL is provided, it's a valid URL format
ALTER TABLE forms
  DROP CONSTRAINT IF EXISTS check_order_confirmation_url_format;

ALTER TABLE forms
  ADD CONSTRAINT check_order_confirmation_url_format 
  CHECK (
    order_confirmation_url IS NULL OR
    order_confirmation_url ~* '^https?://' OR
    order_confirmation_url ~* '^http://localhost' OR
    order_confirmation_url ~* '^https://localhost'
  );

