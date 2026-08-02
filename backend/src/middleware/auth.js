// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const UserModel = require('../models/User');
const AuditLogModel = require('../models/AuditLog');

const authMiddleware = {
  // Verify JWT token
  authenticate: async (req, res, next) => {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        throw new Error();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await UserModel.findById(decoded.id);
      
      if (!user || !user.isActive) {
        throw new Error();
      }

      req.user = user;
      req.userId = decoded.id;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Please authenticate' });
    }
  },

  // Role-based authorization
  authorize: (...roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Please authenticate' });
      }

      if (!roles.includes(req.user.role)) {
        // Log unauthorized access attempt
        AuditLogModel.logSecurityEvent({
          userId: req.userId,
          userEmail: req.user.email,
          userRole: req.user.role,
          action: 'unauthorized_access',
          resource: req.originalUrl,
          details: { requiredRoles: roles },
          severity: 'warning',
        });

        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  },

  // Clinic admin authorization - can only access their own clinic data
  authorizeClinicAdmin: (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Please authenticate' });
    }

    if (req.user.role === 'platform_admin') {
      return next();
    }

    if (req.user.role !== 'clinic_admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Check if the requested resource belongs to their clinic
    const clinicId = req.params.clinicId || req.body.clinicId;
    if (clinicId && clinicId !== req.user.clinicId) {
      AuditLogModel.logSecurityEvent({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'unauthorized_clinic_access',
        resource: req.originalUrl,
        details: { requestedClinicId: clinicId, userClinicId: req.user.clinicId },
        severity: 'warning',
      });

      return res.status(403).json({ error: 'You can only access your own clinic data' });
    }

    next();
  },
};

module.exports = authMiddleware;
