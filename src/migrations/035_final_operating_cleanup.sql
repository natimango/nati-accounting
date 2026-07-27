-- Final cleanup: rename any remaining 'OPERATING' → 'OPERATIONS' in bills
-- Safe to re-run (idempotent)
UPDATE bills SET category_group = 'OPERATIONS'
WHERE category_group = 'OPERATING';

-- Catch any NULL category_group that slipped through
UPDATE bills SET category_group = 'OPERATIONS'
WHERE category_group IS NULL
  AND COALESCE(status, 'pending') NOT IN ('deleted', 'void');
