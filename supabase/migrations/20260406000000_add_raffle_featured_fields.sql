-- Add featured flag and original market price to raffles table
ALTER TABLE raffles
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_price decimal(10,2) DEFAULT NULL;

COMMENT ON COLUMN raffles.featured IS 'When true, the raffle appears in the featured section with a special card';
COMMENT ON COLUMN raffles.original_price IS 'Market price of the skin, used to show discount percentage';
