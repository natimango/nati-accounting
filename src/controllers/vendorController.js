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

async function archiveVendor(req, res) {
  try {
    const { vendor_id } = req.params;
    await pool.query('UPDATE vendors SET is_active = false WHERE vendor_id = $1', [vendor_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { listVendors, getVendor, updateVendor, archiveVendor };
