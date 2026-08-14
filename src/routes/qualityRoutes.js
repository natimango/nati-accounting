const express = require('express');
const router = express.Router();
const { getQualitySummary, getQualityDocuments, getQualityStats } = require('../controllers/qualityController');
const { authorize } = require('../middleware/auth');

router.get('/quality/summary', getQualitySummary);
router.get('/quality/stats', authorize('manager', 'admin'), getQualityStats);
router.get('/quality/documents', authorize('manager', 'admin'), getQualityDocuments);

module.exports = router;
