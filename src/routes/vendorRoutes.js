const express = require('express');
const router = express.Router();
const { listVendors, getVendor, createVendor, updateVendor, archiveVendor } = require('../controllers/vendorController');
const { authorize } = require('../middleware/auth');

router.use(authorize('manager', 'admin'));

router.get('/vendors', listVendors);
router.post('/vendors', createVendor);
router.get('/vendors/:vendor_id', getVendor);
router.patch('/vendors/:vendor_id', updateVendor);
router.delete('/vendors/:vendor_id', archiveVendor);

module.exports = router;
