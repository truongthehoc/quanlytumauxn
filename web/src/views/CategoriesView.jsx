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
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';
import ToggleSwitch from '../components/ToggleSwitch';

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
};

export default function CategoriesView({ activeSubTab = 'PARTNERS' }) {
  const { categories, refreshCategories, hasPermission } = useAuth();
  const [subTab, setSubTab] = useState(activeSubTab);
  const canManage = hasPermission('categories.manage');

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
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-xs font-normal shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Thêm mới
            </button>
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

        <Pagination
          totalItems={currentList.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
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
