import { Router } from 'express';
import * as reportsController from '../controllers/reports.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/dashboard', asyncHandler(reportsController.getDashboard));
router.get('/profit-loss', asyncHandler(reportsController.getProfitAndLoss));
router.get('/balance-sheet', asyncHandler(reportsController.getBalanceSheet));
router.get('/spend-by-category', asyncHandler(reportsController.getSpendByCategory));
router.get('/monthly-trend', asyncHandler(reportsController.getMonthlyTrend));

export default router;
