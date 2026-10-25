import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ClipboardCheck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  FileSpreadsheet,
  ArrowLeft,
  RefreshCw,
  Droplet,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  Calendar,
  User,
  Users,
  Trash2,
  ChevronRight,
  ShieldCheck,
  Barcode,
  Layers,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  FileText,
  Camera,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import DateInput from '../components/DateInput';
import Pagination from '../components/Pagination';
import PrintAuditReportModal from '../components/PrintAuditReportModal';
import SearchableSelect from '../components/SearchableSelect';
import BarcodeScannerModal from '../components/BarcodeScannerModal';

export default function InventoryAuditView() {
  const { user, hasPermission, systemConfig, categories } = useAuth();

  // Mode: 'LIST' or 'DETAIL'
  const [viewMode, setViewMode] = useState('LIST');
  const [selectedAuditId, setSelectedAuditId] = useState(null);

  // Data states
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [auditDetail, setAuditDetail] = useState(null);
  const [auditItems, setAuditItems] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // List filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail filters
  const [itemSearch, setItemSearch] = useState('');
  const [itemStatusFilter, setItemStatusFilter] = useState('ALL');
  const [itemBloodGroupFilter, setItemBloodGroupFilter] = useState('ALL');

  // Scanner state
  const [scanCode, setScanCode] = useState('');
  const [scanMessage, setScanMessage] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const scanInputRef = useRef(null);

  // Helper tính tên kỳ kiểm kê mặc định theo tháng/năm hiện tại
  const getDefaultAuditName = () => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `Kiểm kê quỹ máu định kỳ tháng ${mm}/${yyyy}`;
  };

  // Drawers & Modals
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Danh mục người dùng cho Ban kiểm kê
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedCommitteeUsers, setSelectedCommitteeUsers] = useState([]);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // Create Form State
  const [newAuditName, setNewAuditName] = useState(() => getDefaultAuditName());
  const [newAuditDate, setNewAuditDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newAuditCommittee, setNewAuditCommittee] = useState('');
  const [newAuditNote, setNewAuditNote] = useState('');
  const [newInitMode, setNewInitMode] = useState('ZERO'); // 'ZERO' or 'SYSTEM'
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Complete Form State
  const [balanceInventory, setBalanceInventory] = useState(true);
  const [completeNote, setCompleteNote] = useState('');
  const [completing, setCompleting] = useState(false);

  // Flash / Notification message
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Tải danh mục người dùng để chọn ban kiểm kê với cơ chế 4 tầng dự phòng
  const fetchAvailableUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      let list = [];

      // 1. Endpoint chuyên dụng của kiểm kê
      try {
        const res = await api.get('/audits/helpers/users');
        if (Array.isArray(res.data) && res.data.length > 0) {
          list = res.data;
        }
      } catch (e) {
        console.warn('Endpoint /audits/helpers/users lỗi, thử fallback khác:', e);
      }

      // 2. Dự phòng từ AuthContext categories.users
      if (list.length === 0 && Array.isArray(categories?.users) && categories.users.length > 0) {
        list = categories.users;
      }

      // 3. Dự phòng gọi /categories/all trực tiếp
      if (list.length === 0) {
        try {
          const catRes = await api.get('/categories/all');
          if (Array.isArray(catRes.data?.users) && catRes.data.users.length > 0) {
            list = catRes.data.users;
          }
        } catch (e) {
          // ignore
        }
      }

      // 4. Dự phòng gọi /system/users (nếu user có quyền hoặc là admin)
      if (list.length === 0) {
        try {
          const sysRes = await api.get('/system/users');
          if (Array.isArray(sysRes.data) && sysRes.data.length > 0) {
            list = sysRes.data
              .filter((u) => u.is_active === 1 || u.is_active === true)
              .map((u) => ({
                id: u.id,
                full_name: u.full_name,
                username: u.username,
                phone: u.phone,
                role_name: u.role_name,
              }));
          }
        } catch (e) {
          // ignore
        }
      }

      if (list.length > 0) {
        setAvailableUsers(list);
        return list;
      }
    } catch (err) {
      console.error('Lỗi tải danh mục người dùng:', err);
    } finally {
      setLoadingUsers(false);
    }
    return [];
  }, [categories]);

  useEffect(() => {
    fetchAvailableUsers();
  }, [fetchAvailableUsers]);

  const openCreateDrawer = async () => {
    setNewAuditName(getDefaultAuditName());
    setNewAuditDate(new Date().toISOString().slice(0, 10));
    setNewAuditNote('');
    setNewInitMode('ZERO');
    setCreateError('');
    setUserPickerOpen(false);
    setUserSearchTerm('');

    // Luôn chủ động fetch lại danh sách để đảm bảo dữ liệu mới nhất
    const usersList = await fetchAvailableUsers();
    const currentList = usersList.length > 0 ? usersList : availableUsers;

    // Preselect current logged in user as first member if available
    if (user && currentList.length > 0) {
      const me = currentList.find((u) => u.id === user.id);
      if (me) {
        setSelectedCommitteeUsers([
          {
            id: me.id,
            name: me.full_name,
            roleTitle: 'Trưởng ban',
            roleName: me.role_name || '',
          },
        ]);
      } else {
        setSelectedCommitteeUsers([
          {
            id: user.id,
            name: user.full_name || user.username,
            roleTitle: 'Trưởng ban',
            roleName: user.role_name || '',
          },
        ]);
      }
    } else if (user) {
      setSelectedCommitteeUsers([
        {
          id: user.id,
          name: user.full_name || user.username,
          roleTitle: 'Trưởng ban',
          roleName: user.role_name || '',
        },
      ]);
    } else {
      setSelectedCommitteeUsers([]);
    }

    setCreateDrawerOpen(true);
  };

  const handleAddUserToCommittee = (u) => {
    if (selectedCommitteeUsers.some((mem) => mem.id === u.id)) return;
    let autoRole = 'Ủy viên';
    if (selectedCommitteeUsers.length === 0) autoRole = 'Trưởng ban';
    else if (selectedCommitteeUsers.length === 1) autoRole = 'Thư ký';
    else if (selectedCommitteeUsers.length === 2) autoRole = 'Thủ kho';

    setSelectedCommitteeUsers((prev) => [
      ...prev,
      {
        id: u.id,
        name: u.full_name,
        roleTitle: autoRole,
        roleName: u.role_name || '',
      },
    ]);
  };

  const handleRemoveUserFromCommittee = (userId) => {
    setSelectedCommitteeUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleChangeCommitteeRole = (userId, newRole) => {
    setSelectedCommitteeUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, roleTitle: newRole } : u))
    );
  };

  const formatDate = (d) => {
    if (!d) return '---';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('vi-VN');
  };

  const formatDateTime = (d) => {
    if (!d) return '---';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleString('vi-VN');
  };

  // 1. Fetch Audits List
  const fetchAudits = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const res = await api.get('/audits', { params });
      setAudits(res.data || []);
    } catch (err) {
      console.error('Lỗi tải danh sách kỳ kiểm kê:', err);
      showToast('Lỗi khi tải danh sách kỳ kiểm kê', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, fromDate, toDate]);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  // 2. Fetch Single Audit Detail
  const fetchAuditDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      setLoadingDetail(true);
      const res = await api.get(`/audits/${id}`);
      setAuditDetail(res.data.audit);
      setAuditItems(res.data.items || []);
    } catch (err) {
      console.error('Lỗi tải chi tiết kỳ kiểm kê:', err);
      showToast('Lỗi khi tải chi tiết kỳ kiểm kê: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const openAuditDetail = (auditId) => {
    setSelectedAuditId(auditId);
    setViewMode('DETAIL');
    setItemSearch('');
    setItemStatusFilter('ALL');
    setItemBloodGroupFilter('ALL');
    setScanCode('');
    setScanMessage(null);
    fetchAuditDetail(auditId);
    setTimeout(() => scanInputRef.current?.focus(), 300);
  };

  const backToList = () => {
    setViewMode('LIST');
    setSelectedAuditId(null);
    setAuditDetail(null);
    setAuditItems([]);
    fetchAudits();
  };

  // 3. Create New Audit Period
  const handleCreateAudit = async (e) => {
    e.preventDefault();
    if (!newAuditName.trim()) {
      setCreateError('Vui lòng nhập tên kỳ kiểm kê!');
      return;
    }

    // Format committee from selected users
    let committeeText = '';
    if (selectedCommitteeUsers.length > 0) {
      committeeText = selectedCommitteeUsers
        .map((u) => `${u.roleTitle ? u.roleTitle + ': ' : ''}${u.name}`)
        .join('\n');
      if (newAuditCommittee.trim()) {
        committeeText += '\n' + newAuditCommittee.trim();
      }
    } else {
      committeeText = newAuditCommittee.trim();
    }

    try {
      setCreating(true);
      setCreateError('');
      const payload = {
        name: newAuditName.trim(),
        audit_date: newAuditDate,
        committee: committeeText,
        note: newAuditNote.trim(),
        init_actual_mode: newInitMode,
      };
      const res = await api.post('/audits', payload);
      showToast(res.data.message || 'Đã tạo kỳ kiểm kê thành công!', 'success');
      setCreateDrawerOpen(false);
      setNewAuditName(getDefaultAuditName());
      setSelectedCommitteeUsers([]);
      setNewAuditCommittee('');
      setNewAuditNote('');
      setNewInitMode('ZERO');

      // Open detail of new audit
      if (res.data.audit?.id) {
        openAuditDetail(res.data.audit.id);
      } else {
        fetchAudits();
      }
    } catch (err) {
      console.error('Lỗi tạo kỳ kiểm kê:', err);
      setCreateError(err.response?.data?.error || 'Có lỗi xảy ra khi tạo kỳ kiểm kê');
    } finally {
      setCreating(false);
    }
  };

  // 4. Quick Barcode Scan / Enter Bag Code
  const handleScanSubmit = async (e) => {
    e?.preventDefault();
    if (!scanCode.trim() || !selectedAuditId) return;

    try {
      const code = scanCode.trim();
      setScanMessage(null);
      const res = await api.post(`/audits/${selectedAuditId}/scan`, { blood_code: code });

      // Update item in local list
      if (res.data.item) {
        setAuditItems((prev) => {
          const idx = prev.findIndex((i) => i.id === res.data.item.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.data.item;
            return next;
          }
          return [res.data.item, ...prev];
        });
      }
      if (res.data.audit) {
        setAuditDetail(res.data.audit);
      }

      setScanMessage({
        type: 'success',
        text: res.data.message || `Đã kiểm đếm thành công [${code}]!`,
      });
      setScanCode('');
      setTimeout(() => scanInputRef.current?.focus(), 50);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Lỗi quét mã túi máu';
      setScanMessage({
        type: 'error',
        text: errMsg,
      });
      setTimeout(() => scanInputRef.current?.select(), 50);
    }
  };

  const handleScanAuditBag = async (code) => {
    if (!code?.trim() || !selectedAuditId) return;
    try {
      const clean = code.trim().toUpperCase();
      const res = await api.post(`/audits/${selectedAuditId}/scan`, { blood_code: clean });
      if (res.data.item) {
        setAuditItems((prev) => {
          const idx = prev.findIndex((i) => i.id === res.data.item.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.data.item;
            return next;
          }
          return [res.data.item, ...prev];
        });
      }
      if (res.data.audit) {
        setAuditDetail(res.data.audit);
      }
      setScanMessage({
        type: 'success',
        text: res.data.message || `Đã kiểm đếm thành công [${clean}]!`,
      });
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Lỗi kiểm đếm túi máu';
      setScanMessage({
        type: 'error',
        text: errMsg,
      });
    }
  };

  // 5. Update Item Quantity Directly
  const handleUpdateItemQty = async (itemId, currentQty, delta) => {
    if (!selectedAuditId || auditDetail?.status !== 'IN_PROGRESS') return;
    const targetQty = Math.max(0, Number(currentQty) + delta);
    try {
      const res = await api.put(`/audits/${selectedAuditId}/items/${itemId}`, {
        actual_qty: targetQty,
      });
      if (res.data.item) {
        setAuditItems((prev) =>
          prev.map((i) => (i.id === itemId ? res.data.item : i))
        );
      }
      if (res.data.audit) {
        setAuditDetail(res.data.audit);
      }
    } catch (err) {
      showToast('Lỗi cập nhật số lượng: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleSetItemQtyExact = async (itemId, val) => {
    if (!selectedAuditId || auditDetail?.status !== 'IN_PROGRESS') return;
    const qty = Math.max(0, parseInt(val, 10) || 0);
    try {
      const res = await api.put(`/audits/${selectedAuditId}/items/${itemId}`, {
        actual_qty: qty,
      });
      if (res.data.item) {
        setAuditItems((prev) =>
          prev.map((i) => (i.id === itemId ? res.data.item : i))
        );
      }
      if (res.data.audit) {
        setAuditDetail(res.data.audit);
      }
    } catch (err) {
      showToast('Lỗi cập nhật số lượng: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleUpdateItemNote = async (itemId, noteText) => {
    if (!selectedAuditId || auditDetail?.status !== 'IN_PROGRESS') return;
    try {
      const res = await api.put(`/audits/${selectedAuditId}/items/${itemId}`, {
        note: noteText,
      });
      if (res.data.item) {
        setAuditItems((prev) =>
          prev.map((i) => (i.id === itemId ? res.data.item : i))
        );
      }
    } catch (err) {
      console.error('Lỗi cập nhật ghi chú:', err);
    }
  };

  // 6. Bulk Action
  const handleBulkAction = async (actionType) => {
    if (!selectedAuditId || auditDetail?.status !== 'IN_PROGRESS') return;
    const confirmMsg =
      actionType === 'MATCH_ALL_REMAINING'
        ? 'Bạn có chắc chắn muốn đặt tất cả các mục CHƯA KIỂM ĐẾM bằng đúng số lượng sổ sách không?'
        : 'Bạn có chắc chắn muốn đặt tất cả các mục CHƯA KIỂM ĐẾM về 0 (coi như thiếu) không?';

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.post(`/audits/${selectedAuditId}/bulk-action`, {
        action: actionType,
      });
      showToast(res.data.message || 'Thao tác thành công!', 'success');
      fetchAuditDetail(selectedAuditId);
    } catch (err) {
      showToast('Lỗi thao tác hàng loạt: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // 7. Complete Audit
  const handleConfirmComplete = async () => {
    if (!selectedAuditId) return;
    try {
      setCompleting(true);
      const res = await api.post(`/audits/${selectedAuditId}/complete`, {
        balance_inventory: balanceInventory,
        note: completeNote.trim(),
      });
      showToast(res.data.message || 'Đã chốt kỳ kiểm kê thành công!', 'success');
      setCompleteModalOpen(false);
      setCompleteNote('');
      fetchAuditDetail(selectedAuditId);
    } catch (err) {
      showToast('Lỗi chốt kỳ kiểm kê: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setCompleting(false);
    }
  };

  // 8. Delete Audit
  const handleDeleteAudit = async (auditId, e) => {
    e?.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa kỳ kiểm kê này không? Toàn bộ dữ liệu kiểm đếm sẽ bị xóa.')) return;
    try {
      await api.delete(`/audits/${auditId}`);
      showToast('Đã xóa kỳ kiểm kê thành công!', 'success');
      if (viewMode === 'DETAIL') {
        backToList();
      } else {
        fetchAudits();
      }
    } catch (err) {
      showToast('Lỗi xóa kỳ kiểm kê: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // 9. Export Excel
  const handleExportExcel = () => {
    if (!auditDetail) return;
    try {
      const dataRows = [];

      // Hospital & Title header rows
      dataRows.push([systemConfig?.hospital_name || 'BỆNH VIỆN / CƠ SỞ Y TẾ']);
      dataRows.push([systemConfig?.department_name || 'KHOA XÉT NGHIỆM - TỦ MÁU LÂM SÀNG']);
      dataRows.push(['']);
      dataRows.push(['BIÊN BẢN / BÁO CÁO KIỂM KÊ CHẾ PHẨM MÁU']);
      dataRows.push([`Mã kỳ kiểm kê: ${auditDetail.code}`, '', `Tên kỳ: ${auditDetail.name}`]);
      dataRows.push([`Ngày kiểm kê: ${formatDate(auditDetail.audit_date)}`, '', `Người lập: ${auditDetail.creator_name || ''}`]);
      dataRows.push([
        `Trạng thái: ${auditDetail.status === 'COMPLETED' ? 'Đã hoàn tất' : 'Đang kiểm kê'}`,
        '',
        `Cân bằng kho: ${auditDetail.is_balanced ? 'Đã cân bằng tồn kho' : 'Chưa cân bằng'}`,
      ]);
      dataRows.push(['']);

      // Table Header
      dataRows.push([
        'STT',
        'Mã túi máu',
        'Loại chế phẩm máu',
        'Nhóm ABO',
        'Hệ Rh',
        'Thể tích',
        'Hạn dùng',
        'Sổ sách (SL)',
        'Thực tế (SL)',
        'Chênh lệch (SL)',
        'Trạng thái',
        'Ghi chú / Hiện trạng',
      ]);

      // Items
      auditItems.forEach((item, idx) => {
        const diff = Number(item.diff_qty) || 0;
        const statusLabel =
          item.status === 'MATCHED'
            ? 'Khớp'
            : item.status === 'EXCESS'
            ? `Thừa (+${diff})`
            : item.status === 'DEFICIT'
            ? `Thiếu (${diff})`
            : 'Chưa kiểm đếm';

        dataRows.push([
          idx + 1,
          item.blood_code || '',
          item.product_name || '',
          item.blood_group || '',
          item.rh_factor || '',
          item.volume_name || '',
          formatDate(item.expiry_date),
          Number(item.system_qty) || 0,
          Number(item.actual_qty) || 0,
          diff,
          statusLabel,
          item.note || '',
        ]);
      });

      // Total row
      const totalSys = auditItems.reduce((s, i) => s + (Number(i.system_qty) || 0), 0);
      const totalAct = auditItems.reduce((s, i) => s + (Number(i.actual_qty) || 0), 0);
      const totalDiff = totalAct - totalSys;

      dataRows.push([
        'TỔNG CỘNG',
        '',
        '',
        '',
        '',
        '',
        '',
        totalSys,
        totalAct,
        totalDiff,
        totalDiff === 0 ? 'Khớp hoàn toàn' : totalDiff > 0 ? `Thừa +${totalDiff}` : `Thiếu ${totalDiff}`,
        '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet(dataRows);

      // Set column widths
      ws['!cols'] = [
        { wch: 6 },
        { wch: 18 },
        { wch: 30 },
        { wch: 12 },
        { wch: 10 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
        { wch: 18 },
        { wch: 28 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bien_ban_kiem_ke');

      const fileName = `Bien_ban_kiem_ke_${auditDetail.code}_${auditDetail.audit_date}.xlsx`;
      XLSX.writeFile(wb, fileName);

      showToast(`Đã xuất báo cáo Excel: ${fileName}`, 'success');
    } catch (err) {
      console.error('Lỗi xuất Excel:', err);
      showToast('Lỗi khi xuất file Excel', 'error');
    }
  };

  // Filtered Items for Detail View
  const filteredItems = useMemo(() => {
    return auditItems.filter((item) => {
      if (itemStatusFilter !== 'ALL') {
        if (itemStatusFilter === 'DIFF') {
          if (item.status !== 'EXCESS' && item.status !== 'DEFICIT') return false;
        } else if (item.status !== itemStatusFilter) {
          return false;
        }
      }
      if (itemBloodGroupFilter !== 'ALL' && item.blood_group !== itemBloodGroupFilter) {
        return false;
      }
      if (itemSearch.trim()) {
        const q = itemSearch.trim().toLowerCase();
        const code = (item.blood_code || '').toLowerCase();
        const name = (item.product_name || '').toLowerCase();
        const note = (item.note || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !note.includes(q)) return false;
      }
      return true;
    });
  }, [auditItems, itemStatusFilter, itemBloodGroupFilter, itemSearch]);

  // Overall KPIs for Detail
  const detailKPIs = useMemo(() => {
    if (!auditDetail) return { totalSys: 0, totalAct: 0, totalDiff: 0, matched: 0, excess: 0, deficit: 0, uncounted: 0, pct: 0 };
    const totalSys = auditDetail.total_system_qty || 0;
    const totalAct = auditDetail.total_actual_qty || 0;
    const totalDiff = auditDetail.total_diff_qty || 0;
    const matched = auditDetail.matched_count || 0;
    const excess = auditDetail.excess_count || 0;
    const deficit = auditDetail.deficit_count || 0;
    const uncounted = auditDetail.uncounted_count || 0;
    const totalItems = auditItems.length || 1;
    const countedItems = totalItems - uncounted;
    const pct = Math.min(100, Math.round((countedItems / totalItems) * 100));

    return { totalSys, totalAct, totalDiff, matched, excess, deficit, uncounted, pct };
  }, [auditDetail, auditItems]);

  // Overall KPIs for List
  const listKPIs = useMemo(() => {
    const totalAudits = audits.length;
    const inProgress = audits.filter((a) => a.status === 'IN_PROGRESS').length;
    const completed = audits.filter((a) => a.status === 'COMPLETED').length;
    const totalDiffBags = audits.reduce((s, a) => s + Math.abs(a.total_diff_qty || 0), 0);
    return { totalAudits, inProgress, completed, totalDiffBags };
  }, [audits]);

  // Pagination for List View
  const paginatedAudits = useMemo(() => {
    const start = (page - 1) * pageSize;
    return audits.slice(start, start + pageSize);
  }, [audits, page, pageSize]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast thông báo */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[100000] px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-3 duration-200 ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MÀN HÌNH DANH SÁCH CÁC KỲ KIỂM KÊ (VIEW_MODE = 'LIST')                 */}
      {/* ========================================================================= */}
      {viewMode === 'LIST' && (
        <>
          {/* Header & Tiêu đề */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8] flex items-center justify-center shadow-xs">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-[#190072]">
                    Kiểm Kê Kho Chế Phẩm Máu
                  </h1>
                  <p className="text-xs text-slate-500">
                    Tạo kỳ kiểm kê định kỳ, kiểm đếm thực tế bằng quét mã túi máu và xuất biên bản
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchAudits}
                disabled={loading}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition shadow-xs"
                title="Tải lại danh sách"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {hasPermission('audit.create') && (
                <button
                  type="button"
                  onClick={openCreateDrawer}
                  className="px-4 py-2.5 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white font-semibold text-xs shadow-md shadow-[#C5299B]/20 transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo kỳ kiểm kê mới</span>
                </button>
              )}
            </div>
          </div>

          {/* KPI Thống kê các kỳ kiểm kê */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                Tổng kỳ kiểm kê
              </div>
              <div className="text-2xl font-black text-slate-800">
                {listKPIs.totalAudits}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Tất cả các đợt kiểm kê</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-amber-200/80 shadow-xs bg-gradient-to-br from-amber-50/40 to-transparent">
              <div className="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                Đang kiểm đếm
              </div>
              <div className="text-2xl font-black text-amber-900">
                {listKPIs.inProgress}
              </div>
              <div className="text-[11px] text-amber-600/80 mt-0.5">Kỳ chưa chốt sổ</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs bg-gradient-to-br from-emerald-50/40 to-transparent">
              <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Đã chốt hoàn tất
              </div>
              <div className="text-2xl font-black text-emerald-900">
                {listKPIs.completed}
              </div>
              <div className="text-[11px] text-emerald-600/80 mt-0.5">Đã cân bằng / lưu hồ sơ</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-rose-200/80 shadow-xs bg-gradient-to-br from-rose-50/40 to-transparent">
              <div className="text-[11px] font-semibold text-rose-700 flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Chênh lệch phát hiện
              </div>
              <div className="text-2xl font-black text-rose-900">
                {listKPIs.totalDiffBags} <span className="text-xs font-normal text-rose-600">túi</span>
              </div>
              <div className="text-[11px] text-rose-600/80 mt-0.5">Tổng số túi lệch thừa / thiếu</div>
            </div>
          </div>

          {/* Bộ lọc danh sách kỳ kiểm kê */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm theo mã kỳ, tên kỳ hoặc người lập..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:border-indigo-600 outline-none transition"
                />
              </div>

              {/* Lọc trạng thái */}
              <div className="w-36">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:border-indigo-600 outline-none font-medium"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="IN_PROGRESS">Đang kiểm kê</option>
                  <option value="COMPLETED">Đã hoàn tất</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>

              {/* Lọc ngày kiểm kê */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="shrink-0 text-slate-400">Từ:</span>
                <DateInput
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs w-32"
                />
                <span className="shrink-0 text-slate-400">Đến:</span>
                <DateInput
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs w-32"
                />
              </div>
            </div>
          </div>

          {/* Bảng danh sách các kỳ kiểm kê */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                    <th className="py-3 px-4">Mã kỳ</th>
                    <th className="py-3 px-4">Tên đợt kiểm kê</th>
                    <th className="py-3 px-3 text-center">Ngày kiểm kê</th>
                    <th className="py-3 px-3">Người lập</th>
                    <th className="py-3 px-3 text-center">Sổ sách</th>
                    <th className="py-3 px-3 text-center">Thực tế</th>
                    <th className="py-3 px-3 text-center">Chênh lệch</th>
                    <th className="py-3 px-3 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        Đang tải danh sách kỳ kiểm kê...
                      </td>
                    </tr>
                  ) : paginatedAudits.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
                        Không tìm thấy kỳ kiểm kê nào phù hợp. Bấm <strong>"Tạo kỳ kiểm kê mới"</strong> để bắt đầu!
                      </td>
                    </tr>
                  ) : (
                    paginatedAudits.map((audit) => {
                      const diff = Number(audit.total_diff_qty) || 0;
                      return (
                        <tr
                          key={audit.id}
                          onClick={() => openAuditDetail(audit.id)}
                          className="hover:bg-slate-50/80 transition cursor-pointer group"
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-[#C5299B] whitespace-nowrap">
                            {audit.code}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-[#190072]">
                            <div className="flex items-center gap-1.5">
                              <span>{audit.name}</span>
                              {audit.is_balanced === 1 && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-normal px-1.5 py-0.2 rounded border border-emerald-300">
                                  Đã cân bằng
                                </span>
                              )}
                            </div>
                            {audit.note && (
                              <div className="text-[11px] text-slate-400 font-normal line-clamp-1 mt-0.5">
                                {audit.note}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center text-slate-600 whitespace-nowrap">
                            {formatDate(audit.audit_date)}
                          </td>
                          <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                            {audit.creator_full_name || audit.creator_name || 'Quản trị viên'}
                          </td>
                          <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                            {audit.total_system_qty}
                          </td>
                          <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                            {audit.total_actual_qty}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {diff === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Khớp (0)
                              </span>
                            ) : diff > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center gap-0.5 mx-auto w-fit">
                                <TrendingUp className="w-3 h-3" />
                                Thừa +{diff}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center gap-0.5 mx-auto w-fit">
                                <TrendingDown className="w-3 h-3" />
                                Thiếu {diff}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {audit.status === 'IN_PROGRESS' ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center gap-1 w-fit mx-auto animate-pulse">
                                <Clock className="w-3 h-3" />
                                Đang kiểm kê
                              </span>
                            ) : audit.status === 'COMPLETED' ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center gap-1 w-fit mx-auto">
                                <CheckCircle2 className="w-3 h-3" />
                                Đã hoàn tất
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-300">
                                Đã hủy
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openAuditDetail(audit.id)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs transition flex items-center gap-1"
                                title="Xem & Thực hiện kiểm kê"
                              >
                                <span>{audit.status === 'IN_PROGRESS' ? 'Kiểm kê' : 'Xem chi tiết'}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>

                              {hasPermission('audit.delete') && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteAudit(audit.id, e)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                                  title="Xóa kỳ kiểm kê"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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

            {/* Phân trang */}
            {audits.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                <Pagination
                  total={audits.length}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 2. MÀN HÌNH CHI TIẾT & THỰC HIỆN KIỂM KÊ (VIEW_MODE = 'DETAIL')           */}
      {/* ========================================================================= */}
      {viewMode === 'DETAIL' && auditDetail && (
        <div className="space-y-5">
          {/* Top Bar Detail */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={backToList}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition border border-slate-200 shrink-0"
                title="Quay lại danh sách"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-sm text-[#C5299B]">
                    {auditDetail.code}
                  </span>
                  <span className="text-slate-300">•</span>
                  <h2 className="text-base font-bold text-[#190072]">
                    {auditDetail.name}
                  </h2>
                  {auditDetail.status === 'IN_PROGRESS' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse">
                      Đang kiểm kê
                    </span>
                  ) : auditDetail.status === 'COMPLETED' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Đã hoàn tất
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                      Đã hủy
                    </span>
                  )}
                  {auditDetail.is_balanced === 1 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Đã cân bằng kho
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-3 mt-1 flex-wrap">
                  <span>Ngày kiểm kê: <strong>{formatDate(auditDetail.audit_date)}</strong></span>
                  <span>•</span>
                  <span>Người tạo: <strong>{auditDetail.creator_name || auditDetail.creator_full_name || 'Admin'}</strong></span>
                  {auditDetail.completed_at && (
                    <>
                      <span>•</span>
                      <span>Chốt lúc: <strong>{formatDateTime(auditDetail.completed_at)}</strong> (bởi {auditDetail.completer_name || 'Admin'})</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => setPrintModalOpen(true)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition flex items-center gap-1.5 shadow-xs"
                title="In Biên bản kiểm kê"
              >
                <Printer className="w-4 h-4 text-indigo-600" />
                <span>In Biên bản</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-xs"
                title="Xuất file Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Xuất Excel</span>
              </button>

              {auditDetail.status === 'IN_PROGRESS' && hasPermission('audit.close') && (
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#190072] hover:bg-[#120055] text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-md shadow-[#190072]/20"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Chốt kiểm kê</span>
                </button>
              )}
            </div>
          </div>

          {/* Real-time KPI Stats of this Audit */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">Sổ sách hệ thống</div>
              <div className="text-xl font-black text-slate-800 mt-0.5">
                {detailKPIs.totalSys} <span className="text-xs font-normal text-slate-400">túi</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">Thực tế đếm được</div>
              <div className="text-xl font-black text-slate-900 mt-0.5">
                {detailKPIs.totalAct} <span className="text-xs font-normal text-slate-400">túi</span>
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border shadow-xs ${
              detailKPIs.totalDiff === 0
                ? 'bg-emerald-50/50 border-emerald-200'
                : detailKPIs.totalDiff > 0
                ? 'bg-amber-50/50 border-amber-200'
                : 'bg-rose-50/50 border-rose-200'
            }`}>
              <div className="text-[11px] font-semibold text-slate-700">Chênh lệch tổng</div>
              <div className={`text-xl font-black mt-0.5 ${
                detailKPIs.totalDiff === 0
                  ? 'text-emerald-700'
                  : detailKPIs.totalDiff > 0
                  ? 'text-amber-700'
                  : 'text-rose-700'
              }`}>
                {detailKPIs.totalDiff === 0 ? 'Khớp (0)' : detailKPIs.totalDiff > 0 ? `+${detailKPIs.totalDiff}` : detailKPIs.totalDiff}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-emerald-200 shadow-xs">
              <div className="text-[11px] font-semibold text-emerald-700">Mục khớp 100%</div>
              <div className="text-xl font-black text-emerald-800 mt-0.5">
                {detailKPIs.matched} <span className="text-xs font-normal text-emerald-600">mục</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-rose-200 shadow-xs">
              <div className="text-[11px] font-semibold text-rose-700">Mục chênh lệch</div>
              <div className="text-xl font-black text-rose-800 mt-0.5">
                {detailKPIs.excess + detailKPIs.deficit} <span className="text-xs font-normal text-rose-600">mục</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Thừa: {detailKPIs.excess} • Thiếu: {detailKPIs.deficit}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-indigo-200 shadow-xs">
              <div className="text-[11px] font-semibold text-indigo-700 flex items-center justify-between">
                <span>Tiến độ kiểm đếm</span>
                <span>{detailKPIs.pct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2 overflow-hidden border border-slate-200">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${detailKPIs.pct}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Chưa đếm: {detailKPIs.uncounted} mục
              </div>
            </div>
          </div>

          {/* Thanh Nhập / Quét mã túi máu thời gian thực (KHI KỲ ĐANG MỞ) */}
          {auditDetail.status === 'IN_PROGRESS' && hasPermission('audit.execute') && (
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                <span className="flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-indigo-600" />
                  Quét hoặc Nhập mã túi máu để ghi nhận kiểm đếm thực tế
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  Nhập mã túi máu rồi bấm <strong>Enter</strong> để tăng số lượng thực tế +1
                </span>
              </div>

              <form onSubmit={handleScanSubmit} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex-1 relative min-w-[200px]">
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanCode}
                    onChange={(e) => setScanCode(e.target.value.toUpperCase())}
                    placeholder="Nhập hoặc quét mã túi máu..."
                    className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-amber-300 bg-yellow-50 text-xs font-mono font-bold text-[#C5299B] uppercase outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 shadow-xs placeholder:normal-case placeholder:font-normal placeholder:font-sans placeholder:text-slate-400"
                  />
                  {scanCode && (
                    <button
                      type="button"
                      onClick={() => setScanCode('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white font-semibold text-xs shadow-xs transition flex items-center gap-1.5 whitespace-nowrap shrink-0 active:scale-95"
                  title="Mở Camera quét mã túi máu liên tục"
                >
                  <Camera className="w-4 h-4" />
                  <span>Quét Camera</span>
                </button>

                <button
                  type="submit"
                  disabled={!scanCode.trim()}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Đếm túi này (Enter)</span>
                </button>

                {/* Nút thao tác nhanh hàng loạt */}
                <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-indigo-200">
                  <button
                    type="button"
                    onClick={() => handleBulkAction('MATCH_ALL_REMAINING')}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 text-xs font-semibold shadow-xs transition"
                    title="Đặt tất cả mục chưa kiểm = số lượng sổ sách"
                  >
                    Khớp các mục còn lại
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBulkAction('SET_UNCOUNTED_TO_ZERO')}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-rose-700 border border-rose-200 text-xs font-semibold shadow-xs transition"
                    title="Đặt tất cả mục chưa kiểm = 0 (coi như thiếu)"
                  >
                    Chốt thiếu mục chưa đếm
                  </button>
                </div>
              </form>

              {/* Thông báo quét */}
              {scanMessage && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150 ${
                    scanMessage.type === 'error'
                      ? 'bg-rose-100/80 text-rose-800 border border-rose-300'
                      : 'bg-emerald-100/80 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  <span>{scanMessage.text}</span>
                  <button
                    type="button"
                    onClick={() => setScanMessage(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bảng chi tiết danh mục túi máu của kỳ kiểm kê */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-3 p-4">
            {/* Filter Tabs & Search trong chi tiết */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setItemStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    itemStatusFilter === 'ALL'
                      ? 'bg-[#190072] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả ({auditItems.length})
                </button>

                <button
                  type="button"
                  onClick={() => setItemStatusFilter('MATCHED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 ${
                    itemStatusFilter === 'MATCHED'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  <Check className="w-3 h-3" />
                  Khớp ({detailKPIs.matched})
                </button>

                <button
                  type="button"
                  onClick={() => setItemStatusFilter('DIFF')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 ${
                    itemStatusFilter === 'DIFF'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  Lệch ({detailKPIs.excess + detailKPIs.deficit})
                </button>

                <button
                  type="button"
                  onClick={() => setItemStatusFilter('EXCESS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    itemStatusFilter === 'EXCESS'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  Thừa ({detailKPIs.excess})
                </button>

                <button
                  type="button"
                  onClick={() => setItemStatusFilter('DEFICIT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    itemStatusFilter === 'DEFICIT'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  Thiếu ({detailKPIs.deficit})
                </button>

                <button
                  type="button"
                  onClick={() => setItemStatusFilter('UNCOUNTED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    itemStatusFilter === 'UNCOUNTED'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Chưa kiểm ({detailKPIs.uncounted})
                </button>
              </div>

              {/* Tìm kiếm & Nhóm máu */}
              <div className="flex items-center gap-2">
                <select
                  value={itemBloodGroupFilter}
                  onChange={(e) => setItemBloodGroupFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white font-medium outline-none"
                >
                  <option value="ALL">Tất cả nhóm</option>
                  <option value="O">Nhóm O</option>
                  <option value="A">Nhóm A</option>
                  <option value="B">Nhóm B</option>
                  <option value="AB">Nhóm AB</option>
                </select>

                <div className="relative w-48 sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Tìm mã túi / tên..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>

            {/* Bảng chi tiết */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px]">
                    <th className="py-2.5 px-3 text-center w-12">STT</th>
                    <th className="py-2.5 px-3">Mã túi máu</th>
                    <th className="py-2.5 px-3">Loại chế phẩm</th>
                    <th className="py-2.5 px-2 text-center w-16">Nhóm</th>
                    <th className="py-2.5 px-2 text-center w-20">Thể tích</th>
                    <th className="py-2.5 px-2 text-center w-24">Hạn dùng</th>
                    <th className="py-2.5 px-3 text-center w-24 bg-blue-50/50">Sổ sách</th>
                    <th className="py-2.5 px-3 text-center w-32 bg-emerald-50/50">Thực tế</th>
                    <th className="py-2.5 px-3 text-center w-24">Chênh lệch</th>
                    <th className="py-2.5 px-3">Ghi chú hiện trạng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingDetail ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        Đang tải danh sách túi máu...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-400 italic">
                        Không tìm thấy túi máu nào theo bộ lọc này.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => {
                      const diff = Number(item.diff_qty) || 0;
                      const isUncounted = item.status === 'UNCOUNTED';
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/80 transition ${
                            diff > 0
                              ? 'bg-amber-50/30'
                              : diff < 0
                              ? 'bg-rose-50/30'
                              : isUncounted
                              ? 'opacity-85'
                              : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-medium text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Mã túi máu */}
                          <td className="py-2.5 px-3 font-mono font-bold text-[#C5299B] whitespace-nowrap">
                            {item.blood_code || '---'}
                          </td>

                          {/* Tên chế phẩm */}
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.product_name}
                          </td>

                          {/* Nhóm máu */}
                          <td className="py-2.5 px-2 text-center">
                            <span className="px-1.5 py-0.5 rounded bg-[#fce7f6] text-[#190072] font-bold text-[10px]">
                              {item.blood_group}{item.rh_factor}
                            </span>
                          </td>

                          {/* Thể tích */}
                          <td className="py-2.5 px-2 text-center text-slate-600 whitespace-nowrap">
                            {item.volume_name}
                          </td>

                          {/* Hạn dùng */}
                          <td className="py-2.5 px-2 text-center text-slate-600 whitespace-nowrap">
                            {formatDate(item.expiry_date)}
                          </td>

                          {/* SL Sổ sách */}
                          <td className="py-2.5 px-3 text-center font-bold text-blue-950 bg-blue-50/30">
                            {item.system_qty}
                          </td>

                          {/* SL Thực tế - Cho phép điều chỉnh nếu đang kiểm kê */}
                          <td className="py-2.5 px-3 text-center bg-emerald-50/30">
                            {auditDetail.status === 'IN_PROGRESS' && hasPermission('audit.execute') ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(item.id, item.actual_qty, -1)}
                                  className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs"
                                  title="Giảm 1"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  value={item.actual_qty}
                                  onChange={(e) => handleSetItemQtyExact(item.id, e.target.value)}
                                  className="w-12 py-1 text-center font-bold text-emerald-950 rounded-lg border border-emerald-300 bg-white text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(item.id, item.actual_qty, 1)}
                                  className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs"
                                  title="Tăng 1"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <span className="font-bold text-emerald-950">
                                {item.actual_qty}
                              </span>
                            )}
                          </td>

                          {/* Chênh lệch */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {isUncounted ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                Chưa kiểm
                              </span>
                            ) : diff === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Khớp (0)
                              </span>
                            ) : diff > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Thừa +{diff}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Thiếu {diff}
                              </span>
                            )}
                          </td>

                          {/* Ghi chú */}
                          <td className="py-2.5 px-3">
                            {auditDetail.status === 'IN_PROGRESS' && hasPermission('audit.execute') ? (
                              <input
                                type="text"
                                defaultValue={item.note || ''}
                                onBlur={(e) => handleUpdateItemNote(item.id, e.target.value)}
                                placeholder="Ghi chú hiện trạng..."
                                className="w-full px-2 py-1 text-xs rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 bg-transparent focus:bg-white outline-none transition"
                              />
                            ) : (
                              <span className="text-slate-500 text-xs">
                                {item.note || '---'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DRAWER TẠO KỲ KIỂM KÊ MỚI (TRƯỢT TỪ BÊN PHẢI ĐỒNG BỘ)                  */}
      {/* ========================================================================= */}
      {createDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop - KHÔNG TỰ ĐÓNG KHI BẤM RA NGOÀI VÙNG */}
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-300" />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
            <div className="w-screen max-w-2xl sm:max-w-3xl xl:max-w-4xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              {/* Header Drawer */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8] flex items-center justify-center shrink-0">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#190072]">
                      Tạo Kỳ Kiểm Kê Kho Chế Phẩm Máu
                    </h3>
                    <p className="text-xs text-slate-500">
                      Chụp ảnh các túi máu đang còn tồn kho (số lượng &gt; 0) để đối chiếu thực tế
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateDrawerOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleCreateAudit} className="flex-1 overflow-y-auto flex flex-col justify-between">
                <div className="p-6 space-y-5">
                  {createError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{createError}</span>
                    </div>
                  )}

                  {/* 1. Tên kỳ kiểm kê: Mặc định hiển thị tháng/năm hiện tại, cho phép chỉnh sửa */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Tên kỳ kiểm kê <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      autoFocus
                      required
                      value={newAuditName}
                      onChange={(e) => setNewAuditName(e.target.value)}
                      placeholder="VD: Kiểm kê quỹ máu định kỳ tháng MM/YYYY..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:border-indigo-600 outline-none transition bg-white"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Mặc định hiển thị theo tháng/năm hiện tại, bạn có thể chỉnh sửa lại nếu muốn.
                    </p>
                  </div>

                  {/* 2. Ngày kiểm kê */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Ngày kiểm kê</span> <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <DateInput
                      value={newAuditDate}
                      onChange={(e) => setNewAuditDate(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs w-full bg-white"
                    />
                  </div>

                  {/* 3. TẠM THỜI ẨN MỤC THÀNH PHẦN BAN KIỂM KÊ THEO YÊU CẦU */}
                  {false && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Thành phần Ban kiểm kê</span>
                        <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {loadingUsers && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                            Đang tải...
                          </span>
                        )}
                        <span className="text-[11px] text-indigo-700 font-medium bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                          Đã chọn {selectedCommitteeUsers.length} thành viên
                        </span>
                      </div>
                    </div>

                    {/* Danh sách thành viên đã chọn với vai trò trong ban */}
                    {selectedCommitteeUsers.length > 0 && (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto p-2 bg-slate-50/80 rounded-xl border border-slate-200">
                        {selectedCommitteeUsers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs hover:border-slate-300 transition"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <select
                                value={member.roleTitle}
                                onChange={(e) => handleChangeCommitteeRole(member.id, e.target.value)}
                                className="px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-900 font-bold text-[11px] outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="Trưởng ban">Trưởng ban</option>
                                <option value="Thư ký">Thư ký</option>
                                <option value="Thủ kho">Thủ kho</option>
                                <option value="Ủy viên">Ủy viên</option>
                              </select>

                              <span className="font-semibold text-slate-800 truncate">
                                {member.name}
                              </span>

                              {member.roleName && (
                                <span className="text-[10px] text-slate-400 font-normal truncate">
                                  ({member.roleName})
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveUserFromCommittee(member.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
                              title="Bỏ chọn thành viên này"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Khung chọn thêm thành viên từ Danh mục người dùng */}
                    <div className="p-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-950">
                        <span>Thêm thành viên từ Danh mục người dùng:</span>
                        {availableUsers.length === 0 && !loadingUsers && (
                          <button
                            type="button"
                            onClick={fetchAvailableUsers}
                            className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-normal"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Tải lại
                          </button>
                        )}
                      </div>

                      {/* Dropdown SearchableSelect để tìm và chọn nhanh bất kỳ ai */}
                      <div>
                        <SearchableSelect
                          value=""
                          onChange={(userId) => {
                            const found = availableUsers.find((u) => String(u.id) === String(userId));
                            if (found) handleAddUserToCommittee(found);
                          }}
                          options={availableUsers
                            .filter((u) => !selectedCommitteeUsers.some((mem) => mem.id === u.id))
                            .map((u) => ({
                              value: u.id,
                              label: u.full_name,
                              subLabel: u.role_name || u.username,
                            }))}
                          placeholder={
                            loadingUsers
                              ? 'Đang tải danh mục người dùng...'
                              : availableUsers.length === 0
                              ? 'Không có người dùng nào để chọn'
                              : '-- Bấm vào đây để tìm hoặc chọn nhân viên --'
                          }
                          disabled={loadingUsers || availableUsers.length === 0}
                          className="w-full text-xs"
                        />
                      </div>

                      {/* Danh sách người dùng dưới dạng huy hiệu (chips) để click nhanh */}
                      {availableUsers.length > 0 && (
                        <div className="pt-1">
                          <div className="text-[10px] text-slate-500 mb-1.5 font-medium">
                            Hoặc bấm nhanh từ danh sách nhân viên:
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                            {availableUsers
                              .filter((u) => !selectedCommitteeUsers.some((mem) => mem.id === u.id))
                              .map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => handleAddUserToCommittee(u)}
                                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 text-indigo-900 border border-slate-200 hover:border-indigo-300 text-[11px] font-medium transition flex items-center gap-1 shadow-2xs"
                                  title="Bấm để thêm vào Ban kiểm kê"
                                >
                                  <Plus className="w-3 h-3 text-indigo-600" />
                                  <span>{u.full_name}</span>
                                  {u.role_name && (
                                    <span className="text-[10px] text-slate-400">({u.role_name})</span>
                                  )}
                                </button>
                              ))}

                            {availableUsers.every((u) =>
                              selectedCommitteeUsers.some((mem) => mem.id === u.id)
                            ) && (
                              <span className="text-xs text-slate-400 italic py-1">
                                Đã chọn tất cả nhân viên trong danh mục.
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Nếu chưa tải được */}
                      {availableUsers.length === 0 && !loadingUsers && (
                        <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-center justify-between">
                          <span>Chưa tải được danh sách người dùng.</span>
                          <button
                            type="button"
                            onClick={fetchAvailableUsers}
                            className="px-2 py-1 rounded bg-white text-indigo-600 font-semibold border border-indigo-200 hover:bg-indigo-50 transition"
                          >
                            Tải lại
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Ô ghi chú thêm thành viên ngoài hệ thống (nếu có) */}
                    <div>
                      <input
                        type="text"
                        value={newAuditCommittee}
                        onChange={(e) => setNewAuditCommittee(e.target.value)}
                        placeholder="Thêm thành viên khác ngoài hệ thống (nếu có, VD: Thanh tra Bệnh viện, Đại diện Ban Giám đốc...)"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-indigo-600 placeholder:text-slate-400 bg-white"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Có thể bổ sung thêm các thành viên ngoài danh mục nhân viên vào ô trên.
                      </p>
                    </div>
                  </div>
                  )}

                  {/* 4. Chế độ khởi tạo số lượng thực tế */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Chế độ khởi tạo số lượng thực tế
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <label
                        className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition ${
                          newInitMode === 'ZERO'
                            ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold ring-1 ring-indigo-600/30'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="initMode"
                            checked={newInitMode === 'ZERO'}
                            onChange={() => setNewInitMode('ZERO')}
                            className="text-indigo-600"
                          />
                          <span>Bắt đầu từ 0 (Khuyến nghị chuẩn)</span>
                        </div>
                        <span className="text-[11px] font-normal text-slate-500 mt-1 pl-5">
                          Quét hoặc đếm từng túi máu thực tế trong tủ
                        </span>
                      </label>

                      <label
                        className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition ${
                          newInitMode === 'SYSTEM'
                            ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold ring-1 ring-indigo-600/30'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="initMode"
                            checked={newInitMode === 'SYSTEM'}
                            onChange={() => setNewInitMode('SYSTEM')}
                            className="text-indigo-600"
                          />
                          <span>Thực tế = Sổ sách</span>
                        </div>
                        <span className="text-[11px] font-normal text-slate-500 mt-1 pl-5">
                          Khởi tạo khớp sẵn, chỉ điều chỉnh các túi sai lệch
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* 5. Ghi chú kỳ kiểm kê */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Ghi chú kỳ kiểm kê
                    </label>
                    <input
                      type="text"
                      value={newAuditNote}
                      onChange={(e) => setNewAuditNote(e.target.value)}
                      placeholder="Mục đích kiểm kê, ghi chú..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-indigo-600 outline-none transition bg-white"
                    />
                  </div>
                </div>

                {/* Footer Drawer: Hủy bỏ nằm kế bên Bắt đầu kiểm kê */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCreateDrawerOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-6 py-2.5 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white font-semibold text-xs shadow-md shadow-[#C5299B]/20 flex items-center gap-2 transition disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{creating ? 'Đang khởi tạo...' : 'Bắt đầu kiểm kê'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL CHỐT KỲ KIỂM KÊ & CÂN BẰNG TỒN KHO                               */}
      {/* ========================================================================= */}
      {completeModalOpen && auditDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#190072]">
                    Xác nhận Chốt Kỳ Kiểm Kê
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kỳ: {auditDetail.code} — {auditDetail.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompleteModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Tóm tắt số liệu */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 text-sm">
                  Tóm tắt kết quả kiểm kê:
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>• Sổ sách hệ thống: <strong>{detailKPIs.totalSys}</strong> túi</div>
                  <div>• Thực tế kiểm đếm: <strong>{detailKPIs.totalAct}</strong> túi</div>
                  <div>• Số mục khớp 100%: <strong>{detailKPIs.matched}</strong> mục</div>
                  <div>
                    • Số mục chênh lệch:{' '}
                    <strong className={detailKPIs.excess + detailKPIs.deficit > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {detailKPIs.excess + detailKPIs.deficit}
                    </strong>{' '}
                    mục
                  </div>
                </div>
              </div>

              {/* Tùy chọn cân bằng kho */}
              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={balanceInventory}
                    onChange={(e) => setBalanceInventory(e.target.checked)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 shrink-0"
                  />
                  <div>
                    <span className="font-bold text-indigo-950 block">
                      Tự động CÂN BẰNG TỒN KHO theo thực tế
                    </span>
                    <span className="text-slate-600 text-[11px] block mt-0.5">
                      Hệ thống sẽ cập nhật số lượng tồn kho của các lô/túi máu trong tủ bằng đúng số lượng đã kiểm đếm thực tế.
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kết luận / Ghi chú hoàn tất của Ban kiểm kê
                </label>
                <textarea
                  rows={2}
                  value={completeNote}
                  onChange={(e) => setCompleteNote(e.target.value)}
                  placeholder="Ghi chú kiến nghị xử lý chênh lệch (nếu có)..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-indigo-600 outline-none transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmComplete}
                  disabled={completing}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{completing ? 'Đang chốt...' : 'Xác nhận Chốt & Hoàn tất'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL IN BIÊN BẢN KIỂM KÊ                                              */}
      {/* ========================================================================= */}
      {printModalOpen && auditDetail && (
        <PrintAuditReportModal
          audit={auditDetail}
          items={auditItems}
          onClose={() => setPrintModalOpen(false)}
          onExportExcel={handleExportExcel}
        />
      )}

      {/* Barcode Scanner cho Kiểm Kê Kho (Continuous Mode) */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Quét mã vạch kiểm kê túi máu"
        description="Quét mã vạch trên nhãn túi máu để ghi nhận kiểm đếm thực tế"
        continuous={true}
        onScan={handleScanAuditBag}
      />
    </div>
  );
}
