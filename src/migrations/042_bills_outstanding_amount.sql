-- Add outstanding_amount column to bills table and backfill from payments
ALTER TABLE bills ADD COLUMN IF NOT EXISTS outstanding_amount DECIMAL(15,2);

-- Backfill: outstanding = total_amount minus sum of payments recorded
UPDATE bills b
SET outstanding_amount = GREATEST(0, COALESCE(b.total_amount, 0) - COALESCE(
  (SELECT SUM(p.amount_paid) FROM payments p WHERE p.bill_id = b.bill_id),
  0
));

-- For bills with no total_amount, set to 0
UPDATE bills SET outstanding_amount = 0 WHERE outstanding_amount IS NULL;
