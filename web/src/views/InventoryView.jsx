import React, { useState, useEffect, useCallback } from 'react';
import {
  Droplet,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  RefreshCw,
  ArrowUpRight,
  PackagePlus,
  Repeat,
  X,
  Camera,
  Barcode,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { getExpiryBadgeInfo } from '../utils/expiryHelper';

export default function InventoryView({ onNavigate, initialSearch = '' }) {
  const { hasPermission, systemConfig } = useAuth();
  const [data, setData] = useState({
    warningDays: 7,
    summary: {
      totalUnits: 0,
      totalVolumeMl: 0,
      safeUnits: 0,
      warningUnits: 0,
      expiredUnits: 0,
      pendingLendUnits: 0,
      pendingBorrowUnits: 0,
    },
    byBloodType: [],
    lots: [],
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedBloodType, setSelectedBloodType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [search, setSearch] = useState(initialSearch || '');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (initialSearch !== undefined && initialSearch !== null) {
      setSearch(initialSearch);
    }
  }, [initialSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBloodType, selectedStatus, selectedGroup, search]);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory');
      setData(res.data);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const productGroups = Array.from(
    new Set(data.lots.map((l) => l.product_group).filter(Boolean))
  );

  const filteredLots = data.lots.filter((lot) => {
    const bt = `${lot.blood_group}${lot.rh_factor}`;
    if (selectedBloodType !== 'ALL' && bt !== selectedBloodType) return false;
    if (selectedStatus !== 'ALL' && lot.expiry_status !== selectedStatus) return false;
    if (selectedGroup !== 'ALL' && lot.product_group !== selectedGroup) return false;
    if (search.trim()) {
      const kw = search.toLowerCase();
      const match =
        lot.product_code.toLowerCase().includes(kw) ||
        lot.product_name.toLowerCase().includes(kw) ||
        (lot.blood_code && lot.blood_code.toLowerCase().includes(kw)) ||
        bt.toLowerCase().includes(kw) ||
        String(lot.volume_ml).includes(kw);
      if (!match) return false;
    }
    return true;
  });

  const formatDate = (d) => {
    if (!d) return '---';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('vi-VN');
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Cards - Đổ màu pastel nhạt & có họa tiết trang trí */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Tổng tồn tủ máu */}
        <div
          onClick={() => setSelectedStatus('ALL')}
          className={`relative overflow-hidden cursor-pointer p-4 rounded-2xl border transition shadow-xs bg-gradient-to-br from-[#fdf2fa] via-[#fce7f6] to-[#f7d4ec] ${
            selectedStatus === 'ALL'
              ? 'border-[#C5299B] ring-2 ring-[#C5299B]/30'
              : 'border-[#f3bce2] hover:border-[#C5299B]'
          }`}
        >
          {/* Decorative Pattern */}
          <div className="pointer-events-none absolute -right-6 -top-6 w-28 h-28 rounded-full bg-[#C5299B]/10" />
          <div className="pointer-events-none absolute right-8 -bottom-8 w-24 h-24 rounded-full bg-[#C5299B]/10" />
          <Droplet className="pointer-events-none absolute -right-2 -bottom-2 w-20 h-20 text-[#C5299B]/15 rotate-12" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-normal text-[#190072]">Tổng tồn tủ máu</span>
            <div className="w-9 h-9 rounded-xl bg-white/80 text-[#C5299B] shadow-2xs flex items-center justify-center">
              <Droplet className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10 mt-2.5 flex items-baseline gap-2">
            <span className="stat-number text-3xl sm:text-4xl text-[#C5299B] leading-none">
              {data.summary.totalUnits}
            </span>
            <span className="text-xs text-slate-600 font-normal">
              bịch ({data.summary.totalVolumeMl.toLocaleString('vi-VN')} ml)
            </span>
          </div>
        </div>

        {/* Card 2: Còn hạn an toàn */}
        <div
          onClick={() => setSelectedStatus('SAFE')}
          className={`relative overflow-hidden cursor-pointer p-4 rounded-2xl border transition shadow-xs bg-gradient-to-br from-emerald-50 via-emerald-100/70 to-teal-100/90 ${
            selectedStatus === 'SAFE'
              ? 'border-emerald-600 ring-2 ring-emerald-500/30'
              : 'border-emerald-200 hover:border-emerald-400'
          }`}
        >
          {/* Decorative Pattern */}
          <div className="pointer-events-none absolute -right-6 -top-6 w-28 h-28 rounded-full bg-emerald-500/10" />
          <div className="pointer-events-none absolute right-8 -bottom-8 w-24 h-24 rounded-full bg-emerald-500/10" />
          <CheckCircle2 className="pointer-events-none absolute -right-2 -bottom-2 w-20 h-20 text-emerald-600/15 rotate-12" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-normal text-emerald-900">Còn hạn an toàn</span>
            <div className="w-9 h-9 rounded-xl bg-white/80 text-emerald-600 shadow-2xs flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10 mt-2.5 flex items-baseline gap-2">
            <span className="stat-number text-3xl sm:text-4xl text-emerald-700 leading-none">
              {data.summary.safeUnits}
            </span>
            <span className="text-xs text-emerald-800/80">(&gt; {data.warningDays} ngày)</span>
          </div>
        </div>

        {/* Card 3: Sắp hết hạn */}
        <div
          onClick={() => setSelectedStatus('WARNING')}
          className={`relative overflow-hidden cursor-pointer p-4 rounded-2xl border transition shadow-xs bg-gradient-to-br from-amber-50 via-amber-100/70 to-orange-100/90 ${
            selectedStatus === 'WARNING'
              ? 'border-amber-500 ring-2 ring-amber-500/30'
              : 'border-amber-200 hover:border-amber-400'
          }`}
        >
          {/* Decorative Pattern */}
          <div className="pointer-events-none absolute -right-6 -top-6 w-28 h-28 rounded-full bg-amber-500/10" />
          <div className="pointer-events-none absolute right-8 -bottom-8 w-24 h-24 rounded-full bg-amber-500/10" />
          <Clock className="pointer-events-none absolute -right-2 -bottom-2 w-20 h-20 text-amber-600/15 rotate-12" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-normal text-amber-900">
              Sắp hết hạn (≤ {data.warningDays} ngày)
            </span>
            <div className="w-9 h-9 rounded-xl bg-white/80 text-amber-600 shadow-2xs flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10 mt-2.5 flex items-baseline gap-2">
            <span className="stat-number text-3xl sm:text-4xl text-amber-700 leading-none">
              {data.summary.warningUnits}
            </span>
            <span className="text-xs text-amber-800 font-normal">Ưu tiên xuất trước</span>
          </div>
        </div>

        {/* Card 4: Đã hết hạn */}
        <div
          onClick={() => setSelectedStatus('EXPIRED')}
          className={`relative overflow-hidden cursor-pointer p-4 rounded-2xl border transition shadow-xs bg-gradient-to-br from-rose-50 via-rose-100/70 to-red-100/90 ${
            selectedStatus === 'EXPIRED'
              ? 'border-rose-500 ring-2 ring-rose-500/30'
              : 'border-rose-200 hover:border-rose-400'
          }`}
        >
          {/* Decorative Pattern */}
          <div className="pointer-events-none absolute -right-6 -top-6 w-28 h-28 rounded-full bg-rose-500/10" />
          <div className="pointer-events-none absolute right-8 -bottom-8 w-24 h-24 rounded-full bg-rose-500/10" />
          <AlertTriangle className="pointer-events-none absolute -right-2 -bottom-2 w-20 h-20 text-rose-600/15 rotate-12" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-normal text-rose-900">Đã hết hạn (Cảnh báo)</span>
            <div className="w-9 h-9 rounded-xl bg-white/80 text-rose-600 shadow-2xs flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10 mt-2.5 flex items-baseline gap-2">
            <span className="stat-number text-3xl sm:text-4xl text-rose-600 leading-none">
              {data.summary.expiredUnits}
            </span>
            <span className="text-xs text-rose-700 font-normal">Không được xuất</span>
          </div>
        </div>

        {/* Card 5: Đang Mượn / Cho mượn */}
        <div
          onClick={() => onNavigate('borrow_lend')}
          className="relative overflow-hidden cursor-pointer p-4 rounded-2xl border border-indigo-200 hover:border-indigo-400 transition shadow-xs bg-gradient-to-br from-indigo-50 via-indigo-100/70 to-purple-100/90"
        >
          {/* Decorative Pattern */}
          <div className="pointer-events-none absolute -right-6 -top-6 w-28 h-28 rounded-full bg-[#190072]/10" />
          <div className="pointer-events-none absolute right-8 -bottom-8 w-24 h-24 rounded-full bg-[#190072]/10" />
          <Repeat className="pointer-events-none absolute -right-2 -bottom-2 w-20 h-20 text-[#190072]/15 rotate-12" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-normal text-[#190072]">Đang Mượn / Cho mượn</span>
            <div className="w-9 h-9 rounded-xl bg-white/80 text-[#190072] shadow-2xs flex items-center justify-center">
              <Repeat className="w-5 h-5" />
            </div>
          </div>
          <div className="relative z-10 mt-2 text-xs space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-slate-600">Cho mượn chưa thu:</span>
              <span className="stat-number text-base text-[#190072]">{data.summary.pendingLendUnits} bịch</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-slate-600">Mượn chưa trả:</span>
              <span className="stat-number text-base text-[#C5299B]">{data.summary.pendingBorrowUnits} bịch</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Banners for Expired or Expiring Soon */}
      {(data.summary.expiredUnits > 0 || data.summary.warningUnits > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.summary.expiredUnits > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-normal text-rose-800 ">
                    Cảnh báo: Có {data.summary.expiredUnits} đơn vị chế phẩm máu đã hết hạn!
                  </h4>
                  <p className="text-xs text-rose-700 mt-0.5">
                    Cần cách ly khỏi tủ máu lưu trữ và thực hiện hủy / điều chỉnh kho theo quy định.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStatus('EXPIRED')}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-normal shrink-0"
              >
                Xem ngay
              </button>
            </div>
          )}

          {data.summary.warningUnits > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-normal text-amber-800 ">
                    Lưu ý: Có {data.summary.warningUnits} đơn vị sắp hết hạn (trong {data.warningDays} ngày tới)
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Hệ thống tự động ưu tiên gợi ý các lô này lên đầu khi thực hiện Xuất chế phẩm máu.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStatus('WARNING')}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-normal shrink-0"
              >
                Lọc lô sắp hết hạn
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lots Table & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2 flex-1">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã, tên chế phẩm, thể tích..."
                className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-300 text-sm focus:border-[#C5299B] outline-none"
              />
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-[#C5299B] hover:bg-[#C5299B]/10 rounded-lg active:scale-95 transition"
                title="Quét mã vạch túi máu bằng Camera"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full sm:w-52">
              <SearchableSelect
                value={selectedGroup}
                onChange={(val) => setSelectedGroup(val)}
                options={[
                  { value: 'ALL', label: 'Tất cả loại chế phẩm' },
                  ...productGroups.map((g) => ({ value: g, label: g })),
                ]}
                className="px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div className="w-full sm:w-52">
              <SearchableSelect
                value={selectedBloodType}
                onChange={(val) => setSelectedBloodType(val)}
                options={[
                  { value: 'ALL', label: 'Tất cả nhóm máu (ABO/Rh)' },
                  ...['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(
                    (bt) => ({
                      value: bt,
                      label: `Nhóm ${bt}`,
                    })
                  ),
                ]}
                className="px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div className="w-full sm:w-48">
              <SearchableSelect
                value={selectedStatus}
                onChange={(val) => setSelectedStatus(val)}
                options={[
                  { value: 'ALL', label: 'Hạn sử dụng' },
                  { value: 'SAFE', label: 'Còn hạn an toàn' },
                  {
                    value: 'WARNING',
                    label: `Sắp hết hạn (≤ ${data.warningDays} ngày)`,
                  },
                  { value: 'EXPIRED', label: 'Đã hết hạn' },
                ]}
                className="px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              onClick={fetchInventory}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {hasPermission('import.create') && (
              <button
                onClick={() => onNavigate('import')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-normal shadow-sm transition"
              >
                <PackagePlus className="w-4 h-4" />
                <span className="hidden sm:inline">Nhập máu</span>
                <span className="sm:hidden">Nhập</span>
              </button>
            )}
            {hasPermission('export.create') && (
              <button
                onClick={() => onNavigate('export')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-xs font-normal shadow-sm transition"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span className="hidden sm:inline">Xuất máu</span>
                <span className="sm:hidden">Xuất</span>
              </button>
            )}
          </div>
        </div>

        {/* Giao diện Thẻ danh sách cho Điện thoại di động (Mobile Card View) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredLots.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm px-4">
              Không có lô chế phẩm máu nào khớp với bộ lọc hiện tại.
            </div>
          ) : (
            filteredLots
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((lot) => {
                const badge = getExpiryBadgeInfo(
                  lot.days_remaining,
                  systemConfig?.expiry_warning_milestones
                );
                return (
                  <div key={lot.id} className="p-4 space-y-2 hover:bg-slate-50/80 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Barcode className="w-3.5 h-3.5 text-[#C5299B] shrink-0" />
                          <span className="font-mono text-xs font-bold text-[#C5299B] truncate">
                            {lot.blood_code || lot.product_code}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900 mt-0.5 line-clamp-1">
                          {lot.product_name}
                        </h4>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base font-bold text-[#190072]">
                          {lot.quantity}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">{lot.unit_name}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold ${
                          lot.rh_factor === '-'
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : 'bg-[#fce7f6] text-[#190072] border border-[#f5c6e8]'
                        }`}
                      >
                        {lot.blood_group} ({lot.rh_factor === '+' ? 'Rh+' : 'Rh-'})
                      </span>

                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-medium">
                        {lot.volume_name}
                      </span>

                      <span
                        style={{
                          backgroundColor: badge.bgColor,
                          color: badge.textColor,
                          borderColor: badge.borderColor,
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
                      >
                        {badge.icon === 'alert' && <AlertTriangle className="w-3 h-3 shrink-0" />}
                        {badge.icon === 'clock' && <Clock className="w-3 h-3 shrink-0" />}
                        {badge.icon === 'check' && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                        <span>{badge.text}</span>
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                      <span>Lấy: {formatDate(lot.collection_date)}</span>
                      <span>HSD: <strong>{formatDate(lot.expiry_date)}</strong></span>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* Giao diện Bảng dữ liệu cho Máy tính & Tablet (Desktop Table View) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs ">
                <th className="py-3 px-4 text-left">Mã túi máu</th>
                <th className="py-3 px-4 text-left">Loại chế phẩm máu</th>
                <th className="py-3 px-4 text-center">Nhóm máu (ABO/Rh)</th>
                <th className="py-3 px-4 text-center">Thể tích</th>
                <th className="py-3 px-4 text-center">ĐVT</th>
                <th className="py-3 px-4 text-center">Ngày lấy máu</th>
                <th className="py-3 px-4 text-center">Hạn sử dụng</th>
                <th className="py-3 px-4 text-center">Cảnh báo HSD</th>
                <th className="py-3 px-4 text-center">Số lượng tồn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLots.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    Không có lô chế phẩm máu nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredLots
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((lot) => {
                    const isExpired = lot.expiry_status === 'EXPIRED';
                    const isWarning = lot.expiry_status === 'WARNING';
                    return (
                      <tr
                        key={lot.id}
                        className="odd:bg-white even:bg-[#fdf2fa] hover:bg-[#fce7f6]/60 transition"
                      >
                        <td className="py-3 px-4 font-mono text-xs font-semibold">
                          {lot.blood_code ? (
                            <span className="text-[#C5299B]">{lot.blood_code}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">---</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-normal text-slate-900">{lot.product_name}</div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg font-normal text-xs ${
                              lot.rh_factor === '-'
                                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                : 'bg-[#fce7f6] text-[#190072] border border-[#f5c6e8]'
                            }`}
                          >
                            {lot.blood_group} ({lot.rh_factor === '+' ? 'Rh+' : 'Rh-'})
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-normal text-slate-700">
                          {lot.volume_name}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600">
                          {lot.unit_name}
                        </td>
                        <td className="py-3 px-4 text-center font-normal text-slate-700">
                          {formatDate(lot.collection_date)}
                        </td>
                        <td className="py-3 px-4 text-center font-normal text-slate-800">
                          {formatDate(lot.expiry_date)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {(() => {
                            const badge = getExpiryBadgeInfo(
                              lot.days_remaining,
                              systemConfig?.expiry_warning_milestones
                            );
                            return (
                              <span
                                style={{
                                  backgroundColor: badge.bgColor,
                                  color: badge.textColor,
                                  borderColor: badge.borderColor,
                                }}
                                title={badge.label}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border shadow-2xs transition"
                              >
                                {badge.icon === 'alert' && (
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                )}
                                {badge.icon === 'clock' && (
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                )}
                                {badge.icon === 'check' && (
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span>{badge.text}</span>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-lg font-normal text-slate-900">
                            {lot.quantity}
                          </span>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          totalItems={filteredLots.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Barcode Scanner Modal cho Kho Chế Phẩm */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Quét mã vạch tra cứu túi máu"
        description="Quét mã trên túi máu để lọc và xem thông tin chi tiết"
        onScan={(scannedCode) => {
          setSearch(scannedCode);
        }}
      />
    </div>
  );
}
