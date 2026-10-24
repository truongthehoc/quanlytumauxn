const PERMISSION_MODULES = [
  {
    module: 'dashboard',
    label: 'Tổng quan & Cảnh báo',
    permissions: [
      { key: 'dashboard.view', label: 'Xem bảng điều khiển & cảnh báo hạn dùng' },
    ],
  },
  {
    module: 'inventory',
    label: 'Quản lý Tồn kho Tủ máu',
    permissions: [
      { key: 'inventory.view', label: 'Xem danh sách tồn kho & lô chế phẩm' },
      { key: 'inventory.adjust', label: 'Điều chỉnh / Kiểm kê số lượng tồn kho' },
    ],
  },
  {
    module: 'import',
    label: 'Nhập chế phẩm máu',
    permissions: [
      { key: 'import.view', label: 'Xem lịch sử phiếu nhập kho' },
      { key: 'import.create', label: 'Tạo phiếu nhập chế phẩm máu vào kho' },
      { key: 'import.print', label: 'In phiếu nhập kho' },
      { key: 'import.cancel_request', label: 'Gửi yêu cầu hủy phiếu nhập kho' },
      { key: 'import.cancel_approve', label: 'Duyệt / Từ chối hủy phiếu nhập kho' },
      { key: 'import.delete', label: 'Hủy / Xóa phiếu nhập kho' },
    ],
  },
  {
    module: 'export',
    label: 'Xuất chế phẩm máu',
    permissions: [
      { key: 'export.view', label: 'Xem lịch sử phiếu xuất máu' },
      { key: 'export.create', label: 'Bấm xuất chế phẩm máu' },
      { key: 'export.print', label: 'In phiếu xuất máu' },
      { key: 'export.cancel_request', label: 'Gửi yêu cầu hủy phiếu xuất máu' },
      { key: 'export.cancel_approve', label: 'Duyệt / Từ chối hủy phiếu xuất máu' },
      { key: 'export.delete', label: 'Hủy / Xóa phiếu xuất máu' },
    ],
  },
  {
    module: 'borrow_lend',
    label: 'Mượn & Cho mượn máu',
    permissions: [
      { key: 'borrow_lend.view', label: 'Xem danh sách phiếu Mượn / Cho mượn' },
      { key: 'borrow_lend.create', label: 'Tạo phiếu Mượn / Cho mượn chế phẩm máu' },
      { key: 'borrow_lend.return', label: 'Xác nhận Hoàn trả (Trả một phần / Đã trả)' },
      { key: 'borrow_lend.print', label: 'In phiếu Mượn / Cho mượn / Hoàn trả' },
      { key: 'borrow_lend.delete', label: 'Hủy / Xóa phiếu Mượn / Cho mượn' },
    ],
  },
  {
    module: 'audit',
    label: 'Kiểm kê kho chế phẩm',
    permissions: [
      { key: 'audit.view', label: 'Xem danh sách kỳ kiểm kê & chi tiết' },
      { key: 'audit.create', label: 'Tạo mới kỳ kiểm kê kho' },
      { key: 'audit.execute', label: 'Thực hiện kiểm đếm thực tế (nhập / quét mã túi)' },
      { key: 'audit.close', label: 'Chốt kỳ kiểm kê & Cân bằng tồn kho' },
      { key: 'audit.delete', label: 'Hủy / Xóa kỳ kiểm kê' },
      { key: 'audit.export', label: 'Xuất biên bản kiểm kê & Báo cáo Excel' },
    ],
  },
  {
    module: 'reports',
    label: 'Báo cáo & Thống kê',
    permissions: [
      { key: 'reports.view', label: 'Xem báo cáo Nhập - Xuất - Tồn & Hạn dùng' },
      { key: 'reports.export_excel', label: 'Xuất báo cáo ra file Excel (.xlsx)' },
      { key: 'reports.print', label: 'In báo cáo' },
    ],
  },
  {
    module: 'categories',
    label: 'Quản lý Danh mục',
    permissions: [
      { key: 'categories.view', label: 'Xem các danh mục (Đối tác, Chế phẩm, Thể tích, ĐVT)' },
      { key: 'categories.manage', label: 'Thêm / Sửa / Xóa danh mục' },
    ],
  },
  {
    module: 'system',
    label: 'Quản trị Hệ thống',
    permissions: [
      { key: 'system.config', label: 'Cấu hình hệ thống (Đơn vị, Khoa, Logo, Thông tin PM)' },
      { key: 'system.users', label: 'Quản lý Người dùng' },
      { key: 'system.roles', label: 'Quản lý Nhóm quyền & Phân quyền chi tiết' },
      { key: 'system.backup', label: 'Sao lưu & Khôi phục dữ liệu hệ thống' },
    ],
  },
];

const ALL_PERMISSION_KEYS = PERMISSION_MODULES.flatMap((m) =>
  m.permissions.map((p) => p.key)
);

module.exports = {
  PERMISSION_MODULES,
  ALL_PERMISSION_KEYS,
};
