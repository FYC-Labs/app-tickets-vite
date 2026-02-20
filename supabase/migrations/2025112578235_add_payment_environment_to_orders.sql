-- Add payment_environment column to orders table
-- This stores the payment environment (production/sandbox) used when the order was created
ALTER TABLE orders
ADD COLUMN payment_environment text CHECK (payment_environment IN ('production', 'sandbox'));

-- Add comment for documentation
COMMENT ON COLUMN orders.payment_environment IS 'Payment environment used for this order. "production" = real payments, "sandbox" = test payments. Determined from event.accrupay_environment or ENV_TAG at time of order creation.';

