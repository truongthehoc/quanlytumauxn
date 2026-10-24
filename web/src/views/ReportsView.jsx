import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Filter,
  BarChart3,
  Clock,
  Repeat,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import { getExpiryBadgeInfo } from '../utils/expiryHelper';

export default function ReportsView() {
  const { systemConfig, hasPermission } = useAuth();
  const [reportTab, setReportTab] = useState(() => {
    return localStorage.getItem('bloodbank_report_tab') || 'MOVEMENT';
  }); // 'MOVEMENT' | 'EXPIRY' | 'PARTNER_DEBT'

  useEffect(() => {
    localStorage.setItem('bloodbank_report_tab', reportTab);
  }, [reportTab]);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [movementReport, setMovementReport] = useState([]);
  const [partnerBorrowLend, setPartnerBorrowLend] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [reportTab, fromDate, toDate]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const [repRes, invRes] = await Promise.all([
        api.get(`/reports/summary?from_date=${fromDate}&to_date=${toDate}`),
        api.get('/inventory'),
      ]);
      setMovementReport(repRes.data.movementReport || []);
      setPartnerBorrowLend(repRes.data.partnerBorrowLend || []);
      setLots(invRes.data.lots || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Nhập - Xuất - Tồn
    const sheet1Data = movementReport.map((r, idx) => ({
      STT: idx + 1,
      'Mã chế phẩm': r.product_code,
      'Tên chế phẩm máu': r.product_name,
      'Nhóm chế phẩm': r.product_group,
      'Nhóm máu ABO': r.blood_group,
      'Hệ Rh': r.rh_factor,
      'SL Nhập kho': r.imported_qty,
      'SL Xuất máu': r.exported_qty,
      'SL Cho mượn': r.lent_qty,
      'SL Mượn về': r.borrowed_qty,
      'SL Nhận trả mượn': r.return_lent_qty,
      'SL Xuất trả nợ': r.return_borrowed_qty,
      'Tồn kho hiện tại': r.current_stock,
      'Trong đó quá hạn': r.expired_stock,
    }));
    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(wb, ws1, 'Nhap_Xuat_Ton');

    // Sheet 2: Chi tiết lô & Hạn sử dụng
    const sheet2Data = lots.map((l, idx) => ({
      STT: idx + 1,
      'Mã máu (Túi)': l.blood_code || '---',
      'Mã CP': l.product_code,
      'Tên chế phẩm máu': l.product_name,
      'Nhóm máu': `${l.blood_group}${l.rh_factor}`,
      'Thể tích': l.volume_name,
      ĐVT: l.unit_name,
      'Ngày lấy máu': l.collection_date || '---',
      'Hạn sử dụng': l.expiry_date,
      'Số ngày còn lại': l.days_remaining,
      'Tình trạng HSD':
        l.expiry_status === 'EXPIRED'
          ? 'Đã hết hạn'
          : l.expiry_status === 'WARNING'
          ? 'Sắp hết hạn'
          : 'Còn hạn an toàn',
      'Số lượng tồn': l.quantity,
    }));
    const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
    XLSX.utils.book_append_sheet(wb, ws2, 'Ton_Kho_Theo_Lo_HSD');

    // Sheet 3: Công nợ Mượn / Cho mượn Đối tác
    const sheet3Data = partnerBorrowLend.map((p, idx) => ({
      STT: idx + 1,
      'Mã đơn vị': p.partner_code,
      'Tên đơn vị đối tác': p.partner_name,
      'Số điện thoại': p.phone,
      'Tổng đã Cho mượn': p.total_lent,
      'Đã thu hồi': p.lent_returned,
      'Đối tác còn nợ': p.lent_remaining,
      'Tổng đã Mượn về': p.total_borrowed,
      'Đã hoàn trả đối tác': p.borrowed_returned,
      'Khoa còn nợ đối tác': p.borrowed_remaining,
    }));
    const ws3 = XLSX.utils.json_to_sheet(sheet3Data);
    XLSX.utils.book_append_sheet(wb, ws3, 'Muon_Cho_Muon_Doi_Tac');

    XLSX.writeFile(wb, `BaoCao_TuMau_${fromDate}_${toDate}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Filter & Actions Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-normal  text-slate-600">
            <Filter className="w-4 h-4 text-[#C5299B]" />
            Từ ngày:
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-normal"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-normal  text-slate-600">
            Đến ngày:
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-normal"
            />
          </div>
          <button
            onClick={fetchReports}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-normal"
          >
            Xem báo cáo
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          {hasPermission('reports.export_excel') && (
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-normal shadow-sm transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Xuất file Excel (.xlsx)
            </button>
          )}
          {hasPermission('reports.print') && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C5299B] hover:bg-[#a82083] text-white text-xs font-normal shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              In báo cáo
            </button>
          )}
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setReportTab('MOVEMENT')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-normal  transition ${
            reportTab === 'MOVEMENT'
              ? 'bg-[#C5299B] text-white shadow'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          1. Báo cáo Nhập - Xuất - Mượn - Tồn kho
        </button>

        <button
          onClick={() => setReportTab('EXPIRY')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-normal  transition ${
            reportTab === 'EXPIRY'
              ? 'bg-[#C5299B] text-white shadow'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          2. Báo cáo Tồn kho theo Lô & Cảnh báo Hạn dùng
        </button>

        <button
          onClick={() => setReportTab('PARTNER_DEBT')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-normal  transition ${
            reportTab === 'PARTNER_DEBT'
              ? 'bg-[#C5299B] text-white shadow'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Repeat className="w-4 h-4" />
          3. Báo cáo Mượn / Cho mượn theo Đơn vị Đối tác
        </button>
      </div>

      {/* Printable Report Area */}
      <div
        id="printable-area"
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
      >
        {/* Print Header */}
        <div className="border-b border-slate-200 pb-4 mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-normal  text-slate-500">
              {systemConfig.unit_name}
            </p>
            <h2 className="text-base font-normal  text-[#C5299B]">
              {systemConfig.department_name}
            </h2>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>
              Kỳ báo cáo: <strong>{fromDate}</strong> đến <strong>{toDate}</strong>
            </p>
            <p>Ngày kết xuất: {new Date().toLocaleString('vi-VN')}</p>
          </div>
        </div>

        {reportTab === 'MOVEMENT' && (
          <div>
            <h3 className="section-title text-lg font-bold text-[#190072] text-center mb-4">
              Báo cáo tổng hợp Nhập - Xuất - Mượn - Tồn kho chế phẩm máu
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs ">
                    <th className="border border-slate-300 py-2.5 px-3 text-center">STT</th>
                    <th className="border border-slate-300 py-2.5 px-3 text-left">Mã CP</th>
                    <th className="border border-slate-300 py-2.5 px-3 text-left">
                      Tên loại chế phẩm máu
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Nhóm máu (ABO/Rh)
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Nhập kho
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Xuất máu
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Cho mượn
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Mượn về
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Tồn hiện tại
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Quá hạn
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {movementReport
                    .filter(
                      (r) =>
                        r.current_stock > 0 ||
                        r.imported_qty > 0 ||
                        r.exported_qty > 0 ||
                        r.lent_qty > 0 ||
                        r.borrowed_qty > 0
                    )
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((row, idx) => (
                      <tr key={row.blood_product_id} className="hover:bg-slate-50">
                        <td className="border border-slate-300 py-2 px-3 text-center">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>
                        <td className="border border-slate-300 py-2 px-3 font-mono text-xs">
                          {row.product_code}
                        </td>
                        <td className="border border-slate-300 py-2 px-3 font-normal text-slate-900">
                          {row.product_name}
                        </td>
                        <td className="border border-slate-300 py-2 px-3 text-center font-normal text-[#C5299B]">
                          {row.blood_group} ({row.rh_factor === '+' ? 'Rh+' : 'Rh-'})
                        </td>
                        <td className="border border-slate-300 py-2 px-3 text-center font-normal text-emerald-700">
                          {row.imported_qty}
                        </td>
                        <td className="border border-slate-300 py-2 px-3 text-center font-normal text-[#C5299B]">
                          {row.exported_qty}
                        </td>
                        <td className="border border-slate-300 py-2 px-3 text-center text-indigo-700 font-normal">
                          {row.lent_qty}
                        </td>
                        <td className="border border-slate-300 py-2 px-3 text-center text-purple-700 font-normal">
                          {row.borrowed_qty}
                        </td>
                        <td className="border border-slate-300 py-2 px-3 text-center font-normal text-slate-900 bg-slate-50">
                          {row.current_stock}
                        </td>
                        <td className="border border-slate-300 py-2 px-3 text-center font-normal text-rose-600">
                          {row.expired_stock}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 rounded-xl overflow-hidden border border-slate-200">
              <Pagination
                totalItems={
                  movementReport.filter(
                    (r) =>
                      r.current_stock > 0 ||
                      r.imported_qty > 0 ||
                      r.exported_qty > 0 ||
                      r.lent_qty > 0 ||
                      r.borrowed_qty > 0
                  ).length
                }
                currentPage={currentPage}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        )}

        {reportTab === 'EXPIRY' && (
          <div>
            <h3 className="section-title text-lg font-bold text-[#190072] text-center mb-4">
              Báo cáo chi tiết lô tồn kho & cảnh báo hạn sử dụng
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs ">
                    <th className="border border-slate-300 py-2.5 px-3 text-center">STT</th>
                    <th className="border border-slate-300 py-2.5 px-3 text-left">Mã máu (Túi)</th>
                    <th className="border border-slate-300 py-2.5 px-3 text-left">Mã CP</th>
                    <th className="border border-slate-300 py-2.5 px-3 text-left">
                      Tên chế phẩm máu
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      ABO / Rh
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Thể tích
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Ngày lấy máu
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Hạn sử dụng
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Cảnh báo hạn dùng
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Số lượng tồn
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lots
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((l, idx) => (
                      <tr key={l.id}>
                        <td className="border border-slate-300 py-2 px-3 text-center">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>
                        <td className="border border-slate-300 py-2 px-3 font-mono text-xs font-semibold text-center">
                          {l.blood_code ? (
                            <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800">
                              {l.blood_code}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">---</span>
                          )}
                        </td>
                        <td className="border border-slate-300 py-2 px-3 font-mono text-xs">
                          {l.product_code}
                        </td>
                      <td className="border border-slate-300 py-2 px-3 font-normal">
                        {l.product_name}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-center font-normal text-[#C5299B]">
                        {l.blood_group}
                        {l.rh_factor}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-center">
                        {l.volume_name}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-center font-normal text-slate-700">
                        {l.collection_date ? new Date(l.collection_date).toLocaleDateString('vi-VN') : '---'}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-center font-normal">
                        {new Date(l.expiry_date).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-center font-normal">
                        {(() => {
                          const badge = getExpiryBadgeInfo(
                            l.days_remaining,
                            systemConfig?.expiry_warning_milestones
                          );
                          return (
                            <span
                              style={{
                                backgroundColor: badge.bgColor,
                                color: badge.textColor,
                                borderColor: badge.borderColor,
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border"
                            >
                              {badge.icon === 'alert' && (
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              )}
                              {badge.icon === 'clock' && (
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                              )}
                              {badge.icon === 'check' && (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>{badge.text}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-center font-normal">
                        {l.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 rounded-xl overflow-hidden border border-slate-200">
              <Pagination
                totalItems={lots.length}
                currentPage={currentPage}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        )}

        {reportTab === 'PARTNER_DEBT' && (
          <div>
            <h3 className="section-title text-lg font-bold text-[#190072] text-center mb-4">
              Báo cáo theo dõi Mượn / Cho mượn theo đơn vị đối tác
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs ">
                    <th className="border border-slate-300 py-2.5 px-3 text-center">STT</th>
                    <th className="border border-slate-300 py-2.5 px-3 text-left">Mã ĐV</th>
                    <th className="border border-slate-300 py-2.5 px-3 text-left">
                      Tên đơn vị đối tác
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Tổng Cho mượn
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Đã thu hồi
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center bg-indigo-50">
                      Đối tác còn nợ
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Tổng Đi mượn
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center">
                      Đã trả đối tác
                    </th>
                    <th className="border border-slate-300 py-2.5 px-3 text-center bg-purple-50">
                      Khoa còn nợ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {partnerBorrowLend
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((p, idx) => (
                      <tr key={p.partner_id} className="hover:bg-slate-50">
                        <td className="border border-slate-300 py-2 px-3 text-center">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>
                      <td className="border border-slate-300 py-2 px-3 font-mono text-xs">
                        {p.partner_code}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 font-normal text-slate-800">
                        {p.partner_name}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-center font-normal">
                        {p.total_lent}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-center text-emerald-700 font-normal">
                        {p.lent_returned}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-center font-normal text-indigo-700 bg-indigo-50/40">
                        {p.lent_remaining}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-center font-normal">
                        {p.total_borrowed}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-center text-emerald-700 font-normal">
                        {p.borrowed_returned}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-center font-normal text-purple-700 bg-purple-50/40">
                        {p.borrowed_remaining}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 rounded-xl overflow-hidden border border-slate-200">
              <Pagination
                totalItems={partnerBorrowLend.length}
                currentPage={currentPage}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
