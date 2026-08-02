// backend/src/controllers/authController.js
const UserModel = require('../models/User');
const AuditLogModel = require('../models/AuditLog');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

class AuthController {
  async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name, role, clinicId } = req.body;

      // Check if user exists
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Create user
      const user = await UserModel.create({
        email,
        password,
        name,
        role: role || 'doctor',
        clinicId: role === 'clinic_admin' ? clinicId : null,
      });

      // Log registration
      await AuditLogModel.create({
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        action: 'register',
        resource: 'users',
        resourceId: user._id,
        details: { role: user.role },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      // Generate token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '7d',
      });

      res.status(201).json({
        user: { ...user, password: undefined },
        token,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const user = await UserModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({ error: 'Account is deactivated' });
      }

      // Verify password
      const isValid = await UserModel.comparePassword(user, password);
      if (!isValid) {
        // Log failed login attempt
        await AuditLogModel.logSecurityEvent({
          userId: user._id,
          userEmail: user.email,
          userRole: user.role,
          action: 'failed_login',
          resource: 'auth',
          details: { reason: 'Invalid password' },
          ip: req.ip,
          userAgent: req.get('user-agent'),
          severity: 'warning',
        });

        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Log successful login
      await AuditLogModel.create({
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        action: 'login',
        resource: 'auth',
        details: { method: 'password' },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      // Generate token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '7d',
      });

      res.json({
        user: { ...user, password: undefined },
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.userId;

      // Find user
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isValid = await UserModel.comparePassword(user, currentPassword);
      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Update password
      await UserModel.updatePassword(userId, newPassword);

      // Log password change
      await AuditLogModel.logSecurityEvent({
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        action: 'change_password',
        resource: 'users',
        resourceId: user._id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        severity: 'info',
      });

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const user = await UserModel.findByEmail(email);

      if (user) {
        // In production, send reset email with token
        // For now, just log the request
        await AuditLogModel.create({
          userId: user._id,
          userEmail: user.email,
          userRole: user.role,
          action: 'forgot_password',
          resource: 'auth',
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });
      }

      // Always return success to prevent email enumeration
      res.json({ message: 'If an account exists, a reset link will be sent' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  }

  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;
      
      // Verify reset token (simplified - in production use a proper reset token system)
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await UserModel.findById(decoded.id);

      if (!user) {
        return res.status(400).json({ error: 'Invalid reset token' });
      }

      // Update password
      await UserModel.updatePassword(user._id, newPassword);

      // Log password reset
      await AuditLogModel.logSecurityEvent({
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        action: 'reset_password',
        resource: 'users',
        resourceId: user._id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        severity: 'info',
      });

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }

  async logout(req, res) {
    try {
      // Log logout
      await AuditLogModel.create({
        userId: req.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: 'logout',
        resource: 'auth',
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  async getProfile(req, res) {
    try {
      const user = await UserModel.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user: { ...user, password: undefined } });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }

  async updateProfile(req, res) {
    try {
      const { name, phone } = req.body;
      const user = await UserModel.update(req.userId, { name, phone });

      res.json({ user: { ...user, password: undefined } });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
}

module.exports = new AuthController();
