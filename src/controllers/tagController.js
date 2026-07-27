const pool = require('../config/database');

// GET /api/tags — all active tags grouped by tag_group
async function getTags(req, res) {
  try {
    const result = await pool.query(
      `SELECT tag_id, tag_name, tag_group, account_code, color
       FROM expense_tags
       WHERE is_active = true
       ORDER BY tag_group, tag_id`
    );

    const grouped = {};
    result.rows.forEach(row => {
      if (!grouped[row.tag_group]) grouped[row.tag_group] = [];
      grouped[row.tag_group].push(row);
    });

    res.json({ success: true, tags: result.rows, grouped });
  } catch (err) {
    console.error('getTags error', err);
    res.status(500).json({ error: 'Failed to load tags' });
  }
}

// GET /api/tags/bill/:bill_id — tags assigned to a bill
async function getBillTags(req, res) {
  try {
    const { bill_id } = req.params;
    const result = await pool.query(
      `SELECT et.tag_id, et.tag_name, et.tag_group, et.account_code, et.color
       FROM bill_expense_tags bet
       JOIN expense_tags et ON bet.tag_id = et.tag_id
       WHERE bet.bill_id = $1`,
      [bill_id]
    );
    res.json({ success: true, tags: result.rows });
  } catch (err) {
    console.error('getBillTags error', err);
    res.status(500).json({ error: 'Failed to load bill tags' });
  }
}

// PUT /api/tags/bill/:bill_id — set (replace) tags on a bill
async function setBillTags(req, res) {
  const client = await pool.connect();
  try {
    const { bill_id } = req.params;
    const { tag_ids = [] } = req.body;

    await client.query('BEGIN');
    await client.query('DELETE FROM bill_expense_tags WHERE bill_id = $1', [bill_id]);

    if (tag_ids.length > 0) {
      const values = tag_ids.map((tid, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO bill_expense_tags (bill_id, tag_id) VALUES ${values}`,
        [bill_id, ...tag_ids]
      );
    }

    // Derive category_group from tags: if any PURCHASE tag → COGS, else OPERATIONS
    if (tag_ids.length > 0) {
      const groupRes = await client.query(
        `SELECT tag_group FROM expense_tags WHERE tag_id = ANY($1::int[])`,
        [tag_ids]
      );
      const hasPurchase = groupRes.rows.some(r => r.tag_group === 'PURCHASE');
      await client.query(
        `UPDATE bills SET category_group = $1 WHERE bill_id = $2`,
        [hasPurchase ? 'COGS' : 'OPERATIONS', bill_id]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('setBillTags error', err);
    res.status(500).json({ error: 'Failed to save tags' });
  } finally {
    client.release();
  }
}

module.exports = { getTags, getBillTags, setBillTags };
