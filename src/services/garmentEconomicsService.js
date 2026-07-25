/**
 * Garment-level P&L: wires actual bill costs, marketing spend, fulfillment
 * costs, and sell-through data into a per-SKU profitability view.
 *
 * Revenue    = units_sold × selling_price  (from size_sellthrough + price history)
 * COGS       = actual bill_items where sku_code matches, tagged PURCHASE/COGS
 *              falls back to sku_cost_layers estimate if no bills yet
 * Fulfillment= shipments + fulfillment-tagged bills, spread per unit sold
 * Marketing  = marketing_spend + marketing-tagged bills for the drop,
 *              allocated to each SKU by its revenue share within the drop
 * CM         = Revenue − COGS − Fulfillment − Marketing
 * Max CAC    = max(0, CM_before_marketing − net_margin_buffer × price)
 *              (the most you can spend per acquired customer and stay healthy)
 * Actual CAC = Total marketing allocated / units_sold
 */

const pool = require('../config/database');

const COST_TYPES_LANDED = ['manufacturing', 'packaging', 'inbound_freight', 'other_variable'];

async function getSettings() {
  const r = await pool.query(
    `SELECT setting_value FROM finance_settings WHERE setting_key = 'target_net_margin_buffer' LIMIT 1`
  );
  return parseFloat(r.rows[0]?.setting_value) || 0.2;
}

// Latest price for each SKU as of today
async function fetchPrices(skuIds) {
  if (!skuIds.length) return new Map();
  const r = await pool.query(
    `SELECT DISTINCT ON (sku_id) sku_id, selling_price, mrp
     FROM sku_price_history
     WHERE sku_id = ANY($1::int[]) AND effective_from <= CURRENT_DATE
     ORDER BY sku_id, effective_from DESC`,
    [skuIds]
  );
  return new Map(r.rows.map(row => [row.sku_id, row]));
}

// Estimated cost layers per SKU (landed costs only)
async function fetchCostLayers(skuIds) {
  if (!skuIds.length) return new Map();
  const r = await pool.query(
    `SELECT sku_id, SUM(amount_per_unit) AS estimated_cost
     FROM sku_cost_layers
     WHERE sku_id = ANY($1::int[])
       AND cost_type = ANY($2::text[])
       AND effective_from <= CURRENT_DATE
     GROUP BY sku_id`,
    [skuIds, COST_TYPES_LANDED]
  );
  return new Map(r.rows.map(row => [row.sku_id, parseFloat(row.estimated_cost || 0)]));
}

// SKU assumptions (gateway, returns, shipping subsidy)
async function fetchAssumptions(skuIds) {
  if (!skuIds.length) return new Map();
  const r = await pool.query(
    `SELECT * FROM sku_assumptions WHERE sku_id = ANY($1::int[])`,
    [skuIds]
  );
  return new Map(r.rows.map(row => [row.sku_id, row]));
}

// Actual COGS from posted bill_items by sku_code
async function fetchActualCogs(skuCodes) {
  if (!skuCodes.length) return new Map();
  const r = await pool.query(
    `SELECT bi.sku_code, SUM(bi.amount) AS actual_cogs
     FROM bill_items bi
     JOIN bills b ON bi.bill_id = b.bill_id
     WHERE bi.sku_code = ANY($1::text[])
       AND COALESCE(b.category_group, 'OPERATING') = 'COGS'
       AND COALESCE(b.status, 'pending') NOT IN ('deleted', 'void')
     GROUP BY bi.sku_code`,
    [skuCodes]
  );
  return new Map(r.rows.map(row => [row.sku_code, parseFloat(row.actual_cogs || 0)]));
}

// Size sell-through per SKU
async function fetchSellThrough(skuIds) {
  if (!skuIds.length) return new Map();
  const r = await pool.query(
    `SELECT sku_id,
            SUM(units_sold) AS units_sold,
            SUM(units_available) AS units_available
     FROM size_sellthrough
     WHERE sku_id = ANY($1::int[])
     GROUP BY sku_id`,
    [skuIds]
  );
  return new Map(r.rows.map(row => [row.sku_id, {
    units_sold: parseInt(row.units_sold || 0),
    units_available: parseInt(row.units_available || 0)
  }]));
}

// Marketing spend for a drop: marketing_spend table + bills tagged MARKETING
async function fetchMarketingByDrop(dropName, dropId) {
  let total = 0;

  // 1. Directly ingested marketing spend (by drop_name)
  if (dropName) {
    const r = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM marketing_spend WHERE drop_name = $1`,
      [dropName]
    );
    total += parseFloat(r.rows[0]?.total || 0);
  }

  // 2. Bills tagged MARKETING linked to this drop (by drop_name on bills OR drop_id on bill_items)
  const taggedQuery = dropName
    ? `SELECT COALESCE(SUM(b.total_amount), 0) AS total
       FROM bills b
       JOIN bill_expense_tags bet ON b.bill_id = bet.bill_id
       JOIN expense_tags et ON bet.tag_id = et.tag_id
       WHERE et.tag_group = 'MARKETING'
         AND b.drop_name = $1
         AND COALESCE(b.status, 'pending') NOT IN ('deleted', 'void')`
    : `SELECT COALESCE(SUM(b.total_amount), 0) AS total
       FROM bills b
       JOIN bill_expense_tags bet ON b.bill_id = bet.bill_id
       JOIN expense_tags et ON bet.tag_id = et.tag_id
       WHERE et.tag_group = 'MARKETING'
         AND COALESCE(b.status, 'pending') NOT IN ('deleted', 'void')`;

  const params = dropName ? [dropName] : [];
  const r2 = await pool.query(taggedQuery, params);
  total += parseFloat(r2.rows[0]?.total || 0);

  return total;
}

// Fulfillment cost per sku_code from shipments + bills tagged FULFILLMENT
async function fetchFulfillmentBySkuCode(skuCodes, dropName) {
  const costMap = new Map();

  if (skuCodes.length) {
    // Shipments directly linked to sku_code
    const r = await pool.query(
      `SELECT sku_code, SUM(charge_amount) AS total
       FROM shipments
       WHERE sku_code = ANY($1::text[])
       GROUP BY sku_code`,
      [skuCodes]
    );
    r.rows.forEach(row => {
      costMap.set(row.sku_code, (costMap.get(row.sku_code) || 0) + parseFloat(row.total || 0));
    });
  }

  // Fulfillment-tagged bills for the drop — spread evenly across sku_codes
  if (dropName && skuCodes.length) {
    const r = await pool.query(
      `SELECT COALESCE(SUM(b.total_amount), 0) AS total
       FROM bills b
       JOIN bill_expense_tags bet ON b.bill_id = bet.bill_id
       JOIN expense_tags et ON bet.tag_id = et.tag_id
       WHERE et.tag_group = 'FULFILLMENT'
         AND b.drop_name = $1
         AND COALESCE(b.status, 'pending') NOT IN ('deleted', 'void')`,
      [dropName]
    );
    const dropFulfillment = parseFloat(r.rows[0]?.total || 0);
    if (dropFulfillment > 0) {
      const share = dropFulfillment / skuCodes.length;
      skuCodes.forEach(code => {
        costMap.set(code, (costMap.get(code) || 0) + share);
      });
    }
  }

  return costMap;
}

/**
 * Main entry: compute per-garment P&L for a drop (or all drops if dropId null)
 */
async function getGarmentEconomics(dropId = null) {
  const marginBuffer = await getSettings();

  // 1. Fetch all SKUs (optionally filtered by drop)
  const skuQuery = dropId
    ? `SELECT sm.sku_id, sm.sku_code, sm.sku_name, sm.drop_id, d.drop_name
       FROM sku_master sm
       LEFT JOIN drops d ON sm.drop_id = d.drop_id
       WHERE sm.drop_id = $1 AND sm.status = 'active'
       ORDER BY sm.sku_code`
    : `SELECT sm.sku_id, sm.sku_code, sm.sku_name, sm.drop_id, d.drop_name
       FROM sku_master sm
       LEFT JOIN drops d ON sm.drop_id = d.drop_id
       WHERE sm.status = 'active'
       ORDER BY d.drop_name NULLS LAST, sm.sku_code`;

  const skuRows = (await pool.query(skuQuery, dropId ? [dropId] : [])).rows;
  if (!skuRows.length) return { per_sku: [], summary: null };

  const skuIds = skuRows.map(r => r.sku_id);
  const skuCodes = skuRows.map(r => r.sku_code).filter(Boolean);

  // Determine drop context for marketing/fulfillment fetching
  const dropName = skuRows[0]?.drop_name || null;

  // 2. Parallel data fetches
  const [prices, costLayers, assumptions, actualCogsMap, sellThroughMap, fulfillmentMap] =
    await Promise.all([
      fetchPrices(skuIds),
      fetchCostLayers(skuIds),
      fetchAssumptions(skuIds),
      fetchActualCogs(skuCodes),
      fetchSellThrough(skuIds),
      fetchFulfillmentBySkuCode(skuCodes, dropName)
    ]);

  // 3. Total marketing for the drop (used for proportional allocation)
  const totalMarketing = await fetchMarketingByDrop(dropName, dropId);

  // 4. Compute revenue per SKU to drive marketing allocation weights
  const skuRevenues = skuRows.map(sku => {
    const price = parseFloat(prices.get(sku.sku_id)?.selling_price || 0);
    const st = sellThroughMap.get(sku.sku_id) || { units_sold: 0, units_available: 0 };
    return price * st.units_sold;
  });
  const totalDropRevenue = skuRevenues.reduce((a, b) => a + b, 0);

  // 5. Per-SKU computation
  const perSku = skuRows.map((sku, i) => {
    const priceRow = prices.get(sku.sku_id);
    const sellingPrice = parseFloat(priceRow?.selling_price || 0);
    const mrp = parseFloat(priceRow?.mrp || 0);
    const estimatedCost = costLayers.get(sku.sku_id) || 0;
    const assump = assumptions.get(sku.sku_id) || null;
    const st = sellThroughMap.get(sku.sku_id) || { units_sold: 0, units_available: 0 };
    const unitsSold = st.units_sold;
    const unitsAvailable = st.units_available;

    // Revenue
    const revenue = sellingPrice * unitsSold;

    // COGS: prefer actual bill data, fall back to cost layer estimate × units
    const actualCogs = actualCogsMap.get(sku.sku_code) || 0;
    const estimatedTotalCogs = estimatedCost * Math.max(unitsAvailable, unitsSold);
    const cogs = actualCogs > 0 ? actualCogs : estimatedTotalCogs;
    const cogsSource = actualCogs > 0 ? 'actual' : 'estimated';
    const cogsPerUnit = unitsSold > 0 ? cogs / unitsSold : estimatedCost;

    // Fulfillment
    const fulfillmentTotal = fulfillmentMap.get(sku.sku_code) || 0;
    const fulfillmentPerUnit = unitsSold > 0 ? fulfillmentTotal / unitsSold : 0;

    // Per-unit operational cost from assumptions (gateway + returns)
    let gatewayPerUnit = 0;
    let returnsAllowance = 0;
    if (assump) {
      const gFee = parseFloat(assump.gateway_fee_pct || 0) * sellingPrice
        + parseFloat(assump.gateway_fee_fixed || 0);
      const retRate = parseFloat(assump.returns_rate || 0);
      const retShip = parseFloat(assump.return_shipping_avg || 0);
      const retRecon = parseFloat(assump.reconditioning_cost_avg || 0);
      const retResale = parseFloat(assump.expected_resale_discount_pct || 0) * sellingPrice;
      gatewayPerUnit = gFee;
      returnsAllowance = retRate * (retShip + retRecon + retResale);
    }

    // CM before marketing (used to compute max_cac)
    const cmBeforeMarketing = revenue - cogs - (fulfillmentTotal) - gatewayPerUnit * unitsSold - returnsAllowance * unitsSold;
    const cmBeforeMarketingPct = revenue > 0 ? (cmBeforeMarketing / revenue) * 100 : 0;

    // Max CAC: max spend per customer and still hit margin target
    const bufferAmount = marginBuffer * sellingPrice;
    const maxCacPerUnit = sellingPrice > 0 ? Math.max(0, (cmBeforeMarketing / Math.max(unitsSold, 1)) - bufferAmount) : 0;
    const maxMarketingBudget = maxCacPerUnit * unitsSold;

    // Marketing allocated to this SKU by revenue share
    const revenueShare = totalDropRevenue > 0 ? (skuRevenues[i] / totalDropRevenue) : (skuRows.length > 0 ? 1 / skuRows.length : 0);
    const marketingAllocated = totalMarketing * revenueShare;
    const actualCacPerUnit = unitsSold > 0 ? marketingAllocated / unitsSold : 0;

    // Final CM after marketing
    const cmAfterMarketing = cmBeforeMarketing - marketingAllocated;
    const cmPct = revenue > 0 ? (cmAfterMarketing / revenue) * 100 : 0;

    // Sell-through rate
    const sellThroughPct = unitsAvailable > 0 ? (unitsSold / unitsAvailable) * 100 : 0;

    // Health flags
    const cacHealthy = actualCacPerUnit <= maxCacPerUnit;
    const cmHealthy = cmPct >= 0;

    return {
      sku_id: sku.sku_id,
      sku_code: sku.sku_code,
      sku_name: sku.sku_name,
      drop_id: sku.drop_id,
      drop_name: sku.drop_name,
      selling_price: round(sellingPrice),
      mrp: round(mrp),
      units_available: unitsAvailable,
      units_sold: unitsSold,
      sell_through_pct: round(sellThroughPct),
      revenue: round(revenue),
      cogs: round(cogs),
      cogs_per_unit: round(cogsPerUnit),
      cogs_source: cogsSource,
      fulfillment_total: round(fulfillmentTotal),
      fulfillment_per_unit: round(fulfillmentPerUnit),
      gateway_per_unit: round(gatewayPerUnit),
      returns_allowance_per_unit: round(returnsAllowance),
      cm_before_marketing: round(cmBeforeMarketing),
      cm_before_marketing_pct: round(cmBeforeMarketingPct),
      max_cac: round(maxCacPerUnit),
      max_marketing_budget: round(maxMarketingBudget),
      marketing_allocated: round(marketingAllocated),
      actual_cac: round(actualCacPerUnit),
      cm_after_marketing: round(cmAfterMarketing),
      cm_pct: round(cmPct),
      cac_healthy: cacHealthy,
      cm_healthy: cmHealthy,
      missing_price: !sellingPrice,
      missing_sell_through: unitsSold === 0 && unitsAvailable === 0,
      missing_assumptions: !assump
    };
  });

  // 6. Portfolio summary
  const validSkus = perSku.filter(s => !s.missing_price);
  const summary = {
    sku_count: perSku.length,
    total_revenue: round(perSku.reduce((a, s) => a + s.revenue, 0)),
    total_cogs: round(perSku.reduce((a, s) => a + s.cogs, 0)),
    total_fulfillment: round(perSku.reduce((a, s) => a + s.fulfillment_total, 0)),
    total_marketing: round(totalMarketing),
    total_cm: round(perSku.reduce((a, s) => a + s.cm_after_marketing, 0)),
    blended_cm_pct: validSkus.length > 0
      ? round(validSkus.reduce((a, s) => a + s.cm_pct, 0) / validSkus.length)
      : 0,
    blended_max_cac: validSkus.length > 0
      ? round(validSkus.reduce((a, s) => a + s.max_cac, 0) / validSkus.length)
      : 0,
    blended_actual_cac: validSkus.length > 0
      ? round(validSkus.reduce((a, s) => a + s.actual_cac, 0) / validSkus.length)
      : 0,
    skus_over_cac_budget: perSku.filter(s => !s.cac_healthy && s.units_sold > 0).length,
    skus_negative_cm: perSku.filter(s => !s.cm_healthy).length,
    margin_buffer: marginBuffer,
    drop_name: dropName
  };

  return { per_sku: perSku, summary };
}

function round(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

module.exports = { getGarmentEconomics };
