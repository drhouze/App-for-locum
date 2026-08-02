// backend/src/routes/admin.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const { body } = require('express-validator');

router.use(authMiddleware.authenticate);
router.use(authMiddleware.authorize('platform_admin'));

// User Management
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUser);
router.put('/users/:id', [
  body('name').optional().trim(),
  body('phone').optional().trim(),
  body('isActive').optional().isBoolean(),
], adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.patch('/users/:id/toggle', [
  body('isActive').isBoolean(),
], adminController.toggleUserStatus);

// Data Export/Import
router.post('/export', adminController.exportAllData);
router.get('/download-csv', adminController.downloadAllCSV);
router.post('/import', adminController.importData);

// Audit Logs
router.get('/audit-logs', adminController.getAuditLogs);
router.get('/audit-stats', adminController.getAuditStats);

// System Health
router.get('/health', adminController.getSystemHealth);

module.exports = router;
