import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Repeat,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Printer,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Search,
  RefreshCw,
  Building2,
  User,
  Calendar,
  FileText,
  AlertTriangle,
  Send,
  Droplet,
  Camera,
  Barcode,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import PrintSlipModal from '../components/PrintSlipModal';
import DateInput from '../components/DateInput';
import QuickAddPartnerModal from '../components/QuickAddPartnerModal';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';
import BarcodeScannerModal from '../components/BarcodeScannerModal';

const STATUS_BADGES = {
  PENDING: {
    label: 'Chưa trả',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-300',
    dotCls: 'bg-amber-500',
  },
  PARTIAL: {
    label: 'Trả một phần',
    badgeCls: 'bg-sky-50 text-sky-800 border-sky-300',
    dotCls: 'bg-sky-500',
  },
  COMPLETED: {
    label: 'Đã trả đủ',
    badgeCls: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    dotCls: 'bg-emerald-500',
  },
};

function formatPersonName(str = '') {
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

export default function BorrowLendView() {
  const { categories, hasPermission } = useAuth();

  // Mode: null (closed) | 'LEND' (Cho mượn) | 'BORROW' (Mượn máu)
  const [drawerMode, setDrawerMode] = useState(null);

  const [loading, setLoading] = useState(false);
  const [lots, setLots] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, searchQuery]);

  // Modals & Slips
  const [printTx, setPrintTx] = useState(null);
  const [returnModalTx, setReturnModalTx] = useState(null);
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  const [returnItems, setReturnItems] = useState([]);
  const [returnPerson, setReturnPerson] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!message && !error) return;
    const timer = setTimeout(() => {
      setMessage('');
      setError('');
    }, 3500);
    return () => clearTimeout(timer);
  }, [message, error]);

  // Common Header Form state (partnerId & personName NOT required)
  const [partnerId, setPartnerId] = useState('');
  const [personName, setPersonName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  // ==================== LEND (CHO MƯỢN) STATE ====================
  // Quick-entry draft bar for LEND
  const [lendDraftBloodCode, setLendDraftBloodCode] = useState('');
  const [lendDraftLotId, setLendDraftLotId] = useState('');
  const [lendDraftQty, setLendDraftQty] = useState(1);
  const [lendDraftNote, setLendDraftNote] = useState('');
  const [lendSuggestionsOpen, setLendSuggestionsOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState('lend'); // 'lend' | 'borrow' | 'search'
  // Final list of items to lend
  const [lendList, setLendList] = useState([]);

  // Refs for LEND quick-entry
  const lendBloodCodeInputRef = useRef(null);
  const lendQtyInputRef = useRef(null);
  const lendSuggestionsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (lendSuggestionsRef.current && !lendSuggestionsRef.current.contains(e.target)) {
        setLendSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ==================== BORROW (MƯỢN MÁU) STATE ====================
  const defaultExpiry = () => {
    const d = new Date();
    d.setDate(d.getDate() + 25);
    return d.toISOString().slice(0, 10);
  };

  // Quick-entry draft bar for BORROW
  const [borrowDraftBloodCode, setBorrowDraftBloodCode] = useState('');
  const [borrowDraftProductId, setBorrowDraftProductId] = useState('');
  const [borrowDraftGroup, setBorrowDraftGroup] = useState('O');
  const [borrowDraftRh, setBorrowDraftRh] = useState('+');
  const [borrowDraftVolumeId, setBorrowDraftVolumeId] = useState('');
  const [borrowDraftExpiry, setBorrowDraftExpiry] = useState(defaultExpiry());
  const [borrowDraftQty, setBorrowDraftQty] = useState(1);
  const [borrowDraftNote, setBorrowDraftNote] = useState('');
  // Final list of items borrowed
  const [borrowList, setBorrowList] = useState([]);

  // Refs for BORROW quick-entry
  const borrowBloodCodeInputRef = useRef(null);
  const borrowQtyInputRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, txRes] = await Promise.all([
        api.get('/inventory'),
        api.get('/transactions?tx_type=LEND,BORROW'),
      ]);
      const validLots = (invRes.data.lots || []).filter(
        (l) => l.quantity > 0 && l.expiry_status !== 'EXPIRED'
      );
      setLots(validLots);
      setTransactions(txRes.data || []);
    } catch (e) {
      console.error(e);
      setError('Lỗi khi tải dữ liệu giao dịch mượn/cho mượn');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set default products / volumes for borrow when categories load
  useEffect(() => {
    if (categories.bloodProducts.length && !borrowDraftProductId) {
      setBorrowDraftProductId(categories.bloodProducts[0].id);
    }
    if (categories.volumes.length && !borrowDraftVolumeId) {
      setBorrowDraftVolumeId(categories.volumes[0].id);
    }
  }, [categories, borrowDraftProductId, borrowDraftVolumeId]);

  // Selected Lot in Lend draft bar
  const selectedLendLot = useMemo(() => {
    if (!lendDraftLotId) return null;
    return lots.find((l) => Number(l.id) === Number(lendDraftLotId)) || null;
  }, [lots, lendDraftLotId]);

  // Tính số lượng đã đưa vào lendList của lô này
  const lendLotInListQty = useMemo(() => {
    if (!selectedLendLot) return 0;
    const found = lendList.find((it) => Number(it.lot_id) === Number(selectedLendLot.id));
    return found ? Number(found.quantity) : 0;
  }, [selectedLendLot, lendList]);

  const lendRemainingStock = useMemo(() => {
    if (!selectedLendLot) return 0;
    return Math.max(0, Number(selectedLendLot.quantity) - lendLotInListQty);
  }, [selectedLendLot, lendLotInListQty]);

  // Danh sách các túi máu trong kho khớp mã realtime
  const matchingLendLots = useMemo(() => {
    const q = lendDraftBloodCode.trim().toUpperCase();
    if (!q) return [];
    return lots.filter((l) => l.blood_code && l.blood_code.toUpperCase().includes(q));
  }, [lots, lendDraftBloodCode]);

  const selectLendLotSuggestion = (lot) => {
    setLendDraftBloodCode(lot.blood_code || '');
    setLendDraftLotId(lot.id);
    setLendSuggestionsOpen(false);
    setFormError('');
    setTimeout(() => {
      lendQtyInputRef.current?.focus();
      lendQtyInputRef.current?.select();
    }, 50);
  };

  // Handle blood code typing / Enter in LEND form
  const handleLendBloodCodeChange = (code) => {
    setLendDraftBloodCode(code);
    setLendSuggestionsOpen(true);
    const clean = code.trim().toUpperCase();
    if (!clean) {
      setLendDraftLotId('');
      setFormError('');
      return;
    }
    const matched = lots.find((l) => l.blood_code && l.blood_code.toUpperCase() === clean);
    if (matched) {
      setLendDraftLotId(matched.id);
      setFormError('');
    } else {
      const partial = lots.filter((l) => l.blood_code && l.blood_code.toUpperCase().includes(clean));
      if (partial.length === 1) {
        setLendDraftLotId(partial[0].id);
      } else {
        setLendDraftLotId('');
      }
    }
  };

  const handleLendBloodCodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const clean = lendDraftBloodCode.trim().toUpperCase();
      if (!clean) {
        setFormError('Bắt buộc nhập hoặc quét Mã túi máu!');
        return;
      }
      const matched = lots.find((l) => l.blood_code && l.blood_code.toUpperCase() === clean) || matchingLendLots[0];
      if (matched) {
        setLendDraftLotId(matched.id);
        const inList = lendList.find((it) => Number(it.lot_id) === Number(matched.id))?.quantity || 0;
        const remain = Math.max(0, Number(matched.quantity) - Number(inList));
        if (remain <= 0) {
          setFormError(`Túi máu "${matched.blood_code}" (${matched.product_name}) đã đạt tối đa tồn kho trong danh sách cho mượn!`);
          return;
        }
        addLendItemToList(matched, Number(lendDraftQty) || 1, lendDraftNote);
        setLendDraftBloodCode('');
        setLendDraftLotId('');
        setLendDraftQty(1);
        setLendDraftNote('');
        setLendSuggestionsOpen(false);
        setTimeout(() => lendBloodCodeInputRef.current?.focus(), 50);
      } else {
        setFormError(`Không tìm thấy túi máu có mã "${clean}" trong kho lưu trữ hoặc túi đã hết tồn!`);
      }
    }
  };

  const handleScanResult = (code) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;

    if (scannerTarget === 'lend') {
      setLendDraftBloodCode(clean);
      const matched = lots.find((l) => l.blood_code && l.blood_code.toUpperCase() === clean);
      if (matched) {
        setLendDraftLotId(matched.id);
        const inList = lendList.find((it) => Number(it.lot_id) === Number(matched.id))?.quantity || 0;
        const remain = Math.max(0, Number(matched.quantity) - Number(inList));
        if (remain <= 0) {
          setFormError(`Túi máu "${clean}" (${matched.product_name}) đã đạt tối đa tồn kho trong danh sách cho mượn!`);
          return;
        }
        addLendItemToList(matched, Number(lendDraftQty) || 1, lendDraftNote);
        setLendDraftBloodCode('');
        setLendDraftLotId('');
        setLendDraftQty(1);
        setMessage(`Đã quét & thêm túi máu [${clean}] vào danh sách cho mượn.`);
      } else {
        setFormError(`Không tìm thấy túi máu có mã "${clean}" trong kho lưu trữ!`);
      }
    } else if (scannerTarget === 'borrow') {
      setBorrowDraftBloodCode(clean);
    } else if (scannerTarget === 'search') {
      setSearchQuery(clean);
    }
  };

  const addLendItemToList = (lot, qty, itNote) => {
    setFormError('');
    const existing = lendList.find((it) => Number(it.lot_id) === Number(lot.id));
    if (existing) {
      setLendList((prev) =>
        prev.map((it) =>
          Number(it.lot_id) === Number(lot.id)
            ? { ...it, quantity: Number(it.quantity) + Number(qty), note: itNote.trim() || it.note }
            : it
        )
      );
    } else {
      setLendList((prev) => [
        ...prev,
        {
          lot_id: lot.id,
          blood_code: lot.blood_code || '',
          product_name: lot.product_name,
          blood_group: lot.blood_group,
          rh_factor: lot.rh_factor,
          volume_name: lot.volume_name,
          unit_name: lot.unit_name,
          expiry_date: lot.expiry_date,
          max_quantity: lot.quantity,
          quantity: Number(qty),
          note: itNote.trim(),
        },
      ]);
    }
  };

  const handleAddLendClick = () => {
    setFormError('');
    const clean = lendDraftBloodCode.trim().toUpperCase();
    if (!clean) {
      setFormError('Bắt buộc nhập hoặc quét Mã túi máu!');
      lendBloodCodeInputRef.current?.focus();
      return;
    }
    const matched = lots.find((l) => l.blood_code && l.blood_code.toUpperCase() === clean) || selectedLendLot;
    if (!matched) {
      setFormError(`Không tìm thấy túi máu có mã "${clean}" trong kho lưu trữ!`);
      lendBloodCodeInputRef.current?.focus();
      return;
    }
    const qty = Number(lendDraftQty);
    if (!qty || qty <= 0) {
      setFormError('Số lượng cho mượn phải lớn hơn 0');
      lendQtyInputRef.current?.focus();
      return;
    }
    if (lendLotInListQty + qty > Number(matched.quantity)) {
      setFormError(
        `Số lượng (${qty}) vượt quá số tồn khả dụng! Lô "${matched.product_name}" [${matched.blood_group}${matched.rh_factor}] chỉ còn tồn ${lendRemainingStock} ${matched.unit_name}.`
      );
      return;
    }

    addLendItemToList(matched, qty, lendDraftNote);
    setLendDraftBloodCode('');
    setLendDraftLotId('');
    setLendDraftQty(1);
    setLendDraftNote('');
    setTimeout(() => lendBloodCodeInputRef.current?.focus(), 50);
  };

  // ==================== BORROW ITEM ADD ====================
  const handleBorrowProductChange = (val) => {
    setBorrowDraftProductId(val);
    const bp = categories.bloodProducts.find((p) => String(p.id) === String(val));
    if (bp) {
      const matchVol = categories.volumes.find((v) => Number(v.volume_ml) === Number(bp.volume_ml));
      if (matchVol) setBorrowDraftVolumeId(matchVol.id);
    }
  };

  const handleAddBorrowClick = () => {
    setFormError('');
    if (!borrowDraftProductId) {
      setFormError('Vui lòng chọn Loại chế phẩm máu cần mượn');
      return;
    }
    const qty = Number(borrowDraftQty);
    if (!qty || qty <= 0) {
      setFormError('Số lượng mượn phải lớn hơn 0');
      borrowQtyInputRef.current?.focus();
      return;
    }

    const bp = categories.bloodProducts.find((p) => String(p.id) === String(borrowDraftProductId));
    const vol = categories.volumes.find((v) => String(v.id) === String(borrowDraftVolumeId));

    setBorrowList((prev) => [
      ...prev,
      {
        blood_code: borrowDraftBloodCode.trim().toUpperCase() || '',
        blood_product_id: borrowDraftProductId,
        product_name: bp?.name || 'Chế phẩm máu',
        blood_group: borrowDraftGroup,
        rh_factor: borrowDraftRh,
        volume_id: borrowDraftVolumeId,
        volume_name: vol?.name || '250ml',
        expiry_date: borrowDraftExpiry,
        quantity: qty,
        note: borrowDraftNote.trim(),
      },
    ]);

    setBorrowDraftBloodCode('');
    setBorrowDraftQty(1);
    setBorrowDraftNote('');
    setTimeout(() => borrowBloodCodeInputRef.current?.focus(), 50);
  };

  // ==================== SUBMIT CHO MƯỢN ====================
  const handleSubmitLend = async (e) => {
    e.preventDefault();
    if (lendList.length === 0) {
      setFormError('Vui lòng chọn chế phẩm máu và bấm dấu + (hoặc Enter) để đưa xuống danh sách cho mượn!');
      return;
    }

    setMessage('');
    setError('');
    setFormError('');
    setSubmitting(true);
    const formattedName = personName.trim() ? formatPersonName(personName) : '';

    try {
      const res = await api.post('/transactions/lend', {
        partner_id: partnerId || null,
        person_name: formattedName,
        due_date: dueDate || null,
        note,
        items: lendList.map((it) => ({
          lot_id: it.lot_id,
          quantity: it.quantity,
          note: it.note,
        })),
      });
      setMessage(`${res.data.message} (Mã phiếu: ${res.data.code})`);
      setDrawerMode(null);
      resetForms();
      fetchData();
      const detail = await api.get(`/transactions/${res.data.id}`);
      setPrintTx(detail.data);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Lỗi khi tạo phiếu Cho mượn');
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== SUBMIT MƯỢN MÁU ====================
  const handleSubmitBorrow = async (e) => {
    e.preventDefault();
    if (borrowList.length === 0) {
      setFormError('Vui lòng nhập chế phẩm máu và bấm dấu + (hoặc Enter) để đưa xuống danh sách mượn về kho!');
      return;
    }

    setMessage('');
    setError('');
    setFormError('');
    setSubmitting(true);
    const formattedName = personName.trim() ? formatPersonName(personName) : '';

    try {
      const res = await api.post('/transactions/borrow', {
        partner_id: partnerId || null,
        person_name: formattedName,
        due_date: dueDate || null,
        note,
        items: borrowList.map((it) => ({
          blood_code: it.blood_code || null,
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
      setDrawerMode(null);
      resetForms();
      fetchData();
      const detail = await api.get(`/transactions/${res.data.id}`);
      setPrintTx(detail.data);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Lỗi khi tạo phiếu Mượn');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForms = () => {
    setPartnerId('');
    setPersonName('');
    setDueDate('');
    setNote('');
    setLendList([]);
    setLendDraftBloodCode('');
    setLendDraftLotId('');
    setLendDraftQty(1);
    setLendDraftNote('');
    setBorrowList([]);
    setBorrowDraftBloodCode('');
    setBorrowDraftQty(1);
    setBorrowDraftNote('');
    setFormError('');
  };

  // Thống kê số lượng chỉ số
  const counts = useMemo(() => {
    let total = transactions.length;
    let lendPending = 0;
    let borrowPending = 0;
    let completed = 0;
    let pending = 0;
    let partial = 0;

    for (const t of transactions) {
      if (t.return_status === 'COMPLETED') {
        completed++;
      } else {
        if (t.tx_type === 'LEND') lendPending++;
        if (t.tx_type === 'BORROW') borrowPending++;
        if (t.return_status === 'PENDING') pending++;
        if (t.return_status === 'PARTIAL') partial++;
      }
    }

    return { total, lendPending, borrowPending, completed, pending, partial };
  }, [transactions]);

  // Bộ lọc danh sách giao dịch
  const filteredTxs = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== 'ALL' && t.tx_type !== typeFilter) return false;
      if (statusFilter === 'PENDING_OR_PARTIAL') {
        if (t.return_status === 'COMPLETED') return false;
      } else if (statusFilter !== 'ALL' && t.return_status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = t.code && t.code.toLowerCase().includes(q);
        const matchPartner = t.partner_name && t.partner_name.toLowerCase().includes(q);
        const matchPerson = t.person_name && t.person_name.toLowerCase().includes(q);
        const matchNote = t.note && t.note.toLowerCase().includes(q);
        const matchItems =
          t.items &&
          t.items.some(
            (it) =>
              (it.blood_code && it.blood_code.toLowerCase().includes(q)) ||
              (it.product_name && it.product_name.toLowerCase().includes(q)) ||
              (it.blood_group && it.blood_group.toLowerCase().includes(q))
          );

        if (!matchCode && !matchPartner && !matchPerson && !matchNote && !matchItems) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, typeFilter, statusFilter, searchQuery]);

  // Mở modal hoàn trả
  const openReturnModal = (tx) => {
    setReturnModalTx(tx);
    setReturnPerson(tx.person_name || '');
    setReturnNote('');
    setReturnItems(
      (tx.items || []).map((it) => ({
        item_id: it.id,
        blood_code: it.blood_code,
        product_name: it.product_name,
        blood_group: it.blood_group,
        rh_factor: it.rh_factor,
        volume_name: it.volume_name,
        quantity: it.quantity,
        returned_quantity: it.returned_quantity,
        remaining: it.quantity - it.returned_quantity,
        return_quantity: it.quantity - it.returned_quantity,
        expiry_date: it.expiry_date ? it.expiry_date.slice(0, 10) : defaultExpiry(),
      }))
    );
  };

  const handleConfirmReturn = async (e) => {
    e.preventDefault();
    if (!returnModalTx) return;

    const totalToReturn = returnItems.reduce(
      (sum, it) => sum + Number(it.return_quantity || 0),
      0
    );
    if (totalToReturn <= 0) {
      alert('Vui lòng nhập số lượng hoàn trả lớn hơn 0');
      return;
    }

    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const res = await api.post(`/transactions/${returnModalTx.id}/return`, {
        person_name: formatPersonName(returnPerson),
        note: returnNote,
        items: returnItems.map((r) => ({
          item_id: r.item_id,
          return_quantity: Number(r.return_quantity),
          expiry_date: r.expiry_date,
        })),
      });
      setMessage(`${res.data.message} (Mã phiếu hoàn trả: ${res.data.returnCode})`);
      setReturnModalTx(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi khi ghi nhận hoàn trả');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '---';
    return new Date(d).toLocaleDateString('vi-VN');
  };

  const isOverdue = (dueDate, returnStatus) => {
    if (!dueDate || returnStatus === 'COMPLETED') return false;
    const today = new Date().toISOString().slice(0, 10);
    return dueDate.slice(0, 10) < today;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#fdf2fa] text-[#C5299B] flex items-center justify-center shrink-0">
            <Repeat className="w-5 h-5" />
          </div>
          <div>
            <h2 className="section-title text-base font-bold text-[#190072]">
              Quản lý Mượn & Cho mượn
            </h2>
            <p className="text-xs text-slate-500">
              Theo dõi xuất cho mượn, nhập mượn và tiến độ hoàn trả chế phẩm máu ({transactions.length} phiếu)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          {hasPermission('borrow_lend.create') && (
            <>
              <button
                type="button"
                onClick={() => {
                  resetForms();
                  setDrawerMode('LEND');
                  setMessage('');
                  setError('');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Cho mượn</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetForms();
                  setDrawerMode('BORROW');
                  setMessage('');
                  setError('');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-xs bg-[#C5299B] hover:bg-[#a82083] text-white"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Mượn máu</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Thông báo kết quả thao tác */}
      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && !drawerMode && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Hàng Thẻ Thống Kê Chỉ Số */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Tổng giao dịch */}
        <div
          onClick={() => {
            setTypeFilter('ALL');
            setStatusFilter('ALL');
            setCurrentPage(1);
          }}
          className={`group relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer bg-gradient-to-br from-[#f8f6fc] via-[#f3eefb] to-[#ede7f8] ${
            typeFilter === 'ALL' && statusFilter === 'ALL'
              ? 'border-[#190072] ring-2 ring-[#190072]/20 shadow-md scale-[1.01]'
              : 'border-indigo-100/90 hover:border-indigo-300 hover:shadow-xs'
          }`}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-indigo-200/30 blur-xl pointer-events-none" />
          <FileText className="absolute -right-3 -bottom-3 w-20 h-20 text-[#190072] opacity-[0.05] pointer-events-none transform -rotate-12 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between gap-2.5">
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-[#190072]/70 uppercase tracking-wider block">
                Tổng giao dịch
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-[#190072] tracking-tight">
                  {counts.total}
                </span>
                <span className="text-xs font-medium text-[#190072]/60">phiếu</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                Mọi đợt mượn & cho mượn
              </p>
            </div>
            <div
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                typeFilter === 'ALL' && statusFilter === 'ALL'
                  ? 'bg-[#190072] text-white shadow-xs'
                  : 'bg-white/80 text-[#190072] border border-[#190072]/15'
              }`}
            >
              <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* Card 2: Đang cho mượn */}
        <div
          onClick={() => {
            setTypeFilter('LEND');
            setStatusFilter('PENDING_OR_PARTIAL');
            setCurrentPage(1);
          }}
          className={`group relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer bg-gradient-to-br from-[#eff6ff] via-[#e0f2fe] to-[#dbeafe] ${
            typeFilter === 'LEND' && statusFilter === 'PENDING_OR_PARTIAL'
              ? 'border-indigo-600 ring-2 ring-indigo-600/20 shadow-md scale-[1.01]'
              : 'border-indigo-100 hover:border-indigo-300 hover:shadow-xs'
          }`}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-indigo-200/40 blur-xl pointer-events-none" />
          <ArrowUpRight className="absolute -right-3 -bottom-3 w-20 h-20 text-indigo-600 opacity-[0.06] pointer-events-none transform rotate-6 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between gap-2.5">
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block">
                Đang cho mượn
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-indigo-700 tracking-tight">
                  {counts.lendPending}
                </span>
                <span className="text-xs text-indigo-700/70 font-medium">phiếu</span>
                {counts.lendPending > 0 && (
                  <span className="text-[10px] font-bold text-indigo-800 bg-indigo-200/90 px-1.5 py-0.5 rounded-full ml-1">
                    Chờ trả
                  </span>
                )}
              </div>
              <p className="text-[11px] text-indigo-700/70 mt-0.5 truncate">
                Xuất kho, chờ đơn vị bạn hoàn trả
              </p>
            </div>
            <div
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                typeFilter === 'LEND' && statusFilter === 'PENDING_OR_PARTIAL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white/80 text-indigo-700 border border-indigo-200'
              }`}
            >
              <ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* Card 3: Đang đi mượn */}
        <div
          onClick={() => {
            setTypeFilter('BORROW');
            setStatusFilter('PENDING_OR_PARTIAL');
            setCurrentPage(1);
          }}
          className={`group relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer bg-gradient-to-br from-[#fffbeb] via-[#fef3c7]/60 to-[#fef0bc]/70 ${
            typeFilter === 'BORROW' && statusFilter === 'PENDING_OR_PARTIAL'
              ? 'border-amber-500 ring-2 ring-amber-500/25 shadow-md scale-[1.01]'
              : 'border-amber-200 hover:border-amber-300 hover:shadow-xs'
          }`}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-amber-300/30 blur-xl pointer-events-none" />
          <ArrowDownLeft className="absolute -right-3 -bottom-3 w-20 h-20 text-amber-600 opacity-[0.07] pointer-events-none transform -rotate-12 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between gap-2.5">
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                Đang đi mượn
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-amber-700 tracking-tight">
                  {counts.borrowPending}
                </span>
                <span className="text-xs text-amber-700/70 font-medium">phiếu</span>
                {counts.borrowPending > 0 && (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-200/90 px-1.5 py-0.5 rounded-full ml-1">
                    Cần trả
                  </span>
                )}
              </div>
              <p className="text-[11px] text-amber-800/70 mt-0.5 truncate">
                Mượn về kho, cần trả lại đối tác
              </p>
            </div>
            <div
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                typeFilter === 'BORROW' && statusFilter === 'PENDING_OR_PARTIAL'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white/80 text-amber-700 border border-amber-200'
              }`}
            >
              <ArrowDownLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* Card 4: Đã hoàn trả đủ */}
        <div
          onClick={() => {
            setTypeFilter('ALL');
            setStatusFilter('COMPLETED');
            setCurrentPage(1);
          }}
          className={`group relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer bg-gradient-to-br from-[#ecfdf5] via-[#d1fae5]/60 to-[#a7f3d0]/40 ${
            statusFilter === 'COMPLETED'
              ? 'border-emerald-600 ring-2 ring-emerald-600/20 shadow-md scale-[1.01]'
              : 'border-emerald-200 hover:border-emerald-300 hover:shadow-xs'
          }`}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-emerald-200/40 blur-xl pointer-events-none" />
          <CheckCircle2 className="absolute -right-3 -bottom-3 w-20 h-20 text-emerald-600 opacity-[0.06] pointer-events-none transform -rotate-12 transition-transform duration-300 group-hover:scale-110" />

          <div className="relative z-10 flex items-center justify-between gap-2.5">
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">
                Đã trả đủ
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
                  {counts.completed}
                </span>
                <span className="text-xs text-emerald-700/70 font-medium">phiếu</span>
              </div>
              <p className="text-[11px] text-emerald-700/70 mt-0.5 truncate">
                Đã tất toán toàn bộ lượng máu
              </p>
            </div>
            <div
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                statusFilter === 'COMPLETED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white/80 text-emerald-700 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bảng Danh Sách Phiếu & Bộ Lọc */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Thanh Tab trạng thái & Tìm kiếm */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 lg:pb-0">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                statusFilter === 'ALL'
                  ? 'bg-[#190072] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('PENDING');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Chưa trả ({counts.pending})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('PARTIAL');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 ${
                statusFilter === 'PARTIAL'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Trả một phần ({counts.partial})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('COMPLETED');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 ${
                statusFilter === 'COMPLETED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Đã trả đủ ({counts.completed})</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Lọc theo loại phiếu */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('ALL');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  typeFilter === 'ALL'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cả hai
              </button>
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('LEND');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  typeFilter === 'LEND'
                    ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cho mượn
              </button>
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('BORROW');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  typeFilter === 'BORROW'
                    ? 'bg-white text-[#C5299B] shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đi mượn
              </button>
            </div>

            {/* Ô tìm kiếm */}
            <div className="w-full sm:w-64 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm mã phiếu, đối tác, người nhận..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-[#C5299B] outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Bảng Danh Sách */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                <th className="py-3 px-4 text-left">Mã phiếu</th>
                <th className="py-3 px-3 text-center">Loại</th>
                <th className="py-3 px-4 text-left">Đơn vị đối tác</th>
                <th className="py-3 px-4 text-left">Người giao dịch</th>
                <th className="py-3 px-4 text-left">Chi tiết chế phẩm & Tiến độ trả</th>
                <th className="py-3 px-3 text-center">Hạn trả</th>
                <th className="py-3 px-3 text-center">Trạng thái hoàn trả</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Repeat className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    Không có phiếu Mượn / Cho mượn nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredTxs
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((tx) => {
                    const badge = STATUS_BADGES[tx.return_status] || STATUS_BADGES.PENDING;
                    const isLend = tx.tx_type === 'LEND';
                    const overdue = isOverdue(tx.due_date, tx.return_status);

                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setPrintTx(tx)}
                        title="Bấm để xem chi tiết phiếu"
                        className="cursor-pointer odd:bg-white even:bg-[#fdf2fa]/40 hover:bg-[#fce7f6]/50 transition"
                      >
                        {/* Mã phiếu */}
                        <td className="py-3.5 px-4 font-mono text-xs">
                          <div className="font-bold text-[#190072]">{tx.code}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {new Date(tx.tx_date).toLocaleDateString('vi-VN')}
                          </div>
                        </td>

                        {/* Loại phiếu */}
                        <td className="py-3.5 px-3 text-center">
                          {isLend ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              Cho mượn
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8] text-xs font-semibold">
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              Đi mượn
                            </span>
                          )}
                        </td>

                        {/* Đơn vị đối tác */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-medium text-slate-900">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{tx.partner_name || '---'}</span>
                          </div>
                          {tx.creator_name && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Lập bởi: {tx.creator_name}
                            </div>
                          )}
                        </td>

                        {/* Người giao dịch */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-800">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{tx.person_name || '---'}</span>
                          </div>
                          {tx.note && (
                            <div className="text-[11px] text-slate-400 italic truncate max-w-xs mt-0.5" title={tx.note}>
                              {tx.note}
                            </div>
                          )}
                        </td>

                        {/* Chi tiết chế phẩm & Tiến độ */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1.5 min-w-[240px]">
                            {(tx.items || []).map((it) => {
                              const pct = it.quantity > 0 ? Math.min(100, Math.round((it.returned_quantity / it.quantity) * 100)) : 0;
                              return (
                                <div
                                  key={it.id}
                                  className="text-xs bg-white/90 p-2 rounded-xl border border-slate-200 shadow-xs"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {it.blood_code && (
                                        <span className="font-mono text-[11px] font-semibold text-[#C5299B]">
                                          {it.blood_code}
                                        </span>
                                      )}
                                      <span className="px-1.5 py-0.5 rounded bg-[#fce7f6] text-[#190072] font-semibold text-[11px]">
                                        {it.blood_group}
                                        {it.rh_factor}
                                      </span>
                                      <span className="text-slate-800 font-medium">
                                        {it.product_name} ({it.volume_name || '250ml'})
                                      </span>
                                    </div>
                                    <span className="text-slate-600 font-semibold shrink-0">
                                      {it.returned_quantity}/{it.quantity}
                                    </span>
                                  </div>

                                  {/* Thanh tiến độ hoàn trả */}
                                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        pct >= 100
                                          ? 'bg-emerald-500'
                                          : pct > 0
                                          ? 'bg-sky-500'
                                          : 'bg-slate-300'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        {/* Hạn trả */}
                        <td className="py-3.5 px-3 text-center">
                          {tx.due_date ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`text-xs font-semibold ${
                                  overdue ? 'text-rose-600 font-bold animate-pulse' : 'text-slate-700'
                                }`}
                              >
                                {formatDate(tx.due_date)}
                              </span>
                              {overdue && (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full mt-0.5">
                                  Quá hạn
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">Không hẹn</span>
                          )}
                        </td>

                        {/* Trạng thái */}
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.badgeCls}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dotCls}`} />
                            {badge.label}
                          </span>
                          <div className="text-[11px] text-slate-500 mt-1 font-mono">
                            Đã trả: {tx.total_returned}/{tx.total_quantity}
                          </div>
                        </td>

                        {/* Thao tác */}
                        <td className="py-3.5 px-4 text-right">
                          <div
                            className="inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {tx.return_status !== 'COMPLETED' &&
                              hasPermission('borrow_lend.return') && (
                                <button
                                  type="button"
                                  onClick={() => openReturnModal(tx)}
                                  title="Ghi nhận hoàn trả chế phẩm máu"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition shadow-xs"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Hoàn trả</span>
                                </button>
                              )}
                            <button
                              type="button"
                              onClick={() => setPrintTx(tx)}
                              title="Xem & In phiếu"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
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
          totalItems={filteredTxs.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* 4. Drawer Trượt Phải: FORM CHO MƯỢN / MƯỢN RIÊNG BIỆT */}
      {hasPermission('borrow_lend.create') && drawerMode && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-300"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
            <div className="w-screen max-w-5xl sm:max-w-6xl xl:max-w-7xl 2xl:max-w-[1450px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              {/* Header Drawer */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      drawerMode === 'LEND'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8]'
                    }`}
                  >
                    {drawerMode === 'LEND' ? (
                      <ArrowUpRight className="w-5 h-5" />
                    ) : (
                      <ArrowDownLeft className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#190072]">
                      {drawerMode === 'LEND'
                        ? 'Tạo phiếu Cho mượn Chế phẩm máu'
                        : 'Tạo phiếu Mượn Chế phẩm máu'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {drawerMode === 'LEND'
                        ? 'Xuất chế phẩm máu trong kho cho đơn vị bạn mượn (trừ tồn kho)'
                        : 'Mượn chế phẩm máu từ đơn vị khác về kho lưu trữ (cộng tồn kho)'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerMode(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content: FORM CHO MƯỢN (LEND) */}
              {drawerMode === 'LEND' && (
                <form onSubmit={handleSubmitLend} className="flex-1 overflow-y-auto flex flex-col justify-between">
                  <div className="p-6 space-y-5">
                    {formError && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* Thông tin đối tác & người nhận (KHÔNG BẮT BUỘC) */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                            Đơn vị mượn
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
                          placeholder="-- Chọn đơn vị mượn (nếu có) --"
                          onAddNew={() => setAddPartnerOpen(true)}
                          addNewLabel="Thêm mới đơn vị đối tác..."
                          className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-indigo-600" />
                            Người mượn / Người nhận
                          </span>
                        </label>
                        <input
                          type="text"
                          value={personName}
                          onChange={(e) => setPersonName(e.target.value)}
                          placeholder="Họ tên người đến nhận máu..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-indigo-600 outline-none transition bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                            Ngày hẹn hoàn trả
                          </span>
                        </label>
                        <DateInput
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Ghi chú cho mượn
                        </label>
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Lý do cho mượn..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-indigo-600 outline-none transition bg-white"
                        />
                      </div>
                    </div>

                    {/* THANH NHẬP NHANH CHẾ PHẨM CHO MƯỢN (BẮT BUỘC NHẬP MÃ TÚI MÁU -> TỰ ĐỘNG LOAD THÔNG TIN) */}
                    <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                      <div className="text-xs font-bold text-indigo-950 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Droplet className="w-4 h-4 text-indigo-600" />
                          Nhập hoặc quét Mã túi máu trong kho để xuất cho mượn
                        </span>
                        {selectedLendLot && (
                          <span className="text-[11px] font-normal text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-lg border border-emerald-300">
                            Đã tải: <strong>{selectedLendLot.product_name}</strong> [{selectedLendLot.blood_group}{selectedLendLot.rh_factor}] (Tồn khả dụng: {lendRemainingStock} {selectedLendLot.unit_name})
                          </span>
                        )}
                      </div>

                      <div className="flex items-end gap-2 flex-nowrap">
                        {/* 1. Mã túi máu (BẮT BUỘC, TỰ ĐỘNG GỢI Ý & LỌC REALTIME) */}
                        <div className="w-[220px] shrink-0 relative z-30" ref={lendSuggestionsRef}>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                              <span>Mã túi máu <span className="text-rose-500 font-bold">*</span></span>
                              {matchingLendLots.length > 0 && lendDraftBloodCode.trim() && (
                                <span className="text-[10px] text-indigo-700 font-normal">
                                  {matchingLendLots.length} khớp
                                </span>
                              )}
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setScannerTarget('lend');
                                setScannerOpen(true);
                              }}
                              className="text-[11px] text-[#C5299B] font-semibold flex items-center gap-1 hover:underline"
                            >
                              <Camera className="w-3 h-3" />
                              <span>Camera</span>
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              ref={lendBloodCodeInputRef}
                              type="text"
                              autoFocus
                              value={lendDraftBloodCode}
                              onFocus={() => {
                                if (lendDraftBloodCode.trim()) setLendSuggestionsOpen(true);
                              }}
                              onChange={(e) => handleLendBloodCodeChange(e.target.value)}
                              onKeyDown={handleLendBloodCodeKeyDown}
                              placeholder="Nhập/quét mã túi máu"
                              className="w-full pl-3 pr-14 py-2 rounded-xl border border-amber-300 bg-yellow-50 text-xs font-mono font-semibold text-[#C5299B] uppercase outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 shadow-xs placeholder:normal-case placeholder:font-normal placeholder:font-sans placeholder:text-slate-400"
                            />
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setScannerTarget('lend');
                                  setScannerOpen(true);
                                }}
                                className="p-1 text-[#C5299B] hover:bg-[#C5299B]/10 rounded-lg active:scale-95 transition"
                                title="Quét mã túi máu bằng camera"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </button>
                              {lendDraftBloodCode && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLendDraftBloodCode('');
                                    setLendDraftLotId('');
                                    setLendSuggestionsOpen(false);
                                    lendBloodCodeInputRef.current?.focus();
                                  }}
                                  className="text-slate-400 hover:text-slate-600 p-0.5"
                                  title="Xóa mã"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* DROPDOWN GỢI Ý TÚI MÁU KHỚP MÃ REALTIME - CÁC CỘT THẲNG HÀNG DỄ SO SÁNH */}
                          {lendSuggestionsOpen && lendDraftBloodCode.trim() && (
                            <div className="absolute left-0 top-full mt-1.5 w-[760px] max-w-[calc(100vw-3rem)] bg-white rounded-2xl border border-indigo-200 shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                              <div className="px-3.5 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                                <span className="text-[11px] font-bold text-indigo-900">
                                  Túi máu khớp mã ({matchingLendLots.length})
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  Bấm để chọn nhanh
                                </span>
                              </div>

                              {/* Tiêu đề cột để so sánh thẳng hàng */}
                              <div className="px-3.5 py-1.5 bg-slate-50 border-b border-slate-200/80 grid grid-cols-[115px_42px_1fr_65px_100px_120px_70px] gap-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                <span>Mã túi</span>
                                <span className="text-center">Nhóm</span>
                                <span>Tên chế phẩm</span>
                                <span>Thể tích</span>
                                <span>Hạn dùng</span>
                                <span className="text-right">Tồn khả dụng</span>
                                <span className="text-center">Đã chọn</span>
                              </div>

                              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                                {matchingLendLots.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-slate-500">
                                    Không tìm thấy túi máu nào có mã chứa "<strong>{lendDraftBloodCode}</strong>" trong kho.
                                  </div>
                                ) : (
                                  matchingLendLots.map((lot) => {
                                    const inList = lendList.find((it) => Number(it.lot_id) === Number(lot.id))?.quantity || 0;
                                    const available = Math.max(0, Number(lot.quantity) - inList);
                                    const isSelected = selectedLendLot && Number(selectedLendLot.id) === Number(lot.id);

                                    return (
                                      <button
                                        key={lot.id}
                                        type="button"
                                        onClick={() => selectLendLotSuggestion(lot)}
                                        className={`w-full text-left px-3.5 py-2.5 transition grid grid-cols-[115px_42px_1fr_65px_100px_120px_70px] items-center gap-2.5 ${
                                          isSelected
                                            ? 'bg-indigo-100/70 border-l-4 border-indigo-600'
                                            : 'hover:bg-indigo-50/70'
                                        }`}
                                      >
                                        <span className="font-mono font-bold text-xs text-[#C5299B] truncate">
                                          {lot.blood_code}
                                        </span>
                                        <span className="px-1 py-0.5 rounded bg-[#fce7f6] text-[#190072] font-bold text-[10px] text-center">
                                          {lot.blood_group}{lot.rh_factor}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-800 truncate" title={lot.product_name}>
                                          {lot.product_name}
                                        </span>
                                        <span className="text-xs text-slate-600 truncate">
                                          {lot.volume_name || `${lot.volume_ml}ml`}
                                        </span>
                                        <span className="text-xs text-slate-500 truncate">
                                          HSD: {formatDate(lot.expiry_date)}
                                        </span>
                                        <span className={`text-xs font-bold text-right truncate ${available > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                          Tồn: {available} {lot.unit_name}
                                        </span>
                                        <div className="flex justify-center">
                                          {inList > 0 ? (
                                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                              Đã chọn {inList}
                                            </span>
                                          ) : (
                                            <span className="text-slate-300 text-xs">—</span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 2. Loại chế phẩm máu trong kho (TỰ ĐỘNG TẢI, KHÔNG CHO CHỌN) */}
                        <div className="flex-1 min-w-[180px]">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Loại chế phẩm máu
                          </label>
                          <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            value={selectedLendLot ? `${selectedLendLot.product_name} (${selectedLendLot.volume_name})` : ''}
                            placeholder="Tự động tải theo mã..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-100 text-slate-800 font-medium cursor-not-allowed"
                          />
                        </div>

                        {/* 3. Nhóm ABO (tự load) */}
                        <div className="w-[75px] shrink-0">
                          <label className="block text-xs text-slate-600 mb-1 text-center">
                            Nhóm ABO
                          </label>
                          <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            value={selectedLendLot ? `Nhóm ${selectedLendLot.blood_group}` : ''}
                            placeholder="ABO"
                            className="w-full px-1 py-2 rounded-xl border border-slate-200 text-xs bg-slate-100 text-slate-700 font-semibold text-center cursor-not-allowed"
                          />
                        </div>

                        {/* 4. Hệ Rh (tự load) */}
                        <div className="w-[65px] shrink-0">
                          <label className="block text-xs text-slate-600 mb-1 text-center">
                            Hệ Rh
                          </label>
                          <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            value={selectedLendLot ? `Rh(${selectedLendLot.rh_factor})` : ''}
                            placeholder="Rh"
                            className="w-full px-1 py-2 rounded-xl border border-slate-200 text-xs bg-slate-100 text-slate-700 font-semibold text-center cursor-not-allowed"
                          />
                        </div>

                        {/* 5. Thể tích (tự load) */}
                        <div className="w-[80px] shrink-0">
                          <label className="block text-xs text-slate-600 mb-1 text-center">
                            Thể tích
                          </label>
                          <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            value={selectedLendLot?.volume_name || ''}
                            placeholder="Thể tích"
                            className="w-full px-1 py-2 rounded-xl border border-slate-200 text-xs bg-slate-100 text-slate-700 font-medium text-center cursor-not-allowed"
                          />
                        </div>

                        {/* 6. Hạn sử dụng (tự load) */}
                        <div className="w-[95px] shrink-0">
                          <label className="block text-xs text-slate-600 mb-1 text-center">
                            Hạn dùng
                          </label>
                          <input
                            type="text"
                            readOnly
                            tabIndex={-1}
                            value={selectedLendLot ? formatDate(selectedLendLot.expiry_date) : ''}
                            placeholder="HSD"
                            className="w-full px-1 py-2 rounded-xl border border-slate-200 text-xs bg-slate-100 text-slate-700 text-center cursor-not-allowed text-[11px]"
                          />
                        </div>

                        {/* 7. Số lượng */}
                        <div className="w-[75px] shrink-0">
                          <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                            SL mượn
                          </label>
                          <input
                            ref={lendQtyInputRef}
                            type="number"
                            min={1}
                            max={lendRemainingStock || 999}
                            value={lendDraftQty}
                            onChange={(e) => setLendDraftQty(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddLendClick();
                              }
                            }}
                            className="w-full px-2 py-2 rounded-xl border border-indigo-200 bg-white text-xs font-bold text-center text-slate-800 outline-none focus:border-indigo-600"
                          />
                        </div>

                        {/* 8. Nút Thêm vào danh sách (+) - Đặt sang phải cùng dòng */}
                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={handleAddLendClick}
                            className="h-[38px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                            title="Thêm vào danh sách cho mượn (Enter)"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Thêm</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* BẢNG DANH SÁCH CHẾ PHẨM CHO MƯỢN ĐÃ THÊM */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-[#190072] uppercase tracking-wide">
                          Danh sách chế phẩm xuất cho mượn ({lendList.length} mục)
                        </span>
                        <span className="text-xs font-bold text-indigo-700">
                          Tổng số lượng: {lendList.reduce((sum, it) => sum + Number(it.quantity || 0), 0)} túi/bịch
                        </span>
                      </div>

                      {lendList.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 text-xs">
                          Chưa có chế phẩm nào. Hãy nhập Mã túi máu hoặc chọn Chế phẩm ở trên rồi bấm <strong>+ Thêm</strong> hoặc <strong>Enter</strong>!
                        </div>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                              <th className="py-2.5 px-3 text-center w-12">STT</th>
                              <th className="py-2.5 px-3 text-left">Mã túi máu</th>
                              <th className="py-2.5 px-3 text-left">Tên chế phẩm máu</th>
                              <th className="py-2.5 px-3 text-center">ABO / Rh</th>
                              <th className="py-2.5 px-3 text-center">Thể tích</th>
                              <th className="py-2.5 px-3 text-center">Hạn dùng</th>
                              <th className="py-2.5 px-3 text-center w-24">Số lượng</th>
                              <th className="py-2.5 px-3 text-left">Ghi chú</th>
                              <th className="py-2.5 px-3 text-right w-16">Xóa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {lendList.map((it, idx) => (
                              <tr key={it.lot_id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 text-center font-semibold text-slate-500">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-semibold text-[#C5299B]">
                                  {it.blood_code || '---'}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-900">
                                  {it.product_name}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded bg-[#fce7f6] text-[#190072] font-semibold text-[11px]">
                                    {it.blood_group} ({it.rh_factor})
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-700">
                                  {it.volume_name}
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-700">
                                  {formatDate(it.expiry_date)}
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-base text-indigo-700">
                                  {it.quantity}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {it.note || '---'}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLendList((prev) =>
                                        prev.filter((item) => item.lot_id !== it.lot_id)
                                      )
                                    }
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                    title="Xóa khỏi danh sách"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Footer Drawer Cho mượn */}
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDrawerMode(null)}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || lendList.length === 0}
                      className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>{submitting ? 'Đang xử lý...' : 'Hoàn tất'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Form Content: FORM MƯỢN MÁU (BORROW) */}
              {drawerMode === 'BORROW' && (
                <form onSubmit={handleSubmitBorrow} className="flex-1 overflow-y-auto flex flex-col justify-between">
                  <div className="p-6 space-y-5">
                    {formError && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* Thông tin đối tác & người nhận (KHÔNG BẮT BUỘC) */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-[#C5299B]" />
                            Mượn từ Đơn vị
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
                          placeholder="-- Chọn đơn vị cho mượn (nếu có) --"
                          onAddNew={() => setAddPartnerOpen(true)}
                          addNewLabel="Thêm mới đơn vị đối tác..."
                          className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-[#C5299B]" />
                            Ai mượn / Người nhận máu
                          </span>
                        </label>
                        <input
                          type="text"
                          value={personName}
                          onChange={(e) => setPersonName(e.target.value)}
                          placeholder="Tên nhân viên đi mượn / nhận..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#C5299B] outline-none transition bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-[#C5299B]" />
                            Ngày hẹn trả lại đối tác
                          </span>
                        </label>
                        <DateInput
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Ghi chú phiếu mượn
                        </label>
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Ghi chú phiếu mượn..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#C5299B] outline-none transition bg-white"
                        />
                      </div>
                    </div>

                    {/* THANH NHẬP NHANH CHẾ PHẨM MƯỢN VỀ KHO (NHẬP MÃ / TÊN -> ENTER / +) */}
                    <div className="p-4 rounded-2xl bg-[#fdf2fa] border border-[#f5c6e8] space-y-3">
                      <div className="text-xs font-bold text-[#190072] flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Droplet className="w-4 h-4 text-[#C5299B]" />
                          Nhập thông tin chế phẩm mượn về kho (Nhập/quét Mã hoặc chọn Tên chế phẩm)
                        </span>
                      </div>

                      <div className="flex items-end gap-2">
                        {/* 1. Mã túi máu */}
                        <div className="w-[180px] shrink-0">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-semibold text-slate-700">
                              Mã túi máu
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setScannerTarget('borrow');
                                setScannerOpen(true);
                              }}
                              className="text-[11px] text-[#C5299B] font-semibold flex items-center gap-1 hover:underline"
                            >
                              <Camera className="w-3 h-3" />
                              <span>Camera</span>
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              ref={borrowBloodCodeInputRef}
                              type="text"
                              value={borrowDraftBloodCode}
                              onChange={(e) => setBorrowDraftBloodCode(e.target.value.toUpperCase())}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddBorrowClick();
                                }
                              }}
                              placeholder="Nhập/quét mã túi máu"
                              className="w-full pl-3 pr-8 py-2 rounded-xl border border-amber-300 bg-yellow-50 text-xs font-mono font-semibold text-[#C5299B] uppercase outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 shadow-xs placeholder:normal-case placeholder:font-normal placeholder:font-sans placeholder:text-slate-400"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setScannerTarget('borrow');
                                setScannerOpen(true);
                              }}
                              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[#C5299B] hover:bg-[#C5299B]/10 rounded-lg active:scale-95 transition"
                              title="Quét mã túi máu bằng camera"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 2. Loại chế phẩm */}
                        <div className="flex-1 min-w-[180px]">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Loại chế phẩm máu
                          </label>
                          <SearchableSelect
                            value={borrowDraftProductId}
                            onChange={(val) => handleBorrowProductChange(val)}
                            options={categories.bloodProducts.map((bp) => ({
                              value: bp.id,
                              label: bp.name,
                              subLabel: bp.code,
                            }))}
                            placeholder="-- Chọn loại chế phẩm --"
                            className="px-3.5 py-2 rounded-xl border border-[#f5c6e8] text-xs bg-white"
                          />
                        </div>

                        {/* 3. Nhóm ABO */}
                        <div className="w-[80px] shrink-0">
                          <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                            Nhóm ABO
                          </label>
                          <SearchableSelect
                            value={borrowDraftGroup}
                            onChange={(val) => setBorrowDraftGroup(val)}
                            options={[
                              { value: 'O', label: 'Nhóm O' },
                              { value: 'A', label: 'Nhóm A' },
                              { value: 'B', label: 'Nhóm B' },
                              { value: 'AB', label: 'Nhóm AB' },
                            ]}
                            className="px-1 py-2 rounded-xl border border-[#f5c6e8] text-xs bg-white text-center"
                          />
                        </div>

                        {/* 4. Rh */}
                        <div className="w-[70px] shrink-0">
                          <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                            Hệ Rh
                          </label>
                          <SearchableSelect
                            value={borrowDraftRh}
                            onChange={(val) => setBorrowDraftRh(val)}
                            options={[
                              { value: '+', label: 'Rh+' },
                              { value: '-', label: 'Rh-' },
                            ]}
                            className="px-1 py-2 rounded-xl border border-[#f5c6e8] text-xs bg-white text-center"
                          />
                        </div>

                        {/* 5. Thể tích */}
                        <div className="w-[85px] shrink-0">
                          <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                            Thể tích
                          </label>
                          <SearchableSelect
                            value={borrowDraftVolumeId}
                            onChange={(val) => setBorrowDraftVolumeId(val)}
                            options={categories.volumes.map((v) => ({
                              value: v.id,
                              label: v.name,
                            }))}
                            placeholder="Thể tích"
                            className="px-1 py-2 rounded-xl border border-[#f5c6e8] text-xs bg-white text-center"
                          />
                        </div>

                        {/* 6. Hạn sử dụng */}
                        <div className="w-[105px] shrink-0">
                          <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                            Hạn dùng
                          </label>
                          <DateInput
                            value={borrowDraftExpiry}
                            onChange={(e) => setBorrowDraftExpiry(e.target.value)}
                            className="px-1 py-2 rounded-xl border border-[#f5c6e8] text-xs bg-white text-center text-[11px]"
                          />
                        </div>

                        {/* 7. Số lượng */}
                        <div className="w-[75px] shrink-0">
                          <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                            Số lượng
                          </label>
                          <input
                            ref={borrowQtyInputRef}
                            type="number"
                            min={1}
                            value={borrowDraftQty}
                            onChange={(e) => setBorrowDraftQty(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddBorrowClick();
                              }
                            }}
                            className="w-full px-2 py-2 rounded-xl border border-[#f5c6e8] bg-white text-xs font-bold text-center text-slate-800 outline-none focus:border-[#C5299B]"
                          />
                        </div>

                        {/* 8. Nút Thêm vào danh sách (+) - Cùng dòng bên phải */}
                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={handleAddBorrowClick}
                            className="h-[38px] px-4 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white font-semibold text-xs shadow-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                            title="Thêm vào danh sách mượn (Enter)"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Thêm</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* BẢNG DANH SÁCH CHẾ PHẨM MƯỢN VỀ KHO ĐÃ THÊM */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-[#190072] uppercase tracking-wide">
                          Danh sách chế phẩm mượn về kho ({borrowList.length} mục)
                        </span>
                        <span className="text-xs font-bold text-[#C5299B]">
                          Tổng số lượng: {borrowList.reduce((sum, it) => sum + Number(it.quantity || 0), 0)} túi/bịch
                        </span>
                      </div>

                      {borrowList.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 text-xs">
                          Chưa có chế phẩm nào. Hãy nhập thông tin chế phẩm ở trên rồi bấm <strong>+ Thêm</strong> hoặc <strong>Enter</strong>!
                        </div>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                              <th className="py-2.5 px-3 text-center w-12">STT</th>
                              <th className="py-2.5 px-3 text-left">Mã túi máu</th>
                              <th className="py-2.5 px-3 text-left">Tên chế phẩm máu</th>
                              <th className="py-2.5 px-3 text-center">ABO / Rh</th>
                              <th className="py-2.5 px-3 text-center">Thể tích</th>
                              <th className="py-2.5 px-3 text-center">Hạn dùng</th>
                              <th className="py-2.5 px-3 text-center w-24">Số lượng</th>
                              <th className="py-2.5 px-3 text-left">Ghi chú</th>
                              <th className="py-2.5 px-3 text-right w-16">Xóa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {borrowList.map((it, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 text-center font-semibold text-slate-500">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-semibold text-[#C5299B]">
                                  {it.blood_code || '---'}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-900">
                                  {it.product_name}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded bg-[#fce7f6] text-[#190072] font-semibold text-[11px]">
                                    {it.blood_group} ({it.rh_factor})
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-700">
                                  {it.volume_name}
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-700">
                                  {formatDate(it.expiry_date)}
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-base text-[#C5299B]">
                                  {it.quantity}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {it.note || '---'}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setBorrowList((prev) => prev.filter((_, i) => i !== idx))
                                    }
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                    title="Xóa khỏi danh sách"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Footer Drawer Mượn */}
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDrawerMode(null)}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || borrowList.length === 0}
                      className="px-6 py-2.5 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white font-semibold text-xs shadow-md shadow-[#C5299B]/20 flex items-center gap-2 transition disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>{submitting ? 'Đang xử lý...' : 'Hoàn tất'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal Hoàn Trả (Trả 1 phần hoặc Trả đủ) */}
      {returnModalTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="modal-title text-base font-bold text-[#190072]">
                    Ghi nhận Hoàn trả — Phiếu {returnModalTx.code}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {returnModalTx.tx_type === 'LEND'
                      ? `Nhận lại chế phẩm máu từ đối tác: ${returnModalTx.partner_name || 'Đơn vị bạn'} (Cộng lại vào kho)`
                      : `Xuất trả chế phẩm máu cho đối tác: ${returnModalTx.partner_name || 'Đơn vị cho mượn'} (Trừ tồn kho)`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnModalTx(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmReturn} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Người giao / nhận hoàn trả
                  </label>
                  <input
                    type="text"
                    value={returnPerson}
                    onChange={(e) => setReturnPerson(e.target.value)}
                    placeholder="Họ tên người giao/nhận trả..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Ghi chú hoàn trả
                  </label>
                  <input
                    type="text"
                    value={returnNote}
                    onChange={(e) => setReturnNote(e.target.value)}
                    placeholder="Nhập ghi chú hoàn trả nếu có..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-600 outline-none transition"
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                      <th className="py-2.5 px-3 text-left">Chế phẩm máu</th>
                      <th className="py-2.5 px-3 text-center">Gốc</th>
                      <th className="py-2.5 px-3 text-center">Đã trả</th>
                      <th className="py-2.5 px-3 text-center">Còn lại</th>
                      <th className="py-2.5 px-3 text-center w-28">Trả đợt này</th>
                      {returnModalTx.tx_type === 'LEND' && (
                        <th className="py-2.5 px-3 text-left w-36">HSD nhận lại</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {returnItems.map((rit, idx) => (
                      <tr key={rit.item_id}>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {rit.blood_code && (
                              <span className="font-mono text-[11px] font-semibold text-[#C5299B]">
                                {rit.blood_code}
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 rounded bg-[#fce7f6] text-[#190072] font-semibold text-[11px]">
                              {rit.blood_group}
                              {rit.rh_factor}
                            </span>
                            <span className="font-medium text-slate-900 text-xs">
                              {rit.product_name} ({rit.volume_name})
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {rit.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-emerald-700">
                          {rit.returned_quantity}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-amber-700">
                          {rit.remaining}
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min={0}
                            max={rit.remaining}
                            value={rit.return_quantity}
                            onChange={(e) => {
                              const next = [...returnItems];
                              next[idx].return_quantity = e.target.value;
                              setReturnItems(next);
                            }}
                            className="w-full px-2 py-1.5 rounded-xl border border-slate-300 text-center font-bold text-emerald-700 outline-none focus:border-emerald-600"
                          />
                        </td>
                        {returnModalTx.tx_type === 'LEND' && (
                          <td className="py-2.5 px-3">
                            <DateInput
                              value={rit.expiry_date}
                              onChange={(e) => {
                                const next = [...returnItems];
                                next[idx].expiry_date = e.target.value;
                                setReturnItems(next);
                              }}
                              className="px-2 py-1.5 rounded-xl border border-slate-300 text-xs"
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnModalTx(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : 'Xác nhận Hoàn trả'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thêm Nhanh Đối Tác */}
      <QuickAddPartnerModal
        open={addPartnerOpen}
        onClose={() => setAddPartnerOpen(false)}
        onCreated={(newId) => {
          if (newId) setPartnerId(newId);
        }}
      />

      {/* Modal In & Chi Tiết Phiếu */}
      {printTx && (
        <PrintSlipModal transaction={printTx} onClose={() => setPrintTx(null)} />
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title={
          scannerTarget === 'lend'
            ? 'Quét mã túi máu cho mượn'
            : scannerTarget === 'borrow'
            ? 'Quét mã túi máu mượn về'
            : 'Quét tìm kiếm phiếu'
        }
        description="Quét mã vạch trên nhãn túi máu để tự động nhận diện"
        continuous={scannerTarget === 'lend'}
        onScan={handleScanResult}
      />
    </div>
  );
}
