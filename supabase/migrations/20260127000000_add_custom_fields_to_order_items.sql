-- Persist custom field values selected by the client per order item (e.g. upselling "Size": "M")
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN order_items.custom_fields IS 'Custom field values for this line item (e.g. { "Size": "M" } selected by the client for upsellings).';
