// backend/src/routes/locumSlots.js
const express = require('express');
const router = express.Router();
const locumSlotController = require('../controllers/locumSlotController');
const authMiddleware = require('../middleware/auth');
const { body } = require('express-validator');

router.use(authMiddleware.authenticate);

router.post('/', [
  authMiddleware.authorize('clinic_admin', 'platform_admin'),
  body('clinicId').notEmpty(),
  body('date').notEmpty(),
  body('startTime').notEmpty(),
  body('endTime').notEmpty(),
  body('rate').isNumeric().optional(),
], locumSlotController.createSlot);

router.get('/', locumSlotController.getSlots);

router.get('/available', locumSlotController.getAvailableSlots);

router.get('/:id', locumSlotController.getSlot);

router.put('/:id', [
  authMiddleware.authorize('clinic_admin', 'platform_admin'),
], locumSlotController.updateSlot);

router.delete('/:id', [
  authMiddleware.authorize('clinic_admin', 'platform_admin'),
], locumSlotController.deleteSlot);

router.post('/:id/assign', [
  authMiddleware.authorize('clinic_admin', 'platform_admin'),
  body('doctorId').notEmpty(),
], locumSlotController.assignSlot);

router.post('/:id/complete', [
  authMiddleware.authorize('clinic_admin', 'platform_admin'),
], locumSlotController.completeSlot);

router.post('/:id/cancel', [
  authMiddleware.authorize('clinic_admin', 'platform_admin'),
], locumSlotController.cancelSlot);

router.get('/doctor/:doctorId', locumSlotController.getDoctorSlots);

router.get('/doctor/:doctorId/summary', locumSlotController.getDoctorSummary);

module.exports = router;
