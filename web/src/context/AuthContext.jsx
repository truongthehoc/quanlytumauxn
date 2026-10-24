import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [systemConfig, setSystemConfig] = useState({
    unit_name: 'BỆNH VIỆN ĐA KHOA TRUNG TÂM',
    department_name: 'KHOA XÉT NGHIỆM - TỦ MÁU LƯU TRỮ',
    logo_url: '',
    app_name: 'Hệ thống Quản lý Tủ máu Xét nghiệm',
    app_version: '2.0.0',
    app_developer: 'Phòng CNTT',
    expiry_warning_days: '7',
  });
  const [categories, setCategories] = useState({
    partners: [],
    bloodProducts: [],
    volumes: [],
    units: [],
    departments: [],
    users: [],
  });
  const [pendingSummary, setPendingSummary] = useState({
    totalPending: 0,
    importPending: 0,
    exportPending: 0,
  });

  const fetchSystemInfo = useCallback(async () => {
    try {
      const res = await api.get('/auth/system-info');
      if (res.data) {
        setSystemConfig((prev) => ({ ...prev, ...res.data }));
      }
    } catch (e) {
      console.error('Error loading system info:', e);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/categories/all');
      if (res.data) {
        setCategories({
          partners: res.data.partners || [],
          bloodProducts: res.data.bloodProducts || [],
          volumes: res.data.volumes || [],
          units: res.data.units || [],
          departments: res.data.departments || [],
          users: res.data.users || [],
        });
      }
    } catch (e) {
      console.error('Error loading categories:', e);
    }
  }, []);

  const fetchPendingSummary = useCallback(async () => {
    const token = localStorage.getItem('blood_bank_token');
    if (!token) return;
    try {
      const res = await api.get('/transactions/pending-summary');
      if (res.data) {
        setPendingSummary({
          totalPending: Number(res.data.totalPending || 0),
          importPending: Number(res.data.importPending || 0),
          exportPending: Number(res.data.exportPending || 0),
        });
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchSystemInfo();
    const token = localStorage.getItem('blood_bank_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
        fetchCategories();
        fetchPendingSummary();
      })
      .catch(() => {
        localStorage.removeItem('blood_bank_token');
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fetchSystemInfo, fetchCategories, fetchPendingSummary]);

  // Polling pending approval summary every 25 seconds for managers
  useEffect(() => {
    if (!user) return;
    fetchPendingSummary();
    const interval = setInterval(fetchPendingSummary, 25000);
    return () => clearInterval(interval);
  }, [user, fetchPendingSummary]);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('blood_bank_token', res.data.token);
    setUser(res.data.user);
    await fetchCategories();
    fetchPendingSummary();
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('blood_bank_token');
    setUser(null);
    setPendingSummary({ totalPending: 0, importPending: 0, exportPending: 0 });
  };

  const hasPermission = useCallback(
    (permKey) => {
      if (!user) return false;
      if (user.role_code === 'ADMIN') return true;
      return Array.isArray(user.permissions) && user.permissions.includes(permKey);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        systemConfig,
        categories,
        pendingSummary,
        login,
        logout,
        hasPermission,
        refreshPendingSummary: fetchPendingSummary,
        refreshSystemInfo: fetchSystemInfo,
        refreshCategories: fetchCategories,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
