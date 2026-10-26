import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Printer,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Calendar,
  PackagePlus,
  ArrowUpRight,
  User,
  Clock,
  FileText,
  Filter,
  Droplet,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import PrintSlipModal from '../components/PrintSlipModal';
import Pagination from '../components/Pagination';
import {
  CancelApproveModal,
  CancelRejectModal,
} from '../components/CancelModals';

export default function CancellationApprovalView() {
  const { hasPermission, refreshPendingSummary } = useAuth();

  const canApproveImport = hasPermission('import.cancel_approve');
  const canApproveExport = hasPermission('export.cancel_approve');

  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [statusTab, setStatusTab] = useState('PENDING_CANCEL'); // 'PENDING_CANCEL' | 'CANCELLED' | 'REJECTED' | 'ALL'
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'IMPORT' | 'EXPORT'
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Targets for approval / rejection modals
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [printTx, setPrintTx] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!message && !error) return;
    const timer = setTimeout(() => {
      setMessage('');
      setError('');
    }, 3500);
    return () => clearTimeout(timer);
  }, [message, error]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      // Lấy tất cả các giao dịch IMPORT và EXPORT
      const res = await api.get('/transactions?tx_type=IMPORT,EXPORT');
      setTransactions(res.data || []);
      refreshPendingSummary?.();
    } catch (err) {
      console.error(err);
      setError('Lỗi khi tải danh sách phiếu yêu cầu duyệt hủy');
    } finally {
      setLoading(false);
    }
  }, [refreshPendingSummary]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Lọc chỉ lấy các phiếu có liên quan đến việc hủy:
  // - Đang chờ duyệt hủy (PENDING_CANCEL)
  // - Đã hủy (CANCELLED)
  // - Đã từng bị từ chối hủy (cancel_reject_reason)
  const cancellationRecords = useMemo(() => {
    return transactions.filter(
      (tx) =>
        tx.status === 'PENDING_CANCEL' ||
        tx.status === 'CANCELLED' ||
        Boolean(tx.cancel_requested_by) ||
        Boolean(tx.cancel_reject_reason)
    );
  }, [transactions]);

  // Đếm các số liệu thống kê
  const counts = useMemo(() => {
    let pending = 0;
    let pendingImport = 0;
    let pendingExport = 0;
    let cancelled = 0;
    let rejected = 0;

    for (const tx of cancellationRecords) {
      if (tx.status === 'PENDING_CANCEL') {
        pending++;
        if (tx.tx_type === 'IMPORT') pendingImport++;
        if (tx.tx_type === 'EXPORT') pendingExport++;
      } else if (tx.status === 'CANCELLED') {
        cancelled++;
      } else if (tx.cancel_reject_reason) {
        rejected++;
      }
    }

    return {
      all: cancellationRecords.length,
      pending,
      pendingImport,
      pendingExport,
      cancelled,
      rejected,
    };
  }, [cancellationRecords]);

  // Bộ lọc danh sách hiển thị
  const filteredRecords = useMemo(() => {
    let list = cancellationRecords;

    // Lọc theo Tab trạng thái
    if (statusTab === 'PENDING_CANCEL') {
      list = list.filter((tx) => tx.status === 'PENDING_CANCEL');
    } else if (statusTab === 'CANCELLED') {
      list = list.filter((tx) => tx.status === 'CANCELLED');
    } else if (statusTab === 'REJECTED') {
      list = list.filter((tx) => tx.status === 'COMPLETED' && Boolean(tx.cancel_reject_reason));
    }

    // Lọc theo loại phiếu
    if (typeFilter !== 'ALL') {
      list = list.filter((tx) => tx.tx_type === typeFilter);
    }

    // Tìm kiếm từ khóa
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (tx) =>
          (tx.code && tx.code.toLowerCase().includes(q)) ||
          (tx.cancel_reason && tx.cancel_reason.toLowerCase().includes(q)) ||
          (tx.cancel_requester_name && tx.cancel_requester_name.toLowerCase().includes(q)) ||
          (tx.partner_name && tx.partner_name.toLowerCase().includes(q)) ||
          (tx.department_info && tx.department_info.toLowerCase().includes(q)) ||
          (tx.person_name && tx.person_name.toLowerCase().includes(q)) ||
          (tx.creator_name && tx.creator_name.toLowerCase().includes(q)) ||
          (tx.items &&
            tx.items.some(
              (it) =>
                (it.blood_code && it.blood_code.toLowerCase().includes(q)) ||
                (it.product_name && it.product_name.toLowerCase().includes(q))
            ))
      );
    }

    // Sắp xếp: Phiếu chờ duyệt hủy đưa lên đầu, sau đó sắp theo thời gian yêu cầu mới nhất
    return [...list].sort((a, b) => {
      if (a.status === 'PENDING_CANCEL' && b.status !== 'PENDING_CANCEL') return -1;
      if (a.status !== 'PENDING_CANCEL' && b.status === 'PENDING_CANCEL') return 1;
      const dateA = new Date(a.cancel_requested_at || a.tx_date || 0);
      const dateB = new Date(b.cancel_requested_at || b.tx_date || 0);
      return dateB - dateA;
    });
  }, [cancellationRecords, statusTab, typeFilter, searchQuery]);

  // Xử lý Duyệt hủy
  const handleApproveConfirm = async () => {
    if (!approveTarget) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/transactions/${approveTarget.id}/cancel-approve`);
      setMessage(res.data.message || `Đã duyệt hủy phiếu ${approveTarget.code} thành công`);
      setApproveTarget(null);
      fetchTransactions();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi khi duyệt hủy phiếu');
    } finally {
      setActionLoading(false);
    }
  };

  // Xử lý Từ chối duyệt hủy
  const handleRejectConfirm = async (rejectReason) => {
    if (!rejectTarget) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/transactions/${rejectTarget.id}/cancel-reject`, {
        reject_reason: rejectReason,
      });
      setMessage(res.data.message || `Đã từ chối hủy phiếu ${rejectTarget.code}`);
      setRejectTarget(null);
      fetchTransactions();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi khi từ chối yêu cầu hủy');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Thông báo kết quả thao tác */}
      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight truncate">
              Duyệt Hủy Phiếu
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block truncate">
              Xét duyệt hoàn nguyên kho cho các yêu cầu hủy phiếu Nhập & Xuất
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right sm:hidden">
            <span className="text-xs font-bold text-amber-600 block leading-tight">
              {counts.pending}
            </span>
            <span className="text-[10px] text-slate-400 block leading-tight">chờ duyệt</span>
          </div>

          <button
            type="button"
            onClick={fetchTransactions}
            title="Làm mới dữ liệu"
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. Hàng Card Thống kê chỉ số */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
        {/* Card 1: Tổng chờ duyệt */}
        <div
          onClick={() => {
            setStatusTab('PENDING_CANCEL');
            setTypeFilter('ALL');
            setCurrentPage(1);
          }}
          className={`group relative overflow-hidden p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer bg-gradient-to-br from-[#fffbeb] via-[#fef3c7]/60 to-[#fef0bc]/70 ${
            statusTab === 'PENDING_CANCEL' && typeFilter === 'ALL'
              ? 'border-amber-500 ring-2 ring-amber-500/25 shadow-md scale-[1.01]'
              : 'border-amber-200 hover:border-amber-300 hover:shadow-xs'
          }`}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-amber-300/30 blur-xl pointer-events-none" />
          <AlertTriangle className="absolute -right-3 -bottom-3 w-16 h-16 sm:w-20 sm:h-20 text-amber-600 opacity-[0.07] pointer-events-none transform rotate-6 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-900 uppercase tracking-wider block truncate">
                  Tổng chờ duyệt
                </span>
                {counts.pending > 0 && (
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
                <span className="text-xl sm:text-3xl font-black text-amber-700 tracking-tight">
                  {counts.pending}
                </span>
                <span className="text-[10px] sm:text-xs font-medium text-amber-700/70">phiếu</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-amber-800/70 mt-0.5 truncate hidden sm:block">
                Cả phiếu nhập & xuất
              </p>
            </div>
            <div
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                statusTab === 'PENDING_CANCEL' && typeFilter === 'ALL'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white/80 text-amber-700 border border-amber-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* Card 2: Nhập kho chờ duyệt */}
        <div
          onClick={() => {
            setStatusTab('PENDING_CANCEL');
            setTypeFilter('IMPORT');
            setCurrentPage(1);
          }}
          className={`group relative overflow-hidden p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer bg-gradient-to-br from-[#eff6ff] via-[#e0f2fe] to-[#dbeafe] ${
            statusTab === 'PENDING_CANCEL' && typeFilter === 'IMPORT'
              ? 'border-sky-600 ring-2 ring-sky-600/20 shadow-md scale-[1.01]'
              : 'border-sky-200/70 hover:border-sky-300 hover:shadow-xs'
          }`}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-sky-200/40 blur-xl pointer-events-none" />
          <PackagePlus className="absolute -right-3 -bottom-3 w-16 h-16 sm:w-20 sm:h-20 text-sky-600 opacity-[0.06] pointer-events-none transform -rotate-12 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-sky-800 uppercase tracking-wider block truncate">
                Nhập chờ duyệt
              </span>
              <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
                <span className="text-xl sm:text-3xl font-black text-sky-700 tracking-tight">
                  {counts.pendingImport}
                </span>
                <span className="text-[10px] sm:text-xs font-medium text-sky-600/70">phiếu</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-sky-700/70 mt-0.5 truncate hidden sm:block">
                Hoàn nguyên trừ kho
              </p>
            </div>
            <div
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                statusTab === 'PENDING_CANCEL' && typeFilter === 'IMPORT'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white/80 text-sky-700 border border-sky-200'
              }`}
            >
              <PackagePlus className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* Card 3: Xuất máu chờ duyệt */}
        <div
          onClick={() => {
            setStatusTab('PENDING_CANCEL');
            setTypeFilter('EXPORT');
            setCurrentPage(1);
          }}
          className={`group relative overflow-hidden p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer bg-gradient-to-br from-[#faf5ff] via-[#f3e8ff] to-[#e9d5ff] ${
            statusTab === 'PENDING_CANCEL' && typeFilter === 'EXPORT'
              ? 'border-purple-600 ring-2 ring-purple-600/20 shadow-md scale-[1.01]'
              : 'border-purple-200 hover:border-purple-300 hover:shadow-xs'
          }`}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-purple-200/40 blur-xl pointer-events-none" />
          <ArrowUpRight className="absolute -right-3 -bottom-3 w-16 h-16 sm:w-20 sm:h-20 text-purple-600 opacity-[0.06] pointer-events-none transform -rotate-6 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-purple-800 uppercase tracking-wider block truncate">
                Xuất chờ duyệt
              </span>
              <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
                <span className="text-xl sm:text-3xl font-black text-purple-700 tracking-tight">
                  {counts.pendingExport}
                </span>
                <span className="text-[10px] sm:text-xs font-medium text-purple-600/70">phiếu</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-purple-700/70 mt-0.5 truncate hidden sm:block">
                Hoàn trả lại tồn kho
              </p>
            </div>
            <div
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                statusTab === 'PENDING_CANCEL' && typeFilter === 'EXPORT'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white/80 text-purple-700 border border-purple-200'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* Card 4: Đã duyệt hủy */}
        <div
          onClick={() => {
            setStatusTab('CANCELLED');
            setTypeFilter('ALL');
            setCurrentPage(1);
          }}
          className={`group relative overflow-hidden p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer bg-gradient-to-br from-[#fff1f2] via-[#ffe4e6]/60 to-[#fedfe3] ${
            statusTab === 'CANCELLED' && typeFilter === 'ALL'
              ? 'border-rose-600 ring-2 ring-rose-600/20 shadow-md scale-[1.01]'
              : 'border-rose-200 hover:border-rose-300 hover:shadow-xs'
          }`}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-rose-200/40 blur-xl pointer-events-none" />
          <XCircle className="absolute -right-3 -bottom-3 w-16 h-16 sm:w-20 sm:h-20 text-rose-600 opacity-[0.06] pointer-events-none transform -rotate-12 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-rose-900 uppercase tracking-wider block truncate">
                Đã duyệt hủy
              </span>
              <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
                <span className="text-xl sm:text-3xl font-black text-rose-700 tracking-tight">
                  {counts.cancelled}
                </span>
                <span className="text-[10px] sm:text-xs text-rose-700/70 font-medium">phiếu</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-rose-700/70 mt-0.5 truncate hidden sm:block">
                Đã hoàn nguyên tồn kho
              </p>
            </div>
            <div
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                statusTab === 'CANCELLED' && typeFilter === 'ALL'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white/80 text-rose-700 border border-rose-200'
              }`}
            >
              <XCircle className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Danh sách Phiếu Cần Duyệt Hủy */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Bộ lọc thanh Tab & Tìm kiếm */}
        <div className="p-3 sm:px-6 sm:py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto text-xs pb-1 lg:pb-0">
            <button
              type="button"
              onClick={() => { setStatusTab('PENDING_CANCEL'); setCurrentPage(1); }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                statusTab === 'PENDING_CANCEL'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Chờ duyệt</span>
              <span className="font-bold">({counts.pending})</span>
            </button>
            <button
              type="button"
              onClick={() => { setStatusTab('CANCELLED'); setCurrentPage(1); }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                statusTab === 'CANCELLED'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Đã hủy</span>
              <span className="font-bold">({counts.cancelled})</span>
            </button>
            <button
              type="button"
              onClick={() => { setStatusTab('REJECTED'); setCurrentPage(1); }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                statusTab === 'REJECTED'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Từ chối</span>
              <span className="font-bold">({counts.rejected})</span>
            </button>
            <button
              type="button"
              onClick={() => { setStatusTab('ALL'); setCurrentPage(1); }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold transition whitespace-nowrap shrink-0 ${
                statusTab === 'ALL'
                  ? 'bg-[#190072] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ({counts.all})
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Lọc theo loại phiếu */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs shrink-0">
              <button
                type="button"
                onClick={() => { setTypeFilter('ALL'); setCurrentPage(1); }}
                className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-lg font-medium transition text-center ${
                  typeFilter === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cả hai
              </button>
              <button
                type="button"
                onClick={() => { setTypeFilter('IMPORT'); setCurrentPage(1); }}
                className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-lg font-medium transition text-center ${
                  typeFilter === 'IMPORT' ? 'bg-white text-sky-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nhập kho
              </button>
              <button
                type="button"
                onClick={() => { setTypeFilter('EXPORT'); setCurrentPage(1); }}
                className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-lg font-medium transition text-center ${
                  typeFilter === 'EXPORT' ? 'bg-white text-purple-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Xuất máu
              </button>
            </div>

            {/* Ô tìm kiếm */}
            <div className="w-full sm:w-60 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm mã phiếu, lý do hủy..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-[#C5299B] outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* --- MOBILE CARD LIST (md:hidden) --- */}
        <div className="md:hidden divide-y-2 divide-slate-200">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
              <p className="text-xs">Đang tải danh sách phiếu cần duyệt hủy...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              {searchQuery
                ? 'Không tìm thấy phiếu nào khớp từ khóa tìm kiếm.'
                : statusTab === 'PENDING_CANCEL'
                ? 'Tuyệt vời! Hiện tại không có phiếu nào đang chờ duyệt hủy.'
                : 'Không có bản ghi yêu cầu hủy nào phù hợp.'}
            </div>
          ) : (
            filteredRecords
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((tx, idx) => {
                const isImport = tx.tx_type === 'IMPORT';
                const canApproveThis = isImport ? canApproveImport : canApproveExport;
                const isOdd = idx % 2 === 1;

                let cardBg = isOdd ? 'bg-slate-100/90 border-l-4 border-l-slate-400' : 'bg-white border-l-4 border-l-[#190072]';
                if (tx.status === 'PENDING_CANCEL') {
                  cardBg = isOdd ? 'bg-amber-100/70 border-l-4 border-l-amber-500' : 'bg-amber-50/70 border-l-4 border-l-amber-500';
                } else if (tx.status === 'CANCELLED') {
                  cardBg = isOdd ? 'bg-rose-100/70 border-l-4 border-l-rose-500' : 'bg-rose-50/70 border-l-4 border-l-rose-500';
                }

                return (
                  <div
                    key={tx.id}
                    onClick={() => setPrintTx(tx)}
                    className={`p-3 space-y-2.5 transition active:scale-[0.99] cursor-pointer ${cardBg}`}
                  >
                    {/* Dòng 1: Mã phiếu + Loại + Trạng thái */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-mono text-xs font-bold ${tx.status === 'CANCELLED' ? 'line-through text-slate-400' : 'text-[#190072]'}`}>
                          {tx.code}
                        </span>
                        {isImport ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 shrink-0">
                            <PackagePlus className="w-3 h-3" />
                            Nhập
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                            <ArrowUpRight className="w-3 h-3" />
                            Xuất
                          </span>
                        )}
                      </div>

                      <div>
                        {tx.status === 'PENDING_CANCEL' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            Chờ duyệt
                          </span>
                        ) : tx.status === 'CANCELLED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                            <XCircle className="w-3 h-3" />
                            Đã hủy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            Hoàn thành
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dòng 2: Thời gian lập & Người yêu cầu hủy */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white/70 p-2 rounded-lg border border-slate-200/80">
                      <div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>Lập: {new Date(tx.tx_date).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div className="font-medium text-slate-700 mt-0.5 truncate">
                          Bởi: {tx.creator_name || 'KTV'}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <User className="w-3 h-3" />
                          <span className="truncate">Xin hủy: {tx.cancel_requester_name || 'KTV'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {tx.cancel_requested_at ? new Date(tx.cancel_requested_at).toLocaleDateString('vi-VN') : '---'}
                        </div>
                      </div>
                    </div>

                    {/* Dòng 3: Lý do xin hủy */}
                    <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200/90 text-xs text-amber-950 italic">
                      <span className="font-semibold text-amber-900 not-italic">Lý do: </span>
                      "{tx.cancel_reason || 'Không ghi rõ lý do'}"
                    </div>

                    {tx.cancel_reject_reason && (
                      <div className="p-1.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[11px]">
                        <span className="font-semibold text-slate-700">Từ chối: </span>"{tx.cancel_reject_reason}"
                      </div>
                    )}

                    {/* Dòng 4: Tóm tắt chế phẩm trong phiếu */}
                    <div className="bg-slate-50/90 rounded-xl p-2 border border-slate-200 text-xs space-y-1">
                      {(tx.items || []).slice(0, 2).map((it, itemIdx) => (
                        <div
                          key={it.id || itemIdx}
                          className={`flex items-center justify-between gap-1 p-1 rounded ${
                            itemIdx % 2 === 0 ? 'bg-white' : 'bg-slate-100/90'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="px-1.5 py-0.5 rounded bg-[#fce7f6] text-[#190072] font-semibold text-[10px]">
                              {it.blood_group}{it.rh_factor}
                            </span>
                            <span className="truncate font-medium text-slate-700">
                              {it.product_name}
                            </span>
                            <span className="text-slate-400 text-[10px] shrink-0">
                              ({it.volume_name || '250ml'})
                            </span>
                          </div>
                          <span className="font-bold text-[#C5299B] shrink-0">
                            x{it.quantity}
                          </span>
                        </div>
                      ))}
                      {(tx.items || []).length > 2 && (
                        <div className="text-[10px] text-slate-500 text-center font-medium pt-0.5">
                          +{(tx.items || []).length - 2} chế phẩm khác...
                        </div>
                      )}
                    </div>

                    {/* Dòng 5: Tổng SL & Nút thao tác */}
                    <div
                      className="flex items-center justify-between pt-1 border-t border-slate-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5">
                        <Droplet className="w-3.5 h-3.5 text-[#C5299B]" />
                        <span className="text-xs text-slate-500">Tổng SL:</span>
                        <span className="text-xs font-bold text-[#C5299B]">
                          {tx.total_quantity}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPrintTx(tx)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1 shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Chi tiết</span>
                        </button>

                        {tx.status === 'PENDING_CANCEL' && canApproveThis && (
                          <>
                            <button
                              type="button"
                              onClick={() => setApproveTarget(tx)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Duyệt</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectTarget(tx)}
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Từ chối</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* --- DESKTOP TABLE (hidden md:block) --- */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                <th className="py-3 px-4 text-left">Mã phiếu</th>
                <th className="py-3 px-3 text-center">Loại phiếu</th>
                <th className="py-3 px-4 text-left">Thời gian lập</th>
                <th className="py-3 px-4 text-left">Người yêu cầu & Thời gian</th>
                <th className="py-3 px-4 text-left">Lý do xin hủy</th>
                <th className="py-3 px-4 text-left">Chế phẩm trong phiếu</th>
                <th className="py-3 px-3 text-center">Tổng SL</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Đang tải danh sách phiếu cần duyệt hủy...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    {searchQuery
                      ? 'Không tìm thấy phiếu nào khớp với từ khóa tìm kiếm.'
                      : statusTab === 'PENDING_CANCEL'
                      ? 'Tuyệt vời! Hiện tại không có phiếu nào đang chờ duyệt hủy.'
                      : 'Không có bản ghi yêu cầu hủy nào phù hợp.'}
                  </td>
                </tr>
              ) : (
                filteredRecords
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((tx) => {
                    const isImport = tx.tx_type === 'IMPORT';
                    const canApproveThis = isImport ? canApproveImport : canApproveExport;

                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setPrintTx(tx)}
                        title="Bấm để xem chi tiết phiếu"
                        className={`cursor-pointer transition ${
                          tx.status === 'PENDING_CANCEL'
                            ? 'bg-amber-50/20 hover:bg-amber-50/50'
                            : tx.status === 'CANCELLED'
                            ? 'bg-rose-50/20 hover:bg-rose-50/40 opacity-80'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Mã phiếu */}
                        <td className="py-3 px-4 font-mono font-medium text-[#190072]">
                          <span className={tx.status === 'CANCELLED' ? 'line-through text-slate-400' : ''}>
                            {tx.code}
                          </span>
                        </td>

                        {/* Loại phiếu */}
                        <td className="py-3 px-3 text-center">
                          {isImport ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                              <PackagePlus className="w-3.5 h-3.5" />
                              Nhập kho
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              Xuất máu
                            </span>
                          )}
                        </td>

                        {/* Thời gian lập phiếu */}
                        <td className="py-3 px-4 text-xs text-slate-600">
                          <div>{new Date(tx.tx_date).toLocaleString('vi-VN')}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Lập bởi: {tx.creator_name || 'KTV'}
                          </div>
                        </td>

                        {/* Người yêu cầu & thời gian */}
                        <td className="py-3 px-4 text-xs text-slate-700">
                          <div className="font-semibold text-slate-800">
                            {tx.cancel_requester_name || 'Kỹ thuật viên'}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {tx.cancel_requested_at
                              ? new Date(tx.cancel_requested_at).toLocaleString('vi-VN')
                              : '---'}
                          </div>
                        </td>

                        {/* Lý do xin hủy */}
                        <td className="py-3 px-4 text-xs">
                          <div className="max-w-xs p-2 rounded-lg bg-amber-50/60 border border-amber-200/80 text-amber-950 italic">
                            "{tx.cancel_reason || 'Không ghi rõ lý do'}"
                          </div>
                          {tx.cancel_reject_reason && (
                            <div className="max-w-xs mt-1 p-1.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[11px]">
                              Từ chối: "{tx.cancel_reject_reason}"
                            </div>
                          )}
                        </td>

                        {/* Chi tiết chế phẩm */}
                        <td className="py-3 px-4">
                          <div className="space-y-1 max-w-sm">
                            {(tx.items || []).slice(0, 2).map((it, idx) => (
                              <div key={it.id || idx} className="text-xs flex items-center gap-1.5 flex-wrap">
                                {it.blood_code && (
                                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-medium border border-blue-200">
                                    Mã: {it.blood_code}
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 rounded bg-[#fce7f6] text-[#190072] font-semibold">
                                  {it.blood_group}
                                  {it.rh_factor}
                                </span>
                                <span className="text-slate-800">
                                  {it.product_name} ({it.volume_name || '250ml'})
                                </span>
                                <span className="text-[#C5299B] font-semibold">x{it.quantity}</span>
                                {idx === 1 && (tx.items || []).length > 2 && (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-xs border border-slate-300 ml-1"
                                    title={`Còn ${(tx.items || []).length - 2} chế phẩm khác.`}
                                  >
                                    ... (+{(tx.items || []).length - 2})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Tổng SL */}
                        <td className="py-3 px-3 text-center text-base font-bold text-[#C5299B]">
                          {tx.total_quantity}
                        </td>

                        {/* Trạng thái */}
                        <td className="py-3 px-3 text-center">
                          {tx.status === 'PENDING_CANCEL' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Chờ duyệt hủy
                            </span>
                          ) : tx.status === 'CANCELLED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                              <XCircle className="w-3.5 h-3.5" />
                              Đã hủy
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Hoàn thành
                            </span>
                          )}
                        </td>

                        {/* Thao tác */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setPrintTx(tx)}
                              title="Xem chi tiết phiếu / In phiếu"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {tx.status === 'PENDING_CANCEL' && canApproveThis && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setApproveTarget(tx)}
                                  title="Duyệt hủy phiếu này (Hoàn nguyên kho)"
                                  className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRejectTarget(tx)}
                                  title="Từ chối yêu cầu hủy"
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 transition"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={filteredRecords.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Modal In & Chi tiết phiếu */}
      {printTx && (
        <PrintSlipModal
          transaction={printTx}
          onClose={() => setPrintTx(null)}
          canApproveCancel={printTx.tx_type === 'IMPORT' ? canApproveImport : canApproveExport}
          canCancelRequest={false}
          onApproveCancel={(tx) => setApproveTarget(tx)}
          onRejectCancel={(tx) => setRejectTarget(tx)}
        />
      )}

      {/* Modal Xác nhận Duyệt hủy */}
      <CancelApproveModal
        isOpen={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        onApprove={handleApproveConfirm}
        loading={actionLoading}
        transaction={approveTarget}
      />

      {/* Modal Từ chối Duyệt hủy */}
      <CancelRejectModal
        isOpen={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        onReject={handleRejectConfirm}
        loading={actionLoading}
        transaction={rejectTarget}
      />
    </div>
  );
}
