import { Router } from 'express';
import * as ordersController from '../controllers/orders.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// E-commerce integration endpoints (API key authentication would go here)
router.post('/', asyncHandler(ordersController.createOrder));
router.post('/settlements', asyncHandler(ordersController.createSettlement));

export default router;
