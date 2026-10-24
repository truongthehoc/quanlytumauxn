import React, { useState, useEffect } from 'react';
import {
  Building2,
  Stethoscope,
  Droplet,
  Scale,
  Plus,
  Edit3,
  Trash2,
  X,
  AlertTriangle,
  Clock,
  RotateCcw,
  Save,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';
import ToggleSwitch from '../components/ToggleSwitch';
import {
  COLOR_PRESETS,
  DEFAULT_EXPIRY_MILESTONES,
  parseExpiryMilestones,
} from '../utils/expiryHelper';

const SUB_HEADERS = {
  PARTNERS: {
    title: 'Danh mục Đơn vị đối tác',
    subtitle: 'Quản lý các đơn vị cung cấp, mượn và cho mượn chế phẩm máu',
    categoryLabel: 'Đơn vị đối tác',
    codeLabel: 'Mã đơn vị',
    codePlaceholder: 'Nhập mã đơn vị đối tác',
    nameLabel: 'Tên đơn vị',
    namePlaceholder: 'Nhập tên đơn vị đối tác',
    icon: Building2,
  },
  DEPARTMENTS: {
    title: 'Danh mục Khoa / Phòng',
    subtitle: 'Quản lý danh mục các Khoa / Phòng lâm sàng nhận chế phẩm máu',
    categoryLabel: 'Khoa / Phòng',
    codeLabel: 'Mã khoa/phòng',
    codePlaceholder: 'Nhập mã khoa/phòng',
    nameLabel: 'Tên khoa/phòng',
    namePlaceholder: 'Nhập tên khoa/phòng',
    icon: Stethoscope,
  },
  PRODUCTS: {
    title: 'Danh mục Loại chế phẩm máu',
    subtitle: 'Quản lý mã loại, tên chế phẩm máu, thể tích, đơn vị tính và trạng thái sử dụng',
    categoryLabel: 'Loại chế phẩm máu',
    codeLabel: 'Mã loại chế phẩm',
    codePlaceholder: 'Nhập mã loại chế phẩm',
    nameLabel: 'Tên loại chế phẩm',
    namePlaceholder: 'Nhập tên loại chế phẩm máu',
    icon: Droplet,
  },
  UNITS: {
    title: 'Danh mục Đơn vị tính',
    subtitle: 'Quản lý đơn vị tính chế phẩm máu',
    categoryLabel: 'Đơn vị tính',
    codeLabel: 'Mã đơn vị tính',
    codePlaceholder: 'Nhập mã đơn vị tính',
    nameLabel: 'Tên đơn vị tính',
    namePlaceholder: 'Nhập tên đơn vị tính',
    icon: Scale,
  },
  ALERTS: {
    title: 'Cấu hình cảnh báo Hạn sử dụng (HSD) & Màu sắc',
    subtitle: 'Tùy chỉnh số ngày còn lại của từng mốc, tên nhãn và màu sắc nhận diện cảnh báo HSD trên toàn hệ thống',
    categoryLabel: 'Mốc cảnh báo HSD',
    icon: AlertTriangle,
  },
};

export default function CategoriesView({ activeSubTab = 'PARTNERS' }) {
  const { categories, refreshCategories, hasPermission, systemConfig, refreshSystemInfo } = useAuth();
  const [subTab, setSubTab] = useState(activeSubTab);
  const canManage = hasPermission('categories.manage') || hasPermission('system.config');

  useEffect(() => {
    if (activeSubTab) {
      setSubTab(activeSubTab);
    }
  }, [activeSubTab]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Expiry Warning Milestones State
  const [milestones, setMilestones] = useState(() =>
    parseExpiryMilestones(systemConfig?.expiry_warning_milestones)
  );
  const [savingMilestones, setSavingMilestones] = useState(false);

  useEffect(() => {
    if (subTab === 'ALERTS') {
      api
        .get('/categories/expiry-milestones')
        .then((res) => {
          if (res.data?.milestones) {
            setMilestones(parseExpiryMilestones(res.data.milestones));
          }
        })
        .catch(() => {
          if (systemConfig?.expiry_warning_milestones) {
            setMilestones(parseExpiryMilestones(systemConfig.expiry_warning_milestones));
          }
        });
    }
  }, [subTab, systemConfig?.expiry_warning_milestones]);

  const handleAddMilestone = () => {
    const safeItem = milestones.find((m) => m.isSafe);
    const regularItems = milestones.filter((m) => !m.isExpired && !m.isSafe);
    const maxDay = regularItems.length > 0 ? Math.max(...regularItems.map((m) => Number(m.days) || 0)) : 0;
    const nextDays = maxDay > 0 ? maxDay + 15 : 10;
    const newId = 'm_' + Date.now();
    const newMilestone = {
      id: newId,
      days: nextDays,
      label: `Cảnh báo (<= ${nextDays} ngày)`,
      textColor: '#0284c7',
      bgColor: '#e0f2fe',
      borderColor: '#bae6fd',
    };
    const expiredItem = milestones.find((m) => m.isExpired);
    const newRegular = [...regularItems, newMilestone].sort((a, b) => Number(a.days) - Number(b.days));
    const result = [];
    if (expiredItem) result.push(expiredItem);
    result.push(...newRegular);
    if (safeItem) result.push(safeItem);
    setMilestones(result);
  };

  const handleUpdateMilestone = (index, field, value) => {
    setMilestones((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleApplyPresetColor = (index, preset) => {
    setMilestones((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        textColor: preset.textColor,
        bgColor: preset.bgColor,
        borderColor: preset.borderColor || preset.bgColor,
      };
      return copy;
    });
  };

  const handleRemoveMilestone = (index) => {
    setMilestones((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleResetMilestones = () => {
    if (window.confirm('Khôi phục cấu hình các mốc cảnh báo về mặc định của hệ thống?')) {
      setMilestones(DEFAULT_EXPIRY_MILESTONES);
    }
  };

  const handleSaveMilestones = async () => {
    setSavingMilestones(true);
    setMessage('');
    setError('');
    try {
      const res = await api.put('/categories/expiry-milestones', { milestones });
      setMessage(res.data?.message || 'Đã lưu cấu hình mốc cảnh báo HSD thành công!');
      if (refreshSystemInfo) {
        await refreshSystemInfo();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi khi lưu cấu hình mốc cảnh báo');
    } finally {
      setSavingMilestones(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [subTab]);

  useEffect(() => {
    if (!message && !error) return;
    const timer = setTimeout(() => {
      setMessage('');
      setError('');
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, error]);

  const openAddModal = () => {
    setEditingItem(null);
    if (subTab === 'PARTNERS') {
      setForm({
        code: '',
        name: '',
        partner_type: 'BOTH',
        contact_person: '',
        phone: '',
        address: '',
        note: '',
        is_active: 1,
      });
    } else if (subTab === 'PRODUCTS') {
      setForm({
        code: '',
        name: '',
        volume_ml: 250,
        unit_id: categories.units[0]?.id || 1,
        is_active: 1,
      });
    } else {
      setForm({
        code: '',
        name: '',
        note: '',
        is_active: 1,
      });
    }
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setForm({
      ...item,
      volume_ml: item.volume_ml !== undefined ? item.volume_ml : 250,
      is_active: item.is_active !== undefined ? (item.is_active ? 1 : 0) : 1,
    });
    setModalOpen(true);
  };

  const getEndpoint = () => {
    if (subTab === 'PARTNERS') return '/categories/partners';
    if (subTab === 'DEPARTMENTS') return '/categories/departments';
    if (subTab === 'PRODUCTS') return '/categories/blood-products';
    return '/categories/units';
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const ep = getEndpoint();
      if (editingItem) {
        const res = await api.put(`${ep}/${editingItem.id}`, form);
        setMessage(res.data?.message || 'Cập nhật danh mục thành công');
      } else {
        const res = await api.post(ep, form);
        setMessage(res.data?.message || 'Thêm danh mục thành công');
      }
      setModalOpen(false);
      await refreshCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi lưu danh mục');
    }
  };

  const handleDelete = async (item) => {
    setMessage('');
    setError('');
    if (Number(item?.usage_count) > 0) {
      setError(
        `Không thể xóa "${item.name}" vì đang tồn tại dữ liệu ràng buộc!`
      );
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa "${item.name}" khỏi danh mục?`)) return;
    try {
      const ep = getEndpoint();
      const res = await api.delete(`${ep}/${item.id}`);
      setMessage(res.data?.message || 'Đã xóa mục danh mục');
      await refreshCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể xóa mục này vì đang có dữ liệu ràng buộc');
    }
  };

  const headerInfo = SUB_HEADERS[subTab] || SUB_HEADERS.PARTNERS;
  const HeaderIcon = headerInfo.icon;

  const currentList =
    subTab === 'PARTNERS'
      ? categories.partners || []
      : subTab === 'PRODUCTS'
      ? categories.bloodProducts || []
      : subTab === 'DEPARTMENTS'
      ? categories.departments || []
      : categories.units || [];

  const slicePage = (arr = []) =>
    arr.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4">
      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Card Header with Add Button */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fdf2fa] text-[#C5299B] flex items-center justify-center">
              <HeaderIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="section-title text-base font-bold text-[#190072]">
                {headerInfo.title}
              </h3>
              <p className="text-xs text-slate-500">{headerInfo.subtitle}</p>
            </div>
          </div>

          {canManage && (
            subTab === 'ALERTS' ? (
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C5299B] text-[#C5299B] hover:bg-[#fdf2fa] text-xs font-medium transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm mốc cảnh báo
                </button>
                <button
                  type="button"
                  disabled={savingMilestones}
                  onClick={handleSaveMilestones}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-xs font-semibold shadow-sm transition disabled:opacity-60"
                >
                  {savingMilestones ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Lưu cấu hình cảnh báo</span>
                </button>
              </div>
            ) : (
              <button
                onClick={openAddModal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-xs font-normal shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                Thêm mới
              </button>
            )
          )}
        </div>

        {/* 1. ĐƠN VỊ ĐỐI TÁC */}
        {subTab === 'PARTNERS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <th className="py-3 px-4 text-left">Mã đơn vị</th>
                  <th className="py-3 px-4 text-left">Tên đơn vị</th>
                  <th className="py-3 px-4 text-left">SĐT</th>
                  <th className="py-3 px-4 text-left">Người liên hệ</th>
                  <th className="py-3 px-4 text-left">Địa chỉ</th>
                  <th className="py-3 px-4 text-left">Ghi chú</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slicePage(categories.partners).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {p.code}
                    </td>
                    <td className="py-3 px-4 text-slate-900">
                      {p.name}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {p.phone || '---'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {p.contact_person || '---'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.address || '---'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {p.note || '---'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.is_active ? (
                        <span className="px-2.5 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Đang sử dụng
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-500 border border-slate-200">
                          Ngưng sử dụng
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canManage && (
                        <div className="inline-flex gap-1.5">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            title={
                              Number(p.usage_count) > 0
                                ? 'Đang có dữ liệu ràng buộc, không thể xóa'
                                : 'Xóa'
                            }
                            className={`p-1.5 rounded-lg ${
                              Number(p.usage_count) > 0
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. LOẠI CHẾ PHẨM MÁU: Mã loại - Tên - Thể tích - Đơn vị tính - Trạng thái */}
        {subTab === 'PRODUCTS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <th className="py-3 px-4 text-left">Mã loại</th>
                  <th className="py-3 px-4 text-left">Tên loại chế phẩm máu</th>
                  <th className="py-3 px-4 text-center">Thể tích</th>
                  <th className="py-3 px-4 text-left">Đơn vị tính</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.bloodProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Chưa có loại chế phẩm máu nào. Hãy bấm &ldquo;+ Thêm mới&rdquo; để khởi tạo.
                    </td>
                  </tr>
                ) : (
                  slicePage(categories.bloodProducts).map((bp) => (
                    <tr key={bp.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {bp.code}
                      </td>
                      <td className="py-3 px-4 text-slate-900 font-medium">
                        {bp.name}
                      </td>
                      <td className="py-3 px-4 text-center text-[#C5299B] font-semibold">
                        {bp.volume_ml || 250} ml
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {bp.unit_name || '---'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {bp.is_active ? (
                          <span className="px-2.5 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Đang sử dụng
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-500 border border-slate-200">
                            Ngưng sử dụng
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canManage && (
                          <div className="inline-flex gap-1.5">
                            <button
                              onClick={() => openEditModal(bp)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(bp)}
                              title={
                                Number(bp.usage_count) > 0
                                  ? 'Đang có dữ liệu ràng buộc, không thể xóa'
                                  : 'Xóa'
                              }
                              className={`p-1.5 rounded-lg ${
                                Number(bp.usage_count) > 0
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. ĐƠN VỊ TÍNH */}
        {subTab === 'UNITS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <th className="py-3 px-4 text-left">Mã ĐVT</th>
                  <th className="py-3 px-4 text-left">Tên đơn vị tính</th>
                  <th className="py-3 px-4 text-left">Ghi chú</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slicePage(categories.units).map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono">{u.code}</td>
                    <td className="py-3 px-4 text-slate-900">{u.name}</td>
                    <td className="py-3 px-4 text-slate-500">{u.note}</td>
                    <td className="py-3 px-4 text-center">
                      {u.is_active ? (
                        <span className="px-2.5 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Đang sử dụng
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-500 border border-slate-200">
                          Ngưng sử dụng
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canManage && (
                        <div className="inline-flex gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            title={
                              Number(u.usage_count) > 0
                                ? 'Đang có dữ liệu ràng buộc, không thể xóa'
                                : 'Xóa'
                            }
                            className={`p-1.5 rounded-lg ${
                              Number(u.usage_count) > 0
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. KHOA / PHÒNG */}
        {subTab === 'DEPARTMENTS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <th className="py-3 px-4 text-left">Mã khoa/phòng</th>
                  <th className="py-3 px-4 text-left">Tên khoa/phòng</th>
                  <th className="py-3 px-4 text-left">Ghi chú</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(categories.departments || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Chưa có Khoa/Phòng nào. Hãy bấm &ldquo;+ Thêm mới&rdquo; để khởi tạo.
                    </td>
                  </tr>
                ) : (
                  slicePage(categories.departments || []).map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-slate-700">{d.code}</td>
                      <td className="py-3 px-4 text-slate-900">{d.name}</td>
                      <td className="py-3 px-4 text-slate-500">{d.note || '---'}</td>
                      <td className="py-3 px-4 text-center">
                        {d.is_active ? (
                          <span className="px-2.5 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Đang sử dụng
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-500 border border-slate-200">
                            Ngưng sử dụng
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canManage && (
                          <div className="inline-flex gap-1.5">
                            <button
                              onClick={() => openEditModal(d)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(d)}
                              title={
                                Number(d.usage_count) > 0
                                  ? 'Đang có dữ liệu ràng buộc, không thể xóa'
                                  : 'Xóa'
                              }
                              className={`p-1.5 rounded-lg ${
                                Number(d.usage_count) > 0
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* CẤU HÌNH CẢNH BÁO HẠN SỬ DỤNG (HSD) & MÀU SẮC */}
        {subTab === 'ALERTS' && (
          <div className="p-4 sm:p-6 space-y-4">
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
        )}

        {subTab !== 'ALERTS' && (
          <Pagination
            totalItems={currentList.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[620px] p-6 sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3.5 mb-4">
              <h3 className="modal-title text-lg font-bold text-[#190072]">
                {editingItem
                  ? `Cập nhật ${headerInfo.categoryLabel}`
                  : `Thêm mới ${headerInfo.categoryLabel}`}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    {headerInfo.codeLabel} <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!!editingItem}
                    value={form.code || ''}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder={headerInfo.codePlaceholder || 'Nhập mã'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-yellow-50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    {headerInfo.nameLabel} <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={headerInfo.namePlaceholder || 'Nhập tên'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-yellow-50"
                    required
                  />
                </div>
              </div>

              {subTab === 'PARTNERS' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">
                        Số điện thoại
                      </label>
                      <input
                        type="text"
                        value={form.phone || ''}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="Nhập số điện thoại liên hệ"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">
                        Người liên hệ
                      </label>
                      <input
                        type="text"
                        value={form.contact_person || ''}
                        onChange={(e) =>
                          setForm({ ...form, contact_person: e.target.value })
                        }
                        placeholder="Nhập họ tên người liên hệ"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Địa chỉ
                    </label>
                    <input
                      type="text"
                      value={form.address || ''}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Nhập địa chỉ đơn vị"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">
                        Ghi chú
                      </label>
                      <input
                        type="text"
                        value={form.note || ''}
                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                        placeholder="Nhập ghi chú (nếu có)"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <ToggleSwitch
                        label="Trạng thái"
                        checked={form.is_active !== undefined ? form.is_active : 1}
                        onChange={(val) => setForm({ ...form, is_active: val })}
                        onText="Đang sử dụng"
                        offText="Ngưng sử dụng"
                      />
                    </div>
                  </div>
                </>
              )}

              {subTab === 'PRODUCTS' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">
                        Thể tích (ml) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={form.volume_ml !== undefined ? form.volume_ml : 250}
                        onChange={(e) =>
                          setForm({ ...form, volume_ml: Number(e.target.value) })
                        }
                        placeholder="Nhập giá trị thể tích (ml)"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-yellow-50"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">
                        Đơn vị tính <span className="text-rose-600">*</span>
                      </label>
                      <SearchableSelect
                        value={form.unit_id || ''}
                        onChange={(val) =>
                          setForm({ ...form, unit_id: Number(val) })
                        }
                        options={categories.units.map((u) => ({
                          value: u.id,
                          label: u.name,
                        }))}
                        placeholder="-- Chọn đơn vị tính --"
                        required
                        className="px-3 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="hidden sm:block" />
                    <div>
                      <ToggleSwitch
                        label="Trạng thái"
                        checked={form.is_active !== undefined ? form.is_active : 1}
                        onChange={(val) => setForm({ ...form, is_active: val })}
                        onText="Đang sử dụng"
                        offText="Ngưng sử dụng"
                      />
                    </div>
                  </div>
                </>
              )}

              {subTab === 'UNITS' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Ghi chú
                    </label>
                    <input
                      type="text"
                      value={form.note || ''}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                      placeholder="Nhập ghi chú (nếu có)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <ToggleSwitch
                      label="Trạng thái"
                      checked={form.is_active !== undefined ? form.is_active : 1}
                      onChange={(val) => setForm({ ...form, is_active: val })}
                      onText="Đang sử dụng"
                      offText="Ngưng sử dụng"
                    />
                  </div>
                </div>
              )}

              {subTab === 'DEPARTMENTS' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Ghi chú
                    </label>
                    <input
                      type="text"
                      value={form.note || ''}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                      placeholder="Nhập ghi chú (nếu có)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <ToggleSwitch
                      label="Trạng thái"
                      checked={form.is_active !== undefined ? form.is_active : 1}
                      onChange={(val) => setForm({ ...form, is_active: val })}
                      onText="Đang sử dụng"
                      offText="Ngưng sử dụng"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-sm"
                >
                  Lưu danh mục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
