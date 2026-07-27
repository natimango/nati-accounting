const express = require('express');
const router = express.Router();
const { listCoaAccounts, listDepartments, listDrops, createDrop } = require('../controllers/metaController');

router.get('/meta/coa_accounts', listCoaAccounts);
router.get('/meta/departments', listDepartments);
router.get('/meta/drops', listDrops);
router.post('/meta/drops', createDrop);

module.exports = router;
