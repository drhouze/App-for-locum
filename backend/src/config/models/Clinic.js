// backend/src/models/Clinic.js
const db = require('./Database');
const { v4: uuidv4 } = require('uuid');

class ClinicModel {
  static async create(clinicData) {
    const id = uuidv4();
    const clinic = {
      name: clinicData.name,
      address: clinicData.address || '',
      phone: clinicData.phone || '',
      email: clinicData.email || '',
      registrationNumber: clinicData.registrationNumber || '',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createDocument('clinics', id, clinic);
    return { ...clinic, _id: id };
  }

  static async findById(id) {
    return await db.getDocument('clinics', id);
  }

  static async findAll(filter = {}) {
    return await db.query('clinics', filter);
  }

  static async update(id, updates) {
    updates.updatedAt = new Date().toISOString();
    return await db.updateDocument('clinics', id, updates);
  }

  static async delete(id) {
    return await db.deleteDocument('clinics', id);
  }

  static async getClinicWithDoctors(clinicId) {
    const clinic = await this.findById(clinicId);
    if (!clinic) return null;

    const users = await db.query('users', { clinicId, role: 'doctor' });
    return { ...clinic, doctors: users };
  }
}

module.exports = ClinicModel;
