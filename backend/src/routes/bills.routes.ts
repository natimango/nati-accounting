import { Router } from 'express';
import * as billsController from '../controllers/bills.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { upload } from '../middleware/upload';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post('/upload', upload.single('bill'), asyncHandler(billsController.uploadBill));
router.get('/', asyncHandler(billsController.getBills));
router.get('/:id', asyncHandler(billsController.getBillById));
router.post('/:id/approve', authorize('ADMIN', 'ACCOUNTANT'), asyncHandler(billsController.approveBill));

export default router;
