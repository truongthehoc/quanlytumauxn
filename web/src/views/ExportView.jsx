import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ArrowUpRight,
  Plus,
  Trash2,
  Printer,
  CheckCircle2,
  Building2,
  User,
  X,
  Save,
  RefreshCw,
  Search,
  Calendar,
  RotateCcw,
  AlertTriangle,
  XCircle,
  Bell,
  ShieldAlert,
  Camera,
  Barcode,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import PrintSlipModal from '../components/PrintSlipModal';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import {
  CancelRequestModal,
  CancelApproveModal,
  CancelRejectModal,
} from '../components/CancelModals';

function toTitleCase(str = '') {
  return String(str)
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
}

export default function ExportView({ onNavigate }) {
  const { categories, refreshCategories, hasPermission, refreshPendingSummary } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [lots, setLots] = useState([]);
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [printTx, setPrintTx] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Quick Add Department Modal state
  const [quickDeptOpen, setQuickDeptOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({ code: '', name: '', note: '' });
  const [deptError, setDeptError] = useState('');

  // Form header state
  const [departmentInfo, setDepartmentInfo] = useState('');
  const [personName, setPersonName] = useState('');
  const [note, setNote] = useState('');

  // Quick-entry bar state (nhập/quét mã máu hoặc chọn chế phẩm -> tự load thông tin -> bấm + hoặc Enter nhảy xuống danh sách xuất)
  const [draftBloodCode, setDraftBloodCode] = useState('');
  const [draftLotId, setDraftLotId] = useState('');
  const [draftQty, setDraftQty] = useState(1);
  const [draftNote, setDraftNote] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerHistoryOpen, setScannerHistoryOpen] = useState(false);
  const bloodCodeInputRef = useRef(null);
  const lotSelectRef = useRef(null);
  const qtyInputRef = useRef(null);
  const noteInputRef = useRef(null);
  const addBtnRef = useRef(null);

  // Added export list state
  const [exportList, setExportList] = useState([]);

  // Pagination state for Export History
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Cancellation state & permissions
  const canCancelRequest = hasPermission('export.cancel_request') || hasPermission('export.delete');
  const canApproveCancel = hasPermission('export.cancel_approve');

  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'PENDING_CANCEL' | 'CANCELLED'
  const [cancelRequestTarget, setCancelRequestTarget] = useState(null);
  const [cancelApproveTarget, setCancelApproveTarget] = useState(null);
  const [cancelRejectTarget, setCancelRejectTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    if (!message && !error) return;
    const timer = setTimeout(() => {
      setMessage('');
      setError('');
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, error]);

  const activeDepartments = (categories.departments || []).filter(
    (d) => d.is_active
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, txRes] = await Promise.all([
        api.get('/inventory'),
        api.get('/transactions?tx_type=EXPORT'),
      ]);
      const availableLots = (invRes.data.lots || []).filter(
        (l) => l.quantity > 0 && l.expiry_status !== 'EXPIRED'
      );
      setLots(availableLots);
      setHistory(txRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = 'hidden';
      const timer = setTimeout(() => {
        bloodCodeInputRef.current?.focus();
      }, 150);
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') setShowForm(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showForm]);

  const counts = useMemo(() => {
    let completed = 0;
    let pending = 0;
    let cancelled = 0;
    for (const tx of history) {
      if (tx.status === 'PENDING_CANCEL') pending++;
      else if (tx.status === 'CANCELLED') cancelled++;
      else completed++;
    }
    return { all: history.length, completed, pending, cancelled };
  }, [history]);

  const filteredHistory = useMemo(() => {
    let list = history;
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'COMPLETED') {
        list = list.filter((tx) => !tx.status || tx.status === 'COMPLETED');
      } else {
        list = list.filter((tx) => tx.status === statusFilter);
      }
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (tx) =>
        (tx.code && tx.code.toLowerCase().includes(q)) ||
        (tx.department_info && tx.department_info.toLowerCase().includes(q)) ||
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
      setMessage(res.data.message || 'Đã gửi yêu cầu hủy phiếu xuất thành công');
      setCancelRequestTarget(null);
      if (printTx?.id === cancelRequestTarget.id) {
        setPrintTx((prev) => ({
          ...prev,
          status: 'PENDING_CANCEL',
          cancel_reason: reason,
          cancel_requested_at: new Date().toISOString(),
        }));
      }
      fetchAll();
      refreshPendingSummary?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi gửi yêu cầu hủy phiếu xuất');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCancelApproveSubmit = async () => {
    if (!cancelApproveTarget) return;
    setCancelLoading(true);
    try {
      const res = await api.post(`/transactions/${cancelApproveTarget.id}/cancel-approve`);
      setMessage(res.data.message || 'Duyệt hủy phiếu xuất thành công');
      setCancelApproveTarget(null);
      if (printTx?.id === cancelApproveTarget.id) {
        setPrintTx((prev) => ({
          ...prev,
          status: 'CANCELLED',
          cancel_approved_at: new Date().toISOString(),
        }));
      }
      fetchAll();
      refreshPendingSummary?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi duyệt hủy phiếu xuất');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCancelRejectSubmit = async (rejectReason) => {
    if (!cancelRejectTarget) return;
    setCancelLoading(true);
    try {
      const res = await api.post(`/transactions/${cancelRejectTarget.id}/cancel-reject`, { reject_reason: rejectReason });
      setMessage(res.data.message || 'Đã từ chối yêu cầu hủy phiếu xuất');
      setCancelRejectTarget(null);
      if (printTx?.id === cancelRejectTarget.id) {
        setPrintTx((prev) => ({
          ...prev,
          status: 'COMPLETED',
          cancel_reject_reason: rejectReason,
        }));
      }
      fetchAll();
      refreshPendingSummary?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi từ chối hủy phiếu xuất');
    } finally {
      setCancelLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '---';
    return new Date(d).toLocaleDateString('vi-VN');
  };

  const selectedDraftLot = lots.find(
    (l) => Number(l.id) === Number(draftLotId)
  );

  const existingDraftItem = selectedDraftLot
    ? exportList.find(
        (item) => Number(item.lot_id) === Number(selectedDraftLot.id)
      )
    : null;
  const currentDraftInList = existingDraftItem
    ? Number(existingDraftItem.quantity)
    : 0;
  const remainingDraftStock = selectedDraftLot
    ? Math.max(0, Number(selectedDraftLot.quantity) - currentDraftInList)
    : null;
  const isOverStock =
    selectedDraftLot && Number(draftQty) > remainingDraftStock;

  const handleDraftQtyChange = (val) => {
    setDraftQty(val);
    if (selectedDraftLot) {
      const num = Number(val);
      if (num > remainingDraftStock) {
        setError(
          `Số lượng xuất (${num}) vượt quá số tồn khả dụng! Lô "${selectedDraftLot.product_name}" [${selectedDraftLot.blood_group}${selectedDraftLot.rh_factor}] chỉ còn tồn ${remainingDraftStock} ${selectedDraftLot.unit_name}.`
        );
      } else {
        setError('');
      }
    }
  };

  const handleBloodCodeChange = (val) => {
    const upper = val.toUpperCase();
    setDraftBloodCode(upper);
    const clean = upper.trim();
    if (!clean) {
      setDraftLotId('');
      setError('');
      return;
    }
    const matched = lots.find(
      (l) => l.blood_code && l.blood_code.toUpperCase() === clean
    );
    if (matched) {
      setDraftLotId(matched.id);
      setError('');
    }
  };

  const addLotToExportList = (lotToAdd, qtyToAdd = 1, itemNote = '') => {
    const existing = exportList.find(
      (item) => Number(item.lot_id) === Number(lotToAdd.id)
    );
    if (existing) {
      setExportList((prev) =>
        prev.map((item) =>
          Number(item.lot_id) === Number(lotToAdd.id)
            ? {
                ...item,
                quantity: Number(item.quantity) + qtyToAdd,
                note: itemNote.trim() || item.note,
              }
            : item
        )
      );
    } else {
      setExportList((prev) => [
        ...prev,
        {
          lot_id: lotToAdd.id,
          blood_code: lotToAdd.blood_code || '',
          product_code: lotToAdd.product_code,
          product_name: lotToAdd.product_name,
          blood_group: lotToAdd.blood_group,
          rh_factor: lotToAdd.rh_factor,
          volume_name: lotToAdd.volume_name,
          unit_name: lotToAdd.unit_name,
          expiry_date: lotToAdd.expiry_date,
          days_remaining: lotToAdd.days_remaining,
          expiry_status: lotToAdd.expiry_status,
          max_quantity: lotToAdd.quantity,
          quantity: qtyToAdd,
          note: itemNote.trim(),
        },
      ]);
    }
  };

  const handleBloodCodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const clean = draftBloodCode.trim().toUpperCase();
      if (!clean) {
        lotSelectRef.current?.focus();
        return;
      }
      const matched = lots.find(
        (l) => l.blood_code && l.blood_code.toUpperCase() === clean
      );
      if (matched) {
        const inList =
          exportList.find((item) => Number(item.lot_id) === Number(matched.id))
            ?.quantity || 0;
        const remain = Math.max(0, Number(matched.quantity) - Number(inList));
        if (remain <= 0) {
          setError(
            `Mã máu "${clean}" (${matched.product_name}) đã có trong danh sách xuất và đạt tối đa tồn kho!`
          );
          return;
        }
        addLotToExportList(matched, 1, draftNote);
        setDraftBloodCode('');
        setDraftLotId('');
        setDraftQty(1);
        setDraftNote('');
        setTimeout(() => {
          bloodCodeInputRef.current?.focus();
        }, 50);
      } else {
        setError(`Không tìm thấy mã máu "${clean}" trong kho hoặc túi máu đã hết tồn!`);
      }
    }
  };

  const handleScanExportBag = (scannedCode) => {
    const clean = scannedCode.trim().toUpperCase();
    if (!clean) return;

    const matched = lots.find(
      (l) => (l.blood_code && l.blood_code.toUpperCase() === clean) ||
             (l.product_code && l.product_code.toUpperCase() === clean)
    );

    if (matched) {
      const inList = exportList.find((item) => Number(item.lot_id) === Number(matched.id))?.quantity || 0;
      const remain = Math.max(0, Number(matched.quantity) - Number(inList));
      if (remain <= 0) {
        setError(`Túi máu "${clean}" (${matched.product_name}) đã đạt giới hạn tồn khả dụng trong danh sách xuất!`);
        return;
      }
      addLotToExportList(matched, 1, draftNote);
      setDraftBloodCode('');
      setDraftLotId('');
      setDraftQty(1);
      setMessage(`Đã quét & thêm túi máu [${clean}] - ${matched.product_name} (${matched.blood_group}${matched.rh_factor}) vào danh sách xuất.`);
      setError('');
    } else {
      setDraftBloodCode(clean);
      setError(`Không tìm thấy túi máu có mã "${clean}" còn tồn khả dụng trong kho!`);
    }
  };

  const handleDraftLotChange = (val) => {
    setDraftLotId(val);
    const nextLot = lots.find((l) => Number(l.id) === Number(val));
    if (nextLot) {
      setDraftBloodCode(nextLot.blood_code || '');
      const inList =
        exportList.find((item) => Number(item.lot_id) === Number(nextLot.id))
          ?.quantity || 0;
      const remain = Math.max(0, Number(nextLot.quantity) - Number(inList));
      if (Number(draftQty) > remain) {
        setError(
          `Số lượng xuất (${draftQty}) vượt quá số tồn khả dụng! Lô "${nextLot.product_name}" [${nextLot.blood_group}${nextLot.rh_factor}] chỉ còn tồn ${remain} ${nextLot.unit_name}.`
        );
      } else {
        setError('');
      }
    } else {
      setDraftBloodCode('');
      setError('');
    }
  };

  const handleAddToExportList = () => {
    setMessage('');
    setError('');

    if (!selectedDraftLot) {
      setError('Vui lòng nhập Mã máu hoặc chọn Loại chế phẩm máu cần xuất');
      bloodCodeInputRef.current?.focus();
      return;
    }

    const qtyToAdd = Number(draftQty);
    if (!qtyToAdd || qtyToAdd <= 0) {
      setError('Số lượng xuất phải lớn hơn 0');
      qtyInputRef.current?.focus();
      return;
    }

    if (currentDraftInList + qtyToAdd > Number(selectedDraftLot.quantity)) {
      setError(
        `Số lượng xuất (${qtyToAdd}) vượt quá số tồn khả dụng! Lô "${selectedDraftLot.product_name}" [${selectedDraftLot.blood_group}${selectedDraftLot.rh_factor}] chỉ còn tồn ${remainingDraftStock} ${selectedDraftLot.unit_name}.`
      );
      return;
    }

    addLotToExportList(selectedDraftLot, qtyToAdd, draftNote);

    setDraftBloodCode('');
    setDraftLotId('');
    setDraftQty(1);
    setDraftNote('');
    setTimeout(() => {
      bloodCodeInputRef.current?.focus();
    }, 50);
  };

  const handleRemoveFromList = (lotId) => {
    setExportList((prev) =>
      prev.filter((item) => Number(item.lot_id) !== Number(lotId))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (exportList.length === 0) {
      setError(
        'Danh sách xuất đang trống. Vui lòng chọn chế phẩm, nhập số lượng và bấm dấu + hoặc Enter để đưa xuống danh sách xuất!'
      );
      return;
    }

    const formattedPerson = toTitleCase(personName);
    setPersonName(formattedPerson);

    try {
      const res = await api.post('/transactions/export', {
        department_info: departmentInfo,
        person_name: formattedPerson,
        note,
        items: exportList.map((it) => ({
          lot_id: Number(it.lot_id),
          quantity: Number(it.quantity),
          note: it.note || '',
        })),
      });
      setMessage(`${res.data.message} (Mã phiếu: ${res.data.code})`);
      setNote('');
      setExportList([]);
      setShowForm(false);
      fetchAll();
      const detail = await api.get(`/transactions/${res.data.id}`);
      setPrintTx(detail.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi xuất chế phẩm máu');
    }
  };

  const totalExportQty = exportList.reduce(
    (sum, it) => sum + Number(it.quantity || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#fdf2fa] text-[#C5299B] flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <h2 className="section-title text-base font-bold text-[#190072]">
              Danh sách phiếu xuất chế phẩm máu
            </h2>
            <p className="text-xs text-slate-500">
              Quản lý và theo dõi các đợt xuất máu cho lâm sàng, phẫu thuật ({history.length} phiếu)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchAll}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {hasPermission('export.create') && (
            <button
              type="button"
              onClick={() => {
                setShowForm(true);
                setMessage('');
                setError('');
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm bg-[#C5299B] hover:bg-[#a82083] text-white"
            >
              <Plus className="w-4 h-4" />
              <span>Xuất chế phẩm</span>
            </button>
          )}
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

      {/* Drawer trượt ra từ bên phải khi bấm "Xuất chế phẩm" */}
      {hasPermission('export.create') && showForm && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop overlay làm mờ nền */}
          {/* Backdrop (Không tự đóng khi click ra ngoài vùng để tránh mất dữ liệu đang nhập dở) */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
            <div className="w-screen max-w-4xl sm:max-w-5xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              {/* Header Drawer */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#fdf2fa] text-[#C5299B] flex items-center justify-center">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#190072]">
                      Tạo phiếu xuất chế phẩm máu
                    </h3>
                    <p className="text-xs text-slate-500">
                      Chọn khoa/phòng nhận máu và xuất các bịch chế phẩm trong kho
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                  title="Đóng (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form body có thanh cuộn riêng */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col justify-between">
                <div className="p-6 space-y-5">
                  {error && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                      {error}
                    </div>
                  )}

                  {/* Thông tin Khoa/Phòng & Người nhận */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-600 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#C5299B]" />
                    Khoa / Phòng nhận máu
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setDeptForm({ code: '', name: '', note: '' });
                      setDeptError('');
                      setQuickDeptOpen(true);
                    }}
                    className="text-xs text-[#C5299B] hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm mới
                  </button>
                </div>
                <SearchableSelect
                  value={departmentInfo}
                  onChange={(val) => setDepartmentInfo(val)}
                  options={[
                    { value: '', label: '-- Chọn Khoa / Phòng nhận máu --' },
                    ...activeDepartments.map((d) => ({
                      value: d.name,
                      label: d.name,
                      subLabel: d.code,
                    })),
                  ]}
                  placeholder="-- Chọn Khoa / Phòng nhận máu --"
                  onAddNew={() => {
                    setDeptForm({ code: '', name: '', note: '' });
                    setDeptError('');
                    setQuickDeptOpen(true);
                  }}
                  addNewLabel="Thêm mới Khoa / Phòng..."
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1.5 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#C5299B]" />
                  Người nhận / Bệnh nhân
                </label>
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  onBlur={() => setPersonName((prev) => toTitleCase(prev))}
                  placeholder="Nhập họ tên người lĩnh máu hoặc bệnh nhân..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#C5299B] focus:ring-2 focus:ring-[#C5299B]/20 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1.5">
                  Ghi chú phiếu xuất
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nhập ghi chú xuất..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#C5299B] focus:ring-2 focus:ring-[#C5299B]/20 outline-none transition"
                />
              </div>
            </div>

            {/* Thanh nhập nhanh chế phẩm (Nhập/quét Mã máu hoặc Chọn chế phẩm -> Tự load thông tin -> Enter hoặc +) */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-[#190072] flex items-center justify-between">
                <span>Chọn chế phẩm đưa vào danh sách xuất (Nhập/quét Mã máu hoặc chọn Loại chế phẩm)</span>
                {selectedDraftLot && (
                  <span className="text-[11px] font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Đã tải thông tin: <strong>{selectedDraftLot.product_name}</strong> [{selectedDraftLot.blood_group}{selectedDraftLot.rh_factor}]
                  </span>
                )}
              </div>

              {/* Hàng 1: Mã máu, Loại chế phẩm, Nhóm ABO, Hệ Rh, Thể tích */}
              <div className="flex flex-wrap items-end gap-2.5">
                {/* 1. Mã máu (Túi) */}
                <div className="w-full sm:w-[170px]">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-slate-600">
                      Mã máu (Túi/Bịch)
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
                      onChange={(e) => handleBloodCodeChange(e.target.value)}
                      onKeyDown={handleBloodCodeKeyDown}
                      placeholder="Nhập/quét mã..."
                      className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-300 bg-yellow-50 text-sm uppercase font-semibold text-[#190072] placeholder:font-sans placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 placeholder:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-[#C5299B] hover:bg-[#C5299B]/10 rounded-lg active:scale-95 transition"
                      title="Bật camera quét mã túi máu"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 2. Loại chế phẩm máu trong kho (FEFO) */}
                <div className="w-full sm:flex-1 sm:min-w-[220px]">
                  <label className="block text-xs text-slate-600 mb-1">
                    Loại chế phẩm máu trong kho (FEFO)
                  </label>
                  <SearchableSelect
                    ref={lotSelectRef}
                    value={draftLotId}
                    onChange={(val) => handleDraftLotChange(val)}
                    onAfterSelect={() => {
                      setTimeout(() => {
                        qtyInputRef.current?.focus();
                        qtyInputRef.current?.select();
                      }, 20);
                    }}
                    options={lots.map((l) => ({
                      value: l.id,
                      label: `${l.blood_code ? `[Mã: ${l.blood_code}] ` : ''}${l.product_name} (${l.volume_name})`,
                      subLabel: `[${l.blood_group}${l.rh_factor}] — HSD: ${formatDate(l.expiry_date)} — Tồn: ${l.quantity} ${l.unit_name} | Mã: ${l.blood_code || l.product_code}`,
                    }))}
                    placeholder="Hãy nhập tên hoặc mã chế phẩm máu"
                    className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-yellow-50"
                  />
                </div>

                {/* 3. Nhóm ABO (tự động load) */}
                <div className="w-[calc(50%-5px)] sm:w-[95px]">
                  <label className="block text-xs text-slate-600 mb-1">
                    Nhóm ABO
                  </label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={selectedDraftLot ? `Nhóm ${selectedDraftLot.blood_group}` : ''}
                    placeholder="Nhóm ABO"
                    className="w-full px-2 py-2 rounded-xl border border-slate-300 text-sm bg-yellow-50 text-slate-800 font-medium text-center cursor-not-allowed"
                  />
                </div>

                {/* 4. Hệ Rh (tự động load) */}
                <div className="w-[calc(50%-5px)] sm:w-[85px]">
                  <label className="block text-xs text-slate-600 mb-1">
                    Hệ Rh
                  </label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={selectedDraftLot ? `Rh(${selectedDraftLot.rh_factor})` : ''}
                    placeholder="Hệ Rh"
                    className="w-full px-2 py-2 rounded-xl border border-slate-300 text-sm bg-yellow-50 text-slate-800 font-medium text-center cursor-not-allowed"
                  />
                </div>

                {/* 5. Thể tích (tự động load) */}
                <div className="w-[calc(50%-5px)] sm:w-[95px]">
                  <label className="block text-xs text-slate-600 mb-1">
                    Thể tích
                  </label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={selectedDraftLot ? (selectedDraftLot.volume_name || `${selectedDraftLot.volume_ml} ml`) : ''}
                    placeholder="Thể tích"
                    className="w-full px-2 py-2 rounded-xl border border-slate-300 text-sm bg-yellow-50 text-slate-800 font-medium text-center cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Hàng 2: Hạn sử dụng, Tồn khả dụng, SL xuất, Ghi chú, Nút + */}
              <div className="flex flex-wrap items-end gap-2.5">
                {/* 6. Hạn sử dụng (tự động load) */}
                <div className="w-[calc(50%-5px)] sm:w-[135px]">
                  <label className="block text-xs text-slate-600 mb-1">
                    Hạn sử dụng
                  </label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={selectedDraftLot ? formatDate(selectedDraftLot.expiry_date) : ''}
                    placeholder="Hạn sử dụng"
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-sm bg-yellow-50 text-slate-800 font-medium text-center cursor-not-allowed"
                  />
                </div>

                {/* 7. Tồn kho khả dụng */}
                <div className="w-[calc(50%-5px)] sm:w-[170px]">
                  <label className="block text-xs text-slate-600 mb-1">
                    Tồn khả dụng
                  </label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={selectedDraftLot ? `${remainingDraftStock} ${selectedDraftLot.unit_name || 'Bịch'}` : ''}
                    title={selectedDraftLot ? `${remainingDraftStock} ${selectedDraftLot.unit_name || 'Bịch'}` : ''}
                    placeholder="Tồn khả dụng"
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-slate-100 text-slate-700 font-semibold text-center cursor-not-allowed"
                  />
                </div>

                {/* 8. Số lượng xuất */}
                <div className="w-[calc(50%-5px)] sm:w-[80px]">
                  <label className="block text-xs text-slate-600 mb-1">
                    SL xuất
                  </label>
                  <input
                    ref={qtyInputRef}
                    type="number"
                    min={1}
                    value={draftQty}
                    onChange={(e) => handleDraftQtyChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        noteInputRef.current?.focus();
                      }
                    }}
                    className={`w-full px-2 py-2 rounded-xl border text-center text-sm outline-none transition focus:border-[#C5299B] focus:ring-2 focus:ring-[#C5299B]/20 ${
                      isOverStock
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-slate-300 bg-yellow-50'
                    }`}
                  />
                </div>

                {/* 9. Ghi chú dòng (thu gọn lại cân đối với ô Tồn khả dụng) */}
                <div className="w-full sm:flex-1 sm:min-w-[160px]">
                  <label className="block text-xs text-slate-600 mb-1">
                    Ghi chú
                  </label>
                  <input
                    ref={noteInputRef}
                    type="text"
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddToExportList();
                      }
                    }}
                    placeholder="Ghi chú dòng xuất..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:border-[#C5299B] focus:ring-2 focus:ring-[#C5299B]/20 outline-none transition"
                  />
                </div>

                {/* 10. Nút + */}
                <div className="w-full sm:w-[44px]">
                  <button
                    ref={addBtnRef}
                    type="button"
                    onClick={handleAddToExportList}
                    disabled={!selectedDraftLot || isOverStock}
                    title="Đưa vào danh sách xuất (Enter hoặc +)"
                    className="w-full h-[38px] rounded-xl bg-[#C5299B] hover:bg-[#a82083] disabled:opacity-40 text-white flex items-center justify-center shadow-sm transition"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {isOverStock && (
                <div className="text-xs text-rose-600 pt-1 font-medium">
                  Cảnh báo: Số lượng xuất ({draftQty}) lớn hơn số tồn khả dụng ({remainingDraftStock} {selectedDraftLot?.unit_name})!
                </div>
              )}
            </div>

            {/* Danh sách chế phẩm xuất kho */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <span className="section-title text-xs font-bold text-[#190072]">
                  Danh sách chế phẩm xuất ({exportList.length} dòng — Tổng:{' '}
                  {totalExportQty} đơn vị)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] table-fixed text-sm">
                  <thead>
                    <tr className="bg-slate-100/70 text-slate-600 text-xs border-b border-slate-200">
                      <th className="py-2.5 px-3 text-center w-[4%]">#</th>
                      <th className="py-2.5 px-3 text-left w-[13%]">Mã máu (Túi)</th>
                      <th className="py-2.5 px-3 text-left w-[20%]">
                        Tên chế phẩm máu
                      </th>
                      <th className="py-2.5 px-2.5 text-center w-[9%]">
                        Nhóm máu
                      </th>
                      <th className="py-2.5 px-2.5 text-center w-[9%]">
                        Thể tích
                      </th>
                      <th className="py-2.5 px-2.5 text-center w-[12%]">
                        Đơn vị tính
                      </th>
                      <th className="py-2.5 px-2.5 text-center w-[11%]">
                        Hạn sử dụng
                      </th>
                      <th className="py-2.5 px-2.5 text-center w-[9%]">
                        Số lượng xuất
                      </th>
                      <th className="py-2.5 px-3 text-left w-[9%]">
                        Ghi chú
                      </th>
                      <th className="py-2.5 px-2 text-center w-[4%]">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {exportList.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="py-8 text-center text-slate-400 text-sm"
                        >
                          Chưa có chế phẩm nào trong danh sách xuất. Hãy chọn chế phẩm ở thanh phía trên và bấm dấu (+) hoặc nhấn Enter.
                        </td>
                      </tr>
                    ) : (
                      exportList.map((item, idx) => (
                        <tr key={item.lot_id}>
                          <td className="py-2.5 px-3 text-center text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs font-semibold">
                            {item.blood_code ? (
                              <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800">
                                {item.blood_code}
                              </span>
                            ) : (
                              <span className="text-slate-400">---</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 truncate">
                            {item.product_name}
                          </td>
                          <td className="py-2.5 px-2.5 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-lg text-xs ${
                                item.rh_factor === '-'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-[#fce7f6] text-[#190072] border border-[#eab3dc]'
                              }`}
                            >
                              {item.blood_group}
                              {item.rh_factor}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-center text-slate-700">
                            {item.volume_name}
                          </td>
                          <td className="py-2.5 px-2.5 text-center text-slate-700">
                            {item.unit_name}
                          </td>
                          <td className="py-2.5 px-2.5 text-center text-slate-800">
                            {formatDate(item.expiry_date)}
                          </td>
                          <td className="py-2.5 px-2.5 text-center text-[#C5299B]">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 truncate">
                            {item.note || '---'}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveFromList(item.lot_id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                              title="Xóa khỏi danh sách xuất"
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
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-white transition"
                >
                  Đóng / Hủy
                </button>
                <button
                  type="submit"
                  disabled={exportList.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#C5299B] hover:bg-[#a82083] disabled:opacity-40 text-white text-sm font-medium shadow-sm transition"
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

      {/* Lịch sử Xuất Chế Phẩm Máu (Mặc định hiển thị danh sách này) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="section-title text-sm font-bold text-[#190072] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#C5299B]" />
            Danh sách phiếu đã xuất ({filteredHistory.length} phiếu)
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
                placeholder="Tìm mã phiếu, người nhận, khoa..."
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
        {/* Status filter tabs */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-50/70 border-b border-slate-200 overflow-x-auto text-xs">
          <span className="text-slate-500 font-medium whitespace-nowrap">Trạng thái:</span>
          <button
            type="button"
            onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
            className={`px-3 py-1 rounded-lg font-medium transition ${
              statusFilter === 'ALL'
                ? 'bg-[#190072] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Tất cả ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('COMPLETED'); setCurrentPage(1); }}
            className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Hoàn thành ({counts.completed})
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('PENDING_CANCEL'); setCurrentPage(1); }}
            className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              statusFilter === 'PENDING_CANCEL'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white text-amber-700 hover:bg-amber-50 border border-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Chờ duyệt hủy ({counts.pending})
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('CANCELLED'); setCurrentPage(1); }}
            className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              statusFilter === 'CANCELLED'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white text-rose-700 hover:bg-rose-50 border border-slate-200'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Đã hủy ({counts.cancelled})
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                <th className="py-3 px-4 text-left">Mã phiếu</th>
                <th className="py-3 px-4 text-left">Thời gian xuất</th>
                <th className="py-3 px-4 text-left">Khoa / Phòng nhận</th>
                <th className="py-3 px-4 text-left">Người nhận / Bệnh nhân</th>
                <th className="py-3 px-4 text-left">Chi tiết chế phẩm xuất</th>
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
                    Đang tải danh sách phiếu xuất máu...
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    {searchQuery ? 'Không tìm thấy phiếu nào khớp với từ khóa tìm kiếm.' : 'Chưa có phiếu xuất chế phẩm máu nào.'}
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
                      <td className="py-3 px-4 font-mono text-[#C5299B]">
                        <span className={tx.status === 'CANCELLED' ? 'line-through text-slate-400' : ''}>
                          {tx.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {new Date(tx.tx_date).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        {tx.department_info || '---'}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {tx.person_name || '---'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {(tx.items || []).slice(0, 2).map((it, idx) => (
                            <div
                              key={it.id}
                              className="text-xs flex items-center gap-1.5 flex-wrap"
                            >
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
                                — HSD: {formatDate(it.expiry_date)}
                              </span>
                              <span className="text-[#C5299B] font-semibold">
                                x{it.quantity}
                              </span>
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                            <XCircle className="w-3.5 h-3.5" />
                            Đã hủy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
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

                          {(!tx.status || tx.status === 'COMPLETED') && canCancelRequest && (
                            <button
                              type="button"
                              onClick={() => setCancelRequestTarget(tx)}
                              title="Yêu cầu hủy phiếu xuất này"
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

      {printTx && (
        <PrintSlipModal
          transaction={printTx}
          onClose={() => setPrintTx(null)}
          canCancelRequest={canCancelRequest}
          canApproveCancel={canApproveCancel}
          onRequestCancel={(tx) => setCancelRequestTarget(tx)}
          onApproveCancel={(tx) => setCancelApproveTarget(tx)}
          onRejectCancel={(tx) => setCancelRejectTarget(tx)}
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

      {quickDeptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3.5 mb-4">
              <h3 className="modal-title text-lg font-bold text-[#190072]">
                Thêm mới Khoa / Phòng
              </h3>
              <button
                type="button"
                onClick={() => setQuickDeptOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {deptError && (
              <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {deptError}
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setDeptError('');
                try {
                  await api.post('/categories/departments', {
                    ...deptForm,
                    is_active: 1,
                  });
                  await refreshCategories();
                  setDepartmentInfo(deptForm.name.trim());
                  setQuickDeptOpen(false);
                } catch (err) {
                  setDeptError(
                    err.response?.data?.error || 'Lỗi thêm Khoa/Phòng'
                  );
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Mã khoa/phòng <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={deptForm.code}
                  onChange={(e) =>
                    setDeptForm({ ...deptForm, code: e.target.value })
                  }
                  placeholder="Nhập mã khoa/phòng..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-yellow-50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Tên khoa/phòng <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={deptForm.name}
                  onChange={(e) =>
                    setDeptForm({ ...deptForm, name: e.target.value })
                  }
                  placeholder="Nhập tên khoa/phòng..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-yellow-50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Ghi chú
                </label>
                <input
                  type="text"
                  value={deptForm.note}
                  onChange={(e) =>
                    setDeptForm({ ...deptForm, note: e.target.value })
                  }
                  placeholder="Ghi chú thêm..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickDeptOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-sm"
                >
                  Lưu Khoa/Phòng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner cho Xuất Máu (Hỗ trợ quét liên tục nhiều túi máu) */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Quét mã vạch xuất túi máu"
        description="Quét mã túi máu để tự động tìm và thêm vào danh sách xuất"
        continuous={true}
        onScan={handleScanExportBag}
      />

      {/* Barcode Scanner cho Tìm kiếm lịch sử phiếu xuất */}
      <BarcodeScannerModal
        isOpen={scannerHistoryOpen}
        onClose={() => setScannerHistoryOpen(false)}
        title="Quét tìm kiếm phiếu xuất"
        description="Quét mã túi máu hoặc số phiếu để tra cứu lịch sử xuất"
        continuous={false}
        onScan={(scannedCode) => {
          setSearchQuery(scannedCode);
          setCurrentPage(1);
        }}
      />
    </div>
  );
}
