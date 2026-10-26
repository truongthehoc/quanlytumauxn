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
    <div className="space-y-4 sm:space-y-5">
      {/* 0. Thanh tiêu đề trang gọn gàng cho di động */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#190072] to-[#C5299B] text-white flex items-center justify-center shadow-xs shrink-0">
            <Droplet className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-bold text-[#190072] leading-tight">
              Kho chế phẩm máu
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 hidden sm:block">
              Quản lý theo dõi hạn dùng, lưu kho và cấp phát sinh phẩm
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={fetchInventory}
            disabled={loading}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium shadow-2xs transition active:scale-95 flex items-center gap-1 shrink-0"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C5299B] ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
          {hasPermission('import.create') && (
            <button
              onClick={() => onNavigate('import')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-2xs transition active:scale-95 shrink-0"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nhập máu</span>
              <span className="sm:hidden">Nhập</span>
            </button>
          )}
          {hasPermission('export.create') && (
            <button
              onClick={() => onNavigate('export')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-xs font-medium shadow-2xs transition active:scale-95 shrink-0"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xuất máu</span>
              <span className="sm:hidden">Xuất</span>
            </button>
          )}
        </div>
      </div>

      {/* Top KPI Cards - 2 Cột trên Mobile, 3 Cột trên Tablet, 5 Cột trên Desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3.5">
        {/* Card 1: Tổng tồn tủ máu */}
        <div
          onClick={() => setSelectedStatus('ALL')}
          className={`relative overflow-hidden cursor-pointer p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition shadow-2xs bg-gradient-to-br from-[#fdf2fa] via-[#fce7f6] to-[#f7d4ec] ${
            selectedStatus === 'ALL'
              ? 'border-[#C5299B] ring-2 ring-[#C5299B]/30'
              : 'border-[#f3bce2] hover:border-[#C5299B]'
          }`}
        >
          {/* Decorative Pattern */}
          <div className="pointer-events-none absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-[#C5299B]/10" />
          <Droplet className="pointer-events-none absolute -right-2 -bottom-2 w-14 h-14 sm:w-20 sm:h-20 text-[#C5299B]/15 rotate-12" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-[#190072] truncate">Tổng tồn tủ máu</span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/80 text-[#C5299B] shadow-2xs flex items-center justify-center shrink-0">
              <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="relative z-10 mt-1.5 sm:mt-2.5 flex items-baseline gap-1 sm:gap-1.5">
            <span className="stat-number text-xl sm:text-3xl lg:text-4xl text-[#C5299B] leading-none">
              {data.summary.totalUnits}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-600 font-medium">bịch</span>
          </div>
          <div className="relative z-10 text-[10px] sm:text-[11px] text-[#190072]/80 mt-1 truncate">
            {data.summary.totalVolumeMl.toLocaleString('vi-VN')} ml
          </div>
        </div>

        {/* Card 2: Còn hạn an toàn */}
        <div
          onClick={() => setSelectedStatus('SAFE')}
          className={`relative overflow-hidden cursor-pointer p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition shadow-2xs bg-gradient-to-br from-emerald-50 via-emerald-100/70 to-teal-100/90 ${
            selectedStatus === 'SAFE'
              ? 'border-emerald-600 ring-2 ring-emerald-500/30'
              : 'border-emerald-200 hover:border-emerald-400'
          }`}
        >
          <div className="pointer-events-none absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-emerald-500/10" />
          <CheckCircle2 className="pointer-events-none absolute -right-2 -bottom-2 w-14 h-14 sm:w-20 sm:h-20 text-emerald-600/15 rotate-12" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-900 truncate">Còn hạn an toàn</span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/80 text-emerald-600 shadow-2xs flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="relative z-10 mt-1.5 sm:mt-2.5 flex items-baseline gap-1 sm:gap-1.5">
            <span className="stat-number text-xl sm:text-3xl lg:text-4xl text-emerald-700 leading-none">
              {data.summary.safeUnits}
            </span>
            <span className="text-[10px] sm:text-xs text-emerald-800/80 font-medium">bịch</span>
          </div>
          <div className="relative z-10 text-[10px] sm:text-[11px] text-emerald-700 mt-1 truncate">
            &gt; {data.warningDays} ngày (Sẵn sàng)
          </div>
        </div>

        {/* Card 3: Sắp hết hạn */}
        <div
          onClick={() => setSelectedStatus('WARNING')}
          className={`relative overflow-hidden cursor-pointer p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition shadow-2xs bg-gradient-to-br from-amber-50 via-amber-100/70 to-orange-100/90 ${
            selectedStatus === 'WARNING'
              ? 'border-amber-500 ring-2 ring-amber-500/30'
              : 'border-amber-200 hover:border-amber-400'
          }`}
        >
          <div className="pointer-events-none absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-amber-500/10" />
          <Clock className="pointer-events-none absolute -right-2 -bottom-2 w-14 h-14 sm:w-20 sm:h-20 text-amber-600/15 rotate-12" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-900 truncate">
              Sắp hết hạn
            </span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/80 text-amber-600 shadow-2xs flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="relative z-10 mt-1.5 sm:mt-2.5 flex items-baseline gap-1 sm:gap-1.5">
            <span className="stat-number text-xl sm:text-3xl lg:text-4xl text-amber-700 leading-none">
              {data.summary.warningUnits}
            </span>
            <span className="text-[10px] sm:text-xs text-amber-800 font-medium">bịch</span>
          </div>
          <div className="relative z-10 text-[10px] sm:text-[11px] text-amber-700 mt-1 truncate">
            ≤ {data.warningDays} ngày (Ưu tiên FEFO)
          </div>
        </div>

        {/* Card 4: Đã hết hạn */}
        <div
          onClick={() => setSelectedStatus('EXPIRED')}
          className={`relative overflow-hidden cursor-pointer p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition shadow-2xs bg-gradient-to-br from-rose-50 via-rose-100/70 to-red-100/90 ${
            selectedStatus === 'EXPIRED'
              ? 'border-rose-500 ring-2 ring-rose-500/30'
              : 'border-rose-200 hover:border-rose-400'
          }`}
        >
          <div className="pointer-events-none absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-rose-500/10" />
          <AlertTriangle className="pointer-events-none absolute -right-2 -bottom-2 w-14 h-14 sm:w-20 sm:h-20 text-rose-600/15 rotate-12" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-rose-900 truncate">Đã hết hạn</span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/80 text-rose-600 shadow-2xs flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="relative z-10 mt-1.5 sm:mt-2.5 flex items-baseline gap-1 sm:gap-1.5">
            <span className="stat-number text-xl sm:text-3xl lg:text-4xl text-rose-600 leading-none">
              {data.summary.expiredUnits}
            </span>
            <span className="text-[10px] sm:text-xs text-rose-700 font-medium">bịch</span>
          </div>
          <div className="relative z-10 text-[10px] sm:text-[11px] text-rose-700 mt-1 truncate">
            {data.summary.expiredUnits > 0 ? 'Không được xuất' : '0 bịch (An toàn)'}
          </div>
        </div>

        {/* Card 5: Đang Mượn / Cho mượn (Spans 2 columns on mobile) */}
        <div
          onClick={() => onNavigate('borrow_lend')}
          className="col-span-2 sm:col-span-1 lg:col-span-1 relative overflow-hidden cursor-pointer p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-indigo-200 hover:border-indigo-400 transition shadow-2xs bg-gradient-to-br from-indigo-50 via-indigo-100/70 to-purple-100/90"
        >
          <div className="pointer-events-none absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-[#190072]/10" />
          <Repeat className="pointer-events-none absolute -right-2 -bottom-2 w-14 h-14 sm:w-20 sm:h-20 text-[#190072]/15 rotate-12" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-[#190072] truncate">Đang Mượn / Cho mượn</span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/80 text-[#190072] shadow-2xs flex items-center justify-center shrink-0">
              <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="relative z-10 mt-1.5 sm:mt-2 text-xs grid grid-cols-2 sm:grid-cols-1 gap-1">
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[10px] sm:text-xs text-slate-600 truncate">Cho mượn:</span>
              <span className="stat-number text-xs sm:text-base font-bold text-[#190072] shrink-0">
                {data.summary.pendingLendUnits} bịch
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[10px] sm:text-xs text-slate-600 truncate">Mượn viện:</span>
              <span className="stat-number text-xs sm:text-base font-bold text-[#C5299B] shrink-0">
                {data.summary.pendingBorrowUnits} bịch
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Banners for Expired or Expiring Soon */}
      {(data.summary.expiredUnits > 0 || data.summary.warningUnits > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {data.summary.expiredUnits > 0 && (
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-rose-50 border border-rose-300 flex items-start justify-between gap-2.5 sm:gap-3 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-rose-800">
                    Cảnh báo: Có {data.summary.expiredUnits} đơn vị chế phẩm máu đã hết hạn!
                  </h4>
                  <p className="text-[11px] sm:text-xs text-rose-700 mt-0.5">
                    Cần cách ly khỏi tủ máu lưu trữ và thực hiện hủy / điều chỉnh kho theo quy định.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStatus('EXPIRED')}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shrink-0 shadow-2xs transition active:scale-95"
              >
                Xem ngay
              </button>
            </div>
          )}

          {data.summary.warningUnits > 0 && (
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-300 flex items-start justify-between gap-2.5 sm:gap-3 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-amber-800">
                    Lưu ý: Có {data.summary.warningUnits} đơn vị sắp hết hạn (trong {data.warningDays} ngày tới)
                  </h4>
                  <p className="text-[11px] sm:text-xs text-amber-700 mt-0.5">
                    Hệ thống tự động ưu tiên gợi ý các lô này lên đầu khi thực hiện Xuất chế phẩm máu.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStatus('WARNING')}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0 shadow-2xs transition active:scale-95"
              >
                Lọc lô
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lots Table & Filter Bar */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap items-center gap-2 flex-1">
            <div className="col-span-2 sm:col-span-3 lg:w-64 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã, tên, thể tích..."
                className="w-full pl-9 pr-10 py-1.5 sm:py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-[#C5299B] outline-none"
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

            <div className="col-span-1 lg:w-52">
              <SearchableSelect
                value={selectedGroup}
                onChange={(val) => setSelectedGroup(val)}
                options={[
                  { value: 'ALL', label: 'Tất cả loại chế phẩm' },
                  ...productGroups.map((g) => ({ value: g, label: g })),
                ]}
                className="px-2.5 py-1.5 sm:py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
              />
            </div>

            <div className="col-span-1 lg:w-44">
              <SearchableSelect
                value={selectedBloodType}
                onChange={(val) => setSelectedBloodType(val)}
                options={[
                  { value: 'ALL', label: 'Tất cả nhóm máu' },
                  ...['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(
                    (bt) => ({
                      value: bt,
                      label: `Nhóm ${bt}`,
                    })
                  ),
                ]}
                className="px-2.5 py-1.5 sm:py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
              />
            </div>

            <div className="col-span-2 sm:col-span-1 lg:w-48">
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
                className="px-2.5 py-1.5 sm:py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 shrink-0 self-end md:self-center">
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

        {/* Giao diện Thẻ danh sách cho Điện thoại di động (Mobile Card View - Có tương phản màu xen kẽ cao) */}
        <div className="block md:hidden divide-y-2 divide-slate-200">
          {filteredLots.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs sm:text-sm px-4">
              Không có lô chế phẩm máu nào khớp với bộ lọc hiện tại.
            </div>
          ) : (
            filteredLots
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((lot, idx) => {
                const badge = getExpiryBadgeInfo(
                  lot.days_remaining,
                  systemConfig?.expiry_warning_milestones
                );
                const isExpired = lot.expiry_status === 'EXPIRED';
                const isWarning = lot.expiry_status === 'WARNING';
                const borderColor = isExpired
                  ? 'border-l-rose-500'
                  : isWarning
                  ? 'border-l-amber-500'
                  : 'border-l-emerald-500';

                return (
                  <div
                    key={lot.id}
                    className={`p-3 space-y-2 border-l-4 ${borderColor} ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-100/90'
                    } transition`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Barcode className="w-3.5 h-3.5 text-[#C5299B] shrink-0" />
                          <span className="font-mono text-xs font-bold text-[#C5299B] truncate">
                            {lot.blood_code || lot.product_code}
                          </span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 line-clamp-1">
                          {lot.product_name}
                        </h4>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base sm:text-lg font-extrabold text-[#190072]">
                          {lot.quantity}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">{lot.unit_name}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold ${
                          lot.rh_factor === '-'
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : 'bg-[#fce7f6] text-[#190072] border border-[#f5c6e8]'
                        }`}
                      >
                        {lot.blood_group} ({lot.rh_factor === '+' ? 'Rh+' : 'Rh-'})
                      </span>

                      <span className="px-2 py-0.5 rounded-lg bg-slate-200/80 text-slate-700 font-medium text-[11px]">
                        {lot.volume_name}
                      </span>

                      <span
                        style={{
                          backgroundColor: badge.bgColor,
                          color: badge.textColor,
                          borderColor: badge.borderColor,
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                      >
                        {badge.icon === 'alert' && <AlertTriangle className="w-3 h-3 shrink-0" />}
                        {badge.icon === 'clock' && <Clock className="w-3 h-3 shrink-0" />}
                        {badge.icon === 'check' && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                        <span>{badge.text}</span>
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span>Lấy: {formatDate(lot.collection_date)}</span>
                      <span>HSD: <strong className="text-slate-800">{formatDate(lot.expiry_date)}</strong></span>
                    </div>

                    {hasPermission('export.create') && !isExpired && (
                      <div className="pt-0.5 flex justify-end">
                        <button
                          onClick={() => onNavigate('export')}
                          className="px-2.5 py-1 rounded-lg bg-[#C5299B] hover:bg-[#a82083] text-white text-[11px] font-medium shadow-2xs transition active:scale-95 flex items-center gap-1"
                        >
                          <ArrowUpRight className="w-3 h-3" />
                          <span>Xuất túi này</span>
                        </button>
                      </div>
                    )}
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
