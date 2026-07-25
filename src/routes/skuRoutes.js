const express = require('express');
const router = express.Router();
const { listSkus, createSku, updateSku, setSkuPrice, getSkuCosts, setSkuCost } = require('../controllers/skuController');
const { authorize } = require('../middleware/auth');

router.get('/skus', listSkus);
router.post('/skus', authorize('manager', 'admin'), createSku);
router.patch('/skus/:sku_id', authorize('manager', 'admin'), updateSku);
router.post('/skus/:sku_id/price', authorize('manager', 'admin'), setSkuPrice);
router.get('/skus/:sku_id/costs', getSkuCosts);
router.post('/skus/:sku_id/costs', authorize('manager', 'admin'), setSkuCost);

module.exports = router;
