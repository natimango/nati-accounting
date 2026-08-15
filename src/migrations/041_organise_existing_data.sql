-- Comprehensive data organisation for NATI existing bills
-- Safe to re-run: all updates use WHERE conditions

-- 1. Normalise category text — lowercase, trim, fix common variants
UPDATE bills SET category = LOWER(TRIM(category)) WHERE category IS NOT NULL;

-- 2. Map common category aliases → canonical names
UPDATE bills SET category = 'salary'          WHERE LOWER(TRIM(COALESCE(category,''))) IN ('intern','intern salary','internship','stipend','payroll','wages','hr','salaries');
UPDATE bills SET category = 'rent'            WHERE LOWER(TRIM(COALESCE(category,''))) IN ('workspace','office rent','studio rent','studio');
UPDATE bills SET category = 'manufacturing'   WHERE LOWER(TRIM(COALESCE(category,''))) IN ('job work','stitching','tailoring','vendor','cutting','sewing','production');
UPDATE bills SET category = 'fabric'          WHERE LOWER(TRIM(COALESCE(category,''))) IN ('raw materials','textile','yarn','thread','cloth','material');
UPDATE bills SET category = 'shipping'        WHERE LOWER(TRIM(COALESCE(category,''))) IN ('logistics','courier','delivery','delhivery','bluedart','dtdc','xpressbees','ecom express');
UPDATE bills SET category = 'marketing'       WHERE LOWER(TRIM(COALESCE(category,''))) IN ('ads','meta','google','digital marketing','paid ads','advertising');
UPDATE bills SET category = 'content'         WHERE LOWER(TRIM(COALESCE(category,''))) IN ('content creation','photography','shoots','shoot','photo shoot','video');
UPDATE bills SET category = 'software'        WHERE LOWER(TRIM(COALESCE(category,''))) IN ('tech','subscriptions','saas','tools','apps','software subscription');
UPDATE bills SET category = 'travel'          WHERE LOWER(TRIM(COALESCE(category,''))) IN ('transportation','conveyance','cab','uber','flight','train');
UPDATE bills SET category = 'packaging'       WHERE LOWER(TRIM(COALESCE(category,''))) IN ('packing','boxes','bags','poly bags','labels','tags','hangtags');
UPDATE bills SET category = 'embroidery'      WHERE LOWER(TRIM(COALESCE(category,''))) IN ('embellishment','hand work','handwork','embellishments','mirror work');
UPDATE bills SET category = 'washing'         WHERE LOWER(TRIM(COALESCE(category,''))) IN ('finishing','dyeing','dye','bleach','laundry');
UPDATE bills SET category = 'trims'           WHERE LOWER(TRIM(COALESCE(category,''))) IN ('accessories','buttons','zippers','hooks','elastic','lining','interlining');
UPDATE bills SET category = 'gateway'         WHERE LOWER(TRIM(COALESCE(category,''))) IN ('payment gateway','razorpay','payment processing');
UPDATE bills SET category = 'misc'            WHERE category IS NULL OR TRIM(category) = '';

-- 3. Re-derive category_group from canonical category
UPDATE bills SET category_group = 'COGS'
WHERE category IN ('fabric','manufacturing','embroidery','washing','trims','packaging','quality','inbound_freight','sampling');

UPDATE bills SET category_group = 'FULFILLMENT'
WHERE category IN ('shipping','warehousing','returns','commission','gateway','cod');

UPDATE bills SET category_group = 'MARKETING'
WHERE category IN ('marketing','ads','influencer','gifting','content','photography','platform_fees','pr','events','affiliate','shoots');

UPDATE bills SET category_group = 'OPERATIONS'
WHERE category IN ('salary','rent','contractor','freelancer','software','travel','bank_charges','legal','compliance','insurance','food_meals','utilities','misc','food')
   OR category_group IS NULL
   OR category_group = 'OPERATING';

-- 4. Ensure all bills are tagged to Hemp Hase Drop 1 if still unassigned
UPDATE bills
SET drop_name = 'Hemp Hase Drop 1'
WHERE drop_name IS NULL OR drop_name = '' OR drop_name = 'Unassigned';

-- 5. Fix bill_items drop_id backfill
UPDATE bill_items bi
SET drop_id = (SELECT drop_id FROM drops WHERE drop_name = 'Hemp Hase Drop 1' LIMIT 1)
WHERE bi.drop_id IS NULL;

-- 6. Add intern/stipend aliases to ensure future uploads normalise correctly
-- (These are handled at the app layer via categoryMap; DB rows are already fixed above)

-- 7. Fix any bills where category_group doesn't match category
-- Belt-and-suspenders pass
UPDATE bills SET category_group = 'COGS'        WHERE category IN ('fabric','manufacturing','embroidery','washing','trims','packaging') AND category_group <> 'COGS';
UPDATE bills SET category_group = 'FULFILLMENT' WHERE category IN ('shipping','warehousing','returns','commission','gateway') AND category_group <> 'FULFILLMENT';
UPDATE bills SET category_group = 'MARKETING'   WHERE category IN ('marketing','ads','content','influencer','pr') AND category_group <> 'MARKETING';
UPDATE bills SET category_group = 'OPERATIONS'  WHERE category IN ('salary','rent','software','travel','misc') AND category_group <> 'OPERATIONS';
