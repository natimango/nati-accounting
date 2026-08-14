const pool = require('../config/database');

async function listTemplates(req, res) {
  try {
    const result = await pool.query(`
      SELECT t.*, v.vendor_name AS resolved_vendor, d.drop_name
      FROM recurring_bill_templates t
      LEFT JOIN vendors v ON v.vendor_id = t.vendor_id
      LEFT JOIN drops d ON d.drop_id = t.drop_id
      ORDER BY t.is_active DESC, t.next_due_date ASC
    `);
    res.json({ success: true, templates: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function createTemplate(req, res) {
  try {
    const { template_name, vendor_id, vendor_name, category, category_group, drop_id, amount, payment_terms, notes, frequency, next_due_date } = req.body;
    if (!template_name || !next_due_date) {
      return res.status(400).json({ success: false, error: 'template_name and next_due_date are required' });
    }
    const VALID_FREQ = ['weekly', 'monthly', 'quarterly', 'yearly'];
    if (frequency && !VALID_FREQ.includes(frequency)) {
      return res.status(400).json({ success: false, error: 'Invalid frequency' });
    }
    const result = await pool.query(`
      INSERT INTO recurring_bill_templates
        (template_name, vendor_id, vendor_name, category, category_group, drop_id, amount, payment_terms, notes, frequency, next_due_date, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [template_name, vendor_id || null, vendor_name || null, category || null, category_group || null,
        drop_id || null, amount || null, payment_terms || 30, notes || null,
        frequency || 'monthly', next_due_date, req.user?.user_id || null]);
    res.status(201).json({ success: true, template: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function updateTemplate(req, res) {
  try {
    const { template_id } = req.params;
    const { template_name, vendor_id, vendor_name, category, category_group, drop_id, amount, payment_terms, notes, frequency, next_due_date, is_active } = req.body;
    const result = await pool.query(`
      UPDATE recurring_bill_templates SET
        template_name = COALESCE($2, template_name),
        vendor_id = $3,
        vendor_name = COALESCE($4, vendor_name),
        category = COALESCE($5, category),
        category_group = COALESCE($6, category_group),
        drop_id = $7,
        amount = COALESCE($8, amount),
        payment_terms = COALESCE($9, payment_terms),
        notes = COALESCE($10, notes),
        frequency = COALESCE($11, frequency),
        next_due_date = COALESCE($12, next_due_date),
        is_active = COALESCE($13, is_active),
        updated_at = NOW()
      WHERE template_id = $1 RETURNING *
    `, [template_id, template_name, vendor_id ?? null, vendor_name, category, category_group,
        drop_id ?? null, amount, payment_terms, notes, frequency, next_due_date, is_active]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, template: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteTemplate(req, res) {
  try {
    const { template_id } = req.params;
    await pool.query('DELETE FROM recurring_bill_templates WHERE template_id = $1', [template_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Spawn a bill from a template — creates a standalone bill and advances next_due_date
async function spawnFromTemplate(req, res) {
  const client = await pool.connect();
  try {
    const { template_id } = req.params;
    const tmpl = await client.query(
      'SELECT * FROM recurring_bill_templates WHERE template_id = $1 AND is_active = true',
      [template_id]
    );
    if (!tmpl.rows.length) return res.status(404).json({ success: false, error: 'Template not found or inactive' });
    const t = tmpl.rows[0];

    const vendorName = t.vendor_name || 'Unknown Vendor';
    const billDate = t.next_due_date;
    const dueDate = t.payment_terms
      ? new Date(new Date(billDate).getTime() + t.payment_terms * 86400000).toISOString().split('T')[0]
      : null;

    await client.query('BEGIN');

    // Insert bill
    const billRes = await client.query(`
      INSERT INTO bills (vendor_name, vendor_id, bill_date, total_amount, outstanding_amount, category, category_group, status, notes, drop_id)
      VALUES ($1,$2,$3,$4,$4,$5,$6,'pending',$7,$8) RETURNING bill_id
    `, [vendorName, t.vendor_id, billDate, t.amount || 0, t.category, t.category_group,
        `[Auto] From recurring template: ${t.template_name}${t.notes ? '\n' + t.notes : ''}`, t.drop_id]);
    const billId = billRes.rows[0].bill_id;

    // Insert payment schedule if due_date
    if (dueDate) {
      await client.query(`
        INSERT INTO payment_schedule (bill_id, due_date, amount, status)
        VALUES ($1, $2, $3, 'pending')
      `, [billId, dueDate, t.amount || 0]);
    }

    // Advance next_due_date
    const next = advanceDate(t.next_due_date, t.frequency);
    await client.query(
      'UPDATE recurring_bill_templates SET next_due_date = $2, updated_at = NOW() WHERE template_id = $1',
      [template_id, next]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, bill_id: billId, next_due_date: next });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

function advanceDate(dateStr, frequency) {
  const d = new Date(dateStr);
  switch (frequency) {
    case 'weekly':    d.setDate(d.getDate() + 7); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
    default:          d.setMonth(d.getMonth() + 1); break; // monthly
  }
  return d.toISOString().split('T')[0];
}

module.exports = { listTemplates, createTemplate, updateTemplate, deleteTemplate, spawnFromTemplate };
