-- Create the founding drop for all pre-production operational bills
INSERT INTO drops (drop_name, drop_number, description, is_active)
VALUES ('Hemp Hase Drop 1', 1, 'Founding drop — all pre-production operational bills (rent, salaries, etc.)', true)
ON CONFLICT (drop_name) DO UPDATE
  SET drop_number = 1,
      description = EXCLUDED.description,
      is_active   = true;

-- Tag every existing bill that has no drop (or is Unassigned) to Hemp Hase Drop 1
UPDATE bills
SET drop_name = 'Hemp Hase Drop 1'
WHERE drop_name IS NULL
   OR drop_name = ''
   OR drop_name = 'Unassigned';

-- Also backfill bill_items: set drop_id to Hemp Hase Drop 1 where unset
UPDATE bill_items
SET drop_id = (SELECT drop_id FROM drops WHERE drop_name = 'Hemp Hase Drop 1' LIMIT 1)
WHERE drop_id IS NULL
  AND bill_id IN (SELECT bill_id FROM bills WHERE drop_name = 'Hemp Hase Drop 1');
