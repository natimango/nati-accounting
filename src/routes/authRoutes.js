const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  login,
  logout,
  me,
  changePassword,
  adminResetPassword,
  listUsers,
  createUser,
  deleteUser,
  updateUser
} = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, changePassword);
router.get('/users', authenticate, authorize('admin'), listUsers);
router.post('/users', authenticate, authorize('admin'), createUser);
router.patch('/users/:id', authenticate, authorize('admin'), updateUser);
router.post('/users/:id/reset-password', authenticate, authorize('admin'), adminResetPassword);
router.delete('/users/:id', authenticate, authorize('admin'), deleteUser);

module.exports = router;
