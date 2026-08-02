// backend/src/routes/clinics.js
const express = require('express');
const router = express.Router();
const clinicController = require('../controllers/clinicController');
const authMiddleware = require('../middleware/auth');
const { body } = require('express-validator');

// All clinic routes require authentication
router.use(authMiddleware.authenticate);

router.post('/', [
  authMiddleware.authorize('platform_admin'),
  body('name').notEmpty().trim(),
  body('address').optional().trim(),
  body('phone').optional().trim(),
  body('email').optional().isEmail().normalizeEmail(),
], clinicController.createClinic);

router.get('/', clinicController.getClinics);

router.get('/:id', clinicController.getClinic);

router.put('/:id', [
  authMiddleware.authorize('platform_admin', 'clinic_admin'),
  body('name').optional().trim(),
  body('address').optional().trim(),
  body('phone').optional().trim(),
  body('email').optional().isEmail().normalizeEmail(),
], clinicController.updateClinic);

router.delete('/:id', [
  authMiddleware.authorize('platform_admin'),
], clinicController.deleteClinic);

router.get('/:id/slots', clinicController.getClinicSlots);

router.get('/:id/export', clinicController.exportClinicData);

router.get('/:id/download-csv', clinicController.downloadClinicCSV);

module.exports = router;
