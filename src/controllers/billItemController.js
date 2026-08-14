const pool = require('../config/database');
const { logDocumentFieldChange } = require('../utils/documentAudit');
const { buildVerificationSnapshot } = require('./uploadController');

async function patchBillItem(req, res) {
  const { id } = req.params;
  const {
    coa_account_id,
    department_id,
    drop_id,
    is_postable,
    posting_status,
    go_live_eligible,
    cost_nature,
    cost_stage,
    sku_code
  } = req.body;

  try {
    const current = await pool.query(
      `SELECT bi.*, b.document_id
       FROM bill_items bi
       LEFT JOIN bills b ON b.bill_id = bi.bill_id
       WHERE bi.item_id = $1`,
      [id]
    );
    if (!current.rows.length) {
      return res.status(404).json({ success: false, error: 'Bill item not found' });
    }
    const existing = current.rows[0];

    const updates = {
      coa_account_id: coa_account_id ?? existing.coa_account_id,
      department_id: department_id ?? existing.department_id,
      drop_id: drop_id ?? existing.drop_id,
      is_postable: typeof is_postable === 'boolean' ? is_postable : existing.is_postable,
      posting_status: posting_status || existing.posting_status,
      go_live_eligible: typeof go_live_eligible === 'boolean' ? go_live_eligible : existing.go_live_eligible,
      cost_nature: cost_nature ?? existing.cost_nature,
      cost_stage: cost_stage ?? existing.cost_stage,
      sku_code: sku_code !== undefined ? (sku_code || null) : existing.sku_code
    };

    if (!updates.is_postable) {
      updates.posting_status = 'unposted';
    }

    if (updates.posting_status === 'posted') {
      if (!updates.coa_account_id || !updates.department_id || !updates.drop_id) {
        return res.status(400).json({
          success: false,
          error: 'Posting requires CoA, department, and drop assignments'
        });
      }
    }

    await pool.query(
      `UPDATE bill_items
       SET coa_account_id  = $1,
           department_id   = $2,
           drop_id         = $3,
           is_postable     = $4,
           posting_status  = $5,
           go_live_eligible = $6,
           cost_nature     = $7,
           cost_stage      = $8,
           sku_code        = $9
       WHERE item_id = $10`,
      [
        updates.coa_account_id,
        updates.department_id,
        updates.drop_id,
        updates.is_postable,
        updates.posting_status,
        updates.go_live_eligible,
        updates.cost_nature,
        updates.cost_stage,
        updates.sku_code,
        id
      ]
    );

    const fields = [
      { field: 'coa_account_id', oldValue: existing.coa_account_id, newValue: updates.coa_account_id },
      { field: 'department_id', oldValue: existing.department_id, newValue: updates.department_id },
      { field: 'drop_id', oldValue: existing.drop_id, newValue: updates.drop_id },
      { field: 'is_postable', oldValue: existing.is_postable, newValue: updates.is_postable },
      { field: 'posting_status', oldValue: existing.posting_status, newValue: updates.posting_status },
      { field: 'go_live_eligible', oldValue: existing.go_live_eligible, newValue: updates.go_live_eligible },
      { field: 'cost_nature', oldValue: existing.cost_nature, newValue: updates.cost_nature },
      { field: 'cost_stage', oldValue: existing.cost_stage, newValue: updates.cost_stage },
      { field: 'sku_code', oldValue: existing.sku_code, newValue: updates.sku_code }
    ];

    const operationId = require('crypto').randomUUID();
    for (const entry of fields) {
      await logDocumentFieldChange({
        documentId: existing.document_id || null,
        fieldName: `bill_items.${entry.field}`,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        actorType: req.user?.role || 'user',
        actorId: req.user?.userId || null,
        reason: 'quality_gate',
        evidence: 'manual correction',
        operationId,
        sourceAction: 'manual_posting'
      });
    }

    const updatedItem = await pool.query('SELECT * FROM bill_items WHERE item_id = $1', [id]);

    const docRow = await pool.query(
      `SELECT d.*, b.total_amount
       FROM documents d
       LEFT JOIN bills b ON b.document_id = d.document_id
       WHERE d.document_id = $1
       LIMIT 1`,
      [existing.document_id]
    );
    const doc = docRow.rows[0] || {};

    const qualitySummary = await buildVerificationSnapshot(doc);

    res.json({
      success: true,
      item: updatedItem.rows[0],
      document: {
        document_id: doc.document_id,
        verification: qualitySummary
      }
    });
  } catch (error) {
    console.error('Patch bill item error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function postAllItems(req, res) {
  const { bill_id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE bill_items
       SET posting_status = 'posted'
       WHERE bill_id = $1
         AND is_postable = true
         AND posting_status != 'posted'
         AND coa_account_id IS NOT NULL
         AND department_id IS NOT NULL
         AND drop_id IS NOT NULL
       RETURNING item_id`,
      [bill_id]
    );
    const count = result.rowCount;
    if (!count) {
      return res.json({ success: true, posted: 0, message: 'No eligible unposted items (need COA + department + drop)' });
    }
    // Log the bulk posting
    const billRow = await pool.query('SELECT document_id FROM bills WHERE bill_id = $1', [bill_id]);
    const documentId = billRow.rows[0]?.document_id;
    const operationId = require('crypto').randomUUID();
    await pool.query(
      `INSERT INTO document_field_history
         (document_id, field_name, old_value, new_value, actor_type, actor_id, source_action, operation_id)
       VALUES ($1, 'bill_items.posting_status', 'unposted', 'posted', $2, $3, 'bulk_post', $4)`,
      [documentId, req.user?.role || 'user', req.user?.user_id || null, operationId]
    );
    res.json({ success: true, posted: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function createBillItem(req, res) {
  const { bill_id } = req.params;
  const {
    description,
    quantity,
    unit_price,
    amount,
    tax_rate,
    tax_amount,
    coa_account_id,
    department_id,
    drop_id,
    is_postable,
    cost_nature,
    cost_stage,
    sku_code
  } = req.body;

  try {
    const billRow = await pool.query(
      `SELECT b.bill_id, b.document_id FROM bills b WHERE b.bill_id = $1`,
      [bill_id]
    );
    if (!billRow.rows.length) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }
    const { document_id } = billRow.rows[0];

    const lineNum = await pool.query(
      `SELECT COALESCE(MAX(line_number), 0) + 1 AS next FROM bill_items WHERE bill_id = $1`,
      [bill_id]
    );
    const lineNumber = lineNum.rows[0].next;

    const computedAmount = amount != null
      ? Number(amount)
      : (Number(quantity || 1) * Number(unit_price || 0));

    const result = await pool.query(
      `INSERT INTO bill_items
         (bill_id, description, quantity, unit_price, amount, tax_rate, tax_amount,
          coa_account_id, department_id, drop_id, is_postable, cost_nature, cost_stage, sku_code, line_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        bill_id,
        description || null,
        quantity != null ? Number(quantity) : null,
        unit_price != null ? Number(unit_price) : null,
        computedAmount,
        tax_rate != null ? Number(tax_rate) : null,
        tax_amount != null ? Number(tax_amount) : null,
        coa_account_id || null,
        department_id || null,
        drop_id || null,
        typeof is_postable === 'boolean' ? is_postable : true,
        cost_nature || null,
        cost_stage || null,
        sku_code || null,
        lineNumber
      ]
    );

    const operationId = require('crypto').randomUUID();
    await logDocumentFieldChange({
      documentId: document_id || null,
      fieldName: 'bill_items.created',
      oldValue: null,
      newValue: `item_id=${result.rows[0].item_id}, amount=${computedAmount}`,
      actorType: req.user?.role || 'user',
      actorId: req.user?.userId || null,
      reason: 'manual_entry',
      evidence: 'manual correction',
      operationId,
      sourceAction: 'create_line_item'
    });

    res.status(201).json({ success: true, item: result.rows[0] });
  } catch (err) {
    console.error('Create bill item error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteBillItem(req, res) {
  const { id } = req.params;
  try {
    const existing = await pool.query(
      `SELECT bi.*, b.document_id FROM bill_items bi
       LEFT JOIN bills b ON b.bill_id = bi.bill_id
       WHERE bi.item_id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Bill item not found' });
    }
    if (existing.rows[0].posting_status === 'posted') {
      return res.status(400).json({ success: false, error: 'Cannot delete a posted line item' });
    }
    await pool.query('DELETE FROM bill_items WHERE item_id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete bill item error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { patchBillItem, postAllItems, createBillItem, deleteBillItem };
