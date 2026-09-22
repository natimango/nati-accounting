const pool = require('../config/database');

// NATI's state = Maharashtra (27) — determines CGST+SGST vs IGST
const NATI_STATE_CODE = '27';

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentFY() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-based
  const fyStart = m >= 4 ? y : y - 1;
  const fyEnd = fyStart + 1;
  return `${String(fyStart).slice(-2)}${String(fyEnd).slice(-2)}`;
}

async function nextInvoiceNumber(client) {
  const fy = currentFY();
  const result = await client.query(
    `INSERT INTO invoice_sequences (fy, last_number)
     VALUES ($1, 1)
     ON CONFLICT (fy) DO UPDATE SET last_number = invoice_sequences.last_number + 1
     RETURNING last_number`,
    [fy]
  );
  const seq = result.rows[0].last_number;
  return `NATI/${fy}/${String(seq).padStart(4, '0')}`;
}

function calcLineItem(item, isInterstate) {
  const qty       = Number(item.quantity || 1);
  const unitPrice = Number(item.unit_price || 0);
  const discPct   = Number(item.discount_pct || 0);
  const gstRate   = Number(item.gst_rate || 0);
  const amount    = +(qty * unitPrice * (1 - discPct / 100)).toFixed(2);
  const gstAmt    = +(amount * gstRate / 100).toFixed(2);
  const cgst      = isInterstate ? 0 : +(gstAmt / 2).toFixed(2);
  const sgst      = isInterstate ? 0 : +(gstAmt / 2).toFixed(2);
  const igst      = isInterstate ? gstAmt : 0;
  return { ...item, amount, cgst_amount: cgst, sgst_amount: sgst, igst_amount: igst };
}

function isInterstate(customerStateCode) {
  if (!customerStateCode) return false;
  return String(customerStateCode) !== String(NATI_STATE_CODE);
}

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────

async function listCustomers(req, res) {
  try {
    const { q, active } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (active !== 'false') { where += ' AND c.is_active = true'; }
    if (q) { params.push(`%${q}%`); where += ` AND (c.customer_name ILIKE $${params.length} OR c.gstin ILIKE $${params.length})`; }
    const rows = await pool.query(
      `SELECT c.*,
         COUNT(i.invoice_id) AS invoice_count,
         COALESCE(SUM(i.total_amount) FILTER (WHERE i.status <> 'void'), 0) AS total_invoiced,
         COALESCE(SUM(i.total_amount - i.amount_paid) FILTER (WHERE i.status NOT IN ('void','paid')), 0) AS outstanding
       FROM customers c
       LEFT JOIN invoices i ON i.customer_id = c.customer_id
       ${where}
       GROUP BY c.customer_id
       ORDER BY c.customer_name`,
      params
    );
    res.json({ success: true, customers: rows.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function createCustomer(req, res) {
  try {
    const {
      customer_name, gstin, pan, contact_name, email, phone,
      address, city, state, state_code, pincode, notes
    } = req.body;
    if (!customer_name) return res.status(400).json({ error: 'customer_name is required' });
    const code = customer_name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10)
      + '_' + Date.now().toString(36).slice(-4).toUpperCase();
    const result = await pool.query(
      `INSERT INTO customers
         (customer_name, customer_code, gstin, pan, contact_name, email, phone,
          address, city, state, state_code, pincode, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [customer_name, code, gstin||null, pan||null, contact_name||null, email||null,
       phone||null, address||null, city||null, state||null, state_code||null, pincode||null, notes||null]
    );
    res.json({ success: true, customer: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function updateCustomer(req, res) {
  try {
    const { customer_id } = req.params;
    const {
      customer_name, gstin, pan, contact_name, email, phone,
      address, city, state, state_code, pincode, notes, is_active
    } = req.body;
    const result = await pool.query(
      `UPDATE customers SET
         customer_name  = COALESCE($2, customer_name),
         gstin          = $3,
         pan            = $4,
         contact_name   = $5,
         email          = $6,
         phone          = $7,
         address        = $8,
         city           = $9,
         state          = $10,
         state_code     = $11,
         pincode        = $12,
         notes          = $13,
         is_active      = COALESCE($14, is_active),
         updated_at     = NOW()
       WHERE customer_id = $1
       RETURNING *`,
      [customer_id, customer_name||null, gstin||null, pan||null, contact_name||null,
       email||null, phone||null, address||null, city||null, state||null, state_code||null,
       pincode||null, notes||null, is_active != null ? is_active : null]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json({ success: true, customer: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── INVOICES ──────────────────────────────────────────────────────────────────

async function listInvoices(req, res) {
  try {
    const { status, customer_id, drop_name, start_date, end_date, q } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (status)      { params.push(status);      where += ` AND i.status = $${params.length}`; }
    if (customer_id) { params.push(customer_id); where += ` AND i.customer_id = $${params.length}`; }
    if (drop_name)   { params.push(drop_name);   where += ` AND i.drop_name = $${params.length}`; }
    if (start_date)  { params.push(start_date);  where += ` AND i.invoice_date >= $${params.length}`; }
    if (end_date)    { params.push(end_date);     where += ` AND i.invoice_date <= $${params.length}`; }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (i.invoice_number ILIKE $${params.length} OR i.customer_name ILIKE $${params.length})`;
    }
    const rows = await pool.query(
      `SELECT i.*,
         (i.total_amount - i.amount_paid) AS balance_due
       FROM invoices i
       ${where}
       ORDER BY i.invoice_date DESC, i.invoice_id DESC
       LIMIT 200`,
      params
    );
    res.json({ success: true, invoices: rows.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getInvoice(req, res) {
  try {
    const { invoice_id } = req.params;
    const inv = await pool.query(
      `SELECT i.*, (i.total_amount - i.amount_paid) AS balance_due
       FROM invoices i WHERE i.invoice_id = $1`,
      [invoice_id]
    );
    if (!inv.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const items = await pool.query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY line_number',
      [invoice_id]
    );
    const payments = await pool.query(
      'SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY payment_date',
      [invoice_id]
    );
    res.json({ success: true, invoice: inv.rows[0], items: items.rows, payments: payments.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function createInvoice(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      customer_id, invoice_date, due_date, drop_id, drop_name,
      payment_terms_text, notes, internal_notes, place_of_supply,
      items = []
    } = req.body;

    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!items.length) return res.status(400).json({ error: 'At least one line item is required' });

    const custResult = await client.query('SELECT * FROM customers WHERE customer_id = $1', [customer_id]);
    if (!custResult.rows.length) return res.status(404).json({ error: 'Customer not found' });
    const cust = custResult.rows[0];

    const interstate = isInterstate(cust.state_code);
    const processedItems = items.map((it, idx) => ({ ...calcLineItem(it, interstate), line_number: idx + 1 }));

    const subtotal   = +processedItems.reduce((s, it) => s + it.amount, 0).toFixed(2);
    const cgstTotal  = +processedItems.reduce((s, it) => s + it.cgst_amount, 0).toFixed(2);
    const sgstTotal  = +processedItems.reduce((s, it) => s + it.sgst_amount, 0).toFixed(2);
    const igstTotal  = +processedItems.reduce((s, it) => s + it.igst_amount, 0).toFixed(2);
    const total      = +(subtotal + cgstTotal + sgstTotal + igstTotal).toFixed(2);

    const invoiceNumber = await nextInvoiceNumber(client);

    const invResult = await client.query(
      `INSERT INTO invoices
         (invoice_number, invoice_date, due_date, customer_id,
          customer_name, customer_gstin, customer_address, customer_state, customer_state_code,
          drop_id, drop_name, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount,
          is_interstate, place_of_supply, payment_terms_text, notes, internal_notes,
          status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'draft',$22)
       RETURNING *`,
      [
        invoiceNumber,
        invoice_date || new Date().toISOString().split('T')[0],
        due_date || null,
        customer_id,
        cust.customer_name,
        cust.gstin || null,
        cust.address || null,
        cust.state || null,
        cust.state_code || null,
        drop_id || null,
        drop_name || null,
        subtotal, cgstTotal, sgstTotal, igstTotal, total,
        interstate,
        place_of_supply || cust.state || null,
        payment_terms_text || null,
        notes || null,
        internal_notes || null,
        req.user?.userId || null
      ]
    );
    const invoice = invResult.rows[0];

    for (const it of processedItems) {
      await client.query(
        `INSERT INTO invoice_items
           (invoice_id, line_number, description, hsn_code, quantity, unit, unit_price,
            discount_pct, amount, gst_rate, cgst_amount, sgst_amount, igst_amount, sku_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [invoice.invoice_id, it.line_number, it.description, it.hsn_code||null,
         it.quantity, it.unit||'pcs', it.unit_price, it.discount_pct||0,
         it.amount, it.gst_rate||0, it.cgst_amount, it.sgst_amount, it.igst_amount,
         it.sku_code||null]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, invoice, items: processedItems });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

async function updateInvoice(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { invoice_id } = req.params;

    const existing = await client.query('SELECT * FROM invoices WHERE invoice_id = $1', [invoice_id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const inv = existing.rows[0];
    if (inv.status === 'void') return res.status(400).json({ error: 'Cannot edit a voided invoice' });
    if (inv.status === 'paid') return res.status(400).json({ error: 'Cannot edit a paid invoice; void it first' });

    const {
      customer_id, invoice_date, due_date, drop_id, drop_name,
      payment_terms_text, notes, internal_notes, place_of_supply,
      items
    } = req.body;

    let custSnap = { customer_name: inv.customer_name, gstin: inv.customer_gstin, address: inv.customer_address, state: inv.customer_state, state_code: inv.customer_state_code };
    let custId = customer_id || inv.customer_id;
    if (customer_id && customer_id !== inv.customer_id) {
      const cr = await client.query('SELECT * FROM customers WHERE customer_id = $1', [customer_id]);
      if (!cr.rows.length) return res.status(404).json({ error: 'Customer not found' });
      const c = cr.rows[0];
      custSnap = { customer_name: c.customer_name, gstin: c.gstin, address: c.address, state: c.state, state_code: c.state_code };
    }

    const interstate = isInterstate(custSnap.state_code);

    let subtotal = inv.subtotal, cgstTotal = inv.cgst_amount, sgstTotal = inv.sgst_amount, igstTotal = inv.igst_amount, total = inv.total_amount;
    let processedItems = null;

    if (items && items.length) {
      await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoice_id]);
      processedItems = items.map((it, idx) => ({ ...calcLineItem(it, interstate), line_number: idx + 1 }));
      subtotal  = +processedItems.reduce((s, it) => s + it.amount, 0).toFixed(2);
      cgstTotal = +processedItems.reduce((s, it) => s + it.cgst_amount, 0).toFixed(2);
      sgstTotal = +processedItems.reduce((s, it) => s + it.sgst_amount, 0).toFixed(2);
      igstTotal = +processedItems.reduce((s, it) => s + it.igst_amount, 0).toFixed(2);
      total     = +(subtotal + cgstTotal + sgstTotal + igstTotal).toFixed(2);
      for (const it of processedItems) {
        await client.query(
          `INSERT INTO invoice_items
             (invoice_id, line_number, description, hsn_code, quantity, unit, unit_price,
              discount_pct, amount, gst_rate, cgst_amount, sgst_amount, igst_amount, sku_code)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [invoice_id, it.line_number, it.description, it.hsn_code||null,
           it.quantity, it.unit||'pcs', it.unit_price, it.discount_pct||0,
           it.amount, it.gst_rate||0, it.cgst_amount, it.sgst_amount, it.igst_amount,
           it.sku_code||null]
        );
      }
    }

    const updated = await client.query(
      `UPDATE invoices SET
         customer_id          = $2,
         customer_name        = $3,
         customer_gstin       = $4,
         customer_address     = $5,
         customer_state       = $6,
         customer_state_code  = $7,
         invoice_date         = COALESCE($8, invoice_date),
         due_date             = $9,
         drop_id              = $10,
         drop_name            = $11,
         payment_terms_text   = $12,
         notes                = $13,
         internal_notes       = $14,
         place_of_supply      = $15,
         subtotal             = $16,
         cgst_amount          = $17,
         sgst_amount          = $18,
         igst_amount          = $19,
         total_amount         = $20,
         is_interstate        = $21,
         updated_at           = NOW()
       WHERE invoice_id = $1
       RETURNING *`,
      [invoice_id, custId, custSnap.customer_name, custSnap.gstin||null, custSnap.address||null,
       custSnap.state||null, custSnap.state_code||null,
       invoice_date||null, due_date||null, drop_id||null, drop_name||null,
       payment_terms_text||null, notes||null, internal_notes||null,
       place_of_supply||null, subtotal, cgstTotal, sgstTotal, igstTotal, total, interstate]
    );

    await client.query('COMMIT');
    res.json({ success: true, invoice: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

async function updateInvoiceStatus(req, res) {
  try {
    const { invoice_id } = req.params;
    const { status } = req.body;
    const VALID = ['draft', 'sent', 'paid', 'void'];
    if (!VALID.includes(status)) return res.status(400).json({ error: `status must be one of: ${VALID.join(', ')}` });

    const existing = await pool.query('SELECT * FROM invoices WHERE invoice_id = $1', [invoice_id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const inv = existing.rows[0];
    if (inv.status === 'void' && status !== 'void') return res.status(400).json({ error: 'Voided invoice cannot be reopened' });

    await pool.query(
      `UPDATE invoices SET status = $2, updated_at = NOW() WHERE invoice_id = $1`,
      [invoice_id, status]
    );
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function recordInvoicePayment(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { invoice_id } = req.params;
    const { payment_date, amount, payment_method, reference, notes } = req.body;

    const invResult = await client.query('SELECT * FROM invoices WHERE invoice_id = $1', [invoice_id]);
    if (!invResult.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const inv = invResult.rows[0];
    if (inv.status === 'void') return res.status(400).json({ error: 'Cannot record payment on voided invoice' });

    const payAmt = Number(amount);
    if (!payAmt || payAmt <= 0) return res.status(400).json({ error: 'amount must be greater than zero' });

    await client.query(
      `INSERT INTO invoice_payments (invoice_id, payment_date, amount, payment_method, reference, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [invoice_id, payment_date || new Date().toISOString().split('T')[0],
       payAmt, payment_method||null, reference||null, notes||null, req.user?.userId||null]
    );

    const newPaid = +(Number(inv.amount_paid) + payAmt).toFixed(2);
    const balance = +(Number(inv.total_amount) - newPaid).toFixed(2);
    const newStatus = balance <= 0 ? 'paid' : 'partially_paid';

    await client.query(
      `UPDATE invoices SET
         amount_paid    = $2,
         payment_date   = CASE WHEN $3 <= 0 THEN $4::date ELSE payment_date END,
         payment_method = CASE WHEN $3 <= 0 THEN $5 ELSE payment_method END,
         payment_ref    = CASE WHEN $3 <= 0 THEN $6 ELSE payment_ref END,
         status         = $7,
         updated_at     = NOW()
       WHERE invoice_id = $1`,
      [invoice_id, newPaid, balance, payment_date||new Date().toISOString().split('T')[0],
       payment_method||null, reference||null, newStatus]
    );

    await client.query('COMMIT');
    res.json({ success: true, amount_paid: newPaid, balance_due: balance, status: newStatus });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

async function deleteInvoice(req, res) {
  try {
    const { invoice_id } = req.params;
    const inv = await pool.query('SELECT status FROM invoices WHERE invoice_id = $1', [invoice_id]);
    if (!inv.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    if (!['draft', 'void'].includes(inv.rows[0].status)) {
      return res.status(400).json({ error: 'Only draft or voided invoices can be deleted; void it first' });
    }
    await pool.query('DELETE FROM invoices WHERE invoice_id = $1', [invoice_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getInvoiceSummary(req, res) {
  try {
    const summary = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'draft')           AS draft_count,
        COUNT(*) FILTER (WHERE status = 'sent')            AS sent_count,
        COUNT(*) FILTER (WHERE status = 'paid')            AS paid_count,
        COUNT(*) FILTER (WHERE status = 'partially_paid')  AS partial_count,
        COUNT(*) FILTER (WHERE status = 'void')            AS void_count,
        COUNT(*) FILTER (WHERE status IN ('sent','partially_paid') AND due_date < CURRENT_DATE) AS overdue_count,
        COALESCE(SUM(total_amount)   FILTER (WHERE status NOT IN ('void','draft')), 0) AS total_invoiced,
        COALESCE(SUM(amount_paid)    FILTER (WHERE status NOT IN ('void')), 0)         AS total_collected,
        COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE status IN ('sent','partially_paid')), 0) AS total_outstanding,
        COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE status IN ('sent','partially_paid') AND due_date < CURRENT_DATE), 0) AS total_overdue
      FROM invoices
    `);
    res.json({ success: true, summary: summary.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  listCustomers, createCustomer, updateCustomer,
  listInvoices, getInvoice, createInvoice, updateInvoice,
  updateInvoiceStatus, recordInvoicePayment, deleteInvoice,
  getInvoiceSummary
};
