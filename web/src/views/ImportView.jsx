import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  PackagePlus,
  Plus,
  Trash2,
  Printer,
  CheckCircle2,
  Calendar,
  Building2,
  User,
  Save,
  RefreshCw,
  X,
  Search,
  RotateCcw,
  AlertTriangle,
  XCircle,
  Bell,
  FileText,
  CalendarDays,
  ShieldAlert,
  Camera,
  Barcode,
  Clock,
  Droplet,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import PrintSlipModal from '../components/PrintSlipModal';
import DateInput from '../components/DateInput';
import QuickAddPartnerModal from '../components/QuickAddPartnerModal';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import {
  CancelRequestModal,
  CancelApproveModal,
  CancelRejectModal,
} from '../components/CancelModals';

export default function ImportView({ onNavigate }) {
  const { categories, hasPermission, refreshPendingSummary } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [printTx, setPrintTx] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerHistoryOpen, setScannerHistoryOpen] = useState(false);

  // Cancellation state
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'PENDING_CANCEL' | 'CANCELLED'
  const [cancelRequestTarget, setCancelRequestTarget] = useState(null);
  const [cancelApproveTarget, setCancelApproveTarget] = useState(null);
  const [cancelRejectTarget, setCancelRejectTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const canCancelRequest = hasPermission('import.cancel_request') || hasPermission('import.delete');
  const canApproveCancel = hasPermission('import.cancel_approve');

  useEffect(() => {
    if (!message && !error) return;
    const timer = setTimeout(() => {
      setMessage('');
      setError('');
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, error]);

  const defaultExpiry = (shelfLifeDays = 30, baseDateStr = null) => {
    const base = baseDateStr ? new Date(baseDateStr) : new Date();
    const d = isNaN(base.getTime()) ? new Date() : base;
    d.setDate(d.getDate() + (Number(shelfLifeDays) || 30));
    return d.toISOString().slice(0, 10);
  };

  const formatDate = (dStr) => {
    if (!dStr) return '';
    const d = new Date(dStr);
    return isNaN(d) ? dStr : d.toLocaleDateString('vi-VN');
  };

  // Header slip state
  const [partnerId, setPartnerId] = useState('');
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  const [personName, setPersonName] = useState('');
  const [note, setNote] = useState('');

  // Table items state
  const [items, setItems] = useState([]);

  // Quick-entry draft state
  const [draftBloodCode, setDraftBloodCode] = useState('');
  const [draftProductId, setDraftProductId] = useState('');
  const [draftBloodGroup, setDraftBloodGroup] = useState('O');
  const [draftRh, setDraftRh] = useState('+');
  const [draftVolumeId, setDraftVolumeId] = useState('');
  const [draftCollectionDate, setDraftCollectionDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [draftExpiryDate, setDraftExpiryDate] = useState(defaultExpiry(30));
  const [draftQty, setDraftQty] = useState(1);
  const [draftNote, setDraftNote] = useState('');

  const handleCollectionDateChange = (eOrVal) => {
    const val = typeof eOrVal === 'string' ? eOrVal : eOrVal?.target?.value ?? '';
    setDraftCollectionDate(val);
    if (val) {
      const dt = new Date(val);
      if (!isNaN(dt.getTime())) {
        const prod = categories.bloodProducts.find((p) => String(p.id) === String(draftProductId));
        const shelfDays = Number(prod?.shelf_life_days) || 35;
        dt.setDate(dt.getDate() + shelfDays);
        setDraftExpiryDate(dt.toISOString().slice(0, 10));
      }
    }
  };

  const bloodCodeInputRef = useRef(null);
  const productSelectRef = useRef(null);
  const bloodGroupRef = useRef(null);
  const rhRef = useRef(null);
  const collectionDateRef = useRef(null);
  const expiryDateRef = useRef(null);
  const qtyInputRef = useRef(null);
  const noteInputRef = useRef(null);
  const addBtnRef = useRef(null);

  useEffect(() => {
    if (draftProductId) {
      const prod = categories.bloodProducts.find((p) => String(p.id) === String(draftProductId));
      if (prod) {
        const prodVolMl = prod.volume_ml || 250;
        const matchingVol = categories.volumes.find((v) => Number(v.volume_ml) === Number(prodVolMl));
        if (matchingVol) {
          setDraftVolumeId(matchingVol.id);
        } else if (categories.volumes.length) {
          setDraftVolumeId(categories.volumes[0].id);
        }
      }
    } else if (categories.volumes.length && !draftVolumeId) {
      setDraftVolumeId(categories.volumes[1]?.id || categories.volumes[0]?.id || '');
    }
  }, [draftProductId, categories.bloodProducts, categories.volumes, draftVolumeId]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/transactions?tx_type=IMPORT');
      setHistory(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') setShowForm(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showForm]);

  const counts = useMemo(() => {
    let completed = 0;
    let pending = 0;
    let cancelled = 0;
    let thisMonth = 0;
    let thisMonthUnits = 0;
    let thisMonthCompleted = 0;
    let thisMonthPending = 0;
    let thisMonthCancelled = 0;

    const now = new Date();
    const curM = now.getMonth();
    const curY = now.getFullYear();

    for (const tx of history) {
      const isPending = tx.status === 'PENDING_CANCEL';
      const isCancelled = tx.status === 'CANCELLED';
      const isCompleted = !isPending && !isCancelled;

      if (isPending) pending++;
      else if (isCancelled) cancelled++;
      else completed++;

      if (tx.tx_date) {
        const d = new Date(tx.tx_date);
        if (!isNaN(d.getTime()) && d.getMonth() === curM && d.getFullYear() === curY) {
          thisMonth++;
          thisMonthUnits += Number(tx.total_quantity || 0);

          if (isPending) thisMonthPending++;
          else if (isCancelled) thisMonthCancelled++;
          else thisMonthCompleted++;
        }
      }
    }
    return {
      all: history.length,
      completed,
      pending,
      cancelled,
      thisMonth,
      thisMonthUnits,
      thisMonthCompleted,
      thisMonthPending,
      thisMonthCancelled,
    };
  }, [history]);

  const filteredHistory = useMemo(() => {
    let list = history;
    if (statusFilter !== 'ALL') {
      const now = new Date();
      const curM = now.getMonth();
      const curY = now.getFullYear();
      const inThisMonth = (tx) => {
        if (!tx.tx_date) return false;
        const d = new Date(tx.tx_date);
        return !isNaN(d.getTime()) && d.getMonth() === curM && d.getFullYear() === curY;
      };

      if (statusFilter === 'THIS_MONTH') {
        list = list.filter(inThisMonth);
      } else if (statusFilter === 'COMPLETED') {
        list = list.filter((tx) => inThisMonth(tx) && (!tx.status || tx.status === 'COMPLETED'));
      } else if (statusFilter === 'PENDING_CANCEL') {
        list = list.filter((tx) => inThisMonth(tx) && tx.status === 'PENDING_CANCEL');
      } else if (statusFilter === 'CANCELLED') {
        list = list.filter((tx) => inThisMonth(tx) && tx.status === 'CANCELLED');
      } else {
        list = list.filter((tx) => tx.status === statusFilter);
      }
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (tx) =>
        (tx.code && tx.code.toLowerCase().includes(q)) ||
        (tx.partner_name && tx.partner_name.toLowerCase().includes(q)) ||
        (tx.person_name && tx.person_name.toLowerCase().includes(q)) ||
        (tx.creator_name && tx.creator_name.toLowerCase().includes(q)) ||
        (tx.cancel_reason && tx.cancel_reason.toLowerCase().includes(q)) ||
        (tx.items &&
          tx.items.some(
            (it) =>
              (it.blood_code && it.blood_code.toLowerCase().includes(q)) ||
              (it.product_name && it.product_name.toLowerCase().includes(q))
          ))
    );
  }, [history, searchQuery, statusFilter]);

  const handleCancelRequestSubmit = async (reason) => {
    if (!cancelRequestTarget) return;
    setCancelLoading(true);
    try {
      const res = await api.post(`/transactions/${cancelRequestTarget.id}/cancel-request`, { reason });
      setMessage(res.data.message || 'Đã gửi yêu cầu hủy phiếu thành công');
      setCancelRequestTarget(null);
      if (printTx?.id === cancelRequestTarget.id) {
        setPrintTx((prev) => ({
          ...prev,
          status: 'PENDING_CANCEL',
          cancel_reason: reason,
          cancel_requested_at: new Date().toISOString(),
        }));
      }
      fetchHistory();
      refreshPendingSummary?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi gửi yêu cầu hủy phiếu');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCancelApproveSubmit = async () => {
    if (!cancelApproveTarget) return;
    setCancelLoading(true);
    try {
      const res = await api.post(`/transactions/${cancelApproveTarget.id}/cancel-approve`);
      setMessage(res.data.message || 'Duyệt hủy phiếu thành công');
      setCancelApproveTarget(null);
      if (printTx?.id === cancelApproveTarget.id) {
        setPrintTx((prev) => ({
          ...prev,
          status: 'CANCELLED',
          cancel_approved_at: new Date().toISOString(),
        }));
      }
      fetchHistory();
      refreshPendingSummary?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi duyệt hủy phiếu');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCancelRejectSubmit = async (rejectReason) => {
    if (!cancelRejectTarget) return;
    setCancelLoading(true);
    try {
      const res = await api.post(`/transactions/${cancelRejectTarget.id}/cancel-reject`, { reject_reason: rejectReason });
      setMessage(res.data.message || 'Đã từ chối yêu cầu hủy phiếu');
      setCancelRejectTarget(null);
      if (printTx?.id === cancelRejectTarget.id) {
        setPrintTx((prev) => ({
          ...prev,
          status: 'COMPLETED',
          cancel_reject_reason: rejectReason,
        }));
      }
      fetchHistory();
      refreshPendingSummary?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi từ chối hủy phiếu');
    } finally {
      setCancelLoading(false);
    }
  };

  const formatPersonName = (str = '') =>
    String(str)
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(
        (word) =>
          word.charAt(0).toLocaleUpperCase('vi-VN') +
          word.slice(1).toLocaleLowerCase('vi-VN')
      )
      .join(' ');

  const activeProducts = useMemo(
    () => categories.bloodProducts.filter((bp) => bp.is_active),
    [categories.bloodProducts]
  );

  const handleDraftProductChange = (val) => {
    setDraftProductId(val);
    const prod = categories.bloodProducts.find((p) => String(p.id) === String(val));
    if (prod?.shelf_life_days) {
      setDraftExpiryDate(defaultExpiry(prod.shelf_life_days, draftCollectionDate));
    }
  };

  const handleAddToImportList = () => {
    const cleanBloodCode = draftBloodCode.trim().toUpperCase();
    if (!cleanBloodCode) {
      setError('Vui lòng nhập Mã máu cho bịch chế phẩm');
      bloodCodeInputRef.current?.focus();
      return;
    }
    // Kiểm tra tính duy nhất: mỗi bịch chỉ có 1 mã trong danh sách nhập này
    const isDup = items.some(
      (it) => it.blood_code && it.blood_code.toUpperCase() === cleanBloodCode
    );
    if (isDup) {
      setError(`Mã máu "${cleanBloodCode}" đã có trong danh sách nhập này (mỗi bịch chỉ có 1 mã)!`);
      bloodCodeInputRef.current?.focus();
      return;
    }

    if (!draftProductId) {
      productSelectRef.current?.focus();
      return;
    }
    const parsedQty = parseInt(draftQty, 10);
    if (!parsedQty || parsedQty <= 0) {
      qtyInputRef.current?.focus();
      return;
    }
    if (!draftExpiryDate) {
      return;
    }
    if (draftCollectionDate && draftExpiryDate && new Date(draftExpiryDate) < new Date(draftCollectionDate)) {
      setError('Hạn sử dụng không thể trước ngày lấy máu!');
      return;
    }

    const prod = categories.bloodProducts.find(
      (p) => String(p.id) === String(draftProductId)
    );
    const prodVolMl = prod?.volume_ml || 250;
    const vol = categories.volumes.find(
      (v) => String(v.id) === String(draftVolumeId) || Number(v.volume_ml) === Number(prodVolMl)
    );
    const resolvedVolumeId = vol?.id || draftVolumeId || (categories.volumes[0]?.id || 1);
    const resolvedVolumeName = vol?.name || `${prodVolMl}ml`;

    setItems((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        blood_code: cleanBloodCode,
        collection_date: draftCollectionDate || null,
        blood_product_id: draftProductId,
        product_name: prod?.name || '',
        product_code: prod?.code || '',
        unit_name: prod?.unit_name || 'Đơn vị',
        blood_group: draftBloodGroup,
        rh_factor: draftRh,
        volume_id: resolvedVolumeId,
        volume_name: resolvedVolumeName,
        expiry_date: draftExpiryDate,
        quantity: parsedQty,
        note: draftNote.trim(),
      },
    ]);

    setDraftBloodCode('');
    setDraftProductId('');
    setDraftQty(1);
    setDraftNote('');
    setTimeout(() => {
      bloodCodeInputRef.current?.focus();
    }, 50);
  };

  const removeItemRow = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleItemCollectionDateChange = (id, newDate) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        let newExpiry = it.expiry_date;
        if (newDate) {
          const dt = new Date(newDate);
          if (!isNaN(dt.getTime())) {
            const prod = categories.bloodProducts.find((p) => String(p.id) === String(it.blood_product_id));
            const shelfDays = Number(prod?.shelf_life_days) || 35;
            dt.setDate(dt.getDate() + shelfDays);
            newExpiry = dt.toISOString().slice(0, 10);
          }
        }
        return { ...it, collection_date: newDate, expiry_date: newExpiry };
      })
    );
  };

  const handleItemExpiryDateChange = (id, newDate) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, expiry_date: newDate } : it))
    );
  };

  const handleOpenNewImportForm = () => {
    const today = new Date().toISOString().slice(0, 10);
    setDraftCollectionDate(today);
    setDraftExpiryDate(defaultExpiry(30, today));
    setDraftBloodCode('');
    setDraftProductId('');
    setDraftQty(1);
    setDraftNote('');
    setShowForm(true);
    setMessage('');
    setError('');
  };

  const handleReImportCancelledSlip = async (tx) => {
    try {
      setLoading(true);
      const res = await api.get(`/transactions/${tx.id}`);
      const fullTx = res.data;
      setPartnerId(fullTx.partner_id || '');
      setPersonName(fullTx.person_name || '');
      setNote(fullTx.note ? `Nhập lại từ phiếu ${fullTx.code}: ${fullTx.note}` : `Nhập lại từ phiếu ${fullTx.code}`);

      const today = new Date().toISOString().slice(0, 10);
      setDraftCollectionDate(today);
      setDraftExpiryDate(defaultExpiry(30, today));

      const reItems = (fullTx.items || []).map((it) => {
        const itemCollectionDate = it.collection_date
          ? String(it.collection_date).slice(0, 10)
          : today;
        const itemExpiryDate = it.expiry_date
          ? String(it.expiry_date).slice(0, 10)
          : defaultExpiry(35, itemCollectionDate);
        return {
          id: Date.now() + Math.random(),
          blood_code: it.blood_code || '',
          collection_date: itemCollectionDate,
          blood_product_id: it.blood_product_id,
          product_name: it.product_name || '',
          product_code: it.product_code || '',
          unit_name: it.unit_name || 'Đơn vị',
          blood_group: it.blood_group,
          rh_factor: it.rh_factor,
          volume_id: it.volume_id,
          volume_name: it.volume_name || '',
          expiry_date: itemExpiryDate,
          quantity: it.quantity || 1,
          note: it.note || '',
        };
      });

      setItems(reItems);
      setShowForm(true);
      setMessage(`Đã nạp dữ liệu từ phiếu đã hủy ${fullTx.code}. Bạn có thể kiểm tra và chọn lại ngày lấy máu trước khi nhập.`);
    } catch (err) {
      console.error(err);
      setError('Không thể tải thông tin phiếu hủy để nhập lại');
    } finally {
      setLoading(false);
    }
  };

  const totalImportQty = useMemo(
    () => items.reduce((sum, it) => sum + Number(it.quantity || 0), 0),
    [items]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!partnerId) {
      setError('Vui lòng chọn đơn vị cung cấp (đối tác)');
      return;
    }
    if (items.length === 0) {
      setError('Vui lòng thêm ít nhất 1 lô chế phẩm vào danh sách nhập');
      return;
    }
    setMessage('');
    setError('');
    const formattedName = formatPersonName(personName);
    setPersonName(formattedName);
    try {
      const res = await api.post('/transactions/import', {
        partner_id: partnerId || null,
        person_name: formattedName,
        note,
        items: items.map((it) => ({
          blood_code: it.blood_code || null,
          collection_date: it.collection_date || null,
          blood_product_id: it.blood_product_id,
          blood_group: it.blood_group,
          rh_factor: it.rh_factor,
          volume_id: it.volume_id,
          expiry_date: it.expiry_date,
          quantity: it.quantity,
          note: it.note,
        })),
      });
      setMessage(`${res.data.message} (Mã phiếu: ${res.data.code})`);
      setItems([]);
      setNote('');
      setShowForm(false);
      fetchHistory();
      const detail = await api.get(`/transactions/${res.data.id}`);
      setPrintTx(detail.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi khi nhập kho');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Toolbar */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#fdf2fa] text-[#C5299B] flex items-center justify-center shrink-0">
            <PackagePlus className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="section-title text-sm sm:text-base font-bold text-[#190072] truncate">
              Danh sách phiếu nhập
            </h2>
            <p className="text-xs text-slate-500 hidden sm:block">
              Quản lý và theo dõi các đợt nhập túi máu vào kho lưu trữ ({history.length} phiếu)
            </p>
            <p className="text-[11px] text-slate-500 sm:hidden">
              Tổng: {history.length} phiếu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchHistory}
            className="p-2 sm:p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {hasPermission('import.create') && (
            <button
              type="button"
              onClick={handleOpenNewImportForm}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm bg-[#C5299B] hover:bg-[#a82083] text-white"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Nhập</span>
            </button>
          )}
        </div>
      </div>

      {/* Cards thống kê */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3.5">
        {/* Card 1: Tổng phiếu */}
        <div
          onClick={() => {
            setStatusFilter('ALL');
            setCurrentPage(1);
          }}
          className={`group relative overflow-hidden p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer bg-gradient-to-br from-[#f8f6fc] via-[#f3eefb] to-[#ede7f8] ${
            statusFilter === 'ALL'
              ? 'border-[#190072] ring-2 ring-[#190072]/20 shadow-md scale-[1.01]'
              : 'border-indigo-100/90 hover:border-indigo-300 hover:shadow-xs'
          }`}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-indigo-200/30 blur-xl pointer-events-none" />
          <FileText className="absolute -right-3 -bottom-3 w-20 h-20 text-[#190072] opacity-[0.05] pointer-events-none transform -rotate-12 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-2.5">
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#190072]/70 uppercase tracking-wider block">
                Tổng phiếu
              </span>
              <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
                <span className="text-xl sm:text-3xl font-black text-[#190072] tracking-tight">
                  {counts.all}
                </span>
                <span className="text-xs font-medium text-[#190072]/60">phiếu</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate hidden xs:block">
                Tất cả đợt nhập kho
              </p>
            </div>
            <div
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-[#190072] text-white shadow-xs'
                  : 'bg-white/80 text-[#190072] border border-[#190072]/15'
              }`}
            >
              <FileText className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* Card 2: Nhập trong tháng */}
        <div
          onClick={() => {
            setStatusFilter('THIS_MONTH');
            setCurrentPage(1);
          }}
          className={`group relative overflow-hidden p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer bg-gradient-to-br from-[#eff6ff] via-[#e0f2fe] to-[#dbeafe] ${
            statusFilter === 'THIS_MONTH'
              ? 'border-sky-600 ring-2 ring-sky-600/20 shadow-md scale-[1.01]'
              : 'border-sky-200/70 hover:border-sky-300 hover:shadow-xs'
          }`}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-sky-200/40 blur-xl pointer-events-none" />
          <CalendarDays className="absolute -right-3 -bottom-3 w-20 h-20 text-sky-600 opacity-[0.06] pointer-events-none transform -rotate-12 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-2.5">
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-sky-800 uppercase tracking-wider block">
                Trong tháng
              </span>
              <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
                <span className="text-xl sm:text-3xl font-black text-sky-700 tracking-tight">
                  {counts.thisMonth}
                </span>
                <span className="text-xs font-medium text-sky-600/70">phiếu</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-sky-700 bg-sky-200/80 px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded-full ml-0.5">
                  Th{new Date().getMonth() + 1}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-sky-700/70 mt-0.5 truncate hidden xs:block">
                {counts.thisMonthUnits > 0 ? `${counts.thisMonthUnits} đơn vị máu` : `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`}
              </p>
            </div>
            <div
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                statusFilter === 'THIS_MONTH'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white/80 text-sky-700 border border-sky-200'
              }`}
            >
              <CalendarDays className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* Card 3: Hoàn thành (Thống kê trong tháng) */}
        <div
          onClick={() => {
            setStatusFilter('COMPLETED');
            setCurrentPage(1);
          }}
          className={`group relative overflow-hidden p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer bg-gradient-to-br from-[#f0fdf4] via-[#ecfdf5] to-[#e1f9eb] ${
            statusFilter === 'COMPLETED'
              ? 'border-emerald-600 ring-2 ring-emerald-600/20 shadow-md scale-[1.01]'
              : 'border-emerald-200/70 hover:border-emerald-300 hover:shadow-xs'
          }`}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-emerald-200/40 blur-xl pointer-events-none" />
          <CheckCircle2 className="absolute -right-3 -bottom-3 w-20 h-20 text-emerald-600 opacity-[0.06] pointer-events-none transform -rotate-6 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-2.5">
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                Hoàn thành
              </span>
              <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
                <span className="text-xl sm:text-3xl font-black text-emerald-700 tracking-tight">
                  {counts.thisMonthCompleted}
                </span>
                <span className="text-xs font-medium text-emerald-600/70">phiếu</span>
                {counts.thisMonth > 0 && (
                  <span className="text-[9px] sm:text-[10px] font-bold text-emerald-700 bg-emerald-200/70 px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded-full ml-0.5">
                    {Math.round((counts.thisMonthCompleted / counts.thisMonth) * 100)}%
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-emerald-700/70 mt-0.5 truncate hidden xs:block">
                Hoàn thành trong tháng
              </p>
            </div>
            <div
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                statusFilter === 'COMPLETED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white/80 text-emerald-700 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* Card 4: Chờ duyệt hủy (Thống kê trong tháng) */}
        <div
          onClick={() => {
            setStatusFilter('PENDING_CANCEL');
            setCurrentPage(1);
          }}
          className={`group relative overflow-hidden p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer bg-gradient-to-br from-[#fffbeb] via-[#fef3c7]/60 to-[#fef0bc]/70 ${
            statusFilter === 'PENDING_CANCEL'
              ? 'border-amber-500 ring-2 ring-amber-500/25 shadow-md scale-[1.01]'
              : 'border-amber-200 hover:border-amber-300 hover:shadow-xs'
          }`}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-amber-300/30 blur-xl pointer-events-none" />
          <AlertTriangle className="absolute -right-3 -bottom-3 w-20 h-20 text-amber-600 opacity-[0.07] pointer-events-none transform rotate-6 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                  Chờ duyệt
                </span>
                {counts.thisMonthPending > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
                <span className="text-xl sm:text-3xl font-black text-amber-700 tracking-tight">
                  {counts.thisMonthPending}
                </span>
                <span className="text-xs font-medium text-amber-700/70">phiếu</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-amber-800/70 mt-0.5 truncate hidden xs:block">
                {counts.thisMonthPending > 0 ? 'Đang chờ duyệt' : 'Chờ duyệt'}
              </p>
            </div>
            <div
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                statusFilter === 'PENDING_CANCEL'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white/80 text-amber-700 border border-amber-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* Card 5: Đã hủy (Thống kê trong tháng) */}
        <div
          onClick={() => {
            setStatusFilter('CANCELLED');
            setCurrentPage(1);
          }}
          className={`col-span-2 sm:col-span-1 group relative overflow-hidden p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer bg-gradient-to-br from-[#fff1f2] via-[#ffe4e6]/60 to-[#fedfe3] ${
            statusFilter === 'CANCELLED'
              ? 'border-rose-600 ring-2 ring-rose-600/20 shadow-md scale-[1.01]'
              : 'border-rose-200 hover:border-rose-300 hover:shadow-xs'
          }`}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-rose-200/40 blur-xl pointer-events-none" />
          <XCircle className="absolute -right-3 -bottom-3 w-20 h-20 text-rose-600 opacity-[0.06] pointer-events-none transform -rotate-12 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-2.5">
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-rose-900 uppercase tracking-wider block">
                Đã hủy
              </span>
              <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
                <span className="text-xl sm:text-3xl font-black text-rose-700 tracking-tight">
                  {counts.thisMonthCancelled}
                </span>
                <span className="text-xs text-rose-700/70 font-medium">phiếu</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-rose-700/70 mt-0.5 truncate hidden xs:block">
                Đã hủy trong tháng
              </p>
            </div>
            <div
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                statusFilter === 'CANCELLED'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white/80 text-rose-700 border border-rose-200'
              }`}
            >
              <XCircle className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Thông báo kết quả khi đóng form */}
      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && !showForm && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Drawer trượt ra từ bên phải khi bấm "Nhập chế phẩm" */}
      {hasPermission('import.create') && showForm && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop overlay làm mờ nền */}
          {/* Backdrop (Không tự đóng khi click ra ngoài vùng để tránh mất dữ liệu đang nhập dở) */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
            <div className="w-screen max-w-4xl sm:max-w-5xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              {/* Header Drawer */}
              <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#fdf2fa] text-[#C5299B] flex items-center justify-center shrink-0">
                    <PackagePlus className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-[#190072] truncate">
                      Tạo phiếu nhập chế phẩm máu
                    </h3>
                    <p className="text-xs text-slate-500 hidden sm:block">
                      Nhập thông tin đối tác và thêm các bịch chế phẩm máu vào kho
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                  title="Đóng (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form body có thanh cuộn riêng */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col justify-between">
                <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5">
                  {error && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm">
                      {error}
                    </div>
                  )}

                  {/* Thông tin Đối tác & Người giao máu */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs text-slate-600 flex items-center gap-1 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-[#C5299B]" />
                          Đơn vị cung cấp (Đối tác) <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setAddPartnerOpen(true)}
                          className="text-xs text-[#C5299B] hover:underline flex items-center gap-0.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Thêm mới
                        </button>
                      </div>
                      <SearchableSelect
                        value={partnerId}
                        onChange={(val) => setPartnerId(val)}
                        options={categories.partners.map((p) => ({
                          value: p.id,
                          label: p.name,
                          subLabel: p.code,
                        }))}
                        placeholder="Hãy chọn đơn vị cung cấp"
                        required
                        onAddNew={() => setAddPartnerOpen(true)}
                        addNewLabel="Thêm mới đơn vị đối tác..."
                        className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-yellow-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 mb-1.5 flex items-center gap-1 font-medium">
                        <User className="w-3.5 h-3.5 text-[#C5299B]" />
                        Người giao máu
                      </label>
                      <input
                        type="text"
                        value={personName}
                        onChange={(e) => setPersonName(e.target.value)}
                        onBlur={() => setPersonName(formatPersonName(personName))}
                        placeholder="Nhập họ tên người bàn giao..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 mb-1.5 font-medium">
                        Ghi chú phiếu nhập
                      </label>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Nhập ghi chú phiếu nhập..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                  </div>

                  {/* Thanh nhập nhanh chế phẩm (Chọn chế phẩm -> Nhập SL -> Enter hoặc bấm nút +) */}
                  <div className="p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="text-xs font-bold text-[#190072]">
                      Chọn chế phẩm đưa vào danh sách nhập (Nhấn Enter hoặc bấm nút +)
                    </div>

                    {/* Hàng 1: Mã máu & Loại chế phẩm */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
                      {/* 1. Mã máu */}
                      <div className="w-full sm:w-[170px] shrink-0">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs text-slate-600 font-medium">
                            Mã máu (Túi/Bịch) <span className="text-rose-600 font-bold">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setScannerOpen(true)}
                            className="text-[11px] text-[#C5299B] font-semibold flex items-center gap-1 hover:underline"
                          >
                            <Camera className="w-3 h-3" />
                            <span>Camera</span>
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            ref={bloodCodeInputRef}
                            type="text"
                            value={draftBloodCode}
                            onChange={(e) => setDraftBloodCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!draftProductId) {
                                  productSelectRef.current?.focus();
                                } else {
                                  handleAddToImportList();
                                }
                              }
                            }}
                            placeholder="Nhập mã máu..."
                            className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-300 bg-yellow-50 text-sm uppercase font-semibold text-[#190072] placeholder:font-sans placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 placeholder:text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setScannerOpen(true)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-[#C5299B] hover:bg-[#C5299B]/10 rounded-lg active:scale-95 transition"
                            title="Quét mã vạch túi máu bằng Camera"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* 2. Loại chế phẩm máu */}
                      <div className="w-full sm:flex-1 sm:min-w-[200px]">
                        <label className="block text-xs text-slate-600 mb-1 font-medium">
                          Loại chế phẩm máu
                        </label>
                        <SearchableSelect
                          ref={productSelectRef}
                          value={draftProductId}
                          onChange={(val) => handleDraftProductChange(val)}
                          onAfterSelect={() => {
                            setTimeout(() => {
                              bloodGroupRef.current?.focus();
                            }, 20);
                          }}
                          options={(activeProducts.length
                            ? activeProducts
                            : categories.bloodProducts
                          ).map((bp) => ({
                            value: bp.id,
                            label: `${bp.name} (${bp.code})`,
                            subLabel: bp.unit_name ? `ĐVT: ${bp.unit_name}` : '',
                          }))}
                          placeholder="Hãy nhập loại chế phẩm máu"
                          className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-yellow-50"
                        />
                      </div>
                    </div>

                    {/* Hàng 2: Nhóm ABO, Hệ Rh, Thể tích (3 cột cân đối trên mobile) */}
                    <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-end gap-2 sm:gap-2.5">
                      {/* 3. Nhóm ABO */}
                      <div className="col-span-1 sm:w-[95px]">
                        <label className="block text-xs text-slate-600 mb-1 font-medium">
                          Nhóm ABO
                        </label>
                        <select
                          ref={bloodGroupRef}
                          value={draftBloodGroup}
                          onChange={(e) => setDraftBloodGroup(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              rhRef.current?.focus();
                            }
                          }}
                          className="w-full px-2 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-yellow-50 cursor-pointer"
                        >
                          <option value="O">Nhóm O</option>
                          <option value="A">Nhóm A</option>
                          <option value="B">Nhóm B</option>
                          <option value="AB">Nhóm AB</option>
                        </select>
                      </div>

                      {/* 4. Hệ Rh */}
                      <div className="col-span-1 sm:w-[85px]">
                        <label className="block text-xs text-slate-600 mb-1 font-medium">
                          Hệ Rh
                        </label>
                        <select
                          ref={rhRef}
                          value={draftRh}
                          onChange={(e) => setDraftRh(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              collectionDateRef.current?.focus();
                            }
                          }}
                          className="w-full px-2 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-yellow-50 cursor-pointer"
                        >
                          <option value="+">Rh(+)</option>
                          <option value="-">Rh(-)</option>
                        </select>
                      </div>

                      {/* 5. Thể tích */}
                      <div className="col-span-1 sm:w-[95px]">
                        <label className="block text-xs text-slate-600 mb-1 font-medium">
                          Thể tích
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={
                            draftProductId
                              ? `${categories.bloodProducts.find((p) => String(p.id) === String(draftProductId))?.volume_ml || 250} ml`
                              : ''
                          }
                          placeholder="250 ml"
                          tabIndex={-1}
                          className="w-full px-1.5 sm:px-2 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-yellow-50 text-slate-800 font-medium text-center cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Hàng 2b: Ngày lấy máu & Hạn sử dụng (2 cột cân đối trên mobile) */}
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2 sm:gap-2.5">
                      {/* 6. Ngày lấy máu */}
                      <div className="col-span-1 sm:w-[135px]">
                        <label className="block text-xs text-slate-600 mb-1 font-medium">
                          Ngày lấy máu
                        </label>
                        <DateInput
                          ref={collectionDateRef}
                          value={draftCollectionDate}
                          onChange={handleCollectionDateChange}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              expiryDateRef.current?.focus();
                            }
                          }}
                          className="px-2 sm:px-2.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-yellow-50"
                        />
                      </div>

                      {/* 7. Hạn sử dụng */}
                      <div className="col-span-1 sm:w-[135px]">
                        <label className="block text-xs text-slate-600 mb-1 font-medium">
                          Hạn sử dụng
                        </label>
                        <DateInput
                          ref={expiryDateRef}
                          value={draftExpiryDate}
                          onChange={(e) => setDraftExpiryDate(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              qtyInputRef.current?.focus();
                              qtyInputRef.current?.select();
                            }
                          }}
                          className="px-2 sm:px-2.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-yellow-50"
                        />
                      </div>
                    </div>

                    {/* Hàng 3: SL nhập, Ghi chú, Nút + (Cùng 1 hàng trên mobile) */}
                    <div className="flex items-end gap-2 sm:gap-2.5 pt-1">
                      {/* 8. Số lượng nhập */}
                      <div className="w-[85px] sm:w-[80px] shrink-0">
                        <label className="block text-xs text-slate-600 mb-1 font-medium">
                          SL nhập
                        </label>
                        <input
                          ref={qtyInputRef}
                          type="number"
                          min={1}
                          value={draftQty}
                          onChange={(e) => setDraftQty(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              noteInputRef.current?.focus();
                            }
                          }}
                          className="w-full px-2 py-2 rounded-xl border border-slate-300 bg-yellow-50 text-center text-sm font-bold text-[#190072]"
                        />
                      </div>

                      {/* 9. Ghi chú */}
                      <div className="flex-1 min-w-0">
                        <label className="block text-xs text-slate-600 mb-1 font-medium">
                          Ghi chú dòng
                        </label>
                        <input
                          ref={noteInputRef}
                          type="text"
                          value={draftNote}
                          onChange={(e) => setDraftNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddToImportList();
                            }
                          }}
                          placeholder="Ghi chú..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:border-[#C5299B] focus:ring-2 focus:ring-[#C5299B]/20 outline-none transition"
                        />
                      </div>

                      {/* 10. Nút + */}
                      <div className="shrink-0">
                        <button
                          ref={addBtnRef}
                          type="button"
                          onClick={handleAddToImportList}
                          disabled={!draftProductId}
                          title="Đưa vào danh sách nhập (Enter hoặc +)"
                          className="w-[42px] sm:w-[44px] h-[38px] rounded-xl bg-[#C5299B] hover:bg-[#a82083] disabled:opacity-40 text-white flex items-center justify-center shadow-sm transition active:scale-95"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Danh sách lô chế phẩm máu nhập kho */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-3.5 sm:px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                      <span className="section-title text-xs font-bold text-[#190072]">
                        Danh sách lô chế phẩm nhập kho ({items.length} dòng — Tổng:{' '}
                        {totalImportQty} đơn vị)
                      </span>
                    </div>

                    {/* Danh sách trên Di động (md:hidden) */}
                    <div className="md:hidden divide-y divide-slate-100 bg-white">
                      {items.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-xs px-4">
                          Chưa có chế phẩm nào trong danh sách nhập. Chọn chế phẩm ở trên và bấm dấu (+) hoặc nhấn Enter.
                        </div>
                      ) : (
                        items.map((it, idx) => (
                          <div key={it.id} className="p-3 flex items-center justify-between gap-2.5">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                                {it.blood_code && (
                                  <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-mono text-[11px] font-semibold border border-blue-200 shrink-0">
                                    {it.blood_code}
                                  </span>
                                )}
                                <span className="px-1.5 py-0.2 rounded bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8] text-[11px] font-bold shrink-0">
                                  {it.blood_group}{it.rh_factor}
                                </span>
                                <span className="text-xs font-semibold text-slate-900 truncate">
                                  {it.product_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                                <span>{it.volume_name || '250 ml'}</span>
                                {it.collection_date && <span>• Lấy: {formatDate(it.collection_date)}</span>}
                                <span>• HSD: {formatDate(it.expiry_date)}</span>
                                {it.note && <span className="italic text-slate-400">• {it.note}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-sm font-bold text-[#C5299B]">x{it.quantity}</span>
                              <button
                                type="button"
                                onClick={() => removeItemRow(it.id)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                                title="Xóa khỏi danh sách nhập"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Bảng trên Màn hình Máy tính (hidden md:block) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full min-w-[960px] table-fixed text-sm">
                        <thead>
                          <tr className="bg-slate-100/70 text-slate-600 text-xs border-b border-slate-200">
                            <th className="py-2.5 px-3 text-center w-[4%]">#</th>
                            <th className="py-2.5 px-3 text-left w-[12%]">Mã máu</th>
                            <th className="py-2.5 px-3 text-left w-[17%]">
                              Loại chế phẩm máu
                            </th>
                            <th className="py-2.5 px-2 text-center w-[7%]">
                              Nhóm máu
                            </th>
                            <th className="py-2.5 px-2 text-center w-[7%]">
                              Thể tích
                            </th>
                            <th className="py-2.5 px-2 text-center w-[8%]">
                              Đơn vị tính
                            </th>
                            <th className="py-2.5 px-2 text-center w-[13%]">
                              Ngày lấy máu
                            </th>
                            <th className="py-2.5 px-2 text-center w-[13%]">
                              Hạn sử dụng
                            </th>
                            <th className="py-2.5 px-2 text-center w-[6%]">
                              Số lượng
                            </th>
                            <th className="py-2.5 px-3 text-left w-[9%]">
                              Ghi chú
                            </th>
                            <th className="py-2.5 px-2 text-center w-[4%]"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.length === 0 ? (
                            <tr>
                              <td
                                colSpan={11}
                                className="py-8 text-center text-xs text-slate-400 italic"
                              >
                                Chưa có chế phẩm nào trong danh sách nhập. Hãy chọn chế phẩm ở thanh phía trên và bấm dấu (+) hoặc nhấn Enter.
                              </td>
                            </tr>
                          ) : (
                            items.map((it, idx) => (
                              <tr key={it.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 text-center text-xs text-slate-500">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-mono text-xs font-bold text-[#190072] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    {it.blood_code || '---'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-normal text-slate-800">
                                  <span className="font-medium text-[#190072]">
                                    {it.product_name}
                                  </span>
                                  {it.product_code && (
                                    <span className="text-xs text-slate-400 ml-1.5">
                                      ({it.product_code})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <span className="px-2 py-0.5 rounded-lg bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8] text-xs font-semibold">
                                    {it.blood_group}
                                    {it.rh_factor}
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 text-center text-xs text-slate-700">
                                  {it.volume_name || '---'}
                                </td>
                                <td className="py-2.5 px-2 text-center text-xs text-slate-600">
                                  {it.unit_name || 'Đơn vị'}
                                </td>
                                <td className="py-1.5 px-1.5 text-center">
                                  <DateInput
                                    value={it.collection_date}
                                    onChange={(e) => handleItemCollectionDateChange(it.id, e.target.value)}
                                    placeholder="dd/MM/yyyy"
                                    className="px-2 py-1 rounded-lg border border-slate-300 text-xs bg-yellow-50/70 focus:bg-white text-center"
                                  />
                                </td>
                                <td className="py-1.5 px-1.5 text-center">
                                  <DateInput
                                    value={it.expiry_date}
                                    onChange={(e) => handleItemExpiryDateChange(it.id, e.target.value)}
                                    placeholder="dd/MM/yyyy"
                                    className="px-2 py-1 rounded-lg border border-slate-300 text-xs bg-yellow-50/70 focus:bg-white text-center"
                                  />
                                </td>
                                <td className="py-2.5 px-2 text-center font-bold text-[#C5299B]">
                                  {it.quantity}
                                </td>
                                <td className="py-2.5 px-3 text-xs text-slate-600 truncate" title={it.note}>
                                  {it.note || '---'}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeItemRow(it.id)}
                                    title="Xóa dòng này"
                                    className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Footer dính đáy Drawer */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm hover:bg-white transition"
                  >
                    Đóng / Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={items.length === 0}
                    className="flex items-center gap-2 px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-[#C5299B] hover:bg-[#a82083] disabled:opacity-40 text-white text-xs sm:text-sm font-medium shadow-sm transition"
                  >
                    <Save className="w-4 h-4" />
                    Lưu phiếu
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Lịch sử Phiếu Nhập Kho (Mặc định hiển thị danh sách này) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <h3 className="section-title text-sm font-bold text-[#190072] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#C5299B] shrink-0" />
            <span>Danh sách phiếu đã nhập ({filteredHistory.length})</span>
          </h3>
          <div className="w-full sm:w-72">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm mã phiếu, người giao, đối tác..."
                className="w-full pl-9 pr-9 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-[#C5299B] outline-none transition"
              />
              <button
                type="button"
                onClick={() => setScannerHistoryOpen(true)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-[#C5299B] hover:bg-slate-200/50 rounded-lg active:scale-95 transition"
                title="Quét mã vạch tìm kiếm phiếu"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Status filter tabs - Tối ưu icon và nhãn gọn gàng cho di động */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 bg-slate-50/70 border-b border-slate-200 overflow-x-auto text-xs">
          <span className="text-slate-500 font-medium whitespace-nowrap hidden sm:inline">Trạng thái:</span>
          <button
            type="button"
            onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition shrink-0 ${
              statusFilter === 'ALL'
                ? 'bg-[#190072] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Tất cả ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('THIS_MONTH'); setCurrentPage(1); }}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition flex items-center gap-1 shrink-0 ${
              statusFilter === 'THIS_MONTH'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white text-sky-700 hover:bg-sky-50 border border-slate-200'
            }`}
            title="Trong tháng"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Trong tháng</span>
            <span>({counts.thisMonth})</span>
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('COMPLETED'); setCurrentPage(1); }}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition flex items-center gap-1 shrink-0 ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-slate-200'
            }`}
            title="Hoàn thành"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Hoàn thành</span>
            <span>({counts.completed})</span>
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('PENDING_CANCEL'); setCurrentPage(1); }}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition flex items-center gap-1 shrink-0 ${
              statusFilter === 'PENDING_CANCEL'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white text-amber-700 hover:bg-amber-50 border border-slate-200'
            }`}
            title="Chờ duyệt hủy"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chờ duyệt hủy</span>
            <span className="sm:hidden">Chờ duyệt</span>
            <span>({counts.pending})</span>
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('CANCELLED'); setCurrentPage(1); }}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition flex items-center gap-1 shrink-0 ${
              statusFilter === 'CANCELLED'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white text-rose-700 hover:bg-rose-50 border border-slate-200'
            }`}
            title="Đã hủy"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Đã hủy</span>
            <span>({counts.cancelled})</span>
          </button>
        </div>

        {/* 1. Giao diện Thẻ dành riêng cho Màn hình Di động (md:hidden) */}
        <div className="md:hidden divide-y-2 divide-slate-200">
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Đang tải danh sách phiếu nhập kho...
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs px-4">
              {searchQuery ? 'Không tìm thấy phiếu nào khớp với từ khóa tìm kiếm.' : 'Chưa có phiếu nhập kho nào.'}
            </div>
          ) : (
            filteredHistory
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((tx, rowIdx) => {
                const isEven = rowIdx % 2 === 0;
                return (
                  <div
                    key={tx.id}
                    onClick={() => setPrintTx(tx)}
                    className={`p-3.5 transition active:bg-slate-200/70 cursor-pointer ${
                      tx.status === 'CANCELLED'
                        ? 'bg-rose-50/70 border-l-4 border-l-rose-500'
                        : tx.status === 'PENDING_CANCEL'
                        ? 'bg-amber-50/70 border-l-4 border-l-amber-500'
                        : isEven
                        ? 'bg-white border-l-4 border-l-[#190072]'
                        : 'bg-slate-100/90 border-l-4 border-l-indigo-400'
                    }`}
                  >
                    {/* Dòng 1: Mã phiếu + Thời gian + Trạng thái */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-mono text-xs font-bold ${
                            tx.status === 'CANCELLED' ? 'line-through text-slate-400' : 'text-[#190072]'
                          }`}>
                            {tx.code}
                          </span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            {new Date(tx.tx_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                            {new Date(tx.tx_date).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </div>

                      {/* Badge trạng thái ngắn gọn có icon */}
                      {tx.status === 'PENDING_CANCEL' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                          <AlertTriangle className="w-3 h-3" />
                          Chờ duyệt
                        </span>
                      ) : tx.status === 'CANCELLED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300 shrink-0">
                          <XCircle className="w-3 h-3" />
                          Đã hủy
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          Hoàn thành
                        </span>
                      )}
                    </div>

                    {/* Dòng 2: Đơn vị cung cấp & Người giao */}
                    {(tx.partner_name || tx.person_name) && (
                      <div className="flex items-center gap-3 text-xs text-slate-600 mb-2.5 flex-wrap">
                        {tx.partner_name && (
                          <div className="flex items-center gap-1 text-slate-800 font-semibold">
                            <Building2 className="w-3.5 h-3.5 text-[#C5299B] shrink-0" />
                            <span className="truncate">{tx.partner_name}</span>
                          </div>
                        )}
                        {tx.person_name && (
                          <div className="flex items-center gap-1 text-slate-600">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{tx.person_name}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Dòng 3: Chi tiết các túi máu nhập */}
                    <div className="space-y-1.5 bg-slate-50/90 rounded-xl p-2 border border-slate-200 text-xs shadow-2xs">
                      {(tx.items || []).slice(0, 3).map((it, idx) => (
                        <div
                          key={it.id || idx}
                          className={`flex items-center justify-between gap-2 p-1.5 rounded-lg border ${
                            idx % 2 === 0
                              ? 'bg-white border-slate-200/80'
                              : 'bg-slate-100/90 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            {it.blood_code && (
                              <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-mono text-[11px] font-semibold border border-blue-200 shrink-0">
                                Mã: {it.blood_code}
                              </span>
                            )}
                            <span className="px-1.5 py-0.2 rounded bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8] font-bold text-[11px] shrink-0">
                              {it.blood_group}{it.rh_factor}
                            </span>
                            <span className="text-slate-800 font-medium truncate">
                              {it.product_name}
                            </span>
                            <span className="text-slate-400 text-[11px] shrink-0">
                              ({it.volume_name})
                            </span>
                            {it.collection_date && (
                              <span className="text-slate-500 text-[10px] shrink-0">
                                • Lấy: {formatDate(it.collection_date)}
                              </span>
                            )}
                            <span className="text-slate-500 text-[10px] shrink-0">
                              • HSD: {formatDate(it.expiry_date)}
                            </span>
                          </div>
                          <div className="flex items-center shrink-0">
                            <span className="text-[#C5299B] font-bold text-xs">x{it.quantity}</span>
                          </div>
                        </div>
                      ))}

                      {(tx.items || []).length > 3 && (
                        <div className="text-[11px] text-slate-500 font-medium text-right pt-0.5">
                          +{(tx.items || []).length - 3} chế phẩm khác (chạm để xem hết)...
                        </div>
                      )}
                    </div>

                    {/* Dòng 4: Tổng SL, Người lập & Nút thao tác */}
                    <div className="flex items-center justify-between mt-2.5 pt-1 text-xs">
                      <div className="flex items-center gap-2 text-slate-500">
                        <span className="flex items-center gap-1 font-medium">
                          <Droplet className="w-3.5 h-3.5 text-[#C5299B]" />
                          <span>Tổng: <strong className="text-[#C5299B] font-bold">{tx.total_quantity}</strong> túi</span>
                        </span>
                        {tx.creator_name && (
                          <span className="text-[11px] text-slate-400 truncate">• {tx.creator_name}</span>
                        )}
                      </div>

                      {/* Các nút thao tác nhanh */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setPrintTx(tx)}
                          title="In phiếu / Xem chi tiết"
                          className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shadow-2xs transition"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {tx.status === 'PENDING_CANCEL' && canApproveCancel && (
                          <>
                            <button
                              type="button"
                              onClick={() => setCancelApproveTarget(tx)}
                              title="Duyệt hủy phiếu"
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCancelRejectTarget(tx)}
                              title="Từ chối hủy"
                              className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 transition"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {(!tx.status || tx.status === 'COMPLETED') && canCancelRequest && (
                          <button
                            type="button"
                            onClick={() => setCancelRequestTarget(tx)}
                            title="Yêu cầu hủy phiếu"
                            className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* 2. Giao diện Bảng dành riêng cho Màn hình Máy tính (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                <th className="py-3 px-4 text-left">Mã phiếu</th>
                <th className="py-3 px-4 text-left">Thời gian nhập</th>
                <th className="py-3 px-4 text-left">Đơn vị cung cấp</th>
                <th className="py-3 px-4 text-left">Người giao</th>
                <th className="py-3 px-4 text-left">Chi tiết chế phẩm nhập</th>
                <th className="py-3 px-4 text-center">Tổng SL</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-left">Người lập</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Đang tải danh sách phiếu nhập kho...
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    {searchQuery ? 'Không tìm thấy phiếu nào khớp với từ khóa tìm kiếm.' : 'Chưa có phiếu nhập kho nào.'}
                  </td>
                </tr>
              ) : (
                filteredHistory
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((tx) => (
                    <tr
                      key={tx.id}
                      onClick={() => setPrintTx(tx)}
                      title="Bấm để xem chi tiết phiếu"
                      className={`cursor-pointer transition ${
                        tx.status === 'CANCELLED'
                          ? 'bg-rose-50/30 hover:bg-rose-50/50 opacity-80'
                          : tx.status === 'PENDING_CANCEL'
                          ? 'bg-amber-50/30 hover:bg-amber-50/60'
                          : 'hover:bg-[#fce7f6]/60'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-[#190072]">
                        <span className={tx.status === 'CANCELLED' ? 'line-through text-slate-400' : ''}>
                          {tx.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {new Date(tx.tx_date).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        {tx.partner_name || '---'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{tx.person_name || '---'}</td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {(tx.items || []).slice(0, 2).map((it, idx) => (
                            <div key={it.id} className="text-xs flex items-center gap-1.5 flex-wrap">
                              {it.blood_code && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-medium border border-blue-200">
                                  Mã: {it.blood_code}
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded bg-[#fce7f6] text-[#190072]">
                                {it.blood_group}
                                {it.rh_factor}
                              </span>
                              <span className="text-slate-800">
                                {it.product_name} ({it.volume_name})
                              </span>
                              <span className="text-slate-500">
                                {it.collection_date ? `— Lấy: ${formatDate(it.collection_date)} ` : ''}— HSD: {new Date(it.expiry_date).toLocaleDateString('vi-VN')}
                              </span>
                              <span className="text-[#C5299B] font-semibold">x{it.quantity}</span>
                              {idx === 1 && (tx.items || []).length > 2 && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs border border-slate-300 ml-1 transition"
                                  title={`Còn ${(tx.items || []).length - 2} chế phẩm khác trong phiếu này. Bấm vào dòng để xem chi tiết`}
                                >
                                  ... (+{(tx.items || []).length - 2})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-base text-[#C5299B]">
                        {tx.total_quantity}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {tx.status === 'PENDING_CANCEL' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Chờ duyệt hủy
                          </span>
                        ) : tx.status === 'CANCELLED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                            <XCircle className="w-3.5 h-3.5" />
                            Đã hủy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Hoàn thành
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {tx.creator_name}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setPrintTx(tx)}
                            title="In phiếu / Xem chi tiết"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {tx.status === 'PENDING_CANCEL' && canApproveCancel && (
                            <>
                              <button
                                type="button"
                                onClick={() => setCancelApproveTarget(tx)}
                                title="Duyệt hủy phiếu này (Hoàn nguyên kho)"
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelRejectTarget(tx)}
                                title="Từ chối yêu cầu hủy"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 transition"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {tx.status === 'CANCELLED' && hasPermission('import.create') && (
                            <button
                              type="button"
                              onClick={() => handleReImportCancelledSlip(tx)}
                              title="Nhập lại từ phiếu đã hủy này"
                              className="p-1.5 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}

                          {(!tx.status || tx.status === 'COMPLETED') && canCancelRequest && (
                            <button
                              type="button"
                              onClick={() => setCancelRequestTarget(tx)}
                              title="Yêu cầu hủy phiếu nhập này"
                              className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          totalItems={filteredHistory.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <QuickAddPartnerModal
        open={addPartnerOpen}
        onClose={() => setAddPartnerOpen(false)}
        onCreated={(newId) => {
          if (newId) setPartnerId(newId);
          setMessage('Đã thêm đơn vị đối tác mới và tự động chọn.');
        }}
      />

      {printTx && (
        <PrintSlipModal
          transaction={printTx}
          onClose={() => setPrintTx(null)}
          canCancelRequest={canCancelRequest}
          canApproveCancel={canApproveCancel}
          onRequestCancel={(tx) => setCancelRequestTarget(tx)}
          onApproveCancel={(tx) => setCancelApproveTarget(tx)}
          onRejectCancel={(tx) => setCancelRejectTarget(tx)}
          onReImport={hasPermission('import.create') ? handleReImportCancelledSlip : null}
        />
      )}

      <CancelRequestModal
        isOpen={Boolean(cancelRequestTarget)}
        onClose={() => setCancelRequestTarget(null)}
        onSubmit={handleCancelRequestSubmit}
        loading={cancelLoading}
        transaction={cancelRequestTarget}
      />

      <CancelApproveModal
        isOpen={Boolean(cancelApproveTarget)}
        onClose={() => setCancelApproveTarget(null)}
        onApprove={handleCancelApproveSubmit}
        loading={cancelLoading}
        transaction={cancelApproveTarget}
      />

      <CancelRejectModal
        isOpen={Boolean(cancelRejectTarget)}
        onClose={() => setCancelRejectTarget(null)}
        onReject={handleCancelRejectSubmit}
        loading={cancelLoading}
        transaction={cancelRejectTarget}
      />

      {/* Barcode Scanner cho Nhập Chế Phẩm */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Quét mã vạch nhập túi máu"
        description="Quét mã vạch trên nhãn túi máu để thêm vào danh sách nhập"
        continuous={false}
        onScan={(scannedCode) => {
          setDraftBloodCode(scannedCode.toUpperCase());
          if (!draftProductId) {
            setTimeout(() => productSelectRef.current?.focus(), 50);
          }
        }}
      />

      {/* Barcode Scanner cho Lịch sử Nhập */}
      <BarcodeScannerModal
        isOpen={scannerHistoryOpen}
        onClose={() => setScannerHistoryOpen(false)}
        title="Quét tìm kiếm phiếu nhập"
        description="Quét mã túi máu hoặc số phiếu để tra cứu lịch sử nhập"
        continuous={false}
        onScan={(scannedCode) => {
          setSearchQuery(scannedCode);
          setCurrentPage(1);
        }}
      />
    </div>
  );
}
