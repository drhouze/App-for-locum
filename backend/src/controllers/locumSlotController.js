// backend/src/controllers/locumSlotController.js
const LocumSlotModel = require('../models/LocumSlot');
const ClinicModel = require('../models/Clinic');
const UserModel = require('../models/User');
const AuditLogModel = require('../models/AuditLog');
const { validationResult } = require('express-validator');

class LocumSlotController {
  async createSlot(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { clinicId } = req.body;

      // Check permissions
      if (req.user.role === 'clinic_admin' && req.user.clinicId !== clinicId) {
        return res.status(403).json({ error: 'You can only create slots for your own clinic' });
      }

      // Verify clinic exists
      const clinic = await ClinicModel.findById(clinicId);
      if (!clinic) {
        return res.status(404).json({ error: 'Clinic not found' });
      }

      const slot = await LocumSlotModel.create(req.body);

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'create_locum_slot',
        resource: 'locumSlots',
        resourceId: slot._id,
        details: slot,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(201).json(slot);
    } catch (error) {
      console.error('Create slot error:', error);
      res.status(500).json({ error: 'Failed to create locum slot' });
    }
  }

  async getSlots(req, res) {
    try {
      const { status, clinicId, doctorId, startDate, endDate } = req.query;
      let filter = {};

      if (status) filter.status = status;
      
      // Filter by clinic based on role
      if (req.user.role === 'clinic_admin') {
        filter.clinicId = req.user.clinicId;
      } else if (clinicId) {
        filter.clinicId = clinicId;
      }

      if (doctorId) {
        filter.doctorId = doctorId;
      }

      let slots = await LocumSlotModel.findAll(filter);

      // Date range filtering
      if (startDate || endDate) {
        slots = slots.filter(slot => {
          const date = slot.date;
          if (startDate && date < startDate) return false;
          if (endDate && date > endDate) return false;
          return true;
        });
      }

      res.json(slots);
    } catch (error) {
      console.error('Get slots error:', error);
      res.status(500).json({ error: 'Failed to get locum slots' });
    }
  }

  async getSlot(req, res) {
    try {
      const { id } = req.params;
      const slot = await LocumSlotModel.findById(id);

      if (!slot) {
        return res.status(404).json({ error: 'Slot not found' });
      }

      // Check permissions
      if (req.user.role === 'clinic_admin' && req.user.clinicId !== slot.clinicId) {
        return res.status(403).json({ error: 'You can only view your own clinic slots' });
      }

      res.json(slot);
    } catch (error) {
      console.error('Get slot error:', error);
      res.status(500).json({ error: 'Failed to get locum slot' });
    }
  }

  async updateSlot(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const slot = await LocumSlotModel.findById(id);
      if (!slot) {
        return res.status(404).json({ error: 'Slot not found' });
      }

      // Check permissions
      if (req.user.role === 'clinic_admin' && req.user.clinicId !== slot.clinicId) {
        return res.status(403).json({ error: 'You can only update your own clinic slots' });
      }

      // Don't allow changing clinic or doctor through regular update
      delete updates.clinicId;
      delete updates.doctorId;

      const updatedSlot = await LocumSlotModel.update(id, updates);

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'update_locum_slot',
        resource: 'locumSlots',
        resourceId: id,
        details: updates,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json(updatedSlot);
    } catch (error) {
      console.error('Update slot error:', error);
      res.status(500).json({ error: 'Failed to update locum slot' });
    }
  }

  async deleteSlot(req, res) {
    try {
      const { id } = req.params;

      const slot = await LocumSlotModel.findById(id);
      if (!slot) {
        return res.status(404).json({ error: 'Slot not found' });
      }

      // Check permissions
      if (req.user.role === 'clinic_admin' && req.user.clinicId !== slot.clinicId) {
        return res.status(403).json({ error: 'You can only delete your own clinic slots' });
      }

      await LocumSlotModel.delete(id);

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'delete_locum_slot',
        resource: 'locumSlots',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({ message: 'Slot deleted successfully' });
    } catch (error) {
      console.error('Delete slot error:', error);
      res.status(500).json({ error: 'Failed to delete locum slot' });
    }
  }

  async assignSlot(req, res) {
    try {
      const { id } = req.params;
      const { doctorId } = req.body;

      const slot = await LocumSlotModel.findById(id);
      if (!slot) {
        return res.status(404).json({ error: 'Slot not found' });
      }

      // Check permissions
      if (req.user.role === 'clinic_admin' && req.user.clinicId !== slot.clinicId) {
        return res.status(403).json({ error: 'You can only assign slots for your own clinic' });
      }

      // Check if slot is available
      if (slot.status !== 'available') {
        return res.status(400).json({ error: 'Slot is not available for assignment' });
      }

      // Verify doctor exists
      const doctor = await UserModel.findById(doctorId);
      if (!doctor || doctor.role !== 'doctor') {
        return res.status(404).json({ error: 'Doctor not found' });
      }

      const updatedSlot = await LocumSlotModel.assignSlot(id, doctorId);

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'assign_locum_slot',
        resource: 'locumSlots',
        resourceId: id,
        details: { doctorId },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json(updatedSlot);
    } catch (error) {
      console.error('Assign slot error:', error);
      res.status(500).json({ error: 'Failed to assign locum slot' });
    }
  }

  async completeSlot(req, res) {
    try {
      const { id } = req.params;

      const slot = await LocumSlotModel.findById(id);
      if (!slot) {
        return res.status(404).json({ error: 'Slot not found' });
      }

      // Check permissions
      if (req.user.role === 'clinic_admin' && req.user.clinicId !== slot.clinicId) {
        return res.status(403).json({ error: 'You can only complete slots for your own clinic' });
      }

      // Check if slot is assigned
      if (slot.status !== 'assigned') {
        return res.status(400).json({ error: 'Only assigned slots can be completed' });
      }

      const updatedSlot = await LocumSlotModel.completeSlot(id);

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'complete_locum_slot',
        resource: 'locumSlots',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json(updatedSlot);
    } catch (error) {
      console.error('Complete slot error:', error);
      res.status(500).json({ error: 'Failed to complete locum slot' });
    }
  }

  async cancelSlot(req, res) {
    try {
      const { id } = req.params;

      const slot = await LocumSlotModel.findById(id);
      if (!slot) {
        return res.status(404).json({ error: 'Slot not found' });
      }

      // Check permissions
      if (req.user.role === 'clinic_admin' && req.user.clinicId !== slot.clinicId) {
        return res.status(403).json({ error: 'You can only cancel slots for your own clinic' });
      }

      // Check if slot can be cancelled
      if (slot.status === 'completed') {
        return res.status(400).json({ error: 'Completed slots cannot be cancelled' });
      }

      const updatedSlot = await LocumSlotModel.cancelSlot(id);

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'cancel_locum_slot',
        resource: 'locumSlots',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json(updatedSlot);
    } catch (error) {
      console.error('Cancel slot error:', error);
      res.status(500).json({ error: 'Failed to cancel locum slot' });
    }
  }

  async getDoctorSlots(req, res) {
    try {
      const { doctorId } = req.params;

      // Check permissions
      if (req.user.role === 'doctor' && req.userId !== doctorId) {
        return res.status(403).json({ error: 'You can only view your own slots' });
      }

      const slots = await LocumSlotModel.findByDoctor(doctorId);
      res.json(slots);
    } catch (error) {
      console.error('Get doctor slots error:', error);
      res.status(500).json({ error: 'Failed to get doctor slots' });
    }
  }

  async getDoctorSummary(req, res) {
    try {
      const { doctorId } = req.params;

      // Check permissions
      if (req.user.role === 'doctor' && req.userId !== doctorId) {
        return res.status(403).json({ error: 'You can only view your own summary' });
      }

      const summary = await LocumSlotModel.getDoctorSummary(doctorId);
      res.json(summary);
    } catch (error) {
      console.error('Get doctor summary error:', error);
      res.status(500).json({ error: 'Failed to get doctor summary' });
    }
  }

  async getAvailableSlots(req, res) {
    try {
      const slots = await LocumSlotModel.findAll({ status: 'available' });
      res.json(slots);
    } catch (error) {
      console.error('Get available slots error:', error);
      res.status(500).json({ error: 'Failed to get available slots' });
    }
  }
}

module.exports = new LocumSlotController();
