// backend/src/models/AuditLog.js
const db = require('./Database');
const { v4: uuidv4 } = require('uuid');

class AuditLogModel {
  static async create(logData) {
    const id = uuidv4();
    const log = {
      userId: logData.userId,
      userEmail: logData.userEmail,
      userRole: logData.userRole,
      action: logData.action,
      resource: logData.resource,
      resourceId: logData.resourceId,
      details: logData.details || {},
      ip: logData.ip || '',
      userAgent: logData.userAgent || '',
      timestamp: new Date().toISOString(),
      type: logData.type || 'user_activity', // 'user_activity', 'error', 'security'
      severity: logData.severity || 'info', // 'info', 'warning', 'error', 'critical'
    };

    await db.createDocument('auditLogs', id, log);
    return { ...log, _id: id };
  }

  static async findAll(filter = {}, limit = 100, offset = 0) {
    let logs = await db.query('auditLogs', filter);
    logs = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return logs.slice(offset, offset + limit);
  }

  static async findById(id) {
    return await db.getDocument('auditLogs', id);
  }

  static async findByUser(userId, limit = 50) {
    const logs = await db.query('auditLogs', { userId });
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
  }

  static async findByType(type, limit = 50) {
    const logs = await db.query('auditLogs', { type });
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
  }

  static async logError(errorData) {
    return await this.create({
      ...errorData,
      type: 'error',
      severity: errorData.severity || 'error',
    });
  }

  static async logSecurityEvent(securityData) {
    return await this.create({
      ...securityData,
      type: 'security',
      severity: securityData.severity || 'warning',
    });
  }

  static async getStats(days = 7) {
    const logs = await db.getAll('auditLogs');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recent = logs.filter(log => new Date(log.timestamp) >= cutoff);
    
    return {
      total: logs.length,
      recent: recent.length,
      byType: {
        user_activity: logs.filter(l => l.type === 'user_activity').length,
        error: logs.filter(l => l.type === 'error').length,
        security: logs.filter(l => l.type === 'security').length,
      },
      bySeverity: {
        info: logs.filter(l => l.severity === 'info').length,
        warning: logs.filter(l => l.severity === 'warning').length,
        error: logs.filter(l => l.severity === 'error').length,
        critical: logs.filter(l => l.severity === 'critical').length,
      },
    };
  }
}

module.exports = AuditLogModel;
