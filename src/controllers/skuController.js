const pool = require('../config/database');

// GET /api/skus?drop_id=
async function listSkus(req, res) {
  try {
    const { drop_id } = req.query;
    const params = [];
    const where = drop_id ? 'WHERE sm.drop_id = $1' : '';
    if (drop_id) params.push(drop_id);

    const r = await pool.query(
      `SELECT
         sm.sku_id, sm.sku_code, sm.sku_name, sm.drop_id, sm.status,
         d.drop_name,
         price.selling_price, price.mrp, price.effective_from AS price_from,
         cost.total_cost,
         assump.shipping_subsidy_avg, assump.gateway_fee_pct, assump.returns_rate,
         st.units_sold, st.units_available
       FROM sku_master sm
       LEFT JOIN drops d ON sm.drop_id = d.drop_id
       LEFT JOIN LATERAL (
         SELECT selling_price, mrp, effective_from
         FROM sku_price_history
         WHERE sku_id = sm.sku_id AND effective_from <= CURRENT_DATE
         ORDER BY effective_from DESC LIMIT 1
       ) price ON true
       LEFT JOIN LATERAL (
         SELECT SUM(amount_per_unit) AS total_cost
         FROM sku_cost_layers
         WHERE sku_id = sm.sku_id AND effective_from <= CURRENT_DATE
       ) cost ON true
       LEFT JOIN sku_assumptions assump ON assump.sku_id = sm.sku_id
       LEFT JOIN LATERAL (
         SELECT SUM(units_sold) AS units_sold, SUM(units_available) AS units_available
         FROM size_sellthrough
         WHERE sku_id = sm.sku_id
       ) st ON true
       ${where}
       ORDER BY d.drop_name NULLS LAST, sm.sku_code`,
      params
    );
    res.json({ success: true, skus: r.rows });
  } catch (err) {
    console.error('listSkus error', err);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/skus — create a new SKU
async function createSku(req, res) {
  try {
    const { sku_code, sku_name, drop_id } = req.body;
    if (!sku_code || !sku_name) return res.status(400).json({ error: 'sku_code and sku_name required' });
    const r = await pool.query(
      `INSERT INTO sku_master (sku_code, sku_name, drop_id, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING *`,
      [sku_code.trim().toUpperCase(), sku_name.trim(), drop_id || null]
    );
    res.json({ success: true, sku: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'SKU code already exists' });
    console.error('createSku error', err);
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/skus/:sku_id — update name/drop/status
async function updateSku(req, res) {
  try {
    const { sku_id } = req.params;
    const { sku_name, drop_id, status } = req.body;
    const r = await pool.query(
      `UPDATE sku_master SET
         sku_name  = COALESCE($1, sku_name),
         drop_id   = COALESCE($2, drop_id),
         status    = COALESCE($3, status),
         updated_at = NOW()
       WHERE sku_id = $4 RETURNING *`,
      [sku_name || null, drop_id || null, status || null, sku_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'SKU not found' });
    res.json({ success: true, sku: r.rows[0] });
  } catch (err) {
    console.error('updateSku error', err);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/skus/:sku_id/price — add/replace current price
async function setSkuPrice(req, res) {
  try {
    const { sku_id } = req.params;
    const { selling_price, mrp, effective_from, notes } = req.body;
    if (!selling_price) return res.status(400).json({ error: 'selling_price required' });
    const r = await pool.query(
      `INSERT INTO sku_price_history (sku_id, selling_price, mrp, effective_from, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [sku_id, selling_price, mrp || null, effective_from || new Date().toISOString().split('T')[0], notes || null]
    );
    res.json({ success: true, price: r.rows[0] });
  } catch (err) {
    console.error('setSkuPrice error', err);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/skus/:sku_id/costs — all cost layers
async function getSkuCosts(req, res) {
  try {
    const r = await pool.query(
      `SELECT * FROM sku_cost_layers WHERE sku_id = $1 ORDER BY cost_type, effective_from DESC`,
      [req.params.sku_id]
    );
    res.json({ success: true, costs: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/skus/:sku_id/costs — upsert a cost layer
// Replaces the most recent entry for the same cost_type
async function setSkuCost(req, res) {
  try {
    const { sku_id } = req.params;
    const { cost_type, amount_per_unit, effective_from, notes } = req.body;
    const VALID_TYPES = ['manufacturing', 'packaging', 'shipping_subsidy',
      'gateway_fee_est', 'returns_allowance', 'inbound_freight', 'other_variable'];
    if (!VALID_TYPES.includes(cost_type)) {
      return res.status(400).json({ error: `cost_type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    if (amount_per_unit == null) return res.status(400).json({ error: 'amount_per_unit required' });
    const r = await pool.query(
      `INSERT INTO sku_cost_layers (sku_id, cost_type, amount_per_unit, effective_from, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [sku_id, cost_type, amount_per_unit, effective_from || new Date().toISOString().split('T')[0], notes || null]
    );
    res.json({ success: true, cost: r.rows[0] });
  } catch (err) {
    console.error('setSkuCost error', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { listSkus, createSku, updateSku, setSkuPrice, getSkuCosts, setSkuCost };
