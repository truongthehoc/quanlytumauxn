import React from 'react';
import { Printer, X, Droplet, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PrintAuditReportModal({
  audit,
  items = [],
  onClose,
  onExportExcel,
}) {
  const { systemConfig } = useAuth();

  if (!audit) return null;

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

  const totalSystemQty = items.reduce((s, i) => s + (Number(i.system_qty) || 0), 0);
  const totalActualQty = items.reduce((s, i) => s + (Number(i.actual_qty) || 0), 0);
  const totalDiffQty = totalActualQty - totalSystemQty;

  const matchedItems = items.filter((i) => i.status === 'MATCHED');
  const excessItems = items.filter((i) => i.status === 'EXCESS');
  const deficitItems = items.filter((i) => i.status === 'DEFICIT');

  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-[99999] flex justify-center items-start bg-slate-900/60 p-4 sm:p-6 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Thanh công cụ khi xem trên màn hình */}
        <div className="print:hidden flex justify-between items-center px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#190072]">
                In Biên bản Kiểm kê Quỹ Chế phẩm Máu
              </h3>
              <p className="text-xs text-slate-500">
                Kỳ: {audit.code} — {audit.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition flex items-center gap-1.5"
                title="Tải file Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Xuất Excel</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>In Biên bản (Ctrl+P)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Nội dung Biên bản kiểm kê (chuẩn khổ giấy A4) */}
        <div className="p-8 sm:p-12 text-slate-900 bg-white font-sans text-sm print:p-0 print:m-0">
          {/* Header Cơ quan / Đơn vị */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                {systemConfig?.hospital_name || 'BỆNH VIỆN / CƠ SỞ Y TẾ'}
              </div>
              <div className="text-sm font-bold uppercase text-[#190072]">
                {systemConfig?.department_name || 'KHOA XÉT NGHIỆM - NGÂN HÀNG MÁU'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Bộ phận: Quản lý Kho & Tủ lưu trữ Chế phẩm máu
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-wider">
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
              </div>
              <div className="text-xs italic text-slate-700">
                Độc lập - Tự do - Hạnh phúc
              </div>
              <div className="text-xs text-slate-500 mt-2 font-mono">
                Số: <strong>{audit.code}</strong>/BB-KKM
              </div>
            </div>
          </div>

          {/* Tiêu đề Biên bản */}
          <div className="text-center my-6">
            <h1 className="text-xl sm:text-2xl font-black uppercase text-[#190072] tracking-wide">
              BIÊN BẢN KIỂM KÊ CHẾ PHẨM MÁU
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-1">
              {audit.name}
            </p>
            <p className="text-xs italic text-slate-500 mt-0.5">
              Thời điểm kiểm kê: {formatDate(audit.audit_date)} (Lập lúc: {formatDateTime(audit.created_at)})
            </p>
          </div>

          {/* Thành phần Ban kiểm kê */}
          <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 print:bg-transparent print:p-2">
            <div className="font-bold text-slate-800 text-sm mb-1">
              I. THÀNH PHẦN BAN KIỂM KÊ:
            </div>
            {audit.committee ? (
              <div className="whitespace-pre-line text-slate-700 pl-3">
                {audit.committee}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-3 text-slate-700">
                <div>• <strong>Trưởng ban:</strong> Đại diện Lãnh đạo Khoa</div>
                <div>• <strong>Thư ký:</strong> Cán bộ phụ trách ghi chép</div>
                <div>• <strong>Ủy viên:</strong> Thủ kho Quản lý Tủ máu</div>
              </div>
            )}
            <div className="text-slate-600 pl-3 pt-1">
              Đã tiến hành kiểm kê thực tế toàn bộ các túi chế phẩm máu đang lưu trữ trong tủ bảo quản. Kết quả như sau:
            </div>
          </div>

          {/* Bảng chi tiết danh mục túi máu kiểm kê */}
          <div className="mb-6">
            <div className="font-bold text-slate-800 text-sm mb-2">
              II. KẾT QUẢ KIỂM KÊ CHI TIẾT:
            </div>
            <div className="overflow-x-auto border border-slate-300 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 uppercase font-bold text-[11px]">
                    <th className="py-2.5 px-2 text-center w-10 border-r border-slate-300">STT</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Mã túi máu</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Loại chế phẩm</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-300 w-16">Nhóm</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-300 w-16">Thể tích</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-300 w-24">Hạn dùng</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-300 w-16 bg-blue-50/50">Sổ sách</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-300 w-16 bg-emerald-50/50">Thực tế</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-300 w-20">Chênh lệch</th>
                    <th className="py-2.5 px-3">Ghi chú / Hiện trạng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-6 text-center text-slate-400 italic">
                        Không có dữ liệu chế phẩm máu nào trong kỳ kiểm kê này.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const diff = Number(item.diff_qty) || 0;
                      return (
                        <tr
                          key={item.id || idx}
                          className={diff !== 0 ? 'bg-amber-50/40' : 'hover:bg-slate-50/60'}
                        >
                          <td className="py-2 px-2 text-center font-medium text-slate-500 border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-[#C5299B] border-r border-slate-200 whitespace-nowrap">
                            {item.blood_code || '---'}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800 border-r border-slate-200">
                            {item.product_name}
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-[#190072] border-r border-slate-200">
                            {item.blood_group}{item.rh_factor}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-700 border-r border-slate-200 whitespace-nowrap">
                            {item.volume_name}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-600 border-r border-slate-200 whitespace-nowrap">
                            {formatDate(item.expiry_date)}
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-blue-900 border-r border-slate-200 bg-blue-50/30">
                            {item.system_qty}
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-emerald-900 border-r border-slate-200 bg-emerald-50/30">
                            {item.actual_qty}
                          </td>
                          <td className="py-2 px-2 text-center font-bold border-r border-slate-200 whitespace-nowrap">
                            {diff === 0 ? (
                              <span className="text-emerald-700">Khớp (0)</span>
                            ) : diff > 0 ? (
                              <span className="text-amber-700">Thừa +{diff}</span>
                            ) : (
                              <span className="text-rose-700">Thiếu {diff}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-600 text-xs">
                            {item.note || 'Bình thường'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={6} className="py-2.5 px-3 text-right uppercase border-r border-slate-300">
                      Tổng cộng:
                    </td>
                    <td className="py-2.5 px-2 text-center text-blue-950 border-r border-slate-300">
                      {totalSystemQty}
                    </td>
                    <td className="py-2.5 px-2 text-center text-emerald-950 border-r border-slate-300">
                      {totalActualQty}
                    </td>
                    <td className="py-2.5 px-2 text-center border-r border-slate-300">
                      {totalDiffQty === 0 ? (
                        <span className="text-emerald-700">0</span>
                      ) : totalDiffQty > 0 ? (
                        <span className="text-amber-700">+{totalDiffQty}</span>
                      ) : (
                        <span className="text-rose-700">{totalDiffQty}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-600">
                      Khớp: {matchedItems.length} • Lệch: {excessItems.length + deficitItems.length}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tóm tắt đánh giá & Kiến nghị */}
          <div className="mb-8 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 print:bg-transparent print:p-2">
            <div className="font-bold text-slate-800 text-sm mb-1">
              III. ĐÁNH GIÁ VÀ KẾT LUẬN CỦA BAN KIỂM KÊ:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-700 pl-3">
              <div>
                <p>• Tổng số túi máu theo Sổ sách: <strong>{totalSystemQty}</strong> túi/bịch.</p>
                <p>• Tổng số túi máu đếm Thực tế: <strong>{totalActualQty}</strong> túi/bịch.</p>
                <p>
                  • Chênh lệch tổng thể:{' '}
                  <strong>
                    {totalDiffQty === 0
                      ? 'Khớp hoàn toàn (0)'
                      : totalDiffQty > 0
                      ? `Thừa +${totalDiffQty} túi`
                      : `Thiếu ${totalDiffQty} túi`}
                  </strong>
                </p>
              </div>
              <div>
                <p>• Tình trạng chất lượng: Các túi máu còn nguyên tem nhãn, bảo quản ở dải nhiệt độ chuẩn.</p>
                <p>
                  • Cân bằng kho:{' '}
                  <strong>
                    {audit.is_balanced
                      ? 'ĐÃ ĐƯỢC CÂN BẰNG TỒN KHO HỆ THỐNG'
                      : 'Lưu biên bản số liệu, chưa cân bằng kho'}
                  </strong>
                </p>
                {audit.note && (
                  <p className="mt-1 text-slate-600 italic">
                    • Ghi chú thêm: {audit.note}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Chữ ký các bên */}
          <div className="pt-4 text-xs">
            <div className="text-right italic text-slate-500 mb-6">
              Ngày {day} tháng {month} năm {year}
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="font-bold uppercase text-slate-900">
                  NGƯỜI LẬP BIÊN BẢN
                </div>
                <div className="text-[11px] italic text-slate-500 mb-20">
                  (Ký, ghi rõ họ tên)
                </div>
                <div className="font-semibold text-slate-800">
                  {audit.creator_name || audit.creator_full_name || '................................'}
                </div>
              </div>

              <div>
                <div className="font-bold uppercase text-slate-900">
                  THỦ KHO TỦ MÁU
                </div>
                <div className="text-[11px] italic text-slate-500 mb-20">
                  (Ký, ghi rõ họ tên)
                </div>
                <div className="font-semibold text-slate-800">
                  ................................
                </div>
              </div>

              <div>
                <div className="font-bold uppercase text-slate-900">
                  TRƯỞNG KHOA / LÃNH ĐẠO
                </div>
                <div className="text-[11px] italic text-slate-500 mb-20">
                  (Ký, đóng dấu)
                </div>
                <div className="font-semibold text-slate-800">
                  ................................
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
