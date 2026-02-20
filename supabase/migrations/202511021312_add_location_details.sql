-- Add structured location data fields to events table
-- This migration adds latitude, longitude, and place_id to support Google Maps Places API

-- Add location latitude
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS location_lat numeric;

-- Add location longitude
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS location_lng numeric;

-- Add Google Place ID
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS location_place_id text;

-- Add indexes for potential location-based queries
CREATE INDEX IF NOT EXISTS idx_events_location_coords ON events(location_lat, location_lng) WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

-- Add comment explaining the location fields
COMMENT ON COLUMN events.location IS 'Formatted address from Google Places';
COMMENT ON COLUMN events.location_lat IS 'Latitude coordinate from Google Places';
COMMENT ON COLUMN events.location_lng IS 'Longitude coordinate from Google Places';
COMMENT ON COLUMN events.location_place_id IS 'Google Place ID for reference';

