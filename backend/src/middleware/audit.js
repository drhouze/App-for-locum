// backend/src/middleware/audit.js
const AuditLogModel = require('../models/AuditLog');

const auditMiddleware = {
  // Log user actions
  logAction: (action, resource) => {
    return async (req, res, next) => {
      const originalSend = res.send;
      
      res.send = function(data) {
        // Only log successful operations
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const logData = {
            userId: req.userId,
            userEmail: req.user?.email,
            userRole: req.user?.role,
            action: action,
            resource: resource,
            resourceId: req.params.id || req.body.id,
            details: {
              method: req.method,
              url: req.originalUrl,
              statusCode: res.statusCode,
              requestBody: req.body,
            },
            ip: req.ip,
            userAgent: req.get('user-agent'),
          };
          
          AuditLogModel.create(logData).catch(err => 
            console.error('Failed to log audit:', err)
          );
        }
        
        originalSend.call(this, data);
      };
      
      next();
    };
  },

  // Log errors
  logError: (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      if (res.statusCode >= 400) {
        const errorData = {
          userId: req.userId,
          userEmail: req.user?.email,
          userRole: req.user?.role,
          action: 'api_error',
          resource: req.originalUrl,
          details: {
            method: req.method,
            statusCode: res.statusCode,
            error: data,
            requestBody: req.body,
          },
          ip: req.ip,
          userAgent: req.get('user-agent'),
          severity: res.statusCode >= 500 ? 'critical' : 'error',
        };
        
        AuditLogModel.logError(errorData).catch(err => 
          console.error('Failed to log error:', err)
        );
      }
      
      originalJson.call(this, data);
    };
    
    next();
  },
};

module.exports = auditMiddleware;
