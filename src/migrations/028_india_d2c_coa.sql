BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 028: India D2C Fashion — full Chart of Accounts
-- Replaces the generic placeholder CoA with a discipline-correct structure
-- aligned to Companies Act 2013 / Ind-AS for a fashion D2C brand.
--
-- Account code convention:
--   1xxx  ASSET
--   2xxx  LIABILITY
--   3xxx  EQUITY
--   4xxx  REVENUE
--   5xxx  COGS / PURCHASE
--   6xxx  FULFILLMENT
--   7xxx  MARKETING
--   8xxx  OPERATIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure account_type supports all needed values
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_account_type_check;

-- ── ASSETS ───────────────────────────────────────────────────────────────────
INSERT INTO accounts (account_code, account_name, account_type) VALUES
  ('1000', 'Assets',                              'ASSET'),
  ('1100', 'Current Assets',                      'ASSET'),
  ('1110', 'Cash in Hand',                        'ASSET'),
  ('1120', 'Bank Accounts',                       'ASSET'),
  ('1130', 'Trade Debtors / Accounts Receivable', 'ASSET'),
  ('1140', 'Inventory — Raw Materials',           'ASSET'),
  ('1141', 'Inventory — Work in Progress',        'ASSET'),
  ('1142', 'Inventory — Finished Goods',          'ASSET'),
  ('1150', 'Prepaid Expenses',                    'ASSET'),
  ('1160', 'Advance to Vendors',                  'ASSET'),
  ('1170', 'Input Tax Credit — CGST',             'ASSET'),
  ('1171', 'Input Tax Credit — SGST',             'ASSET'),
  ('1172', 'Input Tax Credit — IGST',             'ASSET'),
  ('1200', 'Fixed Assets',                        'ASSET'),
  ('1210', 'Equipment & Machinery',               'ASSET'),
  ('1220', 'Computers & Technology',              'ASSET'),
  ('1230', 'Accumulated Depreciation',            'ASSET')
ON CONFLICT (account_code) DO UPDATE SET account_name = EXCLUDED.account_name;

-- ── LIABILITIES ───────────────────────────────────────────────────────────────
INSERT INTO accounts (account_code, account_name, account_type) VALUES
  ('2000', 'Liabilities',                         'LIABILITY'),
  ('2100', 'Current Liabilities',                 'LIABILITY'),
  ('2110', 'Trade Creditors / Accounts Payable',  'LIABILITY'),
  ('2120', 'CGST Payable',                        'LIABILITY'),
  ('2121', 'SGST Payable',                        'LIABILITY'),
  ('2122', 'IGST Payable',                        'LIABILITY'),
  ('2130', 'TDS Payable',                         'LIABILITY'),
  ('2140', 'Salary Payable',                      'LIABILITY'),
  ('2150', 'Customer Advances / Deferred Revenue','LIABILITY'),
  ('2200', 'Long-term Liabilities',               'LIABILITY'),
  ('2210', 'Loans Payable',                       'LIABILITY')
ON CONFLICT (account_code) DO UPDATE SET account_name = EXCLUDED.account_name;

-- ── EQUITY ───────────────────────────────────────────────────────────────────
INSERT INTO accounts (account_code, account_name, account_type) VALUES
  ('3000', 'Equity',                              'EQUITY'),
  ('3100', 'Promoter Capital',                    'EQUITY'),
  ('3200', 'Retained Earnings',                   'EQUITY'),
  ('3300', 'Current Year Profit / Loss',          'EQUITY')
ON CONFLICT (account_code) DO UPDATE SET account_name = EXCLUDED.account_name;

-- ── REVENUE ───────────────────────────────────────────────────────────────────
INSERT INTO accounts (account_code, account_name, account_type) VALUES
  ('4000', 'Revenue',                             'REVENUE'),
  ('4100', 'D2C Website Sales',                   'REVENUE'),
  ('4110', 'Myntra Sales',                        'REVENUE'),
  ('4120', 'Ajio Sales',                          'REVENUE'),
  ('4130', 'Nykaa Fashion Sales',                 'REVENUE'),
  ('4140', 'Instagram / Social Commerce',         'REVENUE'),
  ('4150', 'Other Marketplace Sales',             'REVENUE'),
  ('4160', 'Pop-up & Offline Sales',              'REVENUE'),
  ('4200', 'Shipping Revenue (collected)',        'REVENUE'),
  ('4900', 'Sales Returns & Refunds',             'REVENUE')
ON CONFLICT (account_code) DO UPDATE SET account_name = EXCLUDED.account_name;

-- ── COGS / PURCHASE (5xxx) ────────────────────────────────────────────────────
INSERT INTO accounts (account_code, account_name, account_type) VALUES
  ('5000', 'Cost of Goods Sold',                  'COGS'),
  ('5010', 'Fabric & Raw Materials',              'COGS'),
  ('5020', 'Manufacturing & Job Work',            'COGS'),
  ('5030', 'Embroidery & Embellishment',          'COGS'),
  ('5040', 'Washing & Finishing',                 'COGS'),
  ('5050', 'Trims & Accessories',                 'COGS'),
  ('5060', 'Packaging Materials',                 'COGS'),
  ('5070', 'Quality Inspection',                  'COGS'),
  ('5080', 'Inbound Freight',                     'COGS'),
  ('5090', 'Inventory Write-offs',                'COGS')
ON CONFLICT (account_code) DO UPDATE SET account_name = EXCLUDED.account_name;

-- ── FULFILLMENT (6xxx) ────────────────────────────────────────────────────────
INSERT INTO accounts (account_code, account_name, account_type) VALUES
  ('6000', 'Fulfillment Costs',                   'EXPENSE'),
  ('6010', 'Outbound Shipping & Courier',         'EXPENSE'),
  ('6020', 'Warehousing & Storage',               'EXPENSE'),
  ('6030', 'Returns & Reverse Logistics',         'EXPENSE'),
  ('6040', 'Marketplace Commission',              'EXPENSE'),
  ('6050', 'Payment Gateway Charges',             'EXPENSE'),
  ('6060', 'COD Charges',                         'EXPENSE')
ON CONFLICT (account_code) DO UPDATE SET account_name = EXCLUDED.account_name;

-- ── MARKETING (7xxx) ─────────────────────────────────────────────────────────
INSERT INTO accounts (account_code, account_name, account_type) VALUES
  ('7000', 'Marketing & Advertising',             'EXPENSE'),
  ('7010', 'Digital Advertising — Meta / Google', 'EXPENSE'),
  ('7020', 'Influencer Marketing & Gifting',      'EXPENSE'),
  ('7030', 'Content Creation & Photography',      'EXPENSE'),
  ('7040', 'Platform Fees & Commissions',         'EXPENSE'),
  ('7050', 'PR & Events',                         'EXPENSE'),
  ('7060', 'Affiliate Marketing',                 'EXPENSE')
ON CONFLICT (account_code) DO UPDATE SET account_name = EXCLUDED.account_name;

-- ── OPERATIONS (8xxx) ─────────────────────────────────────────────────────────
INSERT INTO accounts (account_code, account_name, account_type) VALUES
  ('8000', 'Operating Expenses',                  'EXPENSE'),
  ('8010', 'Rent & Workspace',                    'EXPENSE'),
  ('8020', 'Salaries & Wages',                    'EXPENSE'),
  ('8030', 'Contractor & Freelancer Payments',    'EXPENSE'),
  ('8040', 'Software & Subscriptions',            'EXPENSE'),
  ('8050', 'Travel & Conveyance',                 'EXPENSE'),
  ('8060', 'Bank Charges & Merchant Fees',        'EXPENSE'),
  ('8070', 'Legal & Professional Fees',           'EXPENSE'),
  ('8080', 'GST Filing & Compliance',             'EXPENSE'),
  ('8090', 'Insurance',                           'EXPENSE'),
  ('8099', 'Miscellaneous Expenses',              'EXPENSE')
ON CONFLICT (account_code) DO UPDATE SET account_name = EXCLUDED.account_name;

COMMIT;
