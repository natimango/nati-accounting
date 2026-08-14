const express = require('express');
const router = express.Router();
const { patchBillItem, postAllItems, createBillItem, deleteBillItem } = require('../controllers/billItemController');
const { authorize } = require('../middleware/auth');

router.patch('/bill-items/:id', patchBillItem);
router.delete('/bill-items/:id', authorize('manager', 'admin'), deleteBillItem);
router.post('/bills/:bill_id/items', authorize('manager', 'admin'), createBillItem);
router.post('/bills/:bill_id/post-all-items', authorize('manager', 'admin'), postAllItems);

module.exports = router;
