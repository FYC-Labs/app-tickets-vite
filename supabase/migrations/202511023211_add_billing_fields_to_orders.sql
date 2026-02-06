-- Add billing and payment session fields to orders table

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_first_name text,
  ADD COLUMN IF NOT EXISTS customer_last_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_address_2 text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_state text,
  ADD COLUMN IF NOT EXISTS billing_zip text,
  ADD COLUMN IF NOT EXISTS payment_session_id text,
  ADD COLUMN IF NOT EXISTS payment_provider text;

-- Add index for payment session lookups
CREATE INDEX IF NOT EXISTS idx_orders_payment_session ON orders(payment_session_id);

