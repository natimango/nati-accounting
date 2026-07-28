const express = require('express');
const router = express.Router();
const { listCoaAccounts, listDepartments, listDrops, createDrop, updateDrop } = require('../controllers/metaController');
const { authorize } = require('../middleware/auth');

router.get('/meta/coa_accounts', listCoaAccounts);
router.get('/meta/departments', listDepartments);
router.get('/meta/drops', listDrops);
router.post('/meta/drops', authorize('manager', 'admin'), createDrop);
router.patch('/meta/drops/:drop_id', authorize('manager', 'admin'), updateDrop);

module.exports = router;
