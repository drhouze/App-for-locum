// frontend/src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { 
  CalendarIcon, 
  UserGroupIcon, 
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  BuildingOfficeIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

const Dashboard = () => {
  const { user, isDoctor, isClinicAdmin, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentSlots, setRecentSlots] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      let slotsEndpoint = '/locum-slots';
      if (isClinicAdmin) {
        slotsEndpoint = `/locum-slots?clinicId=${user.clinicId}`;
      } else if (isDoctor) {
        slotsEndpoint = `/locum-slots/doctor/${user._id}`;
      }

      const [slotsRes, statsRes] = await Promise.all([
        api.get(slotsEndpoint),
        isDoctor ? api.get(`/locum-slots/doctor/${user._id}/summary`) : null,
        isClinicAdmin ? api.get(`/clinics/${user.clinicId}`) : null,
        isPlatformAdmin ? api.get('/admin/health') : null,
      ]);

      let dashboardStats = {};
      let slots = slotsRes.data || [];

      if (isDoctor && statsRes) {
        dashboardStats = statsRes.data;
      } else if (isClinicAdmin) {
        const clinicData = await api.get(`/clinics/${user.clinicId}`);
        dashboardStats = {
          totalSlots: slots.length,
          assignedSlots: slots.filter(s => s.status === 'assigned').length,
          completedSlots: slots.filter(s => s.status === 'completed').length,
          availableSlots: slots.filter(s => s.status === 'available').length,
          clinicName: clinicData.data.name,
        };
      } else if (isPlatformAdmin) {
        const healthRes = await api.get('/admin/health');
        dashboardStats = healthRes.data;
      }

      setStats(dashboardStats);
      setRecentSlots(slots.slice(0, 5));
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Welcome back, {user?.name}!
      </h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {isDoctor && stats && (
          <>
            <StatCard
              icon={<CalendarIcon className="h-8 w-8 text-blue-500" />}
              title="Total Shifts"
              value={stats.stats?.assigned + stats.stats?.completed || 0}
              color="blue"
            />
            <StatCard
              icon={<CheckCircleIcon className="h-8 w-8 text-green-500" />}
              title="Completed"
              value={stats.stats?.completed || 0}
              color="green"
            />
            <StatCard
              icon={<ClockIcon className="h-8 w-8 text-yellow-500" />}
              title="Upcoming"
              value={stats.stats?.assigned || 0}
              color="yellow"
            />
            <StatCard
              icon={<CurrencyDollarIcon className="h-8 w-8 text-purple-500" />}
              title="Total Earnings"
              value={`$${stats.totalEarnings || 0}`}
              color="purple"
            />
          </>
        )}

        {isClinicAdmin && stats && (
          <>
            <StatCard
              icon={<BuildingOfficeIcon className="h-8 w-8 text-blue-500" />}
              title="Clinic"
              value={stats.clinicName}
              color="blue"
            />
            <StatCard
              icon={<CalendarIcon className="h-8 w-8 text-green-500" />}
              title="Total Slots"
              value={stats.totalSlots || 0}
              color="green"
            />
            <StatCard
              icon={<ClockIcon className="h-8 w-8 text-yellow-500" />}
              title="Assigned"
              value={stats.assignedSlots || 0}
              color="yellow"
            />
            <StatCard
              icon={<CheckCircleIcon className="h-8 w-8 text-purple-500" />}
              title="Completed"
              value={stats.completedSlots || 0}
              color="purple"
            />
          </>
        )}

        {isPlatformAdmin && stats && (
          <>
            <StatCard
              icon={<UserGroupIcon className="h-8 w-8 text-blue-500" />}
              title="Total Users"
              value={stats.stats?.totalUsers || 0}
              color="blue"
            />
            <StatCard
              icon={<BuildingOfficeIcon className="h-8 w-8 text-green-500" />}
              title="Clinics"
              value={stats.stats?.totalClinics || 0}
              color="green"
            />
            <StatCard
              icon={<CalendarIcon className="h-8 w-8 text-yellow-500" />}
              title="Total Slots"
              value={stats.stats?.totalSlots || 0}
              color="yellow"
            />
            <StatCard
              icon={<ChartBarIcon className="h-8 w-8 text-purple-500" />}
              title="System Status"
              value={stats.status === 'healthy' ? 'Healthy' : 'Issues'}
              color={stats.status === 'healthy' ? 'green' : 'red'}
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {isClinicAdmin && (
              <>
                <button
                  onClick={() => navigate('/slots')}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  Create New Locum Slot
                </button>
                <button
                  onClick={() => navigate(`/clinics/${user.clinicId}`)}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
                >
                  View Clinic Dashboard
                </button>
              </>
            )}
            {isDoctor && (
              <>
                <button
                  onClick={() => navigate('/slots')}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  Find Available Shifts
                </button>
                <button
                  onClick={() => navigate('/profile')}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
                >
                  View My Schedule
                </button>
              </>
            )}
            {isPlatformAdmin && (
              <>
                <button
                  onClick={() => navigate('/admin/users')}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  Manage Users
                </button>
                <button
                  onClick={() => navigate('/admin/audit-logs')}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
                >
                  View Audit Logs
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          {recentSlots.length > 0 ? (
            <ul className="space-y-3">
              {recentSlots.map((slot) => (
                <li key={slot._id} className="border-b pb-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">
                        {slot.date} - {slot.startTime} to {slot.endTime}
                      </p>
                      <p className="text-sm text-gray-600">
                        Status: {slot.status}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      slot.status === 'completed' ? 'bg-green-100 text-green-800' :
                      slot.status === 'assigned' ? 'bg-yellow-100 text-yellow-800' :
                      slot.status === 'available' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {slot.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, title, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    purple: 'bg-purple-50 border-purple-200',
    red: 'bg-red-50 border-red-200',
  };

  return (
    <div className={`border rounded-lg p-6 ${colorClasses[color] || 'bg-gray-50'}`}>
      <div className="flex items-center space-x-4">
        {icon}
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
