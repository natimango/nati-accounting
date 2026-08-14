const express = require('express');
const router = express.Router();
const { listCoaAccounts, listDepartments, listDrops, createDrop, updateDrop } = require('../controllers/metaController');
const { authorize } = require('../middleware/auth');
const pool = require('../config/database');

router.get('/meta/coa_accounts', listCoaAccounts);
router.get('/meta/departments', listDepartments);
router.get('/meta/drops', listDrops);
router.post('/meta/drops', authorize('manager', 'admin'), createDrop);
router.patch('/meta/drops/:drop_id', authorize('manager', 'admin'), updateDrop);

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ success: true, results: [] });
  const like = `%${q}%`;
  try {
    const [vendors, bills, docs] = await Promise.all([
      pool.query(
        `SELECT vendor_id, vendor_name, vendor_type FROM vendors
         WHERE is_active = true AND (vendor_name ILIKE $1 OR gstin ILIKE $1)
         LIMIT 5`,
        [like]
      ),
      pool.query(
        `SELECT b.bill_id, b.bill_number, b.total_amount, b.bill_date,
                COALESCE(v.vendor_name, b.vendor_name) AS bill_vendor_name,
                d.document_id
         FROM bills b
         LEFT JOIN vendors v ON v.vendor_id = b.vendor_id
         LEFT JOIN documents d ON d.document_id = b.document_id
         WHERE (b.status IS NULL OR b.status NOT IN ('deleted','void'))
           AND (b.bill_number ILIKE $1 OR v.vendor_name ILIKE $1 OR b.vendor_name ILIKE $1 OR b.category ILIKE $1)
         ORDER BY b.bill_date DESC LIMIT 5`,
        [like]
      ),
      pool.query(
        `SELECT d.document_id, d.file_name, d.uploaded_at, b.bill_id
         FROM documents d
         LEFT JOIN bills b ON b.document_id = d.document_id
         WHERE COALESCE(d.status,'') NOT IN ('deleted')
           AND d.file_name ILIKE $1
         LIMIT 5`,
        [like]
      ),
    ]);
    const results = [
      ...vendors.rows.map(r => ({ type: 'vendor', id: r.vendor_id, label: r.vendor_name, sub: r.vendor_type || '', href: `vendors.html?q=${encodeURIComponent(r.vendor_name)}` })),
      ...bills.rows.map(r => ({ type: 'bill', id: r.bill_id, label: `${r.bill_vendor_name || r.vendor_name || '?'} — ${r.bill_number || '#' + r.bill_id}`, sub: r.total_amount ? `₹${Number(r.total_amount).toLocaleString('en-IN')}` : '', href: `documents.html?doc=${r.document_id || ''}` })),
      ...docs.rows.map(r => ({ type: 'doc', id: r.document_id, label: r.file_name || `Doc #${r.document_id}`, sub: '', href: `documents.html?doc=${r.document_id}` })),
    ];
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
