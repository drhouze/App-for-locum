// backend/src/controllers/clinicController.js
const ClinicModel = require('../models/Clinic');
const UserModel = require('../models/User');
const LocumSlotModel = require('../models/LocumSlot');
const AuditLogModel = require('../models/AuditLog');
const { validationResult } = require('express-validator');

class ClinicController {
  async createClinic(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Only platform admin can create clinics
      if (req.user.role !== 'platform_admin') {
        return res.status(403).json({ error: 'Only platform admin can create clinics' });
      }

      const clinic = await ClinicModel.create(req.body);

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'create_clinic',
        resource: 'clinics',
        resourceId: clinic._id,
        details: clinic,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(201).json(clinic);
    } catch (error) {
      console.error('Create clinic error:', error);
      res.status(500).json({ error: 'Failed to create clinic' });
    }
  }

  async getClinics(req, res) {
    try {
      let clinics;
      
      if (req.user.role === 'platform_admin') {
        clinics = await ClinicModel.findAll();
      } else if (req.user.role === 'clinic_admin') {
        const clinic = await ClinicModel.findById(req.user.clinicId);
        clinics = clinic ? [clinic] : [];
      } else {
        // Doctors can see all clinics
        clinics = await ClinicModel.findAll({ isActive: true });
      }

      res.json(clinics);
    } catch (error) {
      console.error('Get clinics error:', error);
      res.status(500).json({ error: 'Failed to get clinics' });
    }
  }

  async getClinic(req, res) {
    try {
      const { id } = req.params;
      const clinic = await ClinicModel.getClinicWithDoctors(id);

      if (!clinic) {
        return res.status(404).json({ error: 'Clinic not found' });
      }

      // Check permissions
      if (req.user.role === 'clinic_admin' && req.user.clinicId !== id) {
        return res.status(403).json({ error: 'You can only access your own clinic' });
      }

      res.json(clinic);
    } catch (error) {
      console.error('Get clinic error:', error);
      res.status(500).json({ error: 'Failed to get clinic' });
    }
  }

  async updateClinic(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Check permissions
      if (req.user.role !== 'platform_admin') {
        const clinic = await ClinicModel.findById(id);
        if (!clinic || clinic._id !== req.user.clinicId) {
          return res.status(403).json({ error: 'You can only update your own clinic' });
        }
      }

      const clinic = await ClinicModel.update(id, updates);

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'update_clinic',
        resource: 'clinics',
        resourceId: id,
        details: updates,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json(clinic);
    } catch (error) {
      console.error('Update clinic error:', error);
      res.status(500).json({ error: 'Failed to update clinic' });
    }
  }

  async deleteClinic(req, res) {
    try {
      const { id } = req.params;

      // Only platform admin can delete clinics
      if (req.user.role !== 'platform_admin') {
        return res.status(403).json({ error: 'Only platform admin can delete clinics' });
      }

      await ClinicModel.delete(id);

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'delete_clinic',
        resource: 'clinics',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({ message: 'Clinic deleted successfully' });
    } catch (error) {
      console.error('Delete clinic error:', error);
      res.status(500).json({ error: 'Failed to delete clinic' });
    }
  }

  async getClinicSlots(req, res) {
    try {
      const { id } = req.params;

      // Check permissions
      if (req.user.role === 'clinic_admin' && req.user.clinicId !== id) {
        return res.status(403).json({ error: 'You can only view your own clinic slots' });
      }

      const slots = await LocumSlotModel.findByClinic(id);
      res.json(slots);
    } catch (error) {
      console.error('Get clinic slots error:', error);
      res.status(500).json({ error: 'Failed to get clinic slots' });
    }
  }

  async exportClinicData(req, res) {
    try {
      const { id } = req.params;

      // Check permissions
      if (req.user.role === 'clinic_admin' && req.user.clinicId !== id) {
        return res.status(403).json({ error: 'You can only export your own clinic data' });
      }

      const clinic = await ClinicModel.findById(id);
      const doctors = await UserModel.getClinicDoctors(id);
      const slots = await LocumSlotModel.findByClinic(id);

      const data = {
        clinic,
        doctors: doctors.map(d => ({ ...d, password: undefined })),
        slots,
        exportDate: new Date().toISOString(),
      };

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'export_clinic_data',
        resource: 'clinics',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json(data);
    } catch (error) {
      console.error('Export clinic data error:', error);
      res.status(500).json({ error: 'Failed to export clinic data' });
    }
  }

  async downloadClinicCSV(req, res) {
    try {
      const { id } = req.params;

      // Check permissions
      if (req.user.role === 'clinic_admin' && req.user.clinicId !== id) {
        return res.status(403).json({ error: 'You can only download your own clinic data' });
      }

      const slots = await LocumSlotModel.findByClinic(id);
      
      // Create CSV
      const csv = this.convertToCSV(slots);
      
      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'download_clinic_csv',
        resource: 'clinics',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=clinic-${id}-slots.csv`);
      res.send(csv);
    } catch (error) {
      console.error('Download clinic CSV error:', error);
      res.status(500).json({ error: 'Failed to download clinic CSV' });
    }
  }

  convertToCSV(data) {
    if (!data || data.length === 0) return 'No data available';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(obj => headers.map(key => obj[key] || ''));
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
}

module.exports = new ClinicController();
