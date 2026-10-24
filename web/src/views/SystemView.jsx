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
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import ToggleSwitch from '../components/ToggleSwitch';
import {
  DEFAULT_EXPIRY_MILESTONES,
  parseExpiryMilestones,
  COLOR_PRESETS,
} from '../utils/expiryHelper';

export default function SystemView({ activeSubTab = 'CONFIG' }) {
  const { systemConfig, refreshSystemInfo, hasPermission } = useAuth();
  const [tab, setTab] = useState(activeSubTab);
  const [configForm, setConfigForm] = useState({ ...systemConfig });
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

  // Expiry Warning Milestones state
  const [milestones, setMilestones] = useState(() =>
    parseExpiryMilestones(systemConfig.expiry_warning_milestones)
  );

  useEffect(() => {
    setConfigForm((prev) => ({ ...prev, ...systemConfig }));
    if (systemConfig.expiry_warning_milestones) {
      setMilestones(parseExpiryMilestones(systemConfig.expiry_warning_milestones));
    }
  }, [systemConfig]);

  const handleAddMilestone = () => {
    const warningList = milestones.filter((m) => !m.isExpired && !m.isSafe);
    const maxDays = warningList.length
      ? Math.max(...warningList.map((m) => Number(m.days)))
      : 7;
    const newDays = maxDays + 7;
    const newM = {
      id: 'm_' + Date.now(),
      days: newDays,
      label: `Cảnh báo (<= ${newDays} ngày)`,
      textColor: '#d97706',
      bgColor: '#fef3c7',
      borderColor: '#fde68a',
    };
    const safeIdx = milestones.findIndex((m) => m.isSafe);
    if (safeIdx >= 0) {
      const updated = [...milestones];
      updated.splice(safeIdx, 0, newM);
      setMilestones(updated);
    } else {
      setMilestones([...milestones, newM]);
    }
  };

  const handleUpdateMilestone = (idx, field, value) => {
    setMilestones((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    );
  };

  const handleApplyPresetColor = (idx, preset) => {
    setMilestones((prev) =>
      prev.map((m, i) =>
        i === idx
          ? {
              ...m,
              textColor: preset.textColor,
              bgColor: preset.bgColor,
              borderColor: preset.borderColor,
            }
          : m
      )
    );
  };

  const handleRemoveMilestone = (idx) => {
    setMilestones((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleResetMilestones = () => {
    if (window.confirm('Khôi phục các mốc cảnh báo hạn sử dụng về mặc định?')) {
      setMilestones(DEFAULT_EXPIRY_MILESTONES);
    }
  };

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

  // Logo file upload -> Base64 Data URL
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setConfigForm((prev) => ({ ...prev, logo_url: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      const warningMilestones = milestones.filter(
        (m) => !m.isExpired && !m.isSafe && Number(m.days) > 0
      );
      const computedWarningDays = warningMilestones.length
        ? Math.max(...warningMilestones.map((m) => Number(m.days)))
        : 7;

      await api.put('/system/config', {
        ...configForm,
        expiry_warning_days: String(computedWarningDays),
        expiry_warning_milestones: JSON.stringify(milestones),
      });
      await refreshSystemInfo();
      showNotice('Đã lưu cấu hình hệ thống & mốc cảnh báo HSD thành công!');
    } catch (err) {
      showNotice(err.response?.data?.error || 'Lỗi lưu cấu hình', true);
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

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Xác nhận xóa người dùng này?')) return;
    try {
      await api.delete(`/system/users/${id}`);
      showNotice('Đã xóa tài khoản người dùng');
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
          <div className="border-b border-slate-200 pb-3">
            <h3 className="section-title text-base font-bold text-[#190072]">
              Cấu hình Hệ thống Đơn vị & Khoa Xét nghiệm
            </h3>
            <p className="text-xs text-slate-500">
              Thông tin này hiển thị trên thanh tiêu đề phần mềm, màn hình đăng nhập và tất cả các mẫu phiếu in.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-normal text-slate-600 mb-1">
                Tên đơn vị (Bệnh viện / Trung tâm Y tế) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={configForm.unit_name || ''}
                onChange={(e) =>
                  setConfigForm({ ...configForm, unit_name: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-normal bg-yellow-50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-normal text-slate-600 mb-1">
                Tên khoa / Bộ phận <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={configForm.department_name || ''}
                onChange={(e) =>
                  setConfigForm({ ...configForm, department_name: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-normal bg-yellow-50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-normal  text-slate-600 mb-1">
                Địa chỉ đơn vị
              </label>
              <input
                type="text"
                value={configForm.address || ''}
                onChange={(e) =>
                  setConfigForm({ ...configForm, address: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-normal  text-slate-600 mb-1">
                Số điện thoại liên hệ
              </label>
              <input
                type="text"
                value={configForm.phone || ''}
                onChange={(e) =>
                  setConfigForm({ ...configForm, phone: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-normal  text-slate-600 mb-1">
                Logo Đơn vị (Tải ảnh lên hoặc dán URL)
              </label>
              <div className="flex items-center gap-3">
                {configForm.logo_url ? (
                  <img
                    src={configForm.logo_url}
                    alt="Logo"
                    className="w-12 h-12 rounded-xl border border-slate-300 object-contain bg-slate-50 p-1"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                    <Image className="w-5 h-5" />
                  </div>
                )}
                <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-normal text-slate-700">
                  Chọn file ảnh Logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                {configForm.logo_url && (
                  <button
                    type="button"
                    onClick={() => setConfigForm({ ...configForm, logo_url: '' })}
                    className="text-xs text-rose-600 font-normal hover:underline"
                  >
                    Xóa logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Cấu hình các mốc cảnh báo Hạn sử dụng (HSD) & Màu sắc */}
          <div className="pt-5 border-t border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="section-title text-sm font-bold text-[#190072] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#C5299B]" />
                  Cấu hình các mốc cảnh báo Hạn sử dụng (HSD) & Màu sắc
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tùy chỉnh số ngày còn lại của từng mốc, tên nhãn và màu sắc nhận diện hiển thị trên toàn hệ thống.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetMilestones}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Mặc định
                </button>
                <button
                  type="button"
                  onClick={handleAddMilestone}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-xs font-normal shadow-sm transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm mốc cảnh báo
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] table-fixed text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                      <th className="py-2.5 px-3 text-left w-[22%]">Mốc thời gian / Điều kiện</th>
                      <th className="py-2.5 px-3 text-left w-[24%]">Tên nhãn cảnh báo</th>
                      <th className="py-2.5 px-3 text-left w-[24%]">Chọn màu nhanh</th>
                      <th className="py-2.5 px-3 text-center w-[13%]">Mã màu (Chữ / Nền)</th>
                      <th className="py-2.5 px-3 text-center w-[12%]">Xem trước</th>
                      <th className="py-2.5 px-2 text-center w-[5%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {milestones.map((m, idx) => (
                      <tr key={m.id || idx} className="hover:bg-slate-50/70">
                        {/* 1. Điều kiện mốc ngày */}
                        <td className="py-3 px-3">
                          {m.isExpired ? (
                            <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                              Quá hạn (&lt; 0 ngày)
                            </span>
                          ) : m.isSafe ? (
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                              Còn hạn an toàn (Mặc định)
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                              <span>Còn &le;</span>
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={m.days}
                                onChange={(e) =>
                                  handleUpdateMilestone(idx, 'days', parseInt(e.target.value, 10) || 1)
                                }
                                className="w-16 px-2 py-1 rounded-lg border border-slate-300 text-center text-xs font-bold bg-white outline-none"
                              />
                              <span>ngày</span>
                            </div>
                          )}
                        </td>

                        {/* 2. Tên nhãn */}
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={m.label || ''}
                            onChange={(e) => handleUpdateMilestone(idx, 'label', e.target.value)}
                            placeholder="Nhập tên nhãn..."
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white outline-none"
                          />
                        </td>

                        {/* 3. Chọn màu nhanh (Presets) */}
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {COLOR_PRESETS.map((p) => {
                              const isActive = m.textColor === p.textColor && m.bgColor === p.bgColor;
                              return (
                                <button
                                  key={p.name}
                                  type="button"
                                  onClick={() => handleApplyPresetColor(idx, p)}
                                  title={p.name}
                                  style={{ backgroundColor: p.textColor }}
                                  className={`w-5 h-5 rounded-full transition transform hover:scale-110 shrink-0 ${
                                    isActive ? 'ring-2 ring-offset-1 ring-slate-700 scale-110' : 'opacity-85'
                                  }`}
                                />
                              );
                            })}
                          </div>
                        </td>

                        {/* 4. Tùy biến mã màu */}
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-2">
                            <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer" title="Màu chữ">
                              <span>Chữ:</span>
                              <input
                                type="color"
                                value={m.textColor || '#000000'}
                                onChange={(e) => handleUpdateMilestone(idx, 'textColor', e.target.value)}
                                className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
                              />
                            </label>
                            <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer" title="Màu nền">
                              <span>Nền:</span>
                              <input
                                type="color"
                                value={m.bgColor || '#ffffff'}
                                onChange={(e) => {
                                  handleUpdateMilestone(idx, 'bgColor', e.target.value);
                                  handleUpdateMilestone(idx, 'borderColor', e.target.value);
                                }}
                                className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
                              />
                            </label>
                          </div>
                        </td>

                        {/* 5. Xem trước (Preview) */}
                        <td className="py-3 px-3 text-center">
                          <span
                            style={{
                              backgroundColor: m.bgColor,
                              color: m.textColor,
                              borderColor: m.borderColor || m.bgColor,
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border shadow-2xs"
                          >
                            {m.isExpired ? (
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            ) : m.isSafe ? (
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{m.isExpired ? 'Quá hạn 1 ngày' : `Còn ${m.days === 99999 ? 45 : m.days} ngày`}</span>
                          </span>
                        </td>

                        {/* 6. Nút xóa (chỉ cho các mốc cảnh báo thêm) */}
                        <td className="py-3 px-2 text-center">
                          {!m.isExpired && !m.isSafe && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMilestone(idx)}
                              title="Xóa mốc này"
                              className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-sm font-normal shadow"
            >
              <Save className="w-4 h-4" />
              Lưu cấu hình hệ thống
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: THÔNG TIN HỆ THỐNG (Tên phần mềm, phiên bản, người phát triển) */}
      {tab === 'INFO' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-gradient-to-br from-[#190072] to-[#C5299B] text-white rounded-2xl p-6 shadow-lg flex flex-col justify-between">
            <div>
              <span className="px-3 py-1 rounded-full bg-white/15 text-xs font-normal ">
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
                  <span className="font-normal">v{configForm.app_version || '2.0.0'}</span>
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
                  <span className="font-normal">{configForm.unit_name}</span>
                </div>
              </div>
            </div>
          </div>

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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-normal bg-yellow-50"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-normal bg-yellow-50"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-normal bg-yellow-50"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-normal bg-yellow-50"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-normal  text-slate-600 mb-1">
                Mô tả hệ thống
              </label>
              <textarea
                rows={3}
                value={configForm.app_description || ''}
                onChange={(e) =>
                  setConfigForm({ ...configForm, app_description: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-sm font-normal"
              >
                <Save className="w-4 h-4" />
                Lưu thông tin phần mềm
              </button>
            </div>
          </form>
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
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-normal">
                          Hoạt động
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-normal">
                          Đã khóa
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          onClick={() => openEditUser(u)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
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
            {/* Cấu hình tự động sao lưu (Giữ tối đa 3 phiên bản) */}
            <form
              onSubmit={handleSaveConfig}
              className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"
            >
              <h3 className="section-title text-sm font-bold text-[#190072] border-b border-slate-200 pb-3">
                Cài đặt Tự động Sao lưu Hệ thống
              </h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={configForm.auto_backup_enabled === 'true'}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      auto_backup_enabled: e.target.checked ? 'true' : 'false',
                    })
                  }
                  className="w-4 h-4 rounded text-[#C5299B]"
                />
                <span className="text-sm font-normal text-slate-800">
                  Bật tự động sao lưu cơ sở dữ liệu theo định kỳ
                </span>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-normal  text-slate-600 mb-1">
                    Chu kỳ sao lưu (Giờ / lần)
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-normal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-normal  text-slate-600 mb-1">
                    Số phiên bản tự động giữ tối đa
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={configForm.auto_backup_max_files || '3'}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        auto_backup_max_files: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-normal"
                  />
                  <span className="text-[11px] text-slate-500">
                    Mặc định: Giữ tối đa 3 bản tự động mới nhất
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-normal"
                >
                  <Save className="w-4 h-4" />
                  Lưu cài đặt tự động sao lưu
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
