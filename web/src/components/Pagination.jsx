import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

export default function Pagination({
  totalItems = 0,
  currentPage,
  page,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50, 100],
}) {
  const current = page !== undefined ? page : (currentPage !== undefined ? currentPage : 1);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, current), totalPages);

  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(totalItems, safePage * pageSize);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, safePage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="no-print px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span>Hiển thị</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const nextSize = Number(e.target.value);
              onPageSizeChange?.(nextSize);
              onPageChange?.(1);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs outline-none focus:border-[#C5299B]"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} dòng / trang
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-500">
          {totalItems === 0
            ? 'Không có dữ liệu'
            : `Từ ${startIdx}–${endIdx} trên tổng ${totalItems} dòng`}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange?.(1)}
          disabled={safePage <= 1}
          title="Trang đầu"
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange?.(safePage - 1)}
          disabled={safePage <= 1}
          title="Trang trước"
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {getPageNumbers().map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange?.(p)}
            className={`min-w-[28px] h-7 px-2 rounded-lg text-xs transition ${
              p === safePage
                ? 'bg-[#C5299B] text-white shadow-xs'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-[#fdf2fa] hover:text-[#C5299B]'
            }`}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange?.(safePage + 1)}
          disabled={safePage >= totalPages}
          title="Trang sau"
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange?.(totalPages)}
          disabled={safePage >= totalPages}
          title="Trang cuối"
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
