import React from 'react';
import { Printer, X, Droplet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TX_TITLES = {
  IMPORT: 'PHIẾU NHẬP KHO CHẾ PHẨM MÁU',
  EXPORT: 'PHIẾU XUẤT CHẾ PHẨM MÁU',
  LEND: 'PHIẾU CHO MƯỢN CHẾ PHẨM MÁU',
  BORROW: 'PHIẾU MƯỢN CHẾ PHẨM MÁU',
  RETURN_LEND: 'PHIẾU NHẬN HOÀN TRẢ MÁU CHO MƯỢN',
  RETURN_BORROW: 'PHIẾU XUẤT HOÀN TRẢ MÁU ĐÃ MƯỢN',
};

export default function PrintSlipModal({
  transaction,
  onClose,
  onCancelRequest,
  onCancelApprove,
  onCancelReject,
  onRequestCancel,
  onApproveCancel,
  onRejectCancel,
  canCancelRequest = false,
  canApproveCancel = false,
}) {
  const handleCancelRequest = onCancelRequest || onRequestCancel;
  const handleCancelApprove = onCancelApprove || onApproveCancel;
  const handleCancelReject = onCancelReject || onRejectCancel;
  const { systemConfig } = useAuth();

  if (!transaction) return null;

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

  const items = transaction.items || [];
  const totalQty = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const totalVol = items.reduce(
    (s, i) => s + Number(i.quantity || 0) * Number(i.volume_ml || 0),
    0
  );

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-[99999] flex justify-center items-start bg-slate-900/60 p-4 sm:p-6 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Action Bar (hidden when printing) */}
        <div className="no-print shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <Printer className="w-5 h-5 text-[#C5299B]" />
            <h3 className="modal-title text-base font-bold text-[#190072]">
              Chi tiết phiếu: {transaction.code}
            </h3>
            {transaction.status === 'PENDING_CANCEL' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                Chờ duyệt hủy
              </span>
            )}
            {transaction.status === 'CANCELLED' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                Đã hủy
              </span>
            )}
            {(!transaction.status || transaction.status === 'COMPLETED') && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Hoàn thành
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {transaction.status === 'PENDING_CANCEL' && canApproveCancel && (
              <>
                <button
                  type="button"
                  onClick={() => handleCancelApprove?.(transaction)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-sm"
                >
                  Duyệt hủy phiếu
                </button>
                <button
                  type="button"
                  onClick={() => handleCancelReject?.(transaction)}
                  className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold transition"
                >
                  Từ chối
                </button>
              </>
            )}

            {(!transaction.status || transaction.status === 'COMPLETED') && canCancelRequest && (
              <button
                type="button"
                onClick={() => handleCancelRequest?.(transaction)}
                className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition shadow-xs"
              >
                Yêu cầu hủy phiếu
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#C5299B] hover:bg-[#a82083] text-white text-xs font-semibold transition shadow"
            >
              <Printer className="w-3.5 h-3.5" />
              In phiếu ngay
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cancellation Notice Banner (no-print) */}
        {transaction.status === 'PENDING_CANCEL' && (
          <div className="no-print px-6 py-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <span className="font-bold text-amber-700 shrink-0">⚠️ ĐANG CHỜ DUYỆT HỦY:</span>
            <div>
              <span>Lý do hủy: "{transaction.cancel_reason || 'Không ghi rõ'}"</span>
              <span className="text-amber-700 block mt-0.5">
                (Yêu cầu bởi: <strong>{transaction.cancel_requester_name || 'Kỹ thuật viên'}</strong> lúc {formatDateTime(transaction.cancel_requested_at)})
              </span>
            </div>
          </div>
        )}

        {transaction.status === 'CANCELLED' && (
          <div className="no-print px-6 py-3 bg-rose-50 border-b border-rose-200 text-xs text-rose-900 flex items-start gap-2">
            <span className="font-bold text-rose-700 shrink-0">🚫 PHIẾU ĐÃ BỊ HỦY:</span>
            <div>
              <span>Lý do: "{transaction.cancel_reason || 'Không ghi rõ'}"</span>
              <span className="text-rose-700 block mt-0.5">
                (Duyệt hủy bởi: <strong>{transaction.cancel_approver_name || 'Quản trị viên'}</strong> lúc {formatDateTime(transaction.cancel_approved_at)})
              </span>
            </div>
          </div>
        )}

        {/* Printable Content */}
        <div id="printable-area" className="overflow-y-auto flex-1 p-8 text-slate-900 bg-white">
          {/* Header Đơn vị & Khoa */}
          <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
            <div className="flex items-center gap-4">
              {systemConfig.logo_url ? (
                <img
                  src={systemConfig.logo_url}
                  alt="Logo"
                  className="w-16 h-16 object-contain"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-[#C5299B] flex items-center justify-center text-white font-normal">
                  <Droplet className="w-8 h-8" />
                </div>
              )}
              <div>
                <p className="text-sm font-normal  text-slate-700">
                  {systemConfig.unit_name || 'BỆNH VIỆN ĐA KHOA'}
                </p>
                <p className="text-base font-normal  text-[#C5299B]">
                  {systemConfig.department_name || 'KHOA XÉT NGHIỆM - TỦ MÁU'}
                </p>
                {systemConfig.address && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Đ/c: {systemConfig.address} {systemConfig.phone ? `| ĐT: ${systemConfig.phone}` : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right text-xs text-slate-600">
              <p className="font-normal text-slate-900">Mã phiếu: {transaction.code}</p>
              <p>Ngày lập: {formatDateTime(transaction.tx_date)}</p>
              {transaction.parent_tx_code && (
                <p className="font-normal text-indigo-700">
                  Phiếu gốc: {transaction.parent_tx_code}
                </p>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-normal  tracking-wide text-slate-900">
              {TX_TITLES[transaction.tx_type] || 'PHIẾU GIAO DỊCH TỦ MÁU'}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Số phiếu: <span className="font-normal text-slate-900">{transaction.code}</span>
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {transaction.partner_name && (
              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-500">Đơn vị đối tác: </span>
                <span className="font-normal text-slate-900">{transaction.partner_name}</span>
              </div>
            )}
            {transaction.person_name && (
              <div>
                <span className="text-slate-500">
                  {transaction.tx_type === 'IMPORT'
                    ? 'Người giao: '
                    : transaction.tx_type === 'EXPORT'
                    ? 'Người nhận / Bệnh nhân: '
                    : 'Người mượn / Người giao dịch: '}
                </span>
                <span className="font-normal text-slate-900">{transaction.person_name}</span>
              </div>
            )}
            {transaction.department_info && (
              <div>
                <span className="text-slate-500">Khoa/Phòng nhận: </span>
                <span className="font-normal text-slate-900">{transaction.department_info}</span>
              </div>
            )}
            {transaction.due_date && (
              <div>
                <span className="text-slate-500">Hạn hoàn trả dự kiến: </span>
                <span className="font-normal text-slate-900">
                  {formatDate(transaction.due_date)}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-500">Người lập phiếu: </span>
              <span className="font-normal text-slate-900">
                {transaction.creator_name || 'Nhân viên Xét nghiệm'}
              </span>
            </div>
            {transaction.note && (
              <div className="col-span-2">
                <span className="text-slate-500">Ghi chú / Lý do: </span>
                <span className="italic text-slate-800">{transaction.note}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <table className="w-full border-collapse border border-slate-400 text-sm mb-6">
            <thead>
              <tr className="bg-slate-100 text-slate-800">
                <th className="border border-slate-400 px-3 py-2 text-center w-10">STT</th>
                <th className="border border-slate-400 px-3 py-2 text-center">Mã máu (Túi)</th>
                <th className="border border-slate-400 px-3 py-2 text-left">Mã CP</th>
                <th className="border border-slate-400 px-3 py-2 text-left">Tên chế phẩm máu</th>
                <th className="border border-slate-400 px-3 py-2 text-center">Nhóm máu (ABO/Rh)</th>
                <th className="border border-slate-400 px-3 py-2 text-center">Thể tích</th>
                <th className="border border-slate-400 px-3 py-2 text-center">ĐVT</th>
                <th className="border border-slate-400 px-3 py-2 text-center">Ngày lấy máu</th>
                <th className="border border-slate-400 px-3 py-2 text-center">Hạn sử dụng</th>
                <th className="border border-slate-400 px-3 py-2 text-center">Số lượng</th>
                {['LEND', 'BORROW'].includes(transaction.tx_type) && (
                  <th className="border border-slate-400 px-3 py-2 text-center">Đã trả</th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td className="border border-slate-400 px-3 py-2 text-center">{idx + 1}</td>
                  <td className="border border-slate-400 px-3 py-2 font-mono text-xs font-semibold text-center">
                    {item.blood_code || '---'}
                  </td>
                  <td className="border border-slate-400 px-3 py-2 font-mono text-xs">
                    {item.product_code}
                  </td>
                  <td className="border border-slate-400 px-3 py-2 font-normal">
                    {item.product_name}
                    {item.note && (
                      <div className="text-xs text-slate-500 italic">{item.note}</div>
                    )}
                  </td>
                  <td className="border border-slate-400 px-3 py-2 text-center font-normal text-[#C5299B]">
                    {item.blood_group} ({item.rh_factor === '+' ? 'Rh+' : 'Rh-'})
                  </td>
                  <td className="border border-slate-400 px-3 py-2 text-center">
                    {item.volume_name || `${item.volume_ml} ml`}
                  </td>
                  <td className="border border-slate-400 px-3 py-2 text-center">
                    {item.unit_name}
                  </td>
                  <td className="border border-slate-400 px-3 py-2 text-center">
                    {formatDate(item.collection_date) || '---'}
                  </td>
                  <td className="border border-slate-400 px-3 py-2 text-center font-normal">
                    {formatDate(item.expiry_date)}
                  </td>
                  <td className="border border-slate-400 px-3 py-2 text-center font-normal">
                    {item.quantity}
                  </td>
                  {['LEND', 'BORROW'].includes(transaction.tx_type) && (
                    <td className="border border-slate-400 px-3 py-2 text-center">
                      {item.returned_quantity || 0} / {item.quantity}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-normal">
                <td
                  colSpan={9}
                  className="border border-slate-400 px-3 py-2 text-right  text-xs"
                >
                  Tổng cộng ({totalVol.toLocaleString('vi-VN')} ml):
                </td>
                <td className="border border-slate-400 px-3 py-2 text-center text-base text-[#C5299B]">
                  {totalQty}
                </td>
                {['LEND', 'BORROW'].includes(transaction.tx_type) && (
                  <td className="border border-slate-400 px-3 py-2 text-center">
                    {items.reduce((s, i) => s + Number(i.returned_quantity || 0), 0)} / {totalQty}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-4 text-center text-sm mt-10 pt-4">
            <div>
              <p className="font-normal  text-slate-800">Người lập phiếu</p>
              <p className="text-xs text-slate-500 italic">(Ký và ghi rõ họ tên)</p>
              <div className="h-20"></div>
              <p className="font-normal text-slate-900">{transaction.creator_name}</p>
            </div>
            <div>
              <p className="font-normal  text-slate-800">
                {transaction.tx_type === 'IMPORT'
                  ? 'Người giao'
                  : transaction.tx_type === 'EXPORT'
                  ? 'Người nhận máu'
                  : 'Đại diện đơn vị đối tác'}
              </p>
              <p className="text-xs text-slate-500 italic">(Ký và ghi rõ họ tên)</p>
              <div className="h-20"></div>
              <p className="font-normal text-slate-900">{transaction.person_name || ''}</p>
            </div>
            <div>
              <p className="font-normal  text-slate-800">Trưởng khoa Xét nghiệm</p>
              <p className="text-xs text-slate-500 italic">(Ký duyệt)</p>
              <div className="h-20"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
