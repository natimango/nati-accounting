BEGIN;

-- Structured expense tags for Nati fashion brand
-- Groups: PURCHASE (COGS), FULFILLMENT, MARKETING, OPERATIONS
CREATE TABLE IF NOT EXISTS expense_tags (
  tag_id       SERIAL PRIMARY KEY,
  tag_name     VARCHAR(100) NOT NULL,
  tag_group    VARCHAR(50)  NOT NULL,  -- PURCHASE | FULFILLMENT | MARKETING | OPERATIONS
  account_code VARCHAR(20)  NOT NULL,  -- maps to chart of accounts
  color        VARCHAR(20)  NOT NULL DEFAULT '#6B7280',
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  UNIQUE (tag_name, tag_group)
);

-- Junction: many bills can have many tags
CREATE TABLE IF NOT EXISTS bill_expense_tags (
  bill_id INT NOT NULL REFERENCES bills(bill_id) ON DELETE CASCADE,
  tag_id  INT NOT NULL REFERENCES expense_tags(tag_id) ON DELETE CASCADE,
  PRIMARY KEY (bill_id, tag_id)
);

-- Seed Nati brand taxonomy
INSERT INTO expense_tags (tag_name, tag_group, account_code, color) VALUES
  -- PURCHASE / COGS (5xxx)
  ('Fabric & Raw Materials',    'PURCHASE',     '5010', '#f59e0b'),
  ('Manufacturing & Stitching', 'PURCHASE',     '5020', '#ef4444'),
  ('Embroidery & Embellishment','PURCHASE',     '5030', '#a855f7'),
  ('Washing & Finishing',       'PURCHASE',     '5040', '#06b6d4'),
  ('Trims & Accessories',       'PURCHASE',     '5050', '#10b981'),
  ('Packaging Materials',       'PURCHASE',     '5060', '#84cc16'),
  ('Quality Inspection',        'PURCHASE',     '5070', '#f97316'),

  -- FULFILLMENT (6xxx)
  ('Shipping & Courier',        'FULFILLMENT',  '6010', '#3b82f6'),
  ('Warehousing & Storage',     'FULFILLMENT',  '6020', '#6366f1'),
  ('Returns Processing',        'FULFILLMENT',  '6030', '#ec4899'),

  -- MARKETING (7xxx)
  ('Paid Ads (Meta/Google)',    'MARKETING',    '7010', '#f43f5e'),
  ('Influencer & Gifting',      'MARKETING',    '7020', '#e879f9'),
  ('Shoots & Content Creation', 'MARKETING',    '7030', '#fb923c'),
  ('Platform Fees & Commissions','MARKETING',   '7040', '#facc15'),

  -- OPERATIONS (8xxx)
  ('Rent & Workspace',          'OPERATIONS',   '8010', '#475569'),
  ('Salaries & Contractor Pay', 'OPERATIONS',   '8020', '#1e40af'),
  ('Software & Subscriptions',  'OPERATIONS',   '8030', '#0891b2'),
  ('Travel & Logistics',        'OPERATIONS',   '8040', '#16a34a'),
  ('Bank Charges & Fees',       'OPERATIONS',   '8050', '#92400e'),
  ('Legal & Professional',      'OPERATIONS',   '8060', '#7c3aed'),
  ('Food & Team Welfare',       'OPERATIONS',   '8070', '#be185d'),
  ('Miscellaneous Ops',         'OPERATIONS',   '8099', '#94a3b8')
ON CONFLICT (tag_name, tag_group) DO NOTHING;

COMMIT;
