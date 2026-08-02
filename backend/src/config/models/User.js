// backend/src/models/User.js
const db = require('./Database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class UserModel {
  static async create(userData) {
    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const user = {
      email: userData.email,
      password: hashedPassword,
      name: userData.name,
      role: userData.role || 'doctor', // 'doctor', 'clinic_admin', 'platform_admin'
      clinicId: userData.clinicId || null,
      phone: userData.phone || '',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createDocument('users', id, user);
    return { ...user, _id: id };
  }

  static async findById(id) {
    return await db.getDocument('users', id);
  }

  static async findByEmail(email) {
    const users = await db.query('users', { email });
    return users[0] || null;
  }

  static async findAll(filter = {}) {
    return await db.query('users', filter);
  }

  static async update(id, updates) {
    // Don't allow password update through this method
    delete updates.password;
    updates.updatedAt = new Date().toISOString();
    return await db.updateDocument('users', id, updates);
  }

  static async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return await db.updateDocument('users', id, { 
      password: hashedPassword,
      updatedAt: new Date().toISOString()
    });
  }

  static async delete(id) {
    return await db.deleteDocument('users', id);
  }

  static async comparePassword(user, password) {
    return await bcrypt.compare(password, user.password);
  }

  static async getClinicDoctors(clinicId) {
    return await db.query('users', { clinicId, role: 'doctor', isActive: true });
  }

  static async getAllDoctors() {
    return await db.query('users', { role: 'doctor' });
  }

  static async getAllClinicAdmins() {
    return await db.query('users', { role: 'clinic_admin' });
  }
}

module.exports = UserModel;
