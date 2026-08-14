const express = require('express');
const router = express.Router();
const {
  getProfitLoss,
  getPLTrend,
  getBalanceSheet,
  getTrialBalance,
  getChartOfAccounts,
  getDimensionSpend,
  upsertDropBudget,
  getDropBudgets,
  getDropBudgetHistory,
  getDropVariance,
  getMetricsSummary,
  getCogsBySku,
  getContributionMargin,
  getUnitEconomics,
  getGarmentProfitability,
  upsertSkuAssumptions,
  upsertSizeSellThrough,
  ingestMarketingSpend,
  ingestShipmentCost,
  getSalesEntries,
  createSalesEntry,
  updateSalesEntry,
  deleteSalesEntry,
  getJournalEntries,
  getVendorAnalysis,
  getCashFlow,
  createJournalEntry
} = require('../controllers/reportsController');
const { authorize } = require('../middleware/auth');

router.use(authorize('uploader', 'manager', 'admin'));

router.get('/reports/profit-loss', getProfitLoss);
router.get('/reports/trend', getPLTrend);
router.get('/reports/balance-sheet', getBalanceSheet);
router.get('/reports/spend-dimensions', getDimensionSpend);
router.post('/reports/drop-budgets', authorize('admin'), upsertDropBudget);
router.get('/reports/drop-budgets', getDropBudgets);
router.get('/reports/drop-budgets/history', getDropBudgetHistory);
router.get('/reports/drop-variance', getDropVariance);
router.get('/reports/contribution-margin', getContributionMargin);
router.get('/reports/unit-economics', getUnitEconomics);
router.get('/metrics/summary', getMetricsSummary);
router.get('/metrics/cogs/:sku_code', getCogsBySku);
router.get('/reports/garment-economics', getGarmentProfitability);
router.post('/sku/:sku_id/assumptions', authorize('manager', 'admin'), upsertSkuAssumptions);
router.post('/sku/:sku_id/sell-through', authorize('manager', 'admin'), upsertSizeSellThrough);
router.post('/ingest/marketing', authorize('admin'), ingestMarketingSpend);
router.post('/ingest/shipment', authorize('admin'), ingestShipmentCost);
router.get('/reports/sales', getSalesEntries);
router.post('/reports/sales', authorize('manager', 'admin'), createSalesEntry);
router.put('/reports/sales/:id', authorize('manager', 'admin'), updateSalesEntry);
router.delete('/reports/sales/:id', authorize('admin'), deleteSalesEntry);
router.get('/reports/journal-entries', getJournalEntries);
router.get('/reports/trial-balance', getTrialBalance);
router.get('/reports/chart-of-accounts', getChartOfAccounts);
router.get('/reports/vendor-analysis', getVendorAnalysis);
router.get('/reports/cash-flow', getCashFlow);
router.post('/reports/journal-entries', authorize('manager', 'admin'), createJournalEntry);

module.exports = router;
