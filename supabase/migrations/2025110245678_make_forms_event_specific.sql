-- Make forms event-specific with ticket selection
-- Migration created: 2025-11-02

-- Add available_ticket_ids column to store selected ticket IDs for each form
ALTER TABLE forms 
  ADD COLUMN IF NOT EXISTS available_ticket_ids uuid[] DEFAULT ARRAY[]::uuid[];

-- Make event_id required (NOT NULL)
ALTER TABLE forms 
  ALTER COLUMN event_id SET NOT NULL;

-- Add index for faster lookups by event_id
CREATE INDEX IF NOT EXISTS idx_forms_event_id ON forms(event_id);

-- Backfill: For existing forms, populate available_ticket_ids with all tickets from their event
-- This ensures backward compatibility - existing forms will show all event tickets
UPDATE forms f
SET available_ticket_ids = (
  SELECT ARRAY_AGG(tt.id)
  FROM ticket_types tt
  WHERE tt.event_id = f.event_id
)
WHERE available_ticket_ids = ARRAY[]::uuid[] OR available_ticket_ids IS NULL;

