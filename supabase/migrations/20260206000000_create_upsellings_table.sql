-- Create upsellings table for event add-on products
-- This table stores upselling items that can be offered before or after checkout

CREATE TABLE IF NOT EXISTS upsellings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item text NOT NULL,
  description text,
  benefits text,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0,
  sold integer NOT NULL DEFAULT 0,
  sales_start timestamp with time zone,
  sales_end timestamp with time zone,
  custom_fields jsonb DEFAULT '[]'::jsonb,
  images jsonb DEFAULT '[]'::jsonb,
  upselling_strategy text NOT NULL DEFAULT 'PRE-CHECKOUT',
  discount_type text NOT NULL DEFAULT 'NO_DISCOUNT',
  discount numeric(10,2),
  quantity_rule text NOT NULL DEFAULT 'ONLY_ONE',
  manage_inventory text NOT NULL DEFAULT 'NO',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create index on event_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_upsellings_event_id ON upsellings(event_id);

-- Add comments for documentation
COMMENT ON TABLE upsellings IS 'Upselling products that can be offered to customers during ticket purchase flow';
COMMENT ON COLUMN upsellings.item IS 'Product/item name displayed to customers';
COMMENT ON COLUMN upsellings.amount IS 'Price of the upselling item';
COMMENT ON COLUMN upsellings.quantity IS 'Total inventory available';
COMMENT ON COLUMN upsellings.sold IS 'Number of units sold';
COMMENT ON COLUMN upsellings.upselling_strategy IS 'When to show: PRE-CHECKOUT or POST-CHECKOUT';
COMMENT ON COLUMN upsellings.discount_type IS 'Type of discount: NO_DISCOUNT, PERCENTAGE, or FIXED';
COMMENT ON COLUMN upsellings.discount IS 'Discount value (percentage or fixed amount)';
COMMENT ON COLUMN upsellings.quantity_rule IS 'Purchase rule: ONLY_ONE, UNLIMITED, or PER_TICKET';
COMMENT ON COLUMN upsellings.manage_inventory IS 'Whether to track inventory: YES or NO';
COMMENT ON COLUMN upsellings.custom_fields IS 'Array of custom field definitions for customer input';
COMMENT ON COLUMN upsellings.images IS 'Array of public URLs from storage bucket for product images';
