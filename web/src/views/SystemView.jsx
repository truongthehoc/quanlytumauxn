import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Info,
  Users,
  Shield,
  DatabaseBackup,
  Save,
  Plus,
  Edit3,
  Trash2,
  Download,
  RotateCcw,
  Upload,
  CheckCircle2,
  Image,
  X,
  Clock,
  AlertTriangle,
  RefreshCw,
  ScrollText,
  Search,
  Filter,
  Calendar,
  Activity,
  Eye,
  EyeOff,
  KeyRound,
  FileText,
  Check,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import ToggleSwitch from '../components/ToggleSwitch';

export default function SystemView({ activeSubTab = 'CONFIG' }) {
  const { user, systemConfig, refreshSystemInfo, hasPermission } = useAuth();
  const [tab, setTab] = useState(activeSubTab);
  const [configForm, setConfigForm] = useState({ ...systemConfig });
  const [savingConfig, setSavingConfig] = useState(false);
  const [logoOptimizing, setLogoOptimizing] = useState(false);
  const [logoStats, setLogoStats] = useState(null);
  const [togglingUserId, setTogglingUserId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!message && !error) return;
    const timer = setTimeout(() => {
      setMessage('');
      setError('');
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, error]);

  useEffect(() => {
    if (activeSubTab) {
      setTab(activeSubTab);
      setMessage('');
      setError('');
    }
  }, [activeSubTab]);

  // Users & Roles state
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permModules, setPermModules] = useState([]);

  // User modal
  const [userModal, setUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    full_name: '',
    phone: '',
    email: '',
    role_id: '',
    is_active: 1,
  });

  // Reset user password modal state
  const [resetPwdUser, setResetPwdUser] = useState(null);
  const [resetPwdForm, setResetPwdForm] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [resetPwdLoading, setResetPwdLoading] = useState(false);

  // Role modal / editor
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleModal, setRoleModal] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({
    code: '',
    name: '',
    description: '',
  });

  // Backups state
  const [backups, setBackups] = useState([]);
  const [backupNote, setBackupNote] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [backupsPage, setBackupsPage] = useState(1);
  const [backupsPageSize, setBackupsPageSize] = useState(10);

  // Activity Logs state
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsStats, setLogsStats] = useState({
    total_logs: 0,
    today_logs: 0,
    auth_count: 0,
    tx_count: 0,
    audit_count: 0,
    category_count: 0,
    system_count: 0,
  });
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(15);
  const [logsCategory, setLogsCategory] = useState('ALL');
  const [logsStatus, setLogsStatus] = useState('ALL');
  const [logsSearch, setLogsSearch] = useState('');
  const [logsFromDate, setLogsFromDate] = useState('');
  const [logsToDate, setLogsToDate] = useState('');
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = {
        page: logsPage,
        pageSize: logsPageSize,
        category: logsCategory,
        status: logsStatus,
        search: logsSearch,
        from_date: logsFromDate,
        to_date: logsToDate,
      };
      const res = await api.get('/system/logs', { params });
      if (res.data) {
        setLogs(res.data.logs || []);
        setLogsTotal(res.data.total || 0);
        if (res.data.stats) setLogsStats(res.data.stats);
      }
    } catch (err) {
      console.error('Lỗi tải nhật ký hoạt động:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [logsPage, logsPageSize, logsCategory, logsStatus, logsSearch, logsFromDate, logsToDate]);

  useEffect(() => {
    if (tab === 'LOGS') {
      fetchLogs();
    }
  }, [tab, fetchLogs]);

  useEffect(() => {
    setConfigForm((prev) => ({ ...prev, ...systemConfig }));
  }, [systemConfig]);

  const loadSystemData = useCallback(async () => {
    try {
      const promises = [
        api.get('/system/roles'),
        api.get('/system/permissions'),
      ];
      if (hasPermission('system.users')) {
        promises.push(api.get('/system/users'));
      }
      if (hasPermission('system.backup')) {
        promises.push(api.get('/system/backups'));
      }

      const results = await Promise.allSettled(promises);
      if (results[0]?.status === 'fulfilled') {
        const rList = results[0].value.data || [];
        setRoles(rList);
        if (!selectedRole && rList.length) {
          setSelectedRole(rList[0]);
        }
      }
      if (results[1]?.status === 'fulfilled') {
        setPermModules(results[1].value.data || []);
      }
      if (results[2]?.status === 'fulfilled') {
        setUsers(results[2].value.data || []);
      }
      if (results[3]?.status === 'fulfilled') {
        setBackups(results[3].value.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [hasPermission, selectedRole]);

  useEffect(() => {
    loadSystemData();
  }, [loadSystemData]);

  const showNotice = (msg, isErr = false) => {
    if (isErr) {
      setError(msg);
      setMessage('');
    } else {
      setMessage(msg);
      setError('');
    }
  };

  // Tự động tối ưu hóa và nén ảnh logo (Resize max 256x256, nén WebP/PNG chất lượng cao ~15-30KB)
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotice('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WEBP, SVG)', true);
      return;
    }

    try {
      setLogoOptimizing(true);
      const originalSizeKb = (file.size / 1024).toFixed(1);

      // Tạo đối tượng Image và Canvas để nén & resize tự động
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDim = 256; // Kích thước tối đa chuẩn cho logo header & in phiếu
        let { width, height } = img;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Nén định dạng WebP hoặc PNG để giữ độ trong suốt và dung lượng siêu nhẹ
        let mime = 'image/webp';
        let quality = 0.88;
        if (file.type === 'image/png' || file.type === 'image/gif') {
          mime = 'image/png';
        }

        const optimizedDataUrl = canvas.toDataURL(mime, quality);
        const optimizedSizeKb = ((optimizedDataUrl.length * 0.75) / 1024).toFixed(1);

        setConfigForm((prev) => ({ ...prev, logo_url: optimizedDataUrl }));
        setLogoStats({
          originalSizeKb,
          optimizedSizeKb,
          width,
          height,
        });
        setLogoOptimizing(false);
        showNotice(
          `Đã tối ưu hóa logo thành công: ${originalSizeKb} KB ➔ ${optimizedSizeKb} KB (${width}×${height}px)`
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setLogoOptimizing(false);
        showNotice('Không thể xử lý file ảnh này. Vui lòng thử lại với file ảnh khác!', true);
      };

      img.src = objectUrl;
    } catch (err) {
      setLogoOptimizing(false);
      console.error('Lỗi tối ưu ảnh logo:', err);
      showNotice('Lỗi khi xử lý ảnh logo: ' + err.message, true);
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      await api.put('/system/config', configForm);
      await refreshSystemInfo();
      showNotice('Đã lưu cấu hình hệ thống & logo thành công!');
    } catch (err) {
      showNotice(err.response?.data?.error || 'Lỗi lưu cấu hình', true);
    } finally {
      setSavingConfig(false);
    }
  };

  // ==================== USER HANDLERS ====================
  const openAddUser = () => {
    setEditingUser(null);
    setUserForm({
      username: '',
      password: '',
      full_name: '',
      phone: '',
      email: '',
      role_id: roles[0]?.id || 1,
      is_active: 1,
    });
    setUserModal(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setUserForm({
      username: u.username,
      password: '',
      full_name: u.full_name,
      phone: u.phone || '',
      email: u.email || '',
      role_id: u.role_id,
      is_active: u.is_active ? 1 : 0,
    });
    setUserModal(true);
  };

  const openChangePassword = (u) => {
    setResetPwdUser(u);
    setResetPwdForm({ password: '', confirmPassword: '' });
    setShowResetPwd(false);
  };

  const handleSaveResetPassword = async (e) => {
    e.preventDefault();
    if (!resetPwdForm.password || resetPwdForm.password.length < 4) {
      showNotice('Mật khẩu mới phải có ít nhất 4 ký tự', true);
      return;
    }
    if (resetPwdForm.password !== resetPwdForm.confirmPassword) {
      showNotice('Mật khẩu xác nhận không khớp', true);
      return;
    }
    try {
      setResetPwdLoading(true);
      await api.put(`/system/users/${resetPwdUser.id}/password`, {
        password: resetPwdForm.password,
      });
      showNotice(`Đã đổi mật khẩu cho người dùng "${resetPwdUser.username}" thành công!`);
      setResetPwdUser(null);
    } catch (err) {
      showNotice(err.response?.data?.error || 'Lỗi đổi mật khẩu người dùng', true);
    } finally {
      setResetPwdLoading(false);
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.put(`/system/users/${editingUser.id}`, userForm);
        showNotice('Cập nhật người dùng thành công');
      } else {
        await api.post('/system/users', userForm);
        showNotice('Thêm người dùng mới thành công');
      }
      setUserModal(false);
      loadSystemData();
    } catch (err) {
      showNotice(err.response?.data?.error || 'Lỗi lưu người dùng', true);
    }
  };

  const handleToggleUserStatus = async (userItem) => {
    if (user && user.id === userItem.id && userItem.is_active) {
      showNotice('Không thể ngưng hoạt động tài khoản đang đăng nhập!', true);
      return;
    }
    if (userItem.username === 'admin' && userItem.is_active) {
      showNotice('Không thể ngưng hoạt động tài khoản Quản trị viên hệ thống (Admin)!', true);
      return;
    }
    const newStatus = userItem.is_active ? 0 : 1;
    const actionText = newStatus ? 'kích hoạt' : 'ngưng hoạt động';
    if (!window.confirm(`Bạn có chắc muốn ${actionText} tài khoản "${userItem.username}"?`)) {
      return;
    }
    setTogglingUserId(userItem.id);
    try {
      const res = await api.put(`/system/users/${userItem.id}/status`, { is_active: newStatus });
      showNotice(res.data?.message || `Đã ${actionText} tài khoản`);
      await loadSystemData();
    } catch (err) {
      showNotice(err.response?.data?.error || 'Lỗi cập nhật trạng thái người dùng', true);
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleDeleteUser = async (userItem) => {
    if (!userItem.can_delete) {
      showNotice(
        userItem.delete_prevent_reason ||
          'Không thể xóa tài khoản đã có lịch sử đăng nhập hoặc thao tác trên hệ thống!',
        true
      );
      return;
    }
    if (
      !window.confirm(
        `Xác nhận xóa tài khoản "${userItem.username}"? Hành động này không thể hoàn tác.`
      )
    )
      return;
    try {
      await api.delete(`/system/users/${userItem.id}`);
      showNotice('Đã xóa tài khoản người dùng thành công');
      loadSystemData();
    } catch (err) {
      showNotice(err.response?.data?.error || 'Không thể xóa người dùng', true);
    }
  };

  // ==================== ROLE & PERMISSION HANDLERS ====================
  const togglePermissionInRole = (permKey) => {
    if (!selectedRole) return;
    const currentPerms = selectedRole.permissions || [];
    const exists = currentPerms.includes(permKey);
    const updated = exists
      ? currentPerms.filter((k) => k !== permKey)
      : [...currentPerms, permKey];
    setSelectedRole({ ...selectedRole, permissions: updated });
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRole) return;
    try {
      await api.put(`/system/roles/${selectedRole.id}`, {
        name: selectedRole.name,
        description: selectedRole.description,
        permissions: selectedRole.permissions,
      });
      showNotice(`Đã lưu phân quyền cho nhóm "${selectedRole.name}"`);
      loadSystemData();
    } catch (err) {
      showNotice(err.response?.data?.error || 'Lỗi lưu nhóm quyền', true);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    try {
      await api.post('/system/roles', {
        ...newRoleForm,
        permissions: ['dashboard.view', 'inventory.view'],
      });
      setRoleModal(false);
      setNewRoleForm({ code: '', name: '', description: '' });
      showNotice('Tạo nhóm quyền mới thành công');
      loadSystemData();
    } catch (err) {
      showNotice(err.response?.data?.error || 'Lỗi tạo nhóm quyền', true);
    }
  };

  const handleDeleteRole = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa nhóm quyền này?')) return;
    try {
      await api.delete(`/system/roles/${id}`);
      setSelectedRole(null);
      showNotice('Đã xóa nhóm quyền');
      loadSystemData();
    } catch (err) {
      showNotice(err.response?.data?.error || 'Không thể xóa nhóm quyền', true);
    }
  };

  // ==================== BACKUP & RESTORE HANDLERS ====================
  const handleManualBackup = async (type = 'MANUAL') => {
    try {
      const res = await api.post('/system/backups/manual', {
        backup_type: type,
        note: backupNote,
      });
      setBackupNote('');
      showNotice(res.data.message);
      const bRes = await api.get('/system/backups');
      setBackups(bRes.data || []);
    } catch (err) {
      showNotice(err.response?.data?.error || 'Lỗi sao lưu', true);
    }
  };

  const handleDownloadBackup = async (b) => {
    try {
      const res = await api.get(`/system/backups/${b.id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', b.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      showNotice('Không thể tải file sao lưu', true);
    }
  };

  const handleRestoreFromList = async (b) => {
    if (
      !window.confirm(
        `Khôi phục hệ thống từ bản sao lưu "${b.file_name}"? Dữ liệu hiện tại sẽ được thay thế bằng bản sao lưu này.`
      )
    )
      return;
    setRestoring(true);
    try {
      const res = await api.post(`/system/backups/${b.id}/restore`);
      showNotice(res.data.message);
      await refreshSystemInfo();
    } catch (err) {
      showNotice(err.response?.data?.error || 'Lỗi khôi phục dữ liệu', true);
    } finally {
      setRestoring(false);
    }
  };

  const handleUploadRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn khôi phục dữ liệu từ file "${file.name}"?`
      )
    ) {
      e.target.value = '';
      return;
    }
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/system/backups/upload-restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showNotice(res.data.message);
      await refreshSystemInfo();
    } catch (err) {
      showNotice(err.response?.data?.error || 'Lỗi khôi phục từ file tải lên', true);
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  const handleDeleteBackup = async (id) => {
    if (!window.confirm('Xóa bản sao lưu này?')) return;
    try {
      await api.delete(`/system/backups/${id}`);
      const bRes = await api.get('/system/backups');
      setBackups(bRes.data || []);
    } catch (err) {
      showNotice('Lỗi xóa bản sao lưu', true);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-normal flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-700 text-sm font-normal">
          {error}
        </div>
      )}

      {/* TAB 1: CẤU HÌNH HỆ THỐNG (Tên đơn vị, Tên khoa, Logo) */}
      {tab === 'CONFIG' && (
        <form
          onSubmit={handleSaveConfig}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 w-full"
        >
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="section-title text-base font-bold text-[#190072]">
                Cấu hình Hệ thống Đơn vị & Khoa Xét nghiệm
              </h3>
              <p className="text-xs text-slate-500">
                Thông tin này hiển thị trên thanh tiêu đề phần mềm, màn hình đăng nhập và tất cả các mẫu phiếu in.
              </p>
            </div>

            {/* Nút Lưu cấu hình đưa lên góc trên bên phải */}
            <button
              type="submit"
              disabled={savingConfig || logoOptimizing}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition shrink-0 active:scale-95 disabled:opacity-60"
            >
              {savingConfig ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Lưu cấu hình hệ thống</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Cột trái: Thông tin đơn vị */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên đơn vị (Bệnh viện / Trung tâm Y tế) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={configForm.unit_name || ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, unit_name: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-normal bg-yellow-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên khoa / Bộ phận <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={configForm.department_name || ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, department_name: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-normal bg-yellow-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-normal text-slate-600 mb-1">
                    Địa chỉ đơn vị
                  </label>
                  <input
                    type="text"
                    value={configForm.address || ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, address: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-normal text-slate-600 mb-1">
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="text"
                    value={configForm.phone || ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, phone: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                  />
                </div>
              </div>
            </div>

            {/* Cột phải: Khung riêng cho Logo Đơn vị */}
            <div className="lg:col-span-5 bg-slate-50/70 rounded-2xl border border-slate-200 p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <Image className="w-4 h-4 text-[#C5299B]" />
                    <span className="text-xs font-bold text-slate-800">Khung Logo Đơn vị</span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Tối ưu siêu nhẹ ~20KB
                  </span>
                </div>

                {/* Vùng hiển thị Logo Preview */}
                <div className="flex flex-col items-center justify-center py-4">
                  {configForm.logo_url ? (
                    <div className="relative group">
                      <img
                        src={configForm.logo_url}
                        alt="Logo Đơn vị"
                        className="w-28 h-28 rounded-2xl border-2 border-[#C5299B]/30 object-contain bg-white p-2 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setConfigForm({ ...configForm, logo_url: '' });
                          setLogoStats(null);
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 shadow transition"
                        title="Xóa logo này"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-white">
                      <Image className="w-9 h-9 text-slate-300 mb-1" />
                      <span className="text-[11px] text-slate-400 font-medium">Chưa có logo</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tác vụ Upload & Thông tin */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-center gap-2">
                  <label
                    className={`cursor-pointer inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                      logoOptimizing
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-[#C5299B] hover:bg-[#a82083] text-white shadow-xs'
                    }`}
                  >
                    {logoOptimizing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang tối ưu ảnh...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>{configForm.logo_url ? 'Thay đổi ảnh Logo...' : 'Chọn file ảnh Logo...'}</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={logoOptimizing}
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>

                  {configForm.logo_url && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfigForm({ ...configForm, logo_url: '' });
                        setLogoStats(null);
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition border border-rose-200"
                    >
                      Xóa logo
                    </button>
                  )}
                </div>

                {logoStats ? (
                  <div className="text-[11px] text-emerald-700 font-medium flex items-center justify-center gap-1.5 text-center bg-emerald-50 py-1.5 px-2.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Đã tối ưu: <strong>{logoStats.optimizedSizeKb} KB</strong> ({logoStats.width}×{logoStats.height}px) — Giảm {Math.round((1 - logoStats.optimizedSizeKb / logoStats.originalSizeKb) * 100)}%
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                    Tự động đồng bộ làm Favicon trình duyệt, hiển thị trên sidebar, màn hình đăng nhập và các mẫu phiếu in.
                  </p>
                )}
              </div>
            </div>
          </div>

        </form>
      )}

      {/* TAB 2: THÔNG TIN HỆ THỐNG (Tên phần mềm, phiên bản, người phát triển) */}
      {tab === 'INFO' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cột trái: Cập nhật Thông tin Phần mềm */}
          <form
            onSubmit={handleSaveConfig}
            className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"
          >
            <h3 className="section-title text-base font-bold text-[#190072] border-b border-slate-200 pb-3">
              Cập nhật Thông tin Phần mềm
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-normal text-slate-600 mb-1">
                  Tên phần mềm <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={configForm.app_name || ''}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, app_name: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-normal bg-yellow-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-normal text-slate-600 mb-1">
                  Tên viết tắt phần mềm (hiển thị trên Sidebar) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={configForm.app_short_name || 'BloodBank'}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, app_short_name: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-normal bg-yellow-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-normal text-slate-600 mb-1">
                  Phiên bản (Version) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={configForm.app_version || ''}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, app_version: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-normal bg-yellow-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-normal text-slate-600 mb-1">
                  Người phát triển / Đơn vị phát triển <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={configForm.app_developer || ''}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, app_developer: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-normal bg-yellow-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-normal text-slate-600 mb-1">
                Mô tả hệ thống
              </label>
              <textarea
                rows={3}
                value={configForm.app_description || ''}
                onChange={(e) =>
                  setConfigForm({ ...configForm, app_description: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingConfig}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-sm font-normal disabled:opacity-50 transition"
              >
                <Save className="w-4 h-4" />
                {savingConfig ? 'Đang lưu...' : 'Lưu thông tin phần mềm'}
              </button>
            </div>
          </form>

          {/* Cột phải: Thông tin bản quyền & Hệ thống */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#190072] to-[#C5299B] text-white rounded-2xl p-6 shadow-lg flex flex-col justify-between">
            <div>
              <span className="px-3 py-1 rounded-full bg-white/15 text-xs font-normal">
                Thông tin bản quyền & Hệ thống
              </span>
              <h2 className="text-2xl font-normal mt-4">
                {configForm.app_name || 'Hệ thống Quản lý Tủ máu Xét nghiệm'}
              </h2>
              <p className="text-sm text-red-100/90 mt-2 leading-relaxed">
                {configForm.app_description}
              </p>

              <div className="mt-6 space-y-3 bg-black/25 p-4 rounded-xl border border-white/10 text-sm">
                <div className="flex justify-between">
                  <span className="text-red-200">Phiên bản:</span>
                  <span className="font-normal">v{configForm.app_version || '2.0.1'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-200">Người phát triển:</span>
                  <span className="font-normal">{configForm.app_developer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-200">Cơ sở dữ liệu:</span>
                  <span className="font-normal">MySQL (blood_bank)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-200">Đơn vị sử dụng:</span>
                  <span className="font-normal">{configForm.unit_name || 'BỆNH VIỆN THUẬN MỸ TDM'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: NGƯỜI DÙNG */}
      {tab === 'USERS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="section-title text-sm font-bold text-[#190072]">
                Quản lý Tài khoản Người dùng ({users.length})
              </h3>
              <p className="text-xs text-slate-500">
                Người dùng sử dụng hệ thống theo Nhóm quyền được gán
              </p>
            </div>
            <button
              onClick={openAddUser}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-xs font-normal"
            >
              <Plus className="w-4 h-4" />
              Thêm người dùng
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs  text-slate-600">
                  <th className="py-3 px-4 text-left">Tên đăng nhập</th>
                  <th className="py-3 px-4 text-left">Họ và tên</th>
                  <th className="py-3 px-4 text-left">Nhóm quyền được gán</th>
                  <th className="py-3 px-4 text-left">Điện thoại / Email</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users
                  .slice((usersPage - 1) * usersPageSize, usersPage * usersPageSize)
                  .map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-normal text-slate-900">
                      {u.username}
                    </td>
                    <td className="py-3 px-4 font-normal text-slate-800">
                      {u.full_name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8] text-xs font-normal">
                        {u.role_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <div>{u.phone}</div>
                      <div>{u.email}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          Đã khóa
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {/* Nút gạt kích hoạt / ngưng hoạt động tài khoản */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(u.is_active)}
                          disabled={
                            togglingUserId === u.id ||
                            (user && user.id === u.id) ||
                            u.username === 'admin'
                          }
                          title={
                            user && user.id === u.id
                              ? 'Không thể ngưng hoạt động tài khoản đang đăng nhập'
                              : u.username === 'admin'
                              ? 'Không thể ngưng hoạt động tài khoản Quản trị viên hệ thống (Admin)'
                              : u.is_active
                              ? 'Gạt để ngưng hoạt động tài khoản này'
                              : 'Gạt để kích hoạt lại tài khoản này'
                          }
                          onClick={() => handleToggleUserStatus(u)}
                          className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200 ease-in-out focus:outline-none select-none ${
                            (user && user.id === u.id) || u.username === 'admin'
                              ? 'opacity-40 cursor-not-allowed'
                              : 'cursor-pointer hover:opacity-90'
                          } ${u.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        >
                          <span
                            className={`inline-block w-4 h-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                              u.is_active ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>

                        <button
                          onClick={() => openEditUser(u)}
                          title="Sửa thông tin tài khoản"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => openChangePassword(u)}
                          title="Đổi mật khẩu người dùng"
                          className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={!u.can_delete}
                          title={
                            !u.can_delete
                              ? u.delete_prevent_reason ||
                                'Tài khoản đã có lịch sử đăng nhập hoặc thao tác trên hệ thống, không thể xóa'
                              : 'Xóa tài khoản'
                          }
                          className={`p-1.5 rounded-lg transition ${
                            !u.can_delete
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            totalItems={users.length}
            page={usersPage}
            pageSize={usersPageSize}
            onPageChange={setUsersPage}
            onPageSizeChange={setUsersPageSize}
          />
        </div>
      )}

      {/* TAB 4: NHÓM QUYỀN & PHÂN QUYỀN CHI TIẾT */}
      {tab === 'ROLES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Danh sách nhóm quyền */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="section-title text-sm font-bold text-[#190072]">
                Danh sách Nhóm quyền
              </h3>
              <button
                onClick={() => setRoleModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#C5299B] text-white text-xs font-normal"
              >
                <Plus className="w-3.5 h-3.5" />
                Tạo nhóm quyền
              </button>
            </div>

            <div className="space-y-2">
              {roles.map((r) => {
                const active = selectedRole?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRole(r)}
                    className={`cursor-pointer p-3.5 rounded-xl border transition flex items-start justify-between ${
                      active
                        ? 'border-[#C5299B] bg-[#C5299B]/10'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-normal text-sm text-slate-900">
                          {r.name}
                        </span>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {r.code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{r.description}</p>
                      <span className="inline-block mt-1.5 text-[11px] font-normal text-[#C5299B]">
                        {(r.permissions || []).length} quyền được cấp • {r.user_count || 0}{' '}
                        người dùng
                      </span>
                    </div>
                    {!r.is_system && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(r.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Phân quyền chi tiết cho nhóm quyền đang chọn */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            {selectedRole ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="section-title text-base font-bold text-[#190072]">
                      Phân quyền chi tiết: {selectedRole.name} ({selectedRole.code})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tick chọn các quyền hạn được phép sử dụng cho nhóm quyền này
                    </p>
                  </div>
                  <button
                    onClick={handleSaveRolePermissions}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-xs font-normal  shadow"
                  >
                    <Save className="w-4 h-4" />
                    Lưu phân quyền
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {permModules.map((mod) => (
                    <div
                      key={mod.module}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5"
                    >
                      <h4 className="text-xs font-normal  text-[#C5299B] border-b border-slate-200 pb-1.5">
                        {mod.label}
                      </h4>
                      <div className="space-y-2">
                        {mod.permissions.map((perm) => {
                          const checked = (selectedRole.permissions || []).includes(
                            perm.key
                          );
                          return (
                            <label
                              key={perm.key}
                              className="flex items-start gap-2.5 cursor-pointer text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePermissionInRole(perm.key)}
                                className="mt-0.5 rounded text-[#C5299B] focus:ring-red-500"
                              />
                              <div>
                                <div className="font-normal text-slate-800">
                                  {perm.label}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400">
                                  {perm.key}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                Chọn một Nhóm quyền ở bên trái để cấu hình phân quyền chi tiết.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: SAO LƯU & KHÔI PHỤC */}
      {tab === 'BACKUP' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Cấu hình tự động sao lưu */}
            <form
              onSubmit={handleSaveConfig}
              className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="section-title text-sm font-bold text-[#190072]">
                    Cài đặt Tự động Sao lưu Hệ thống
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tự động kết xuất CSDL định kỳ và luân phiên dọn dẹp các bản sao lưu cũ
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                  configForm.auto_backup_enabled === 'true'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    configForm.auto_backup_enabled === 'true' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`} />
                  {configForm.auto_backup_enabled === 'true' ? 'Đang kích hoạt' : 'Đang tạm dừng'}
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={configForm.auto_backup_enabled === 'true'}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        auto_backup_enabled: e.target.checked ? 'true' : 'false',
                      })
                    }
                    className="w-4 h-4 rounded text-[#C5299B] focus:ring-[#C5299B]"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">
                      Bật tự động sao lưu cơ sở dữ liệu định kỳ
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Kích hoạt tiến trình sao lưu chạy ngầm tự động theo thời gian đã cài đặt
                    </p>
                  </div>
                </label>
              </div>

              {/* Khung cấu hình thời gian & thông số */}
              <div className={`space-y-3.5 transition-all ${configForm.auto_backup_enabled === 'true' ? 'opacity-100' : 'opacity-40 pointer-events-none select-none'}`}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Cột 1: Thời gian tự động sao lưu */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#C5299B]" />
                      Thời gian sao lưu
                    </label>
                    <input
                      type="time"
                      value={configForm.auto_backup_time || '23:00'}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          auto_backup_time: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 bg-amber-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                      required={configForm.auto_backup_enabled === 'true'}
                    />
                    <span className="text-[11px] text-slate-500 block mt-1">
                      Mỗi ngày (VD: 23:00)
                    </span>
                  </div>

                  {/* Cột 2: Chu kỳ sao lưu dự phòng */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Chu kỳ (Giờ / lần)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={configForm.auto_backup_interval_hours || '24'}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          auto_backup_interval_hours: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                    />
                    <span className="text-[11px] text-slate-500 block mt-1">
                      Mặc định: 24 giờ
                    </span>
                  </div>

                  {/* Cột 3: Số phiên bản tự động giữ tối đa */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Số bản giữ tối đa
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={configForm.auto_backup_max_files || '3'}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          auto_backup_max_files: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                    />
                    <span className="text-[11px] text-slate-500 block mt-1">
                      Mặc định: 3 bản
                    </span>
                  </div>
                </div>

                {configForm.auto_backup_enabled === 'true' && (
                  <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-100 flex items-start gap-2.5 text-xs text-purple-900">
                    <Clock className="w-4 h-4 text-[#C5299B] shrink-0 mt-0.5" />
                    <div>
                      <span>
                        Hệ thống sẽ tự động thực hiện sao lưu CSDL lúc <strong>{configForm.auto_backup_time || '23:00'}</strong> mỗi ngày. Tự động luân phiên dọn dẹp và giữ lại tối đa <strong>{configForm.auto_backup_max_files || 3} bản</strong> mới nhất.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-normal disabled:opacity-50 transition"
                >
                  <Save className="w-4 h-4" />
                  {savingConfig ? 'Đang lưu...' : 'Lưu cài đặt tự động sao lưu'}
                </button>
              </div>
            </form>

            {/* Sao lưu thủ công & Khôi phục từ file */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div>
                <h3 className="section-title text-sm font-bold text-[#190072] border-b border-slate-200 pb-3">
                  Sao lưu Thủ công & Khôi phục từ File
                </h3>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={backupNote}
                    onChange={(e) => setBackupNote(e.target.value)}
                    placeholder="Nhập ghi chú bản sao lưu..."
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleManualBackup('MANUAL')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-normal  shrink-0 shadow-sm"
                  >
                    Sao lưu thủ công ngay
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <label className="block text-xs font-normal  text-slate-600 mb-2">
                  Khôi phục hệ thống từ file sao lưu trên máy tính (.json)
                </label>
                <label className="cursor-pointer flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50 text-indigo-700 text-xs font-normal  transition">
                  <Upload className="w-4 h-4" />
                  {restoring
                    ? 'Đang khôi phục dữ liệu...'
                    : 'Chọn File Sao Lưu (.json) để Khôi phục'}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleUploadRestore}
                    disabled={restoring}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Danh sách các bản sao lưu */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="section-title text-sm font-bold text-[#190072]">
                Danh sách các Phiên bản Sao lưu ({backups.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs  text-slate-600">
                    <th className="py-3 px-4 text-left">Tên file sao lưu</th>
                    <th className="py-3 px-4 text-center">Loại sao lưu</th>
                    <th className="py-3 px-4 text-center">Dung lượng</th>
                    <th className="py-3 px-4 text-left">Thời gian tạo</th>
                    <th className="py-3 px-4 text-left">Ghi chú</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {backups
                    .slice((backupsPage - 1) * backupsPageSize, backupsPage * backupsPageSize)
                    .map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-xs font-normal text-slate-800">
                        {b.file_name}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-normal ${
                            b.backup_type === 'AUTO'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {b.backup_type === 'AUTO' ? 'Tự động (Auto)' : 'Thủ công'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-slate-600">
                        {(b.file_size / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {new Date(b.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{b.note}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex gap-1.5">
                          <button
                            onClick={() => handleDownloadBackup(b)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-normal"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Tải về
                          </button>
                          <button
                            onClick={() => handleRestoreFromList(b)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-normal"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Khôi phục
                          </button>
                          <button
                            onClick={() => handleDeleteBackup(b.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              totalItems={backups.length}
              page={backupsPage}
              pageSize={backupsPageSize}
              onPageChange={setBackupsPage}
              onPageSizeChange={setBackupsPageSize}
            />
          </div>
        </div>
      )}

      {/* TAB 6: NHẬT KÝ HOẠT ĐỘNG (LỊCH SỬ THAO TÁC HỆ THỐNG) */}
      {tab === 'LOGS' && (
        <div className="space-y-4">
          {/* Top Quick Category KPI Filter Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Tất cả */}
            <div
              onClick={() => {
                setLogsCategory('ALL');
                setLogsPage(1);
              }}
              className={`p-3.5 rounded-2xl border cursor-pointer transition shadow-2xs ${
                logsCategory === 'ALL'
                  ? 'border-[#C5299B] bg-[#fdf2fa] ring-2 ring-[#C5299B]/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Tất cả nhật ký</div>
              <div className="text-2xl font-extrabold text-[#190072] mt-1">{logsStats.total_logs}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Hôm nay: {logsStats.today_logs}</div>
            </div>

            {/* Đăng nhập / Xác thực */}
            <div
              onClick={() => {
                setLogsCategory('AUTH');
                setLogsPage(1);
              }}
              className={`p-3.5 rounded-2xl border cursor-pointer transition shadow-2xs ${
                logsCategory === 'AUTH'
                  ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="text-[11px] font-semibold text-emerald-700 uppercase">Xác thực / Đăng nhập</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">{logsStats.auth_count}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Login, Logout</div>
            </div>

            {/* Giao dịch máu */}
            <div
              onClick={() => {
                setLogsCategory('TRANSACTION');
                setLogsPage(1);
              }}
              className={`p-3.5 rounded-2xl border cursor-pointer transition shadow-2xs ${
                logsCategory === 'TRANSACTION'
                  ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="text-[11px] font-semibold text-blue-700 uppercase">Giao dịch máu</div>
              <div className="text-2xl font-extrabold text-blue-700 mt-1">{logsStats.tx_count}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Xuất, Nhập, Mượn, Hủy</div>
            </div>

            {/* Kiểm kê */}
            <div
              onClick={() => {
                setLogsCategory('AUDIT');
                setLogsPage(1);
              }}
              className={`p-3.5 rounded-2xl border cursor-pointer transition shadow-2xs ${
                logsCategory === 'AUDIT'
                  ? 'border-purple-500 bg-purple-50/70 ring-2 ring-purple-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="text-[11px] font-semibold text-purple-700 uppercase">Kiểm kê quỹ máu</div>
              <div className="text-2xl font-extrabold text-purple-700 mt-1">{logsStats.audit_count}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Tạo kỳ, Chốt, Cân bằng</div>
            </div>

            {/* Danh mục */}
            <div
              onClick={() => {
                setLogsCategory('CATEGORY');
                setLogsPage(1);
              }}
              className={`p-3.5 rounded-2xl border cursor-pointer transition shadow-2xs ${
                logsCategory === 'CATEGORY'
                  ? 'border-pink-500 bg-pink-50/70 ring-2 ring-pink-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="text-[11px] font-semibold text-pink-700 uppercase">Quản lý Danh mục</div>
              <div className="text-2xl font-extrabold text-pink-700 mt-1">{logsStats.category_count}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Đối tác, Khoa, Cảnh báo</div>
            </div>

            {/* Hệ thống */}
            <div
              onClick={() => {
                setLogsCategory('SYSTEM');
                setLogsPage(1);
              }}
              className={`p-3.5 rounded-2xl border cursor-pointer transition shadow-2xs ${
                logsCategory === 'SYSTEM'
                  ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="text-[11px] font-semibold text-amber-700 uppercase">Cấu hình & Quản trị</div>
              <div className="text-2xl font-extrabold text-amber-700 mt-1">{logsStats.system_count}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">User, Role, Backup, Config</div>
            </div>
          </div>

          {/* Main Card with Filter Bar & Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Filter Toolbar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#fdf2fa] text-[#C5299B] flex items-center justify-center">
                    <ScrollText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="section-title text-sm font-bold text-[#190072]">
                      Nhật ký Hoạt động & Lịch sử Thao tác ({logsTotal})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Ghi nhận đầy đủ nhật ký đăng nhập, giao dịch, kiểm kê và quản trị hệ thống
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchLogs}
                    disabled={logsLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 text-xs font-normal transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                    <span>Làm mới</span>
                  </button>

                  {(logsCategory !== 'ALL' || logsStatus !== 'ALL' || logsSearch || logsFromDate || logsToDate) && (
                    <button
                      onClick={() => {
                        setLogsCategory('ALL');
                        setLogsStatus('ALL');
                        setLogsSearch('');
                        setLogsFromDate('');
                        setLogsToDate('');
                        setLogsPage(1);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-normal transition"
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>
              </div>

              {/* Filter controls row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-1">
                {/* Search */}
                <div className="lg:col-span-4 relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={logsSearch}
                    onChange={(e) => {
                      setLogsSearch(e.target.value);
                      setLogsPage(1);
                    }}
                    placeholder="Tìm theo thao tác, nội dung, user, IP..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#C5299B]"
                  />
                </div>

                {/* Category dropdown */}
                <div className="lg:col-span-3">
                  <select
                    value={logsCategory}
                    onChange={(e) => {
                      setLogsCategory(e.target.value);
                      setLogsPage(1);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-700 focus:outline-none"
                  >
                    <option value="ALL">Tất cả phân loại</option>
                    <option value="AUTH">Xác thực / Đăng nhập (AUTH)</option>
                    <option value="TRANSACTION">Giao dịch máu (TRANSACTION)</option>
                    <option value="AUDIT">Kiểm kê quỹ máu (AUDIT)</option>
                    <option value="CATEGORY">Quản lý danh mục (CATEGORY)</option>
                    <option value="SYSTEM">Cấu hình & Quản trị (SYSTEM)</option>
                  </select>
                </div>

                {/* Status dropdown */}
                <div className="lg:col-span-2">
                  <select
                    value={logsStatus}
                    onChange={(e) => {
                      setLogsStatus(e.target.value);
                      setLogsPage(1);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-700 focus:outline-none"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="SUCCESS">Thành công (SUCCESS)</option>
                    <option value="FAILED">Thất bại (FAILED)</option>
                    <option value="WARNING">Cảnh báo (WARNING)</option>
                  </select>
                </div>

                {/* Date range */}
                <div className="lg:col-span-3 flex items-center gap-1.5">
                  <input
                    type="date"
                    value={logsFromDate}
                    onChange={(e) => {
                      setLogsFromDate(e.target.value);
                      setLogsPage(1);
                    }}
                    title="Từ ngày"
                    className="w-full px-2 py-1.5 rounded-xl border border-slate-300 text-[11px] bg-white text-slate-700"
                  />
                  <span className="text-slate-400 text-xs">-</span>
                  <input
                    type="date"
                    value={logsToDate}
                    onChange={(e) => {
                      setLogsToDate(e.target.value);
                      setLogsPage(1);
                    }}
                    title="Đến ngày"
                    className="w-full px-2 py-1.5 rounded-xl border border-slate-300 text-[11px] bg-white text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                    <th className="py-3 px-4 text-left w-36">Thời gian</th>
                    <th className="py-3 px-4 text-left w-48">Người thực hiện</th>
                    <th className="py-3 px-4 text-center w-32">Phân loại</th>
                    <th className="py-3 px-4 text-left">Thao tác & Mô tả chi tiết</th>
                    <th className="py-3 px-4 text-center w-32">Địa chỉ IP</th>
                    <th className="py-3 px-4 text-center w-28">Trạng thái</th>
                    <th className="py-3 px-3 text-center w-16">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#C5299B]" />
                        Đang tải nhật ký hoạt động...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                        Không có bản ghi nhật ký nào phù hợp với bộ lọc tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const catConfig = {
                        AUTH: { label: 'Xác thực', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                        TRANSACTION: { label: 'Giao dịch', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                        AUDIT: { label: 'Kiểm kê', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                        CATEGORY: { label: 'Danh mục', color: 'bg-pink-50 text-pink-700 border-pink-200' },
                        SYSTEM: { label: 'Hệ thống', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                      }[log.action_category] || { label: log.action_category, color: 'bg-slate-100 text-slate-700 border-slate-200' };

                      const statusConfig = {
                        SUCCESS: { label: 'Thành công', color: 'bg-emerald-100 text-emerald-800' },
                        FAILED: { label: 'Thất bại', color: 'bg-rose-100 text-rose-800' },
                        WARNING: { label: 'Cảnh báo', color: 'bg-amber-100 text-amber-800' },
                      }[log.status] || { label: log.status, color: 'bg-slate-100 text-slate-700' };

                      const dt = new Date(log.created_at);
                      const timeStr = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const dateStr = dt.toLocaleDateString('vi-VN');

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition text-xs">
                          {/* 1. Thời gian */}
                          <td className="py-3 px-4">
                            <div className="font-mono font-semibold text-slate-800">{timeStr}</div>
                            <div className="text-[11px] text-slate-400">{dateStr}</div>
                          </td>

                          {/* 2. Người thực hiện */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8] flex items-center justify-center font-bold text-xs shrink-0">
                                {(log.username || 'S')[0].toUpperCase()}
                              </div>
                              <div className="truncate">
                                <div className="font-semibold text-slate-900 truncate">
                                  {log.full_name || log.username || 'Hệ thống'}
                                </div>
                                <div className="font-mono text-[11px] text-slate-400">
                                  @{log.username || 'system'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 3. Phân loại */}
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-lg border text-[11px] font-medium ${catConfig.color}`}>
                              {catConfig.label}
                            </span>
                          </td>

                          {/* 4. Thao tác & Mô tả */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 leading-snug">
                              {log.action_name}
                            </div>
                            {log.description && (
                              <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                {log.description}
                              </div>
                            )}
                          </td>

                          {/* 5. Địa chỉ IP */}
                          <td className="py-3 px-4 text-center">
                            <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {log.ip_address || '---'}
                            </span>
                          </td>

                          {/* 6. Trạng thái */}
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                          </td>

                          {/* 7. Xem chi tiết metadata */}
                          <td className="py-3 px-3 text-center">
                            {log.metadata ? (
                              <button
                                type="button"
                                onClick={() => setSelectedLogDetail(log)}
                                title="Xem chi tiết dữ liệu (JSON)"
                                className="p-1 rounded-lg text-slate-400 hover:text-[#C5299B] hover:bg-[#fdf2fa] transition"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-slate-300 text-xs">---</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination
              totalItems={logsTotal}
              page={logsPage}
              pageSize={logsPageSize}
              onPageChange={setLogsPage}
              onPageSizeChange={setLogsPageSize}
            />
          </div>
        </div>
      )}

      {/* Modal Inspector Chi tiết Metadata Log */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#C5299B]" />
                <h3 className="text-base font-bold text-[#190072]">
                  Chi tiết Dữ liệu Nhật ký #{selectedLogDetail.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-slate-400">Thao tác:</span>{' '}
                  <strong className="text-slate-800">{selectedLogDetail.action_name}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Phân loại:</span>{' '}
                  <strong className="text-slate-800">{selectedLogDetail.action_category}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Người thực hiện:</span>{' '}
                  <strong className="text-slate-800">{selectedLogDetail.full_name} (@{selectedLogDetail.username})</strong>
                </div>
                <div>
                  <span className="text-slate-400">Thời gian:</span>{' '}
                  <strong className="text-slate-800 font-mono">{new Date(selectedLogDetail.created_at).toLocaleString('vi-VN')}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Dữ liệu kỹ thuật kèm theo (Metadata JSON):
                </label>
                <pre className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60">
                  {typeof selectedLogDetail.metadata === 'string'
                    ? selectedLogDetail.metadata
                    : JSON.stringify(selectedLogDetail.metadata, null, 2)}
                </pre>
              </div>

              {selectedLogDetail.user_agent && (
                <div className="text-[11px] text-slate-400 break-all">
                  User Agent: {selectedLogDetail.user_agent}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                className="px-4 py-2 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-xs font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add/Edit User */}
      {userModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3.5 mb-4">
              <h3 className="modal-title text-lg font-bold text-[#190072]">
                {editingUser ? 'Cập nhật Người dùng' : 'Thêm mới Người dùng'}
              </h3>
              <button
                type="button"
                onClick={() => setUserModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-normal text-slate-600 mb-1">
                  Tên đăng nhập <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  disabled={!!editingUser}
                  value={userForm.username}
                  onChange={(e) =>
                    setUserForm({ ...userForm, username: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-yellow-50 disabled:bg-slate-100"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-normal text-slate-600 mb-1">
                  {editingUser ? (
                    'Mật khẩu mới (Để trống nếu giữ nguyên)'
                  ) : (
                    <>
                      Mật khẩu <span className="text-rose-600">*</span>
                    </>
                  )}
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) =>
                    setUserForm({ ...userForm, password: e.target.value })
                  }
                  className={`w-full px-3 py-2 rounded-xl border border-slate-300 text-sm ${
                    !editingUser ? 'bg-yellow-50' : ''
                  }`}
                  required={!editingUser}
                />
              </div>
              <div>
                <label className="block text-xs font-normal text-slate-600 mb-1">
                  Họ và tên nhân viên <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={userForm.full_name}
                  onChange={(e) =>
                    setUserForm({ ...userForm, full_name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-normal bg-yellow-50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-normal text-slate-600 mb-1">
                  Nhóm quyền <span className="text-rose-600">*</span>
                </label>
                <select
                  value={userForm.role_id}
                  onChange={(e) =>
                    setUserForm({ ...userForm, role_id: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-normal bg-yellow-50"
                  required
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-normal text-slate-600 mb-1">
                    Điện thoại
                  </label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) =>
                      setUserForm({ ...userForm, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <ToggleSwitch
                    label="Trạng thái"
                    checked={userForm.is_active}
                    onChange={(val) =>
                      setUserForm({ ...userForm, is_active: val })
                    }
                    onText="Đang hoạt động"
                    offText="Khóa tài khoản"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUserModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-normal"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#C5299B] text-white text-sm font-normal"
                >
                  Lưu người dùng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Đổi mật khẩu người dùng */}
      {resetPwdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-gradient-to-r from-[#190072]/5 to-[#C5299B]/5 border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="modal-title text-base font-bold text-[#190072]">
                    Đổi Mật khẩu Người dùng
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Tài khoản: <strong>{resetPwdUser.username}</strong> ({resetPwdUser.full_name})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetPwdUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResetPassword} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu mới <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showResetPwd ? 'text' : 'password'}
                    value={resetPwdForm.password}
                    onChange={(e) =>
                      setResetPwdForm({ ...resetPwdForm, password: e.target.value })
                    }
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                    placeholder="Nhập mật khẩu mới (tối thiểu 4 ký tự)..."
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPwd(!showResetPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showResetPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Xác nhận mật khẩu mới <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showResetPwd ? 'text' : 'password'}
                    value={resetPwdForm.confirmPassword}
                    onChange={(e) =>
                      setResetPwdForm({ ...resetPwdForm, confirmPassword: e.target.value })
                    }
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                    placeholder="Nhập lại mật khẩu mới..."
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Sau khi đổi, người dùng <strong>{resetPwdUser.username}</strong> có thể đăng nhập ngay với mật khẩu mới này.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetPwdUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={resetPwdLoading}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition"
                >
                  <KeyRound className="w-4 h-4" />
                  {resetPwdLoading ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Create Role */}
      {roleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3.5 mb-4">
              <h3 className="modal-title text-lg font-bold text-[#190072]">
                Thêm mới Nhóm quyền
              </h3>
              <button
                type="button"
                onClick={() => setRoleModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-normal text-slate-600 mb-1">
                  Mã nhóm quyền <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={newRoleForm.code}
                  onChange={(e) =>
                    setNewRoleForm({ ...newRoleForm, code: e.target.value })
                  }
                  placeholder="Nhập mã nhóm quyền..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-yellow-50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-normal text-slate-600 mb-1">
                  Tên nhóm quyền <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={newRoleForm.name}
                  onChange={(e) =>
                    setNewRoleForm({ ...newRoleForm, name: e.target.value })
                  }
                  placeholder="Nhập tên nhóm quyền..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-normal bg-yellow-50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-normal  text-slate-600 mb-1">
                  Mô tả
                </label>
                <input
                  type="text"
                  value={newRoleForm.description}
                  onChange={(e) =>
                    setNewRoleForm({ ...newRoleForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRoleModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-normal"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#C5299B] text-white text-sm font-normal"
                >
                  Tạo nhóm quyền
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
