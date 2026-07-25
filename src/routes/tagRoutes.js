const express = require('express');
const router = express.Router();
const { getTags, getBillTags, setBillTags } = require('../controllers/tagController');

router.get('/tags', getTags);
router.get('/tags/bill/:bill_id', getBillTags);
router.put('/tags/bill/:bill_id', setBillTags);

module.exports = router;
