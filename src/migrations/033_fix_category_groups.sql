-- Fix category_group values to properly separate COGS / FULFILLMENT / MARKETING / OPERATIONS
-- Previously GROUP_TO_CATEGORY_GROUP mapped all non-COGS to 'OPERATING', losing the breakdown

UPDATE bills SET category_group = 'FULFILLMENT'
WHERE LOWER(COALESCE(category, '')) IN (
  'logistics', 'shipping', 'courier', 'delivery', 'delhivery', 'bluedart',
  'warehousing', 'storage', 'returns', 'commission', 'payment gateway',
  'razorpay', 'cod'
)
AND category_group IN ('OPERATING', NULL);

UPDATE bills SET category_group = 'MARKETING'
WHERE LOWER(COALESCE(category, '')) IN (
  'marketing', 'ads', 'meta', 'google', 'influencer', 'gifting',
  'content creation', 'photography', 'shoots', 'platform fees',
  'shopify', 'pr', 'events', 'affiliate'
)
AND category_group IN ('OPERATING', NULL);

UPDATE bills SET category_group = 'OPERATIONS'
WHERE category_group = 'OPERATING';
