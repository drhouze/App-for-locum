// backend/src/models/LocumSlot.js
const db = require('./Database');
const { v4: uuidv4 } = require('uuid');

class LocumSlotModel {
  static async create(slotData) {
    const id = uuidv4();
    const slot = {
      clinicId: slotData.clinicId,
      doctorId: slotData.doctorId || null,
      date: slotData.date,
      startTime: slotData.startTime,
      endTime: slotData.endTime,
      rate: slotData.rate || 0,
      specialty: slotData.specialty || 'General',
      status: slotData.status || 'available', // 'available', 'assigned', 'completed', 'cancelled'
      notes: slotData.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createDocument('locumSlots', id, slot);
    return { ...slot, _id: id };
  }

  static async findById(id) {
    return await db.getDocument('locumSlots', id);
  }

  static async findAll(filter = {}) {
    return await db.query('locumSlots', filter);
  }

  static async findByClinic(clinicId) {
    return await db.query('locumSlots', { clinicId });
  }

  static async findByDoctor(doctorId) {
    return await db.query('locumSlots', { doctorId });
  }

  static async findByDateRange(clinicId, startDate, endDate) {
    const slots = await db.query('locumSlots', { clinicId });
    return slots.filter(slot => {
      return slot.date >= startDate && slot.date <= endDate;
    });
  }

  static async update(id, updates) {
    updates.updatedAt = new Date().toISOString();
    return await db.updateDocument('locumSlots', id, updates);
  }

  static async assignSlot(id, doctorId) {
    return await this.update(id, { 
      doctorId, 
      status: 'assigned',
      assignedAt: new Date().toISOString()
    });
  }

  static async completeSlot(id) {
    return await this.update(id, { 
      status: 'completed',
      completedAt: new Date().toISOString()
    });
  }

  static async cancelSlot(id) {
    return await this.update(id, { 
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    });
  }

  static async delete(id) {
    return await db.deleteDocument('locumSlots', id);
  }

  static async getDoctorSummary(doctorId) {
    const slots = await this.findByDoctor(doctorId);
    const totalEarnings = slots
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + s.rate, 0);
    
    const assigned = slots.filter(s => s.status === 'assigned').length;
    const completed = slots.filter(s => s.status === 'completed').length;
    const cancelled = slots.filter(s => s.status === 'cancelled').length;
    const available = slots.filter(s => s.status === 'available').length;

    return {
      totalEarnings,
      stats: { assigned, completed, cancelled, available },
      slots
    };
  }

  static async getClinicSummary(clinicId) {
    const slots = await this.findByClinic(clinicId);
    const totalCost = slots
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + s.rate, 0);
    
    const assigned = slots.filter(s => s.status === 'assigned').length;
    const completed = slots.filter(s => s.status === 'completed').length;
    const cancelled = slots.filter(s => s.status === 'cancelled').length;
    const available = slots.filter(s => s.status === 'available').length;

    return {
      totalCost,
      stats: { assigned, completed, cancelled, available },
      slots
    };
  }
}

module.exports = LocumSlotModel;
