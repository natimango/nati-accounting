const pool = require('../config/database');

async function listVendors(req, res) {
  try {
    const result = await pool.query(`
      SELECT v.*,
             COUNT(b.bill_id) AS bill_count,
             COALESCE(SUM(b.total_amount), 0) AS total_billed
      FROM vendors v
      LEFT JOIN bills b ON b.vendor_id = v.vendor_id
        AND COALESCE(b.status, 'pending') NOT IN ('deleted', 'void')
      WHERE v.is_active = true
      GROUP BY v.vendor_id
      ORDER BY total_billed DESC, v.vendor_name ASC
    `);
    res.json({ success: true, vendors: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getVendor(req, res) {
  try {
    const { vendor_id } = req.params;
    const result = await pool.query(
      'SELECT * FROM vendors WHERE vendor_id = $1',
      [vendor_id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Vendor not found' });
    res.json({ success: true, vendor: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function updateVendor(req, res) {
  try {
    const { vendor_id } = req.params;
    const { vendor_name, gstin, pan, contact_person, email, phone, address, vendor_type, payment_terms } = req.body;

    if (!vendor_name || !vendor_name.trim()) {
      return res.status(400).json({ success: false, error: 'vendor_name is required' });
    }

    const result = await pool.query(`
      UPDATE vendors SET
        vendor_name    = $1,
        gstin          = $2,
        pan            = $3,
        contact_person = $4,
        email          = $5,
        phone          = $6,
        address        = $7,
        vendor_type    = $8,
        payment_terms  = $9
      WHERE vendor_id = $10
      RETURNING *
    `, [vendor_name.trim(), gstin || null, pan || null, contact_person || null, email || null, phone || null, address || null, vendor_type || null, payment_terms || null, vendor_id]);

    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Vendor not found' });
    res.json({ success: true, vendor: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function createVendor(req, res) {
  try {
    const { vendor_name, gstin, pan, contact_person, email, phone, address, vendor_type, payment_terms } = req.body;
    if (!vendor_name || !vendor_name.trim()) {
      return res.status(400).json({ success: false, error: 'vendor_name is required' });
    }
    const result = await pool.query(`
      INSERT INTO vendors (vendor_name, gstin, pan, contact_person, email, phone, address, vendor_type, payment_terms, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *
    `, [vendor_name.trim(), gstin || null, pan || null, contact_person || null, email || null, phone || null, address || null, vendor_type || null, payment_terms || null]);
    res.status(201).json({ success: true, vendor: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'A vendor with this name already exists' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
}

async function archiveVendor(req, res) {
  try {
    const { vendor_id } = req.params;
    await pool.query('UPDATE vendors SET is_active = false WHERE vendor_id = $1', [vendor_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Merge source vendor into target: reassign all bills, then archive source
async function mergeVendors(req, res) {
  const { vendor_id } = req.params;
  const { merge_into_vendor_id } = req.body;

  if (!merge_into_vendor_id) {
    return res.status(400).json({ success: false, error: 'merge_into_vendor_id is required' });
  }
  if (Number(vendor_id) === Number(merge_into_vendor_id)) {
    return res.status(400).json({ success: false, error: 'Cannot merge a vendor into itself' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const [src, tgt] = await Promise.all([
      client.query('SELECT vendor_id, vendor_name FROM vendors WHERE vendor_id = $1', [vendor_id]),
      client.query('SELECT vendor_id, vendor_name FROM vendors WHERE vendor_id = $1', [merge_into_vendor_id]),
    ]);
    if (!src.rows.length) throw new Error('Source vendor not found');
    if (!tgt.rows.length) throw new Error('Target vendor not found');

    // Reassign bills
    await client.query(
      'UPDATE bills SET vendor_id = $1 WHERE vendor_id = $2',
      [merge_into_vendor_id, vendor_id]
    );

    // Archive source
    await client.query('UPDATE vendors SET is_active = false WHERE vendor_id = $1', [vendor_id]);

    await client.query('COMMIT');
    res.json({
      success: true,
      merged_from: src.rows[0].vendor_name,
      merged_into: tgt.rows[0].vendor_name,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

module.exports = { listVendors, getVendor, createVendor, updateVendor, archiveVendor, mergeVendors };
