import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.post('/login', asyncHandler(authController.login));
router.post('/register', asyncHandler(authController.register));
router.get('/me', authenticate, asyncHandler(authController.me));

export default router;
