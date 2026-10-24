import React, { useState, useRef, useEffect } from 'react';
import {
  Droplet,
  PackagePlus,
  ArrowUpRight,
  Repeat,
  BarChart3,
  FolderKanban,
  Settings,
  LogOut,
  UserCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Building2,
  Stethoscope,
  Beaker,
  Scale,
  Info,
  Users,
  Shield,
  DatabaseBackup,
  Clock,
  Bell,
  ShieldAlert,
  ClipboardCheck,
  AlertTriangle,
  LayoutDashboard,
  ScrollText,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import api from './api';
import { useAuth } from './context/AuthContext';
import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import InventoryView from './views/InventoryView';
import ImportView from './views/ImportView';
import ExportView from './views/ExportView';
import BorrowLendView from './views/BorrowLendView';
import InventoryAuditView from './views/InventoryAuditView';
import ReportsView from './views/ReportsView';
import CategoriesView from './views/CategoriesView';
import SystemView from './views/SystemView';
import CancellationApprovalView from './views/CancellationApprovalView';
import GlobalSearch from './components/GlobalSearch';

export default function App() {
  const { user, loading, systemConfig, logout, hasPermission, pendingSummary } = useAuth();
  const [activePage, setActivePage] = useState(() => {
    return localStorage.getItem('bloodbank_active_page') || 'dashboard';
  });
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('bloodbank_sidebar_collapsed') === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [openGroup, setOpenGroup] = useState(() => {
    const saved = localStorage.getItem('bloodbank_active_page') || 'inventory';
    if (saved.startsWith('cat:')) return 'categories';
    if (saved.startsWith('sys:')) return 'system';
    if (saved !== 'dashboard') return 'operations';
    return null;
  }); // null | 'operations' | 'categories' | 'system'
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPwd, setShowPwd] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!pwdForm.currentPassword) {
      setPwdError('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (!pwdForm.newPassword || pwdForm.newPassword.length < 4) {
      setPwdError('Mật khẩu mới phải có ít nhất 4 ký tự');
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdError('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setPwdLoading(true);
      await api.post('/auth/change-password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      setPwdSuccess('Đổi mật khẩu thành công!');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setChangePwdOpen(false);
        setPwdSuccess('');
      }, 1500);
    } catch (err) {
      setPwdError(err.response?.data?.error || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại.');
    } finally {
      setPwdLoading(false);
    }
  };
  const [now, setNow] = useState(new Date());
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('bloodbank_active_page', activePage);
    if (activePage.startsWith('cat:')) {
      setOpenGroup('categories');
    } else if (activePage.startsWith('sys:')) {
      setOpenGroup('system');
    } else if (activePage !== 'dashboard') {
      setOpenGroup('operations');
    }
  }, [activePage]);

  useEffect(() => {
    localStorage.setItem('bloodbank_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatRealtimeClock = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    const days = [
      'Chủ Nhật',
      'Thứ Hai',
      'Thứ Ba',
      'Thứ Tư',
      'Thứ Năm',
      'Thứ Sáu',
      'Thứ Bảy',
    ];
    const dayName = days[date.getDay()];
    const dd = pad(date.getDate());
    const MM = pad(date.getMonth() + 1);
    const yyyy = date.getFullYear();
    return `${hh}:${mm}:${ss} - ${dayName}, ${dd}/${MM}/${yyyy}`;
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-700 font-sans">
        <div className="flex items-center gap-3">
          <Droplet className="w-6 h-6 text-[#C5299B] animate-bounce" />
          <span className="font-normal">Đang khởi tải Hệ thống Tủ máu Xét nghiệm...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const canApproveImport = hasPermission('import.cancel_approve');
  const canApproveExport = hasPermission('export.cancel_approve');
  const canApproveAny = canApproveImport || canApproveExport;

  const dashboardItem = {
    key: 'dashboard',
    label: 'Tổng quan',
    desc: 'Bảng điều khiển & thống kê nhanh',
    icon: LayoutDashboard,
    show: true,
  };

  const bloodOpsNavItems = [
    {
      key: 'inventory',
      label: 'Kho chế phẩm',
      desc: 'Quản lý lô máu, thể tích & hạn dùng',
      icon: Droplet,
      show: true,
    },
    {
      key: 'export',
      label: 'Xuất chế phẩm máu',
      desc: 'Bấm chọn chế phẩm (ABO/Rh) và xuất',
      icon: ArrowUpRight,
      show: hasPermission('export.view') || hasPermission('export.create'),
    },
    {
      key: 'import',
      label: 'Nhập chế phẩm máu',
      desc: 'Nhập chế phẩm máu vào kho theo lô',
      icon: PackagePlus,
      show: hasPermission('import.view') || hasPermission('import.create'),
    },
    {
      key: 'cancellation_approval',
      label: 'Duyệt Hủy',
      desc: 'Phê duyệt yêu cầu hủy phiếu nhập & xuất',
      icon: ShieldAlert,
      badge: canApproveAny && pendingSummary?.totalPending > 0 ? pendingSummary.totalPending : null,
      show: canApproveAny,
    },
    {
      key: 'borrow_lend',
      label: 'Mượn / Cho mượn',
      desc: 'Quản lý mượn, cho mượn & hoàn trả',
      icon: Repeat,
      show: hasPermission('borrow_lend.view') || hasPermission('borrow_lend.create'),
    },
    {
      key: 'audit',
      label: 'Kiểm kê kho',
      desc: 'Tạo kỳ kiểm kê, đếm thực tế & xuất biên bản',
      icon: ClipboardCheck,
      show: hasPermission('audit.view') || hasPermission('inventory.view') || hasPermission('inventory.adjust'),
    },
    {
      key: 'reports',
      label: 'Báo cáo & Thống kê',
      desc: 'Báo cáo Nhập - Xuất - Tồn & Xuất Excel',
      icon: BarChart3,
      show: hasPermission('reports.view'),
    },
  ].filter((item) => item.show);

  const mainNavItems = [dashboardItem, ...bloodOpsNavItems];

  const categoryChildren = hasPermission('categories.view')
    ? [
        {
          key: 'cat:PARTNERS',
          subKey: 'PARTNERS',
          label: 'Đơn vị đối tác',
          desc: 'Quản lý các đơn vị cung cấp / mượn / cho mượn máu',
          icon: Building2,
        },
        {
          key: 'cat:DEPARTMENTS',
          subKey: 'DEPARTMENTS',
          label: 'Khoa / Phòng',
          desc: 'Quản lý danh mục Khoa / Phòng lâm sàng nhận chế phẩm máu',
          icon: Stethoscope,
        },
        {
          key: 'cat:PRODUCTS',
          subKey: 'PRODUCTS',
          label: 'Loại chế phẩm máu',
          desc: 'Quản lý mã loại, tên chế phẩm máu, đơn vị tính và trạng thái',
          icon: Droplet,
        },
        {
          key: 'cat:UNITS',
          subKey: 'UNITS',
          label: 'Đơn vị tính',
          desc: 'Quản lý đơn vị tính chế phẩm máu',
          icon: Scale,
        },
        {
          key: 'cat:ALERTS',
          subKey: 'ALERTS',
          label: 'Cấu hình cảnh báo',
          desc: 'Cấu hình các mốc cảnh báo Hạn sử dụng (HSD) & Màu sắc',
          icon: AlertTriangle,
        },
      ]
    : [];

  const systemChildren = [
    {
      key: 'sys:CONFIG',
      subKey: 'CONFIG',
      label: 'Cấu hình hệ thống',
      desc: 'Tên đơn vị, Tên khoa, Địa chỉ, SĐT và Logo',
      icon: Settings,
      show: hasPermission('system.config'),
    },
    {
      key: 'sys:INFO',
      subKey: 'INFO',
      label: 'Thông tin hệ thống',
      desc: 'Tên phần mềm, tên viết tắt, phiên bản, người phát triển',
      icon: Info,
      show: hasPermission('system.config'),
    },
    {
      key: 'sys:USERS',
      subKey: 'USERS',
      desc: 'Quản lý tài khoản người dùng theo nhóm quyền được gán',
      label: 'Người dùng',
      icon: Users,
      show: hasPermission('system.users'),
    },
    {
      key: 'sys:ROLES',
      subKey: 'ROLES',
      label: 'Nhóm quyền và Quyền',
      desc: 'Tạo nhóm quyền và phân quyền chi tiết cho từng nhóm quyền',
      icon: Shield,
      show: hasPermission('system.roles'),
    },
    {
      key: 'sys:BACKUP',
      subKey: 'BACKUP',
      label: 'Sao lưu / Khôi phục',
      desc: 'Sao lưu tự động (giữ tối đa 3 bản), sao lưu thủ công và khôi phục dữ liệu',
      icon: DatabaseBackup,
      show: hasPermission('system.backup'),
    },
    {
      key: 'sys:LOGS',
      subKey: 'LOGS',
      label: 'Nhật ký hoạt động',
      desc: 'Ghi và phân loại lịch sử thao tác của người dùng',
      icon: ScrollText,
      show: hasPermission('system.logs') || hasPermission('system.config'),
    },
  ].filter((item) => item.show);

  const allItemsFlat = [...mainNavItems, ...categoryChildren, ...systemChildren];
  const currentNav = allItemsFlat.find((n) => n.key === activePage) || mainNavItems[0];

  const handleSelectMainPage = (key) => {
    setActivePage(key);
    setOpenGroup(null);
    setMobileOpen(false);
  };

  const handleGlobalSearchLot = (bloodCode) => {
    setInventorySearch(bloodCode);
    handleSelectMainPage('inventory');
  };

  const handleSelectSubPage = (groupKey, key) => {
    setActivePage(key);
    setOpenGroup(groupKey);
    setMobileOpen(false);
  };

  const handleClickParentGroup = (groupKey, childrenList) => {
    if (collapsed) {
      setCollapsed(false);
      setOpenGroup(groupKey);
      if (childrenList.length > 0) {
        const isChildActive = childrenList.some((c) => c.key === activePage);
        if (!isChildActive) {
          setActivePage(childrenList[0].key);
        }
      }
      return;
    }
    if (openGroup === groupKey) {
      setOpenGroup(null);
    } else {
      setOpenGroup(groupKey);
      if (childrenList.length > 0) {
        const isChildActive = childrenList.some((c) => c.key === activePage);
        if (!isChildActive) {
          setActivePage(childrenList[0].key);
        }
      }
    }
  };

  const isOperationsActive = bloodOpsNavItems.some((item) => item.key === activePage);
  const isCategoryActive = activePage.startsWith('cat:');
  const isSystemActive = activePage.startsWith('sys:');

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-slate-100 text-slate-800 font-sans">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="no-print fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Left Sidebar - Light Background */}
      <aside
        className={`no-print fixed lg:static inset-y-0 left-0 z-50 h-screen shrink-0 flex flex-col bg-white text-slate-700 border-r border-slate-200 shadow-sm transition-all duration-200 ${
          collapsed ? 'w-20' : 'w-72'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Top of Sidebar: Logo (không khung) + Tên viết tắt phần mềm */}
        <div
          className={`h-16 px-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 bg-white ${
            collapsed ? 'lg:justify-center lg:px-2' : ''
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {systemConfig.logo_url ? (
              <img
                src={systemConfig.logo_url}
                alt="Logo"
                className="w-9 h-9 object-contain shrink-0"
              />
            ) : (
              <Droplet className="w-7 h-7 text-[#C5299B] fill-[#C5299B] shrink-0" />
            )}
            {!collapsed && (
              <div className="min-w-0">
                <span className="text-base font-normal text-[#190072] truncate block">
                  {systemConfig.app_short_name || 'BloodBank'}
                </span>
              </div>
            )}
          </div>

          {/* Close Button (Mobile) */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-3.5">
          {/* Mục riêng trên cùng sidebar: Tổng quan */}
          <div>
            <button
              onClick={() => handleSelectMainPage(dashboardItem.key)}
              title={collapsed ? dashboardItem.label : ''}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-normal transition relative ${
                activePage === dashboardItem.key
                  ? 'bg-[#C5299B] text-white shadow-sm shadow-[#C5299B]/25 font-semibold'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium'
              } ${collapsed ? 'justify-center' : 'justify-start'}`}
            >
              <LayoutDashboard className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate text-left">{dashboardItem.label}</span>}
            </button>
          </div>

          {/* Group 1: Nghiệp vụ (Danh mục lớn gom toàn bộ nghiệp vụ) */}
          {bloodOpsNavItems.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleClickParentGroup('operations', bloodOpsNavItems)}
                title={
                  collapsed
                    ? `Nghiệp vụ${
                        canApproveAny && pendingSummary?.totalPending > 0
                          ? ` (${pendingSummary.totalPending} phiếu chờ duyệt)`
                          : ''
                      }`
                    : ''
                }
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-normal transition relative ${
                  isOperationsActive
                    ? 'bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Activity className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="truncate">Nghiệp vụ</span>}
                </div>
                {!collapsed && (
                  <div className="flex items-center gap-2 shrink-0">
                    {canApproveAny && pendingSummary?.totalPending > 0 && openGroup !== 'operations' && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white animate-pulse"
                        title={`${pendingSummary.totalPending} phiếu chờ duyệt`}
                      >
                        {pendingSummary.totalPending}
                      </span>
                    )}
                    {openGroup === 'operations' ? (
                      <ChevronDown className="w-4 h-4 text-[#C5299B] shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </div>
                )}
                {collapsed && canApproveAny && pendingSummary?.totalPending > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 px-1.5 py-0 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse"
                    title={`${pendingSummary.totalPending} phiếu chờ duyệt`}
                  >
                    {pendingSummary.totalPending}
                  </span>
                )}
              </button>

              {!collapsed && openGroup === 'operations' && (
                <div className="mt-1 pl-4 space-y-1">
                  {bloodOpsNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleSelectSubPage('operations', item.key)}
                        title={item.label}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-normal transition ${
                          isActive
                            ? 'bg-[#C5299B] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon className="w-5 h-5 shrink-0" />
                          <span className="truncate text-left">{item.label}</span>
                        </div>
                        {item.badge ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              isActive
                                ? 'bg-white text-[#C5299B]'
                                : 'bg-amber-500 text-white animate-pulse'
                            }`}
                            title={`${item.badge} phiếu chờ duyệt hủy`}
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Group 2: Quản lý Danh mục */}
          {categoryChildren.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleClickParentGroup('categories', categoryChildren)}
                title={collapsed ? 'Quản lý Danh mục' : ''}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-normal transition ${
                  isCategoryActive
                    ? 'bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FolderKanban className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="truncate">Quản lý Danh mục</span>}
                </div>
                {!collapsed &&
                  (openGroup === 'categories' ? (
                    <ChevronDown className="w-4 h-4 text-[#C5299B] shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  ))}
              </button>

              {!collapsed && openGroup === 'categories' && (
                <div className="mt-1 pl-4 space-y-1">
                  {categoryChildren.map((sub) => {
                    const SubIcon = sub.icon;
                    const isActive = activePage === sub.key;
                    return (
                      <button
                        key={sub.key}
                        onClick={() => handleSelectSubPage('categories', sub.key)}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-normal transition ${
                          isActive
                            ? 'bg-[#C5299B] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <SubIcon className="w-5 h-5 shrink-0" />
                        <span className="truncate text-left">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Group 3: Quản trị Hệ thống */}
          {systemChildren.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleClickParentGroup('system', systemChildren)}
                title={collapsed ? 'Quản trị Hệ thống' : ''}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-normal transition ${
                  isSystemActive
                    ? 'bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Settings className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="truncate">Quản trị Hệ thống</span>}
                </div>
                {!collapsed &&
                  (openGroup === 'system' ? (
                    <ChevronDown className="w-4 h-4 text-[#C5299B] shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  ))}
              </button>

              {!collapsed && openGroup === 'system' && (
                <div className="mt-1 pl-4 space-y-1">
                  {systemChildren.map((sub) => {
                    const SubIcon = sub.icon;
                    const isActive = activePage === sub.key;
                    return (
                      <button
                        key={sub.key}
                        onClick={() => handleSelectSubPage('system', sub.key)}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-normal transition ${
                          isActive
                            ? 'bg-[#C5299B] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <SubIcon className="w-5 h-5 shrink-0" />
                        <span className="truncate text-left">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom of Sidebar: Thông tin Đơn vị & Khoa + Nút thu gọn bên phải */}
        <div
          className={`p-3.5 border-t border-slate-200 bg-slate-50/70 shrink-0 flex items-center ${
            collapsed ? 'justify-center' : 'justify-between gap-2'
          }`}
        >
          {!collapsed && (
            <div className="space-y-0.5 min-w-0">
              <div className="text-xs font-normal text-[#C5299B] truncate">
                {systemConfig.unit_name || 'Bệnh viện Đa khoa'}
              </div>
              <div className="text-xs font-normal text-[#190072] truncate">
                {systemConfig.department_name || 'Khoa Xét nghiệm'}
              </div>
              {systemConfig.phone && (
                <div className="text-[11px] text-slate-400 truncate">
                  ĐT: {systemConfig.phone}
                </div>
              )}
            </div>
          )}

          {/* Collapse Button (Desktop) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-[#C5299B] hover:bg-slate-200/70 transition shrink-0"
            title={collapsed ? 'Mở rộng Sidebar' : 'Thu gọn Sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Top Bar with Account Dropdown on Right */}
        <header className="no-print h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 shadow-xs">
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <h2 className="section-title text-base sm:text-lg font-bold text-[#190072] tracking-tight">
                {currentNav?.label}
              </h2>
              <p className="text-xs text-slate-500 hidden md:block">
                {currentNav?.desc}
              </p>
            </div>
          </div>

          {/* Trường tìm kiếm toàn hệ thống trên Header */}
          <GlobalSearch
            onNavigate={handleSelectMainPage}
            onSearchLot={handleGlobalSearchLot}
          />

          {/* Right Header: Notification Bell (left) | Account Dropdown (right) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Icon Chuông thông báo (Nằm bên trái tài khoản) */}
            <div className="relative" ref={notificationRef}>
              <button
                type="button"
                onClick={() => setNotificationOpen(!notificationOpen)}
                title={
                  canApproveAny && pendingSummary?.totalPending > 0
                    ? `Bạn có ${pendingSummary.totalPending} phiếu cần duyệt`
                    : 'Thông báo'
                }
                className={`relative p-2 rounded-xl transition flex items-center justify-center ${
                  notificationOpen
                    ? 'bg-[#C5299B]/10 text-[#C5299B]'
                    : canApproveAny && pendingSummary?.totalPending > 0
                    ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800'
                    : 'text-slate-600 hover:text-[#C5299B] hover:bg-slate-100'
                }`}
              >
                <Bell className="w-5 h-5" />
                {canApproveAny && pendingSummary?.totalPending > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-xs animate-pulse">
                    {pendingSummary.totalPending > 99 ? '99+' : pendingSummary.totalPending}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {notificationOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#C5299B]" />
                      <span className="text-xs font-bold text-slate-800">Thông báo hệ thống</span>
                    </div>
                    {canApproveAny && pendingSummary?.totalPending > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        {pendingSummary.totalPending} cần duyệt
                      </span>
                    )}
                  </div>

                  <div className="p-2 max-h-80 overflow-y-auto">
                    {canApproveAny && pendingSummary?.totalPending > 0 ? (
                      <div
                        onClick={() => {
                          setNotificationOpen(false);
                          handleSelectMainPage('cancellation_approval');
                        }}
                        className="p-3 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200 transition cursor-pointer group"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                            <ShieldAlert className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-amber-950">Yêu cầu duyệt hủy phiếu</span>
                              <span className="text-[10px] text-amber-700 bg-amber-200/80 px-1.5 py-0.5 rounded-full font-semibold">
                                Chờ duyệt
                              </span>
                            </div>
                            <p className="text-[11px] text-amber-900 mt-0.5 leading-snug">
                              Hiện có <strong className="font-bold text-amber-950">{pendingSummary.totalPending}</strong> phiếu đang chờ bạn duyệt hoàn nguyên kho
                              {pendingSummary.importPending > 0 && ` (${pendingSummary.importPending} nhập)`}
                              {pendingSummary.exportPending > 0 && ` (${pendingSummary.exportPending} xuất)`}.
                            </p>
                            <div className="mt-2 text-xs font-semibold text-[#C5299B] group-hover:underline flex items-center gap-1">
                              <span>Vào duyệt ngay</span>
                              <span>→</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 px-4 text-center">
                        <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
                          <Bell className="w-5 h-5" />
                        </div>
                        <p className="text-xs text-slate-600 font-medium">Hiện không có thông báo mới</p>
                        {canApproveAny && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Tất cả yêu cầu hủy phiếu đều đã được xử lý.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {canApproveAny && (
                    <div className="p-1.5 border-t border-slate-100 bg-slate-50/50">
                      <button
                        type="button"
                        onClick={() => {
                          setNotificationOpen(false);
                          handleSelectMainPage('cancellation_approval');
                        }}
                        className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-center text-[#190072] hover:bg-white hover:shadow-xs transition"
                      >
                        Đến trang Duyệt Hủy
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 py-1 px-1.5 rounded-lg hover:bg-slate-50 transition"
              >
                <UserCheck className="w-5 h-5 text-[#C5299B] shrink-0" />
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-normal text-slate-900 leading-tight">
                    {user.full_name}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    {user.role_name}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <div className="text-xs font-semibold text-slate-900">{user.username}</div>
                    <div className="text-[11px] text-[#C5299B] mt-0.5">
                      {user.role_name}
                    </div>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        setPwdError('');
                        setPwdSuccess('');
                        setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setShowPwd({ current: false, new: false, confirm: false });
                        setChangePwdOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                    >
                      <KeyRound className="w-4 h-4 text-[#C5299B]" />
                      <span>Thay đổi mật khẩu</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-600 hover:bg-rose-50 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất hệ thống</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Full-Width Page Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto w-full">
          <div className="w-full">
            {activePage === 'dashboard' && (
              <DashboardView onNavigate={handleSelectMainPage} />
            )}
            {activePage === 'inventory' && (
              <InventoryView
                onNavigate={handleSelectMainPage}
                initialSearch={inventorySearch}
              />
            )}
            {activePage === 'import' && <ImportView onNavigate={handleSelectMainPage} />}
            {activePage === 'export' && <ExportView onNavigate={handleSelectMainPage} />}
            {activePage === 'cancellation_approval' && <CancellationApprovalView onNavigate={handleSelectMainPage} />}
            {activePage === 'borrow_lend' && <BorrowLendView />}
            {activePage === 'audit' && <InventoryAuditView />}
            {activePage === 'reports' && <ReportsView />}
            {isCategoryActive && (
              <CategoriesView activeSubTab={currentNav.subKey} />
            )}
            {isSystemActive && <SystemView activeSubTab={currentNav.subKey} />}
          </div>
        </main>

        {/* Footer */}
        <footer className="no-print bg-white border-t border-slate-200 py-2 px-6 text-xs text-slate-500 shrink-0">
          <div className="w-full flex flex-wrap items-center justify-between gap-3">
            <div>
              <span>{systemConfig.app_name}</span> — Phiên bản v
              {systemConfig.app_version || '2.0.0'}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Clock className="w-3.5 h-3.5 text-[#C5299B] shrink-0" />
                <span>{formatRealtimeClock(now)}</span>
              </div>
              <span className="text-slate-300 select-none">|</span>
              <div>
                Phát triển bởi: <span className="font-normal text-slate-700">{systemConfig.app_developer}</span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Modal Thay đổi mật khẩu người dùng */}
      {changePwdOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#190072]/5 to-[#C5299B]/5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#C5299B]/10 flex items-center justify-center text-[#C5299B]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#190072]">Thay đổi Mật khẩu</h3>
                  <p className="text-[11px] text-slate-500">Tài khoản: {user.username} ({user.full_name})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChangePwdOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {pwdError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{pwdError}</span>
                </div>
              )}

              {pwdSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{pwdSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu hiện tại <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPwd.current ? 'text' : 'password'}
                    value={pwdForm.currentPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                    placeholder="Nhập mật khẩu đang dùng..."
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd({ ...showPwd, current: !showPwd.current })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPwd.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu mới <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPwd.new ? 'text' : 'password'}
                    value={pwdForm.newPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                    placeholder="Ít nhất 4 ký tự..."
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd({ ...showPwd, new: !showPwd.new })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPwd.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPwd.confirm ? 'text' : 'password'}
                    value={pwdForm.confirmPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5299B]/30"
                    placeholder="Nhập lại mật khẩu mới..."
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd({ ...showPwd, confirm: !showPwd.confirm })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPwd.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setChangePwdOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition"
                >
                  {pwdLoading ? 'Đang lưu...' : 'Cập nhật mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
