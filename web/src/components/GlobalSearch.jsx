import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  X,
  Droplet,
  FileText,
  ClipboardCheck,
  ArrowRight,
  RefreshCw,
  CornerDownLeft,
  Calendar,
  Building2,
  Stethoscope,
  TrendingUp,
  AlertTriangle,
  Package,
} from 'lucide-react';
import api from '../api';

const SYSTEM_PAGES = [
  { key: 'inventory', title: 'Tồn kho Tủ máu', desc: 'Xem số lượng, nhóm máu ABO/Rh và cảnh báo hạn dùng FEFO', icon: Droplet, keywords: ['ton kho', 'tu mau', 'fefo', 'han dung', 'nhom mau'] },
  { key: 'import', title: 'Nhập kho Chế phẩm máu', desc: 'Tiếp nhận túi máu từ các Trung tâm và Viện Huyết học', icon: Package, keywords: ['nhap kho', 'phieu nhap', 'tiep nhan'] },
  { key: 'export', title: 'Xuất kho Cấp phát', desc: 'Xuất cấp phát máu cho các Khoa / Phòng lâm sàng', icon: ArrowRight, keywords: ['xuat kho', 'phieu xuat', 'cap phat', 'lam sang'] },
  { key: 'borrow_lend', title: 'Mượn / Cho mượn máu', desc: 'Điều phối và theo dõi công nợ túi máu giữa các bệnh viện', icon: TrendingUp, keywords: ['muon mau', 'cho muon', 'tra mau', 'dieu phoi'] },
  { key: 'audit', title: 'Kiểm kê Quỹ máu', desc: 'Kiểm kê định kỳ, quét mã vạch và đối chiếu cân bằng tủ máu', icon: ClipboardCheck, keywords: ['kiem ke', 'quy mau', 'bien ban', 'doi chieu'] },
  { key: 'cancellation_approval', title: 'Phê duyệt Hủy phiếu', desc: 'Quy trình kiểm duyệt và hoàn kho các yêu cầu hủy giao dịch', icon: AlertTriangle, keywords: ['duyet huy', 'huy phieu', 'phe duyet'] },
  { key: 'reports', title: 'Báo cáo & Thống kê', desc: 'Báo cáo xuất nhập tồn, biểu đồ và xuất dữ liệu Excel', icon: FileText, keywords: ['bao cao', 'thong ke', 'excel', 'xuat nhap ton'] },
  { key: 'cat:PARTNERS', title: 'Danh mục Đơn vị đối tác', desc: 'Quản lý các viện, trung tâm và bệnh viện liên kết', icon: Building2, keywords: ['doi tac', 'don vi', 'vien huyet hoc'] },
  { key: 'cat:DEPARTMENTS', title: 'Danh mục Khoa / Phòng', desc: 'Quản lý các khoa phòng lâm sàng nhận máu', icon: Stethoscope, keywords: ['khoa phong', 'lam sang', 'cap cuu'] },
  { key: 'sys:USERS', title: 'Quản lý Người dùng', desc: 'Tài khoản nhân viên, bác sĩ và kỹ thuật viên xét nghiệm', icon: Package, keywords: ['nguoi dung', 'nhan vien', 'tai khoan', 'user'] },
];

function removeAccents(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export default function GlobalSearch({ onNavigate, onSearchLot }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ lots: [], transactions: [], audits: [] });

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceTimer = useRef(null);

  // Lắng nghe phím tắt Ctrl + K hoặc / để mở nhanh tìm kiếm
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Đóng khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Thực hiện tìm kiếm với debounce 250ms
  const searchGlobal = useCallback(async (text) => {
    const q = text.trim();
    if (!q) {
      setResults({ lots: [], transactions: [], audits: [] });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/inventory/global-search?q=${encodeURIComponent(q)}`);
      setResults({
        lots: res.data.lots || [],
        transactions: res.data.transactions || [],
        audits: res.data.audits || [],
      });
    } catch (err) {
      console.error('Lỗi tìm kiếm toàn hệ thống:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      searchGlobal(val);
    }, 250);
  };

  const handleClear = () => {
    setQuery('');
    setResults({ lots: [], transactions: [], audits: [] });
    inputRef.current?.focus();
  };

  // Lọc trang chức năng khớp từ khóa
  const matchedPages = query.trim()
    ? SYSTEM_PAGES.filter((p) => {
        const cleanQuery = removeAccents(query);
        return (
          removeAccents(p.title).includes(cleanQuery) ||
          removeAccents(p.desc).includes(cleanQuery) ||
          p.keywords.some((k) => k.includes(cleanQuery))
        );
      }).slice(0, 3)
    : [];

  const hasAnyResults =
    results.lots.length > 0 ||
    results.transactions.length > 0 ||
    results.audits.length > 0 ||
    matchedPages.length > 0;

  // Điều hướng khi chọn kết quả
  const handleSelectLot = (lot) => {
    setOpen(false);
    if (onSearchLot) {
      onSearchLot(lot.blood_code || lot.product_name);
    } else if (onNavigate) {
      onNavigate('inventory');
    }
  };

  const handleSelectTx = (tx) => {
    setOpen(false);
    if (!onNavigate) return;
    if (tx.tx_type === 'IMPORT') onNavigate('import');
    else if (tx.tx_type === 'EXPORT') onNavigate('export');
    else onNavigate('borrow_lend');
  };

  const handleSelectAudit = (audit) => {
    setOpen(false);
    if (onNavigate) onNavigate('audit');
  };

  const handleSelectPage = (pageKey) => {
    setOpen(false);
    if (onNavigate) onNavigate(pageKey);
  };

  const formatDate = (d) => {
    if (!d) return '---';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('vi-VN');
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
      {/* Input Field on Header */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={handleChange}
          placeholder="Tìm mã túi máu, phiếu giao dịch, kỳ kiểm kê... (Ctrl + K)"
          className="w-full pl-9 pr-14 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white focus:border-[#C5299B] focus:ring-2 focus:ring-[#C5299B]/10 outline-none transition text-slate-800 placeholder:text-slate-400"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 text-[#C5299B] animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/50"
              title="Xóa"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-200/60 rounded border border-slate-300/60 font-mono">
              Ctrl K
            </span>
          )}
        </div>
      </div>

      {/* Dropdown Popup Results */}
      {open && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
          {/* Header trạng thái */}
          <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">
              {query.trim()
                ? `Kết quả tìm kiếm cho "${query}"`
                : 'Tìm kiếm nhanh toàn hệ thống'}
            </span>
            <span className="text-[10px] text-slate-400">Nhấn ESC để đóng</span>
          </div>

          <div className="overflow-y-auto p-2 space-y-3 flex-1">
            {/* 1. Trang Chức Năng (Quick Navigation) */}
            {matchedPages.length > 0 && (
              <div>
                <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Điều hướng Chức năng</span>
                </div>
                <div className="space-y-1 mt-0.5">
                  {matchedPages.map((page) => {
                    const PageIcon = page.icon;
                    return (
                      <button
                        key={page.key}
                        type="button"
                        onClick={() => handleSelectPage(page.key)}
                        className="w-full px-3 py-2 rounded-xl text-left hover:bg-indigo-50/70 transition flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                            <PageIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-800 group-hover:text-indigo-900 truncate">
                              {page.title}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {page.desc}
                            </div>
                          </div>
                        </div>
                        <CornerDownLeft className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Túi Máu Trong Kho (Lots) */}
            {results.lots.length > 0 && (
              <div>
                <div className="px-2.5 py-1 text-[11px] font-bold text-rose-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Túi máu trong tủ ({results.lots.length})</span>
                  <span className="text-[10px] font-normal text-slate-400">Xem tại Tồn kho</span>
                </div>
                <div className="space-y-1 mt-0.5">
                  {results.lots.map((lot) => (
                    <button
                      key={lot.id}
                      type="button"
                      onClick={() => handleSelectLot(lot)}
                      className="w-full px-3 py-2 rounded-xl text-left hover:bg-rose-50/50 transition border border-transparent hover:border-rose-100 flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-bold text-xs font-mono shrink-0">
                          {lot.blood_group}
                          {lot.rh_factor}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-[#C5299B]">
                              {lot.blood_code || `Mã #${lot.id}`}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs font-semibold text-slate-800 truncate">
                              {lot.product_name}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>Tồn: <strong>{lot.quantity}</strong> {lot.unit_name}</span>
                            <span>•</span>
                            <span>Hạn dùng: {formatDate(lot.expiry_date)}</span>
                            {lot.days_remaining <= 0 ? (
                              <span className="text-rose-600 font-bold text-[10px]">(Đã hết hạn)</span>
                            ) : lot.days_remaining <= 7 ? (
                              <span className="text-amber-600 font-bold text-[10px]">
                                (Còn {lot.days_remaining} ngày)
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] text-indigo-600 font-medium group-hover:underline shrink-0">
                        Đến túi máu
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Phiếu Giao Dịch (Transactions) */}
            {results.transactions.length > 0 && (
              <div>
                <div className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Phiếu giao dịch ({results.transactions.length})</span>
                </div>
                <div className="space-y-1 mt-0.5">
                  {results.transactions.map((tx) => {
                    const isImport = tx.tx_type === 'IMPORT';
                    const isExport = tx.tx_type === 'EXPORT';
                    return (
                      <button
                        key={tx.id}
                        type="button"
                        onClick={() => handleSelectTx(tx)}
                        className="w-full px-3 py-2 rounded-xl text-left hover:bg-indigo-50/50 transition border border-transparent hover:border-indigo-100 flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 ${
                              isImport
                                ? 'bg-emerald-100 text-emerald-800'
                                : isExport
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isImport ? 'Nhập kho' : isExport ? 'Xuất kho' : 'Mượn/Trả'}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-slate-900">
                                {tx.code}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-xs text-slate-700 truncate">
                                {tx.partner_name || tx.department_info || '---'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>Ngày: {formatDate(tx.tx_date)}</span>
                              <span>•</span>
                              <span>SL: <strong>{tx.total_qty}</strong> túi ({tx.item_count} loại)</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] text-indigo-600 font-medium group-hover:underline shrink-0">
                          Xem phiếu
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Kỳ Kiểm Kê (Audits) */}
            {results.audits.length > 0 && (
              <div>
                <div className="px-2.5 py-1 text-[11px] font-bold text-purple-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Kỳ kiểm kê quỹ máu ({results.audits.length})</span>
                </div>
                <div className="space-y-1 mt-0.5">
                  {results.audits.map((audit) => (
                    <button
                      key={audit.id}
                      type="button"
                      onClick={() => handleSelectAudit(audit)}
                      className="w-full px-3 py-2 rounded-xl text-left hover:bg-purple-50/50 transition border border-transparent hover:border-purple-100 flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 font-mono font-bold text-xs shrink-0">
                          {audit.code}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate">
                            {audit.name}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>Ngày: {formatDate(audit.audit_date)}</span>
                            <span>•</span>
                            <span>Sổ sách: {audit.total_system_qty}</span>
                            <span>•</span>
                            <span>Thực tế: {audit.total_actual_qty}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] text-purple-600 font-medium group-hover:underline shrink-0">
                        Đến kiểm kê
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Khi không tìm thấy kết quả */}
            {query.trim() && !loading && !hasAnyResults && (
              <div className="py-8 text-center text-slate-400">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="text-xs">Không tìm thấy túi máu, phiếu giao dịch hay kỳ kiểm kê nào phù hợp với <strong>"{query}"</strong></p>
                <p className="text-[11px] text-slate-400 mt-1">Gợi ý: Thử tìm theo mã vạch, nhóm máu (A+, O-), hoặc tên khoa phòng.</p>
              </div>
            )}

            {/* Khi chưa gõ gì: Gợi ý tìm kiếm */}
            {!query.trim() && (
              <div className="p-3 text-xs text-slate-500 space-y-2">
                <div className="font-semibold text-slate-700 text-[11px]">
                  Từ khóa gợi ý tìm nhanh:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['O+', 'A+', 'Hồng cầu', 'Huyết tương', 'Tiểu cầu', 'Khoa Cấp cứu', 'Kiểm kê'].map(
                    (tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setQuery(tag);
                          searchGlobal(tag);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition"
                      >
                        {tag}
                      </button>
                    )
                  )}
                </div>
                <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-100">
                  💡 Bạn có thể bấm bất kỳ lúc nào tổ hợp phím <strong>Ctrl + K</strong> để kích hoạt thanh tìm kiếm.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
