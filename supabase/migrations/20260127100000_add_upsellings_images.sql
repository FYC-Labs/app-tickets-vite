-- Add images column to upsellings (array of storage public URLs)
-- Requires table `upsellings` to exist. If you added the column manually, this is a no-op (IF NOT EXISTS).
ALTER TABLE upsellings
  ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN upsellings.images IS 'Array of public URLs from storage bucket (e.g. upselling-images) for product images.';
