-- Full backfill of bills.category_group based on canonical categoryMap
-- Covers all aliases and normalised keys. Safe to re-run (uses explicit WHERE).

-- ── COGS (5xxx) ────────────────────────────────────────────────────────────
UPDATE bills SET category_group = 'COGS'
WHERE LOWER(COALESCE(category, '')) IN (
  'fabric', 'raw materials', 'textile',
  'sampling', 'manufacturing', 'job work', 'stitching', 'tailoring', 'vendor',
  'embroidery', 'embellishment',
  'washing', 'finishing',
  'trims', 'accessories', 'buttons',
  'packaging',
  'quality check', 'quality', 'qc',
  'inbound freight', 'inbound_freight'
)
AND (category_group IS NULL OR category_group NOT IN ('COGS'));

-- ── FULFILLMENT (6xxx) ─────────────────────────────────────────────────────
UPDATE bills SET category_group = 'FULFILLMENT'
WHERE LOWER(COALESCE(category, '')) IN (
  'logistics', 'shipping', 'courier', 'delivery', 'delhivery', 'bluedart',
  'warehousing', 'storage',
  'returns',
  'commission',
  'payment gateway', 'gateway', 'razorpay',
  'cod'
)
AND (category_group IS NULL OR category_group NOT IN ('FULFILLMENT'));

-- ── MARKETING (7xxx) ───────────────────────────────────────────────────────
UPDATE bills SET category_group = 'MARKETING'
WHERE LOWER(COALESCE(category, '')) IN (
  'marketing', 'ads', 'meta', 'google',
  'influencer', 'gifting',
  'content creation', 'content', 'photography', 'shoots',
  'platform fees', 'platform_fees', 'shopify',
  'pr', 'events',
  'affiliate'
)
AND (category_group IS NULL OR category_group NOT IN ('MARKETING'));

-- ── OPERATIONS (8xxx) ──────────────────────────────────────────────────────
-- Also catches legacy 'OPERATING' label
UPDATE bills SET category_group = 'OPERATIONS'
WHERE LOWER(COALESCE(category, '')) IN (
  'rent', 'workspace',
  'salary', 'salaries', 'wages', 'hr',
  'contractor', 'freelancer',
  'tech', 'software', 'subscriptions',
  'travel', 'transportation', 'conveyance',
  'bank charges', 'bank_charges',
  'legal', 'professional',
  'gst', 'compliance',
  'insurance',
  'office', 'admin',
  'food', 'meals', 'food_meals',
  'utilities',
  'misc'
)
AND (category_group IS NULL OR category_group NOT IN ('OPERATIONS'));

-- Rename any remaining legacy 'OPERATING' → 'OPERATIONS'
UPDATE bills SET category_group = 'OPERATIONS'
WHERE category_group = 'OPERATING';

-- Catch-all: anything still NULL or unrecognised → OPERATIONS
UPDATE bills SET category_group = 'OPERATIONS'
WHERE category_group IS NULL;
