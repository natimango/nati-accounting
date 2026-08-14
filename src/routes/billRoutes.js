const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  processBillWithAI,
  processBillManual,
  getPaymentDashboard,
  recordPayment,
  recordSimplePayment,
  deleteBill,
  voidBill,
  updateBillMeta,
  bulkUpdateBillMeta,
  listPayments,
  createStandaloneBill,
  updateBillCore
} = require('../controllers/billController');
const { authorize } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

router.use(authorize('manager', 'admin'));

// Process bill with AI
router.post('/bills/:document_id/process', processBillWithAI);

// Manually process a bill when AI fails or needs override
router.post('/bills/:document_id/manual', processBillManual);

// Get payment dashboard
router.get('/payments/dashboard', getPaymentDashboard);

// Record payment
router.post('/payments/record', recordPayment);

// Delete bill (and cascade its items/payments), reset document for reprocess
router.delete('/bills/:bill_id', deleteBill);

// Void bill (keeps document, marks bill as void, cancels pending payments)
router.patch('/bills/:bill_id/void', authorize('admin'), voidBill);

// Update bill/document metadata (dimensions/category)
router.patch('/bills/:bill_id/meta', updateBillMeta);

// Update core financial fields (amount, date, vendor, bill_number)
router.patch('/bills/:bill_id/core', authorize('manager', 'admin'), updateBillCore);

// Quick payment record against earliest pending schedule
router.post('/payments/record-simple', recordSimplePayment);

// Bulk metadata update (group/category/drop) across multiple bills
router.patch('/bills/bulk-meta', authorize('manager', 'admin'), bulkUpdateBillMeta);

// Payment ledger — all recorded payments with vendor/bill context
router.get('/payments/ledger', listPayments);

// Create a standalone bill (no document upload needed)
router.post('/bills/manual', authorize('manager', 'admin'), createStandaloneBill);

module.exports = router;
