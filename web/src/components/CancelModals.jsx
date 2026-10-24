import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, X, XCircle, RotateCcw } from 'lucide-react';

// 1. Modal Yêu cầu hủy phiếu
export function CancelRequestModal(props) {
  const {
    isOpen,
    open,
    onClose,
    transaction,
    transactionCode,
    txType = 'IMPORT',
    onSubmit,
    onConfirm,
    loading,
  } = props;

  const show = Boolean(isOpen ?? open);
  const targetTx = transaction || (transactionCode ? { code: transactionCode, tx_type: txType } : null);
  const handleAction = onSubmit || onConfirm;

  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (show) {
      setReason('');
      setErr('');
    }
  }, [show]);

  if (!show || !targetTx) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErr('Vui lòng nhập lý do yêu cầu hủy phiếu!');
      return;
    }
    if (handleAction) {
      handleAction(reason.trim());
    }
  };

  const isImport = targetTx.tx_type === 'IMPORT';

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-amber-800">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <h3 className="font-bold text-base">
              Yêu cầu hủy phiếu {isImport ? 'nhập' : 'xuất'}: {targetTx.code}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1 border border-slate-200">
            <div>
              <strong>Mã phiếu:</strong> {targetTx.code}
            </div>
            {targetTx.tx_date && (
              <div>
                <strong>Ngày lập:</strong> {new Date(targetTx.tx_date).toLocaleString('vi-VN')}
              </div>
            )}
            <div>
              <strong>Tổng số lượng chế phẩm:</strong>{' '}
              {targetTx.total_quantity || targetTx.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 1} đơn vị
            </div>
            <div className="text-amber-700 font-medium pt-1">
              * Lưu ý: Phiếu sau khi gửi yêu cầu sẽ chuyển sang trạng thái "Chờ duyệt hủy". Cấp quản lý sẽ xem xét và duyệt hoàn nguyên kho.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lý do yêu cầu hủy phiếu <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={3}
              required
              autoFocus
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErr('');
              }}
              placeholder="Nhập chi tiết lý do cần hủy..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition"
            />
            {err && <p className="text-xs text-rose-600 mt-1">{err}</p>}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 transition"
            >
              Đóng / Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium shadow-sm transition disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{loading ? 'Đang gửi...' : 'Gửi yêu cầu hủy'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 2. Modal Phê duyệt hủy phiếu (Hoàn nguyên kho)
export function CancelApproveModal(props) {
  const {
    isOpen,
    open,
    onClose,
    transaction,
    transactionCode,
    txType = 'IMPORT',
    onApprove,
    onConfirm,
    loading,
  } = props;

  const show = Boolean(isOpen ?? open);
  const targetTx = transaction || (transactionCode ? { code: transactionCode, tx_type: txType } : null);
  const handleAction = onApprove || onConfirm;

  if (!show || !targetTx) return null;

  const isImport = targetTx.tx_type === 'IMPORT';

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-800">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <h3 className="font-bold text-base">
              Xác nhận DUYỆT HỦY phiếu: {targetTx.code}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-rose-50/60 rounded-xl text-xs text-rose-900 space-y-1.5 border border-rose-200">
            <div className="font-semibold text-rose-700">
              Cảnh báo tác động tồn kho khi duyệt hủy:
            </div>
            {isImport ? (
              <p>
                - Với <strong>Phiếu Nhập</strong>: Toàn bộ các túi máu đã nhập theo phiếu này sẽ được <strong>TRỪ KHỎI KHO</strong> để hoàn nguyên (chỉ thực hiện được nếu các túi máu chưa bị xuất).
              </p>
            ) : (
              <p>
                - Với <strong>Phiếu Xuất</strong>: Toàn bộ các túi máu đã xuất theo phiếu này sẽ được <strong>HOÀN TRẢ LẠI TỒN KHO</strong>.
              </p>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 space-y-1 border border-slate-200">
            <div>
              <strong>Người yêu cầu hủy:</strong> {targetTx.cancel_requester_name || 'Kỹ thuật viên'}
            </div>
            <div>
              <strong>Thời gian yêu cầu:</strong>{' '}
              {targetTx.cancel_requested_at
                ? new Date(targetTx.cancel_requested_at).toLocaleString('vi-VN')
                : '---'}
            </div>
            <div className="pt-1 text-slate-900">
              <strong>Lý do yêu cầu hủy:</strong>
              <div className="mt-1 p-2 bg-white rounded-lg border border-slate-200 text-slate-800 italic">
                "{targetTx.cancel_reason || 'Không ghi lý do'}"
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={() => handleAction && handleAction()}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium shadow-sm transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Đang duyệt hoàn kho...' : 'Xác nhận duyệt hủy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. Modal Từ chối yêu cầu hủy phiếu
export function CancelRejectModal(props) {
  const {
    isOpen,
    open,
    onClose,
    transaction,
    transactionCode,
    txType = 'IMPORT',
    onReject,
    onConfirm,
    loading,
  } = props;

  const show = Boolean(isOpen ?? open);
  const targetTx = transaction || (transactionCode ? { code: transactionCode, tx_type: txType } : null);
  const handleAction = onReject || onConfirm;

  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (show) {
      setRejectReason('');
    }
  }, [show]);

  if (!show || !targetTx) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (handleAction) {
      handleAction(rejectReason.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <XCircle className="w-5 h-5 text-slate-500" />
            <span>Từ chối yêu cầu hủy: {targetTx.code}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            Phiếu sẽ được giữ nguyên trạng thái hoạt động bình thường (Hoàn thành) và không thực hiện hoàn nguyên kho.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lý do từ chối (tùy chọn)
            </label>
            <textarea
              rows={3}
              autoFocus
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối yêu cầu hủy để kỹ thuật viên nắm rõ..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-slate-500 focus:ring-2 focus:ring-slate-400/20 outline-none transition"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 transition"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium shadow-sm transition disabled:opacity-50"
            >
              <span>{loading ? 'Đang lưu...' : 'Xác nhận từ chối'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
