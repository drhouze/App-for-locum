// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { body } = require('express-validator');

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').notEmpty().trim(),
], authController.register);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], authController.login);

router.post('/change-password', [
  authMiddleware.authenticate,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
], authController.changePassword);

router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail(),
], authController.forgotPassword);

router.post('/reset-password', [
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
], authController.resetPassword);

router.post('/logout', authMiddleware.authenticate, authController.logout);

router.get('/profile', authMiddleware.authenticate, authController.getProfile);

router.put('/profile', [
  authMiddleware.authenticate,
  body('name').optional().trim(),
  body('phone').optional().trim(),
], authController.updateProfile);

module.exports = router;
