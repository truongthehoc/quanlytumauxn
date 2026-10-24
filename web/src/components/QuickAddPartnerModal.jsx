import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import ToggleSwitch from './ToggleSwitch';

export default function QuickAddPartnerModal({ open, onClose, onCreated }) {
  const { refreshCategories } = useAuth();
  const [form, setForm] = useState({
    code: '',
    name: '',
    phone: '',
    contact_person: '',
    address: '',
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrMsg('');
    setSaving(true);
    try {
      const res = await api.post('/categories/partners', {
        ...form,
        is_active: 1,
      });
      await refreshCategories();
      const newId = res.data?.id;
      setForm({
        code: '',
        name: '',
        phone: '',
        contact_person: '',
        address: '',
        note: '',
      });
      onCreated?.(newId);
      onClose?.();
    } catch (err) {
      setErrMsg(err.response?.data?.error || 'Không thể thêm đơn vị đối tác');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[620px] p-6 sm:p-7">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3.5 mb-4">
          <h3 className="modal-title text-lg font-bold text-[#190072]">
            Thêm mới Đơn vị đối tác
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {errMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Mã đơn vị <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Nhập mã đơn vị đối tác"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-yellow-50"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Tên đơn vị <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nhập tên đơn vị đối tác"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-yellow-50"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Số điện thoại
              </label>
              <input
                type="text"
                value={form.phone}
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
                value={form.contact_person}
                onChange={(e) =>
                  setForm({ ...form, contact_person: e.target.value })
                }
                placeholder="Nhập họ tên người liên hệ"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Địa chỉ</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Nhập địa chỉ đơn vị"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Ghi chú</label>
              <input
                type="text"
                value={form.note}
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

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#C5299B] hover:bg-[#a82083] disabled:opacity-50 text-white text-sm"
            >
              {saving ? 'Đang lưu...' : 'Lưu danh mục'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
