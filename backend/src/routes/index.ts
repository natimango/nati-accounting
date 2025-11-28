import { Router } from 'express';
import authRoutes from './auth.routes';
import billsRoutes from './bills.routes';
import ordersRoutes from './orders.routes';
import reportsRoutes from './reports.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/bills', billsRoutes);
router.use('/orders', ordersRoutes);
router.use('/reports', reportsRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'NATI Accounting API is running',
    timestamp: new Date().toISOString()
  });
});

export default router;
