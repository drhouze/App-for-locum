// backend/src/controllers/adminController.js
const UserModel = require('../models/User');
const ClinicModel = require('../models/Clinic');
const LocumSlotModel = require('../models/LocumSlot');
const AuditLogModel = require('../models/AuditLog');
const driveService = require('../config/drive');

class AdminController {
  // User Management
  async getAllUsers(req, res) {
    try {
      const users = await UserModel.findAll();
      // Remove passwords from response
      const sanitizedUsers = users.map(u => ({ ...u, password: undefined }));
      res.json(sanitizedUsers);
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({ error: 'Failed to get users' });
    }
  }

  async getUser(req, res) {
    try {
      const { id } = req.params;
      const user = await UserModel.findById(id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ ...user, password: undefined });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Don't allow role changes through this endpoint
      delete updates.role;
      delete updates.password;

      const user = await UserModel.update(id, updates);

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'admin_update_user',
        resource: 'users',
        resourceId: id,
        details: updates,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({ ...user, password: undefined });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Prevent deleting yourself
      if (id === req.userId) {
        return res.status(400).json({ error: 'You cannot delete your own account' });
      }

      await UserModel.delete(id);

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'admin_delete_user',
        resource: 'users',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  async toggleUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      // Prevent deactivating yourself
      if (id === req.userId) {
        return res.status(400).json({ error: 'You cannot deactivate your own account' });
      }

      const user = await UserModel.update(id, { isActive });

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'admin_toggle_user_status',
        resource: 'users',
        resourceId: id,
        details: { isActive },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({ ...user, password: undefined });
    } catch (error) {
      console.error('Toggle user status error:', error);
      res.status(500).json({ error: 'Failed to update user status' });
    }
  }

  // Data Export/Import
  async exportAllData(req, res) {
    try {
      const users = await UserModel.findAll();
      const clinics = await ClinicModel.findAll();
      const slots = await LocumSlotModel.findAll();
      const logs = await AuditLogModel.findAll({}, 10000); // Get last 10k logs

      const exportData = {
        users: users.map(u => ({ ...u, password: undefined })),
        clinics,
        slots,
        logs,
        exportDate: new Date().toISOString(),
        exportedBy: req.user.email,
      };

      // Save to Google Drive
      const fileName = `export-${Date.now()}.json`;
      const fileId = await driveService.writeJsonFile(null, exportData, fileName);

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'export_all_data',
        resource: 'system',
        details: { fileId, fileName },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({ 
        message: 'Data exported successfully',
        fileId,
        fileName,
        recordCount: {
          users: users.length,
          clinics: clinics.length,
          slots: slots.length,
          logs: logs.length,
        }
      });
    } catch (error) {
      console.error('Export data error:', error);
      res.status(500).json({ error: 'Failed to export data' });
    }
  }

  async downloadAllCSV(req, res) {
    try {
      const users = await UserModel.findAll();
      const clinics = await ClinicModel.findAll();
      const slots = await LocumSlotModel.findAll();

      // Create multi-sheet CSV (simplified - combining all data)
      const csvData = {
        users: users.map(u => ({ ...u, password: undefined })),
        clinics,
        slots,
      };

      const csv = this.convertToCSV(csvData);

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'download_all_csv',
        resource: 'system',
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=locum-platform-data.csv`);
      res.send(csv);
    } catch (error) {
      console.error('Download CSV error:', error);
      res.status(500).json({ error: 'Failed to download CSV' });
    }
  }

  async importData(req, res) {
    try {
      const { data } = req.body;

      if (!data || !data.users || !data.clinics || !data.slots) {
        return res.status(400).json({ error: 'Invalid data format' });
      }

      // Import users
      for (const user of data.users) {
        const existing = await UserModel.findByEmail(user.email);
        if (!existing) {
          await UserModel.create(user);
        }
      }

      // Import clinics
      for (const clinic of data.clinics) {
        const existing = await ClinicModel.findById(clinic._id);
        if (!existing) {
          await ClinicModel.create(clinic);
        }
      }

      // Import slots
      for (const slot of data.slots) {
        const existing = await LocumSlotModel.findById(slot._id);
        if (!existing) {
          await LocumSlotModel.create(slot);
        }
      }

      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'import_data',
        resource: 'system',
        details: {
          users: data.users.length,
          clinics: data.clinics.length,
          slots: data.slots.length,
        },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({ 
        message: 'Data imported successfully',
        imported: {
          users: data.users.length,
          clinics: data.clinics.length,
          slots: data.slots.length,
        }
      });
    } catch (error) {
      console.error('Import data error:', error);
      res.status(500).json({ error: 'Failed to import data' });
    }
  }

  // Audit Logs
  async getAuditLogs(req, res) {
    try {
      const { limit = 100, offset = 0, type, severity, userId } = req.query;
      let filter = {};

      if (type) filter.type = type;
      if (severity) filter.severity = severity;
      if (userId) filter.userId = userId;

      const logs = await AuditLogModel.findAll(filter, parseInt(limit), parseInt(offset));
      res.json(logs);
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({ error: 'Failed to get audit logs' });
    }
  }

  async getAuditStats(req, res) {
    try {
      const stats = await AuditLogModel.getStats();
      res.json(stats);
    } catch (error) {
      console.error('Get audit stats error:', error);
      res.status(500).json({ error: 'Failed to get audit stats' });
    }
  }

  // System Health
  async getSystemHealth(req, res) {
    try {
      const users = await UserModel.findAll();
      const clinics = await ClinicModel.findAll();
      const slots = await LocumSlotModel.findAll();
      const logs = await AuditLogModel.findAll({}, 100);

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        stats: {
          totalUsers: users.length,
          totalClinics: clinics.length,
          totalSlots: slots.length,
          recentLogs: logs.length,
        },
        roles: {
          doctors: users.filter(u => u.role === 'doctor').length,
          clinicAdmins: users.filter(u => u.role === 'clinic_admin').length,
          platformAdmins: users.filter(u => u.role === 'platform_admin').length,
        }
      });
    } catch (error) {
      console.error('System health error:', error);
      res.status(500).json({ 
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  convertToCSV(data) {
    if (!data || data.length === 0) return 'No data available';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(obj => headers.map(key => {
      const value = obj[key];
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value || '';
    }));
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
}

module.exports = new AdminController();
