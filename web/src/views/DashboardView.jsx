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
  Building2,
  Calendar,
  Layers,
  Sparkles,
  HeartPulse,
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

  // Phân quyền
  const canImport = hasPermission('import.view') || hasPermission('import.create');
  const canExport = hasPermission('export.view') || hasPermission('export.create');
  const canAudit = hasPermission('audit.view') || hasPermission('inventory.view');
  const canBorrowLend = hasPermission('borrow_lend.view') || hasPermission('borrow_lend.create');
  const canReports = hasPermission('reports.view');
  const canApprove = hasPermission('import.cancel_approve') || hasPermission('export.cancel_approve');

  const { stockStats, activity, groupDistribution, productDistribution, expiringLots, trend7Days, latestAudit } = data;

  const totalUnits = stockStats.total_units || 0;
  const totalVolumeLit = (stockStats.total_volume_ml / 1000).toFixed(1);

  // Nhóm ABO tổng hợp
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

  // Tìm giá trị max trong trend để vẽ biểu đồ cột tỷ lệ %
  const maxTrendQty = Math.max(
    1,
    ...trend7Days.map((t) => Math.max(Number(t.import_qty) || 0, Number(t.export_qty) || 0))
  );

  const formatDate = (d) => {
    if (!d) return '---';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('vi-VN');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Chào người dùng */}
      <div className="bg-gradient-to-r from-[#190072] via-[#2a0885] to-[#C5299B] text-white rounded-3xl p-6 sm:p-7 shadow-lg relative overflow-hidden">
        {/* Họa tiết nền chìm */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-[#C5299B]/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-medium backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                {systemConfig?.department_name || 'KHOA XÉT NGHIỆM'}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/10 text-xs text-white/90">
                {user?.role_name || 'Người dùng'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2.5">
              Xin chào, {user?.full_name || user?.username}!
            </h2>
            <p className="text-sm text-purple-100/80 mt-1 max-w-xl">
              Chào mừng bạn đến với Bảng điều khiển quản lý tủ máu xét nghiệm. Dưới đây là tóm tắt nhanh tình trạng kho và các hoạt động vận hành.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-medium backdrop-blur-sm transition border border-white/20 active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Đang cập nhật...' : 'Làm mới dữ liệu'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Banner Cảnh báo cần xử lý ưu tiên (nếu có yêu cầu duyệt hủy hoặc máu quá hạn) */}
      {canApprove && (activity.pending_cancel_count > 0 || (pendingSummary?.totalPending || 0) > 0) && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold">
                Có {activity.pending_cancel_count || pendingSummary?.totalPending} yêu cầu hủy phiếu đang chờ bạn phê duyệt!
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                Các phiếu xuất / nhập máu đã được nhân viên gửi yêu cầu hủy và cần thẩm quyền của bạn duyệt hoặc từ chối.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate && onNavigate('cancellation_approval')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition shrink-0"
          >
            <span>Duyệt yêu cầu ngay</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {stockStats.expired_units > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold">
                Cảnh báo: Hiện có {stockStats.expired_units} túi máu đã quá hạn sử dụng trong tủ!
              </div>
              <div className="text-xs text-rose-700 mt-0.5">
                Vui lòng kiểm tra và thực hiện quy trình niêm phong / thanh lý theo quy chuẩn an toàn sinh học.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate && onNavigate('inventory')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition shrink-0"
          >
            <span>Xem túi máu quá hạn</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Phím tắt thao tác nhanh (Phù hợp với từng chức năng người dùng) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 px-1">
          Phím tắt chức năng thường dùng
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {canExport && (
            <button
              onClick={() => onNavigate && onNavigate('export')}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-[#C5299B]/40 hover:bg-[#fdf2fa] text-slate-700 hover:text-[#C5299B] text-left transition group shadow-2xs"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 group-hover:bg-[#C5299B] group-hover:text-white flex items-center justify-center mb-2 transition">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold">Xuất máu</div>
              <div className="text-[11px] text-slate-400">Xuất lâm sàng/bệnh nhân</div>
            </button>
          )}

          {canImport && (
            <button
              onClick={() => onNavigate && onNavigate('import')}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-700 text-left transition group shadow-2xs"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center mb-2 transition">
                <PackagePlus className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold">Nhập máu</div>
              <div className="text-[11px] text-slate-400">Nhập lô túi máu mới</div>
            </button>
          )}

          <button
            onClick={() => onNavigate && onNavigate('inventory')}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-slate-700 hover:text-blue-700 text-left transition group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center mb-2 transition">
              <Droplet className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold">Kho chế phẩm</div>
            <div className="text-[11px] text-slate-400">Xem danh sách tồn kho</div>
          </button>

          {canBorrowLend && (
            <button
              onClick={() => onNavigate && onNavigate('borrow_lend')}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-700 text-left transition group shadow-2xs"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center mb-2 transition">
                <Repeat className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold">Mượn / Cho mượn</div>
              <div className="text-[11px] text-slate-400">Điều phối viện đối tác</div>
            </button>
          )}

          {canAudit && (
            <button
              onClick={() => onNavigate && onNavigate('audit')}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 text-slate-700 hover:text-purple-700 text-left transition group shadow-2xs"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white flex items-center justify-center mb-2 transition">
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold">Kiểm kê kho</div>
              <div className="text-[11px] text-slate-400">Kiểm đếm thực tế quỹ máu</div>
            </button>
          )}

          {canReports && (
            <button
              onClick={() => onNavigate && onNavigate('reports')}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 text-slate-700 hover:text-teal-700 text-left transition group shadow-2xs"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white flex items-center justify-center mb-2 transition">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold">Báo cáo & Xuất Excel</div>
              <div className="text-[11px] text-slate-400">Báo cáo Nhập - Xuất - Tồn</div>
            </button>
          )}
        </div>
      </div>

      {/* 4. KPI Thống kê nhanh thông tin (Top KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng tồn kho */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng túi máu tồn</span>
            <div className="w-9 h-9 rounded-xl bg-[#fdf2fa] text-[#C5299B] flex items-center justify-center">
              <Droplet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-[#190072]">
              {totalUnits} <span className="text-sm font-normal text-slate-500">túi</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Tổng thể tích: <strong>{totalVolumeLit} Lít</strong> ({stockStats.total_volume_ml.toLocaleString()} ml)</span>
            </div>
          </div>
        </div>

        {/* Card 2: Còn hạn an toàn */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Còn hạn an toàn</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-emerald-700">
              {stockStats.safe_units} <span className="text-sm font-normal text-slate-500">túi</span>
            </div>
            <div className="text-xs text-emerald-600/90 mt-1">
              Hạn dùng &gt; {stockStats.warning_days} ngày, sẵn sàng cấp phát
            </div>
          </div>
        </div>

        {/* Card 3: Cảnh báo hạn sử dụng */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Cảnh báo HSD</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-amber-600">
              {stockStats.warning_units} <span className="text-sm font-normal text-slate-500">túi</span>
            </div>
            <div className="text-xs text-amber-700/80 mt-1">
              Còn &le; {stockStats.warning_days} ngày (Ưu tiên xuất trước - FEFO)
            </div>
          </div>
        </div>

        {/* Card 4: Hoạt động hôm nay */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Hoạt động hôm nay</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <HeartPulse className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                Đã xuất:
              </span>
              <span className="font-bold text-slate-900">{activity.today_export} túi</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 flex items-center gap-1">
                <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
                Đã nhập:
              </span>
              <span className="font-bold text-slate-900">{activity.today_import} túi</span>
            </div>
            <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">
              Tháng này: Nhập {activity.month_import} / Xuất {activity.month_export} túi
            </div>
          </div>
        </div>
      </div>

      {/* 5. Khối nội dung chính: Cơ cấu Nhóm máu & Biểu đồ Xu hướng 7 ngày */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái: Cơ cấu Nhóm máu ABO / Rh (5 cột) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#190072] flex items-center gap-2">
                <Droplet className="w-4 h-4 text-[#C5299B]" />
                Cơ cấu Nhóm máu (ABO / Rh)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Tỷ lệ phân bổ túi máu đang lưu kho</p>
            </div>
            <span className="text-xs font-semibold text-[#C5299B] bg-[#fdf2fa] px-2.5 py-1 rounded-lg">
              {totalUnits} túi
            </span>
          </div>

          <div className="space-y-3.5">
            {aboGroups.map((grp) => (
              <div key={grp.group} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#fce7f6] text-[#190072] font-bold flex items-center justify-center text-xs">
                      {grp.group}
                    </span>
                    <span className="text-slate-700 font-medium">Nhóm {grp.group}</span>
                    <span className="text-[11px] text-slate-400">
                      (Rh+: {grp.rhPos} | Rh-: {grp.rhNeg})
                    </span>
                  </div>
                  <span className="font-bold text-slate-900">
                    {grp.total} túi <span className="text-slate-400 font-normal">({grp.percent}%)</span>
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
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

          {/* Chi tiết phụ về Mượn / Trả đối tác nếu có quyền */}
          {canBorrowLend && (
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-slate-500 text-[11px]">Đang cho mượn</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {activity.pending_lend_qty} túi
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-slate-500 text-[11px]">Đang mượn đối tác</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {activity.pending_borrow_qty} túi
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cột phải: Xu hướng Nhập vs Xuất 7 ngày gần nhất (7 cột) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#190072] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Xu hướng Nhập & Xuất 7 ngày gần nhất
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">So sánh số lượng túi máu nhập và xuất theo ngày</p>
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

            {/* Biểu đồ cột mini CSS responsive */}
            <div className="pt-6 pb-2">
              <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 border-b border-slate-200 pb-2">
                {trend7Days.map((t, idx) => {
                  const inQty = Number(t.import_qty) || 0;
                  const outQty = Number(t.export_qty) || 0;
                  const inHeight = Math.max(4, Math.round((inQty / maxTrendQty) * 100));
                  const outHeight = Math.max(4, Math.round((outQty / maxTrendQty) * 100));

                  return (
                    <div key={t.full_date || idx} className="flex flex-col items-center h-full justify-end group">
                      {/* Tooltip khi hover */}
                      <div className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition mb-1 text-center font-mono">
                        +{inQty}/-{outQty}
                      </div>

                      <div className="w-full flex items-end justify-center gap-1 h-32">
                        {/* Cột Nhập */}
                        <div
                          title={`Nhập: ${inQty} túi (${t.date_label})`}
                          style={{ height: `${inQty > 0 ? inHeight : 4}%` }}
                          className={`w-3 sm:w-4 rounded-t transition-all ${
                            inQty > 0 ? 'bg-emerald-500 group-hover:bg-emerald-600' : 'bg-slate-200'
                          }`}
                        />
                        {/* Cột Xuất */}
                        <div
                          title={`Xuất: ${outQty} túi (${t.date_label})`}
                          style={{ height: `${outQty > 0 ? outHeight : 4}%` }}
                          className={`w-3 sm:w-4 rounded-t transition-all ${
                            outQty > 0 ? 'bg-rose-500 group-hover:bg-rose-600' : 'bg-slate-200'
                          }`}
                        />
                      </div>

                      <div className="text-[11px] font-medium text-slate-500 mt-2">
                        {t.date_label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-3 flex flex-wrap items-center justify-between text-xs text-slate-500">
            <span>Dữ liệu thống kê tự động từ các phiếu nhập xuất đã thực hiện</span>
            {canReports && (
              <button
                onClick={() => onNavigate && onNavigate('reports')}
                className="text-[#C5299B] hover:underline font-medium inline-flex items-center gap-1"
              >
                <span>Xem báo cáo chi tiết</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 6. Hàng bên dưới: Danh sách túi máu sắp hết hạn (FEFO) & Cơ cấu Loại chế phẩm */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bảng Top túi máu sắp hết hạn cần ưu tiên xuất (7 cột) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#190072] flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Túi máu cần ưu tiên xuất trước (FEFO)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Các túi máu có hạn dùng gần nhất (cần xuất trước để tránh hết hạn)
              </p>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('inventory')}
              className="text-xs font-semibold text-[#C5299B] hover:underline inline-flex items-center gap-1"
            >
              <span>Xem kho</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {expiringLots.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Không có túi máu nào trong diện cảnh báo hạn dùng. Tất cả sinh phẩm đều an toàn!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-left">
                    <th className="py-2 px-2.5">Mã túi máu</th>
                    <th className="py-2 px-2.5">Chế phẩm</th>
                    <th className="py-2 px-2.5 text-center">Nhóm máu</th>
                    <th className="py-2 px-2.5 text-center">Hạn dùng</th>
                    <th className="py-2 px-2.5 text-center">Cảnh báo</th>
                    <th className="py-2 px-2.5 text-right">SL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {expiringLots.slice(0, 5).map((lot) => {
                    const badge = getExpiryBadgeInfo(lot.days_remaining, systemConfig?.expiry_warning_milestones);
                    return (
                      <tr key={lot.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-2.5 font-mono font-semibold text-[#C5299B]">
                          {lot.blood_code || '---'}
                        </td>
                        <td className="py-2.5 px-2.5 text-slate-800 font-medium">
                          {lot.product_name}
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-[#fdf2fa] text-[#190072] font-medium border border-[#f5c6e8]">
                            {lot.blood_group}{lot.rh_factor}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-center text-slate-600">
                          {formatDate(lot.expiry_date)}
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          <span
                            style={{
                              backgroundColor: badge.bgColor,
                              color: badge.textColor,
                              borderColor: badge.borderColor,
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
                          >
                            <span>{badge.text}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-bold text-slate-900">
                          {lot.quantity}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tồn kho theo Loại chế phẩm máu (5 cột) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#190072] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#C5299B]" />
                Tồn kho theo Loại chế phẩm
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Số lượng túi máu theo từng loại sinh phẩm</p>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
            {productDistribution.map((p) => {
              const pQty = Number(p.quantity) || 0;
              const pPercent = totalUnits > 0 ? Math.round((pQty / totalUnits) * 100) : 0;

              return (
                <div key={p.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{p.name}</span>
                    <span className="font-bold text-[#190072]">
                      {pQty} túi <span className="text-slate-400 font-normal">({pPercent}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="bg-[#C5299B] h-full rounded-full transition-all duration-300"
                      style={{ width: `${pPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Thông tin Kỳ kiểm kê gần nhất nếu có quyền */}
          {canAudit && latestAudit && (
            <div className="pt-3 border-t border-slate-100">
              <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-purple-900 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-purple-700" />
                    <span>Đợt kiểm kê gần nhất: {latestAudit.code}</span>
                  </div>
                  <div className="text-[11px] text-purple-700/80 mt-0.5">
                    {latestAudit.name} — Ngày: {formatDate(latestAudit.audit_date)}
                  </div>
                </div>
                <button
                  onClick={() => onNavigate && onNavigate('audit')}
                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-[11px] transition shrink-0"
                >
                  Xem kiểm kê
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
