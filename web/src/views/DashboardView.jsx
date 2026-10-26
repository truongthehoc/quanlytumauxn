import React, { useState, useEffect, useCallback } from 'react';
import {
  Droplet,
  PackagePlus,
  ArrowUpRight,
  ShieldAlert,
  Repeat,
  ClipboardCheck,
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  Layers,
  HeartPulse,
  Activity,
  Flame,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { getExpiryBadgeInfo } from '../utils/expiryHelper';

export default function DashboardView({ onNavigate }) {
  const { user, hasPermission, systemConfig, pendingSummary } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    stockStats: {
      total_units: 0,
      total_volume_ml: 0,
      expired_units: 0,
      warning_units: 0,
      safe_units: 0,
      warning_days: 7,
    },
    activity: {
      today_import: 0,
      today_export: 0,
      month_import: 0,
      month_export: 0,
      pending_lend_qty: 0,
      pending_borrow_qty: 0,
      pending_cancel_count: 0,
    },
    groupDistribution: [],
    productDistribution: [],
    expiringLots: [],
    trend7Days: [],
    latestAudit: null,
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/summary');
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu bảng điều khiển:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Phân quyền người dùng
  const canImport = hasPermission('import.view') || hasPermission('import.create');
  const canExport = hasPermission('export.view') || hasPermission('export.create');
  const canAudit = hasPermission('audit.view') || hasPermission('inventory.view');
  const canBorrowLend = hasPermission('borrow_lend.view') || hasPermission('borrow_lend.create');
  const canReports = hasPermission('reports.view');
  const canApprove = hasPermission('import.cancel_approve') || hasPermission('export.cancel_approve');

  const { stockStats, activity, groupDistribution, productDistribution, expiringLots, trend7Days, latestAudit } = data;

  const totalUnits = stockStats.total_units || 0;
  const totalVolumeLit = (stockStats.total_volume_ml / 1000).toFixed(1);

  // Nhóm máu ABO tổng hợp
  const aboGroups = ['A', 'B', 'AB', 'O'].map((grp) => {
    const rhPos = groupDistribution.find((g) => g.blood_group === grp && g.rh_factor === '+')?.quantity || 0;
    const rhNeg = groupDistribution.find((g) => g.blood_group === grp && g.rh_factor === '-')?.quantity || 0;
    const total = Number(rhPos) + Number(rhNeg);
    const percent = totalUnits > 0 ? Math.round((total / totalUnits) * 100) : 0;
    return {
      group: grp,
      rhPos: Number(rhPos),
      rhNeg: Number(rhNeg),
      total,
      percent,
    };
  });

  // Tìm giá trị max trong trend để vẽ biểu đồ cột
  const maxTrendQty = Math.max(
    1,
    ...trend7Days.map((t) => Math.max(Number(t.import_qty) || 0, Number(t.export_qty) || 0))
  );

  const formatDate = (d) => {
    if (!d) return '---';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('vi-VN');
  };

  const pendingCancelTotal = activity.pending_cancel_count || pendingSummary?.totalPending || 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 0. Thanh tiêu đề trang gọn gàng */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#190072] to-[#C5299B] text-white flex items-center justify-center shadow-xs shrink-0">
            <HeartPulse className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-bold text-[#190072] leading-tight">
              Tổng quan ngân hàng máu
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 hidden sm:block">
              Theo dõi tồn kho, cảnh báo hạn dùng và lưu lượng vận hành
            </p>
          </div>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium shadow-2xs transition active:scale-95 shrink-0"
          title="Làm mới dữ liệu"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#C5299B] ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Làm mới</span>
        </button>
      </div>

      {/* 1. Thanh cảnh báo nếu có việc khẩn cấp (Hủy chờ duyệt hoặc máu quá hạn) */}
      {canApprove && pendingCancelTotal > 0 && (
        <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-wrap items-center justify-between gap-2 sm:gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-amber-500"></span>
            </span>
            <span className="text-xs font-semibold">
              Có <strong>{pendingCancelTotal}</strong> yêu cầu hủy phiếu cần phê duyệt!
            </span>
          </div>
          <button
            onClick={() => onNavigate && onNavigate('cancellation_approval')}
            className="text-xs font-bold text-amber-800 hover:text-amber-950 underline inline-flex items-center gap-1 ml-auto"
          >
            <span>Duyệt ngay</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. 4 CARD KPI TỒN KHO MÁU: 2 CỘT TRÊN MOBILE, 4 CỘT TRÊN DESKTOP */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
        {/* Card 1: Tổng tồn kho máu */}
        <div
          onClick={() => onNavigate && onNavigate('inventory')}
          className="relative overflow-hidden cursor-pointer p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition shadow-2xs hover:shadow-md bg-gradient-to-br from-[#fdf2fa] via-[#fce7f6] to-[#f5c6e8]/80 border-[#f5c6e8] group"
        >
          {/* Decorative Patterns */}
          <div className="pointer-events-none absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-[#C5299B]/10" />
          <Droplet className="pointer-events-none absolute -right-2 -bottom-2 w-14 h-14 sm:w-20 sm:h-20 text-[#C5299B]/15 rotate-12 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-[#190072] truncate">Tổng tồn tủ máu</span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/90 text-[#C5299B] shadow-2xs flex items-center justify-center shrink-0">
              <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="relative z-10 mt-1.5 sm:mt-2.5 flex items-baseline gap-1 sm:gap-1.5">
            <span className="text-xl sm:text-3xl font-extrabold text-[#C5299B] leading-none">
              {totalUnits}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-600 font-medium">túi</span>
          </div>
          <div className="relative z-10 text-[10px] sm:text-[11px] text-[#190072]/80 mt-1 truncate">
            {totalVolumeLit}L ({stockStats.total_volume_ml.toLocaleString()} ml)
          </div>
        </div>

        {/* Card 2: Còn hạn an toàn */}
        <div
          onClick={() => onNavigate && onNavigate('inventory')}
          className="relative overflow-hidden cursor-pointer p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition shadow-2xs hover:shadow-md bg-gradient-to-br from-emerald-50 via-emerald-100/70 to-teal-100/90 border-emerald-200 group"
        >
          <div className="pointer-events-none absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-emerald-500/10" />
          <CheckCircle2 className="pointer-events-none absolute -right-2 -bottom-2 w-14 h-14 sm:w-20 sm:h-20 text-emerald-600/15 rotate-12 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-900 truncate">Còn hạn an toàn</span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/90 text-emerald-600 shadow-2xs flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="relative z-10 mt-1.5 sm:mt-2.5 flex items-baseline gap-1 sm:gap-1.5">
            <span className="text-xl sm:text-3xl font-extrabold text-emerald-700 leading-none">
              {stockStats.safe_units}
            </span>
            <span className="text-[10px] sm:text-xs text-emerald-800 font-medium">túi</span>
          </div>
          <div className="relative z-10 text-[10px] sm:text-[11px] text-emerald-700 mt-1 truncate">
            Hạn &gt; {stockStats.warning_days} ngày (Sẵn sàng)
          </div>
        </div>

        {/* Card 3: Cảnh báo HSD */}
        <div
          onClick={() => onNavigate && onNavigate('inventory')}
          className="relative overflow-hidden cursor-pointer p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition shadow-2xs hover:shadow-md bg-gradient-to-br from-amber-50 via-amber-100/70 to-orange-100/90 border-amber-200 group"
        >
          <div className="pointer-events-none absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-amber-500/10" />
          <Clock className="pointer-events-none absolute -right-2 -bottom-2 w-14 h-14 sm:w-20 sm:h-20 text-amber-600/15 rotate-12 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-900 truncate">Cảnh báo HSD</span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/90 text-amber-600 shadow-2xs flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="relative z-10 mt-1.5 sm:mt-2.5 flex items-baseline gap-1 sm:gap-1.5">
            <span className="text-xl sm:text-3xl font-extrabold text-amber-600 leading-none">
              {stockStats.warning_units}
            </span>
            <span className="text-[10px] sm:text-xs text-amber-800 font-medium">túi</span>
          </div>
          <div className="relative z-10 text-[10px] sm:text-[11px] text-amber-700 mt-1 truncate">
            Còn &le; {stockStats.warning_days} ngày (Ưu tiên FEFO)
          </div>
        </div>

        {/* Card 4: Đã quá hạn */}
        <div
          onClick={() => onNavigate && onNavigate('inventory')}
          className="relative overflow-hidden cursor-pointer p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition shadow-2xs hover:shadow-md bg-gradient-to-br from-rose-50 via-rose-100/70 to-red-100/90 border-rose-200 group"
        >
          <div className="pointer-events-none absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-rose-500/10" />
          <AlertTriangle className="pointer-events-none absolute -right-2 -bottom-2 w-14 h-14 sm:w-20 sm:h-20 text-rose-600/15 rotate-12 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-rose-900 truncate">Đã quá hạn</span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/90 text-rose-600 shadow-2xs flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          <div className="relative z-10 mt-1.5 sm:mt-2.5 flex items-baseline gap-1 sm:gap-1.5">
            <span className="text-xl sm:text-3xl font-extrabold text-rose-600 leading-none">
              {stockStats.expired_units}
            </span>
            <span className="text-[10px] sm:text-xs text-rose-800 font-medium">túi</span>
          </div>
          <div className="relative z-10 text-[10px] sm:text-[11px] text-rose-700 mt-1 truncate">
            {stockStats.expired_units > 0 ? 'Cần thanh lý / hủy' : '0 túi (An toàn)'}
          </div>
        </div>
      </div>

      {/* 3. Grid chính: 2 Cột (Cột trái: Biểu đồ & FEFO | Cột phải: Phím tắt & Hoạt động) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* ==================== VÙNG PHÍM TẮT & TÁC VỤ GOM GỌN (Lên trước trên mobile) ==================== */}
        <div className="order-1 lg:order-2 lg:col-span-4 space-y-3.5 sm:space-y-4">
          {/* Card Phím tắt chức năng gom nhỏ */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#190072]">
                Tác vụ nhanh
              </span>
              <span className="text-[10px] text-slate-400">Chạm để mở</span>
            </div>

            {/* Mobile: Lưới 2 cột các nút bấm gọn gàng | Desktop: Danh sách dọc 1 cột */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5 sm:gap-2">
              {canExport && (
                <button
                  onClick={() => onNavigate && onNavigate('export')}
                  className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-[#fdf2fa] hover:border-[#f5c6e8] text-slate-700 hover:text-[#C5299B] flex items-center justify-between transition group text-left"
                >
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:bg-[#C5299B] group-hover:text-white transition">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight truncate">Xuất chế phẩm</div>
                      <div className="text-[10px] text-slate-400 hidden lg:block">Xuất lâm sàng</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#C5299B] transition shrink-0 hidden lg:block" />
                </button>
              )}

              {canImport && (
                <button
                  onClick={() => onNavigate && onNavigate('import')}
                  className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-emerald-50/70 hover:border-emerald-200 text-slate-700 hover:text-emerald-700 flex items-center justify-between transition group text-left"
                >
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition">
                      <PackagePlus className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight truncate">Nhập chế phẩm</div>
                      <div className="text-[10px] text-slate-400 hidden lg:block">Nhập lô túi máu</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 transition shrink-0 hidden lg:block" />
                </button>
              )}

              <button
                onClick={() => onNavigate && onNavigate('inventory')}
                className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-blue-50/70 hover:border-blue-200 text-slate-700 hover:text-blue-700 flex items-center justify-between transition group text-left"
              >
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition">
                    <Droplet className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight truncate">Kho chế phẩm</div>
                    <div className="text-[10px] text-slate-400 hidden lg:block">Quản lý toàn bộ tồn</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition shrink-0 hidden lg:block" />
              </button>

              {canApprove && (
                <button
                  onClick={() => onNavigate && onNavigate('cancellation_approval')}
                  className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-amber-50/70 hover:border-amber-200 text-slate-700 hover:text-amber-800 flex items-center justify-between transition group text-left"
                >
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition">
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight truncate">Duyệt Hủy</div>
                      <div className="text-[10px] text-slate-400 hidden lg:block">Phê duyệt yêu cầu hủy</div>
                    </div>
                  </div>
                  {pendingCancelTotal > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px] shrink-0">
                      {pendingCancelTotal}
                    </span>
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600 transition shrink-0 hidden lg:block" />
                  )}
                </button>
              )}

              {canBorrowLend && (
                <button
                  onClick={() => onNavigate && onNavigate('borrow_lend')}
                  className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-indigo-50/70 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 flex items-center justify-between transition group text-left"
                >
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                      <Repeat className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight truncate">Mượn / Cho mượn</div>
                      <div className="text-[10px] text-slate-400 hidden lg:block">Điều phối đối tác</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 transition shrink-0 hidden lg:block" />
                </button>
              )}

              {canAudit && (
                <button
                  onClick={() => onNavigate && onNavigate('audit')}
                  className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-purple-50/70 hover:border-purple-200 text-slate-700 hover:text-purple-700 flex items-center justify-between transition group text-left"
                >
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition">
                      <ClipboardCheck className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight truncate">Kiểm kê quỹ máu</div>
                      <div className="text-[10px] text-slate-400 hidden lg:block">Tạo kỳ & lập biên bản</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-600 transition shrink-0 hidden lg:block" />
                </button>
              )}

              {canReports && (
                <button
                  onClick={() => onNavigate && onNavigate('reports')}
                  className="w-full p-2 sm:p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-teal-50/70 hover:border-teal-200 text-slate-700 hover:text-teal-700 flex items-center justify-between transition group text-left"
                >
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 group-hover:bg-teal-600 group-hover:text-white transition">
                      <BarChart3 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight truncate">Báo cáo & Thống kê</div>
                      <div className="text-[10px] text-slate-400 hidden lg:block">Xuất file Excel</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-600 transition shrink-0 hidden lg:block" />
                </button>
              )}
            </div>
          </div>

          {/* Card Tóm tắt Hoạt động hôm nay & tháng này */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#190072]">
              Lưu lượng hoạt động
            </span>

            {/* Lưới 2 cột cho các chỉ số hoạt động */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-1.5 sm:gap-2 pt-1 text-xs">
              <div className="p-2 sm:p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                <div className="flex items-center gap-1 text-[11px] text-rose-700 truncate">
                  <ArrowUpRight className="w-3 h-3 text-rose-500 shrink-0" />
                  <span>Xuất hôm nay</span>
                </div>
                <div className="text-base sm:text-lg font-extrabold text-rose-900 mt-0.5">
                  {activity.today_export} <span className="text-[10px] font-normal text-rose-700">túi</span>
                </div>
              </div>

              <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <div className="flex items-center gap-1 text-[11px] text-emerald-700 truncate">
                  <PackagePlus className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Nhập hôm nay</span>
                </div>
                <div className="text-base sm:text-lg font-extrabold text-emerald-900 mt-0.5">
                  {activity.today_import} <span className="text-[10px] font-normal text-emerald-700">túi</span>
                </div>
              </div>

              {canBorrowLend && (
                <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
                  <div className="text-[10px] text-indigo-700 truncate">Đang cho mượn</div>
                  <div className="text-base sm:text-lg font-extrabold text-indigo-900 mt-0.5">
                    {activity.pending_lend_qty} <span className="text-[10px] font-normal text-indigo-700">túi</span>
                  </div>
                </div>
              )}

              {canBorrowLend && (
                <div className="p-2 sm:p-2.5 rounded-xl bg-purple-50/60 border border-purple-100">
                  <div className="text-[10px] text-purple-700 truncate">Đang mượn viện</div>
                  <div className="text-base sm:text-lg font-extrabold text-purple-900 mt-0.5">
                    {activity.pending_borrow_qty} <span className="text-[10px] font-normal text-purple-700">túi</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs mt-1">
              <span className="text-slate-500 text-[11px]">Luỹ kế tháng này:</span>
              <span className="font-semibold text-slate-700 text-[11px]">
                Nhập <strong className="text-emerald-700">{activity.month_import}</strong> / Xuất <strong className="text-rose-700">{activity.month_export}</strong> túi
              </span>
            </div>
          </div>

          {/* Card Đợt kiểm kê gần nhất nếu có quyền */}
          {canAudit && latestAudit && (
            <div className="bg-purple-50/70 rounded-xl sm:rounded-2xl border border-purple-200 p-3 sm:p-4 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                <span className="flex items-center gap-1.5">
                  <ClipboardCheck className="w-3.5 h-3.5 text-purple-700" />
                  Kiểm kê gần nhất
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-200/60 text-purple-800">
                  {latestAudit.code}
                </span>
              </div>
              <p className="text-xs text-purple-800 font-medium line-clamp-1">{latestAudit.name}</p>
              <div className="flex items-center justify-between text-[11px] text-purple-700 pt-1">
                <span>Ngày: {formatDate(latestAudit.audit_date)}</span>
                <button
                  onClick={() => onNavigate && onNavigate('audit')}
                  className="font-bold underline hover:text-purple-950"
                >
                  Xem chi tiết
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ==================== VÙNG BIỂU ĐỒ & DỮ LIỆU TỒN KHO ==================== */}
        <div className="order-2 lg:order-1 lg:col-span-8 space-y-4 sm:space-y-5">
          {/* HÀNG 2: CƠ CẤU NHÓM MÁU ABO/Rh & TỒN KHO THEO LOẠI CHẾ PHẨM */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-5">
            {/* Khối Cơ cấu Nhóm máu (6 cột) */}
            <div className="md:col-span-6 bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#fdf2fa] text-[#C5299B] flex items-center justify-center shrink-0">
                    <Droplet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-[#190072]">Cơ cấu Nhóm máu (ABO / Rh)</h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-400">Phân bổ tỷ lệ túi máu đang lưu kho</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#C5299B] bg-[#fdf2fa] px-2 py-0.5 rounded-lg border border-[#f5c6e8] shrink-0">
                  {totalUnits} túi
                </span>
              </div>

              <div className="space-y-2.5">
                {aboGroups.map((grp) => (
                  <div key={grp.group} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-[#fce7f6] text-[#190072] font-bold flex items-center justify-center text-xs">
                          {grp.group}
                        </span>
                        <span className="text-slate-800 font-semibold">Nhóm {grp.group}</span>
                        <span className="text-[10px] sm:text-[11px] text-slate-400">
                          (Rh+: {grp.rhPos} | Rh-: {grp.rhNeg})
                        </span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {grp.total} túi <span className="text-slate-400 font-normal">({grp.percent}%)</span>
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          grp.group === 'O'
                            ? 'bg-rose-500'
                            : grp.group === 'A'
                            ? 'bg-[#C5299B]'
                            : grp.group === 'B'
                            ? 'bg-blue-500'
                            : 'bg-purple-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(grp.percent, grp.total > 0 ? 5 : 0))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Khối Tồn kho theo Loại chế phẩm máu (6 cột) */}
            <div className="md:col-span-6 bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-[#190072]">Tồn theo Loại chế phẩm</h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-400">Số lượng túi theo từng loại sinh phẩm</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-[195px] overflow-y-auto pr-1">
                {productDistribution.map((p) => {
                  const pQty = Number(p.quantity) || 0;
                  const pPercent = totalUnits > 0 ? Math.round((pQty / totalUnits) * 100) : 0;

                  return (
                    <div
                      key={p.id}
                      className="p-2 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 truncate pr-2">{p.name}</span>
                        <span className="font-bold text-[#190072] shrink-0">
                          {pQty} túi <span className="text-slate-400 font-normal">({pPercent}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className="bg-[#C5299B] h-full rounded-full transition-all duration-300"
                          style={{ width: `${pPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* HÀNG 3: BẢNG TÚI MÁU ƯU TIÊN XUẤT TRƯỚC (FEFO) */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#190072]">
                    Túi máu cần ưu tiên xuất trước (FEFO)
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400">
                    Các túi máu có hạn dùng gần nhất trong tủ cần ưu tiên xuất dùng trước
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate && onNavigate('inventory')}
                className="text-xs font-semibold text-[#C5299B] hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>Xem tất cả kho</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {expiringLots.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Hiện không có túi máu nào trong diện cảnh báo hạn dùng. Tất cả sinh phẩm đều an toàn!
              </div>
            ) : (
              <>
                {/* Mobile: Danh sách thẻ có màu xen kẽ tương phản cao */}
                <div className="md:hidden divide-y-2 divide-slate-200">
                  {expiringLots.slice(0, 6).map((lot, idx) => {
                    const badge = getExpiryBadgeInfo(lot.days_remaining, systemConfig?.expiry_warning_milestones);
                    const isExpired = lot.days_remaining <= 0;
                    const isWarning = lot.days_remaining <= (systemConfig?.expiry_warning_days || 7);
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
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-bold text-[#C5299B]">
                              {lot.blood_code || '---'}
                            </span>
                            <div className="text-xs font-bold text-slate-900 line-clamp-1 mt-0.5">
                              {lot.product_name}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-base font-extrabold text-[#190072]">
                              {lot.quantity}
                            </span>
                            <span className="text-xs text-slate-500 ml-1">túi</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="px-2 py-0.5 rounded-md bg-[#fdf2fa] text-[#190072] font-semibold border border-[#f5c6e8]">
                            {lot.blood_group}{lot.rh_factor}
                          </span>
                          <span
                            style={{
                              backgroundColor: badge.bgColor,
                              color: badge.textColor,
                              borderColor: badge.borderColor,
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                          >
                            <span>{badge.text}</span>
                          </span>
                          <span className="text-[11px] text-slate-500 ml-auto">
                            HSD: <strong>{formatDate(lot.expiry_date)}</strong>
                          </span>
                        </div>

                        {canExport && (
                          <div className="pt-1 flex justify-end">
                            <button
                              onClick={() => onNavigate && onNavigate('export')}
                              className="px-2.5 py-1 rounded-lg bg-[#C5299B] hover:bg-[#a82083] text-white text-[11px] font-medium shadow-2xs transition active:scale-95"
                            >
                              Xuất túi này
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: Bảng dữ liệu ngang */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500 text-left bg-slate-50/70">
                        <th className="py-2.5 px-3">Mã túi máu</th>
                        <th className="py-2.5 px-3">Loại chế phẩm</th>
                        <th className="py-2.5 px-3 text-center">Nhóm máu</th>
                        <th className="py-2.5 px-3 text-center">Hạn sử dụng</th>
                        <th className="py-2.5 px-3 text-center">Cảnh báo HSD</th>
                        <th className="py-2.5 px-3 text-right">SL Tồn</th>
                        {canExport && <th className="py-2.5 px-3 text-right">Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {expiringLots.slice(0, 6).map((lot) => {
                        const badge = getExpiryBadgeInfo(lot.days_remaining, systemConfig?.expiry_warning_milestones);
                        return (
                          <tr key={lot.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-[#C5299B]">
                              {lot.blood_code || '---'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-900 font-medium">
                              {lot.product_name}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-md bg-[#fdf2fa] text-[#190072] font-semibold border border-[#f5c6e8]">
                                {lot.blood_group}{lot.rh_factor}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-700">
                              {formatDate(lot.expiry_date)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                style={{
                                  backgroundColor: badge.bgColor,
                                  color: badge.textColor,
                                  borderColor: badge.borderColor,
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border shadow-2xs"
                              >
                                <span>{badge.text}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {lot.quantity}
                            </td>
                            {canExport && (
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => onNavigate && onNavigate('export')}
                                  className="px-2.5 py-1 rounded-lg bg-[#C5299B] hover:bg-[#a82083] text-white text-[11px] font-medium shadow-2xs transition active:scale-95"
                                >
                                  Xuất túi này
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* HÀNG 4: BIỂU ĐỒ XU HƯỚNG NHẬP VS XUẤT 7 NGÀY GẦN NHẤT */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#190072]">Xu hướng Nhập & Xuất 7 ngày gần nhất</h3>
                  <p className="text-[11px] text-slate-400">So sánh lưu lượng túi máu nhập và xuất qua các ngày</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  Nhập kho
                </span>
                <span className="flex items-center gap-1.5 text-rose-700 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  Xuất kho
                </span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-36 border-b border-slate-100 pb-2">
              {trend7Days.map((t, idx) => {
                const inQty = Number(t.import_qty) || 0;
                const outQty = Number(t.export_qty) || 0;
                const inHeight = Math.max(4, Math.round((inQty / maxTrendQty) * 100));
                const outHeight = Math.max(4, Math.round((outQty / maxTrendQty) * 100));

                return (
                  <div key={t.full_date || idx} className="flex flex-col items-center h-full justify-end group">
                    <div className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition mb-1 text-center font-mono">
                      +{inQty}/-{outQty}
                    </div>

                    <div className="w-full flex items-end justify-center gap-1 h-24">
                      <div
                        title={`Nhập: ${inQty} túi (${t.date_label})`}
                        style={{ height: `${inQty > 0 ? inHeight : 4}%` }}
                        className={`w-3 sm:w-4 rounded-t transition-all ${
                          inQty > 0 ? 'bg-emerald-500 group-hover:bg-emerald-600' : 'bg-slate-200'
                        }`}
                      />
                      <div
                        title={`Xuất: ${outQty} túi (${t.date_label})`}
                        style={{ height: `${outQty > 0 ? outHeight : 4}%` }}
                        className={`w-3 sm:w-4 rounded-t transition-all ${
                          outQty > 0 ? 'bg-rose-500 group-hover:bg-rose-600' : 'bg-slate-200'
                        }`}
                      />
                    </div>

                    <div className="text-[11px] font-medium text-slate-500 mt-1.5">
                      {t.date_label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
