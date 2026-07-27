BEGIN;

-- Add section dimension (Regulars / Artwear / Collectibles) to bills and sales_entries
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS section VARCHAR(50) DEFAULT NULL;

ALTER TABLE sales_entries
  ADD COLUMN IF NOT EXISTS section VARCHAR(50) DEFAULT NULL;

-- Add section to documents for denormalisation (speeds up list queries)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS section VARCHAR(50) DEFAULT NULL;

-- Vendor advances account: bills with payment_status = 'advance' where
-- the advance amount should sit in 1210 Vendor Advances (asset), not expense.
-- We ensure this account exists in CoA.
INSERT INTO accounts (account_code, account_name, account_type, is_active)
VALUES ('1210', 'Vendor Advances', 'ASSET', true)
ON CONFLICT (account_code) DO UPDATE SET account_name = EXCLUDED.account_name, is_active = true;

-- Proprietor equity accounts
INSERT INTO accounts (account_code, account_name, account_type, is_active)
VALUES
  ('3000', 'Proprietor Capital', 'EQUITY', true),
  ('3010', 'Capital Introduced', 'EQUITY', true),
  ('3020', 'Proprietor Drawings', 'EQUITY', true),
  ('3030', 'Retained Earnings', 'EQUITY', true),
  ('3040', 'Current Year Profit', 'EQUITY', true)
ON CONFLICT (account_code) DO UPDATE SET account_name = EXCLUDED.account_name, is_active = true;

-- Customer advance liability
INSERT INTO accounts (account_code, account_name, account_type, is_active)
VALUES ('2130', 'Customer Advances', 'LIABILITY', true)
ON CONFLICT (account_code) DO UPDATE SET account_name = EXCLUDED.account_name, is_active = true;

-- Inventory accounts for each stage
INSERT INTO accounts (account_code, account_name, account_type, is_active)
VALUES
  ('1310', 'Raw Fabric & Materials', 'ASSET', true),
  ('1320', 'Trims & Packaging Materials', 'ASSET', true),
  ('1330', 'Work in Progress', 'ASSET', true),
  ('1340', 'Finished Garments', 'ASSET', true),
  ('1350', 'Returned Goods Pending Inspection', 'ASSET', true),
  ('1360', 'Marketing & Gifting Stock', 'ASSET', true),
  ('1370', 'Development Samples', 'ASSET', true)
ON CONFLICT (account_code) DO UPDATE SET account_name = EXCLUDED.account_name, is_active = true;

-- Drop-level budgets: add section breakdown columns if not there
ALTER TABLE drop_budgets
  ADD COLUMN IF NOT EXISTS section VARCHAR(50) DEFAULT NULL;

-- Section index for query performance
CREATE INDEX IF NOT EXISTS idx_bills_section ON bills(section);
CREATE INDEX IF NOT EXISTS idx_sales_entries_section ON sales_entries(section);

COMMIT;
