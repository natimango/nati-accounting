const express = require('express');
const router = express.Router();
const { listVendors, getVendor, createVendor, updateVendor, archiveVendor, mergeVendors } = require('../controllers/vendorController');
const { authorize } = require('../middleware/auth');

router.use(authorize('manager', 'admin'));

router.get('/vendors', listVendors);
router.post('/vendors', createVendor);
router.get('/vendors/:vendor_id', getVendor);
router.patch('/vendors/:vendor_id', updateVendor);
router.delete('/vendors/:vendor_id', archiveVendor);
router.post('/vendors/:vendor_id/merge', authorize('admin'), mergeVendors);

module.exports = router;
