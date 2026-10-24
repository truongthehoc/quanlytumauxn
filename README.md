# HỆ THỐNG QUẢN LÝ TỦ MÁU KHOA XÉT NGHIỆM (BLOODBANK LAB)

> **Phần mềm chuyên dụng quản lý tiếp nhận, lưu trữ, cấp phát, mượn/cho mượn, kiểm kê định kỳ và giám sát an toàn chế phẩm máu theo thời gian thực tại Khoa Xét nghiệm / Ngân hàng máu bệnh viện.**

---

## 📌 1. TỔNG QUAN HỆ THỐNG

**BloodBank Lab** được xây dựng theo chuẩn quy trình y tế quốc gia về an toàn truyền máu, giúp số hóa toàn diện quy trình vận hành tủ máu lưu trữ tại Bệnh viện:
- Quản lý chính xác từng túi chế phẩm máu theo **Mã túi máu duy nhất**, nhóm máu **ABO / Rh(+/-)**, thể tích và hạn sử dụng.
- Cơ chế giám sát hạn dùng thông minh với thuật toán **FEFO (First Expired, First Out - Hết hạn trước, Xuất trước)** và hệ thống đèn báo cảnh báo đa cấp độ: *Bình thường (Xanh)*, *Sắp hết hạn trong 7 ngày (Vàng)*, *Hết hạn (Đỏ)*.
- Hỗ trợ đầy đủ thiết bị đọc mã vạch chuyên dụng (Barcode Scanner) và máy in nhiệt/A4 tiêu chuẩn y tế.

---

## 🛠 2. KIẾN TRÚC CÔNG NGHỆ

Hệ thống được thiết kế theo mô hình **Client - Server (SPA + RESTful API)** hiện đại, nhẹ, hoạt động mượt mà trên cả mạng nội bộ bệnh viện (LAN) và máy chủ đám mây:

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT (WEB BROWSER)                  │
│       React 18 + Vite + TailwindCSS + Lucide Icons + XLSX   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / RESTful API (JSON)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API SERVER                       │
│        Node.js + Express.js + JWT Authentication            │
│  - RBAC Middleware (Phân quyền chi tiết theo từng chức năng)│
│  - Backup Manager (Tự động sao lưu MySQL định kỳ hàng ngày) │
└──────────────────────────────┬──────────────────────────────┘
                               │ MySQL2 Connection Pool
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE (MYSQL / MARIADB)               │
│ - Tự động khởi tạo cấu trúc bảng (initDb.js)                │
│ - Lưu trữ giao dịch, tồn kho lô túi máu, lịch sử kiểm kê    │
└─────────────────────────────────────────────────────────────┘
```

### Công nghệ sử dụng:
* **Frontend**:
  * [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) (Tốc độ biên dịch siêu tốc, trải nghiệm Single Page Application mượt mà).
  * [TailwindCSS](https://tailwindcss.com/) (Giao diện chuẩn y tế, hiện đại, tối ưu hiển thị trên màn hình máy tính bàn, máy tính bảng và màn hình chạm).
  * [Lucide React](https://lucide.dev/) (Bộ icon đồ họa y tế trực quan).
  * [SheetJS (xlsx)](https://docs.sheetjs.com/) (Xuất báo cáo Excel chuyên nghiệp).
* **Backend**:
  * [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/) (Xử lý đồng thời cao, độ trễ thấp).
  * [MySQL2](https://github.com/sidorares/node-mysql2) (Connection Pooling tối ưu tài nguyên máy chủ).
  * [Bcryptjs](https://github.com/dcodeIO/bcrypt.js) & [JSON Web Token (JWT)](https://jwt.io/) (Bảo mật xác thực tài khoản).
* **Cơ sở dữ liệu**:
  * MySQL 8.0+ / MariaDB 10.4+ (Hỗ trợ InnoDB Engine, Unicode utf8mb4).

---

## 🚀 3. DANH SÁCH PHÂN HỆ VÀ TÍNH NĂNG CHI TIẾT

### 1. Phân hệ Quản lý Tồn kho Tủ máu (`InventoryView`)
* Theo dõi số lượng tồn tức thời theo từng loại chế phẩm máu (Hồng cầu lắng, Huyết tương đông lạnh, Tiểu cầu gạn tách, Tủa lạnh...).
* Phân loại ma trận tồn theo nhóm máu **A, B, AB, O** và yếu tố **Rh(+ / -)**.
* Giám sát hạn dùng FEFO: Bộ lọc theo các mốc thời gian (*Còn hạn > 7 ngày*, *Sắp hết hạn ≤ 7 ngày*, *Đã quá hạn*).
* Tìm kiếm và lọc đa tiêu chí: Theo mã túi máu, loại chế phẩm, thể tích (ml), đơn vị đối tác cung cấp, ngày lấy máu, ngày hết hạn.
* Hỗ trợ quét mã vạch để định vị tức thì vị trí và thông tin chi tiết túi máu trong tủ.

### 2. Phân hệ Nhập kho Chế phẩm máu (`ImportView`)
* Nhập lô chế phẩm máu từ các Trung tâm Huyết học / Đơn vị đối tác (Trung tâm Huyết học TP.HCM, Viện Huyết học TW, BV Chợ Rẫy...).
* Nhập nhanh bằng máy quét mã vạch túi máu hoặc nhập liệu tay.
* Tự động tính hạn sử dụng theo số ngày chuẩn của từng loại chế phẩm.
* Xem trước và in Phiếu nhập kho chuẩn A4/A5 ngay khi hoàn tất.

### 3. Phân hệ Xuất kho Cấp phát (`ExportView`)
* Xuất cấp phát chế phẩm máu cho các Khoa / Phòng lâm sàng (Khoa Hồi sức cấp cứu, Khoa Gây mê phẫu thuật, Khoa Ngoại, Khoa Sản...).
* Cơ chế tự động gợi ý túi máu ưu tiên xuất theo nguyên tắc **FEFO (Túi hết hạn sớm nhất sẽ được gợi ý xuất trước)** nhằm tránh lãng phí máu.
* Kiểm tra chéo nhóm máu người nhận và túi máu trước khi xuất kho.
* In Phiếu xuất kho chuẩn y tế phục vụ ký giao nhận bệnh phẩm.

### 4. Phân hệ Mượn / Cho mượn Máu (`BorrowLendView`)
* Hỗ trợ nghiệp vụ điều phối máu khẩn cấp giữa các bệnh viện lân cận:
  * **Cho đơn vị bạn mượn máu**: Tạm xuất kho và theo dõi công nợ túi máu.
  * **Mượn máu từ đơn vị bạn**: Bổ sung cơ số tủ máu tạm thời trong các ca cấp cứu.
  * **Hoàn trả / Thu hồi máu**: Cập nhật số lượng hoàn trả từng phần hoặc toàn bộ.
* Quản lý trạng thái hợp đồng mượn/cho mượn trực quan (*Đang nợ, Đã trả đủ, Quá hạn hoàn trả*).

### 5. Phân hệ Kiểm kê Quỹ máu Định kỳ (`InventoryAuditView`)
* Chức năng kiểm kê riêng biệt, mở form tạo kỳ kiểm kê dạng **Slide-over Drawer trượt từ bên phải** không che khuất màn hình.
* Tự động đặt tên kỳ kiểm kê mặc định theo tháng/năm hiện tại: `Kiểm kê quỹ máu định kỳ tháng MM/YYYY`.
* **Cơ chế Snapshot thông minh**: Chỉ chụp ảnh số liệu của các túi máu **thực sự còn tồn kho (`quantity > 0`)**, loại bỏ các chế phẩm đã xuất hết để danh sách kiểm kê sạch sẽ, tinh gọn.
* **Quét mã vạch kiểm đếm trực tiếp**:
  * Đếm tăng số lượng thực tế khi quét trúng túi máu trong kỳ.
  * Nếu quét phải túi máu đã hết trong sổ sách nhưng thực tế còn trong tủ: Tự động ghi nhận dòng phát hiện **Thừa (+1)**.
* Chức năng **Cân bằng tồn kho tự động** khi hoàn tất kiểm kê.
* **Xuất báo cáo kiểm kê**:
  * In **Biên bản kiểm kê quỹ máu (Mẫu A4 Bộ Y Tế)** với đầy đủ thành phần ban kiểm kê, bảng chi tiết, kết luận và chữ ký của Trưởng ban, Thư ký, Thủ kho.
  * Xuất báo cáo chi tiết ra file **Excel (.xlsx)**.

### 6. Phân hệ Quy trình Duyệt hủy Phiếu (`CancellationApprovalView`)
* Đảm bảo tính minh bạch và an toàn tài sản y tế: Nhân viên không thể tùy ý xóa phiếu giao dịch đã xác nhận.
* Quy trình 2 bước:
  1. Kỹ thuật viên gửi **Yêu cầu hủy phiếu** kèm lý do giải trình.
  2. Quản trị viên / Lãnh đạo Khoa tiếp nhận, xem xét và bấm **Phê duyệt hủy** hoặc **Từ chối**.
* Khi duyệt hủy: Tồn kho của các túi máu liên quan sẽ được tự động hoàn lại chính xác.

### 7. Phân hệ Báo cáo & Thống kê (`ReportsView`)
* Báo cáo Xuất - Nhập - Tồn chi tiết theo khoảng thời gian tùy chọn.
* Biểu đồ trực quan biến động kho máu theo từng nhóm máu ABO/Rh.
* Báo cáo chi tiết theo Khoa lâm sàng nhận máu và theo Đơn vị cung cấp.
* Xuất file Excel chuẩn hóa mọi báo cáo chỉ với 1 click.

### 8. Phân hệ Quản trị & Cấu hình Hệ thống (`SystemView`)
* **Phân quyền người dùng (RBAC)**: Phân chia quyền hạn chi tiết đến từng thao tác (Xem, Tạo, Duyệt hủy, Kiểm kê, Quản trị hệ thống).
* **Quản lý danh mục**: Danh mục Loại chế phẩm máu, Thể tích, Đơn vị tính, Đơn vị đối tác, Khoa/Phòng lâm sàng.
* **Cấu hình thông tin bệnh viện**: Đổi tên đơn vị, tên khoa, địa chỉ, số điện thoại, số ngày cảnh báo hạn dùng.
* **Sao lưu dữ liệu tự động (Auto Backup)**: Lên lịch tự động sao lưu CSDL MySQL vào thư mục lưu trữ an toàn, hỗ trợ khôi phục dữ liệu (Restore) khi cần.

---

## 👥 4. TÀI KHOẢN TRUY CẬP MẶC ĐỊNH

Khi khởi động lần đầu, hệ thống sẽ tự động khởi tạo các tài khoản mẫu sau:

| Tên đăng nhập | Mật khẩu | Họ và tên | Vai trò | Quyền hạn |
| :--- | :--- | :--- | :--- | :--- |
| `admin` | `admin123` | Quản trị viên Hệ thống | Quản trị hệ thống (Admin) | Toàn quyền toàn bộ hệ thống |
| `ktv1` | `123456` | CNXN. Nguyễn Thị Minh Anh | Kỹ thuật viên Xét nghiệm | Nhập, Xuất, Mượn trả, Kiểm kê, Báo cáo |
| `ktv2` | `123456` | BS. Trần Văn Hùng | Kỹ thuật viên Xét nghiệm | Nhập, Xuất, Mượn trả, Kiểm kê, Báo cáo |

> ⚠️ **Khuyến cáo bảo mật**: Sau khi triển khai chính thức, vui lòng đăng nhập tài khoản `admin` và đổi mật khẩu trong mục Quản trị người dùng!

---

## 📁 5. CẤU TRÚC THƯ MỤC DỰ ÁN

```
Blood/
├── .gitignore               # Cấu hình bỏ qua file nhạy cảm và node_modules
├── package.json             # File quản lý script tổng của dự án
├── start.bat                # Kịch bản 1-click khởi động toàn bộ hệ thống trên Windows
├── stop.bat                 # Kịch bản 1-click dừng toàn bộ tiến trình hệ thống
├── README.md                # Tài liệu mô tả hệ thống chi tiết (File này)
├── DEPLOY.md                # Hướng dẫn chi tiết các bước triển khai lên môi trường thực tế
│
├── server/                  # Mã nguồn Backend API (Node.js + Express)
│   ├── .env.example         # File mẫu cấu hình biến môi trường
│   ├── package.json         # Danh sách thư viện Backend
│   ├── backups/             # Thư mục lưu trữ các bản sao lưu CSDL tự động
│   └── src/
│       ├── index.js         # Điểm khởi chạy API Server (Port 5005)
│       ├── db.js            # Kết nối MySQL Connection Pool
│       ├── initDb.js        # Tự động khởi tạo Schema CSDL và dữ liệu mẫu
│       ├── permissions.js   # Bảng phân quyền chức năng chi tiết
│       ├── backupManager.js # Quản lý sao lưu CSDL định kỳ
│       └── routes/          # Các API Endpoints:
│           ├── auth.js          # Xác thực, Đăng nhập, System Info
│           ├── inventory.js     # Danh sách tồn kho, hạn dùng, cảnh báo
│           ├── transactions.js  # Nhập kho, Xuất kho, Hủy phiếu
│           ├── audits.js        # Kiểm kê kho riêng biệt, quét mã, cân bằng
│           ├── categories.js    # Danh mục đối tác, khoa phòng, chế phẩm
│           ├── reports.js       # Báo cáo thống kê, xuất Excel
│           └── system.js        # Cấu hình hệ thống, người dùng, sao lưu
│
└── web/                     # Mã nguồn Frontend SPA (React + Vite + TailwindCSS)
    ├── package.json         # Danh sách thư viện Frontend
    ├── vite.config.js       # Cấu hình Vite & Proxy API về Port 5005
    ├── tailwind.config.js   # Cấu hình giao diện Tailwind
    ├── index.html           # File HTML gốc
    └── src/
        ├── main.jsx         # Điểm khởi chạy React App
        ├── App.jsx          # Điều hướng trang và Sidebar Navigation
        ├── api.js           # Cấu hình Axios Client gọi API
        ├── context/         # AuthContext (Trạng thái đăng nhập & Danh mục)
        ├── components/      # Các component dùng chung:
        │   ├── DateInput.jsx             # Chọn ngày chuẩn tiếng Việt
        │   ├── SearchableSelect.jsx      # Dropdown tìm kiếm thông minh
        │   ├── PrintSlipModal.jsx        # In phiếu Nhập / Xuất kho A4/A5
        │   ├── PrintAuditReportModal.jsx # In Biên bản kiểm kê chuẩn Bộ Y Tế
        │   └── Pagination.jsx            # Phân trang dữ liệu
        └── views/           # Các màn hình chức năng:
            ├── LoginView.jsx                # Màn hình đăng nhập
            ├── InventoryView.jsx            # Quản lý tồn kho & FEFO
            ├── ImportView.jsx               # Nhập kho chế phẩm máu
            ├── ExportView.jsx               # Xuất cấp phát chế phẩm máu
            ├── BorrowLendView.jsx           # Mượn / Cho mượn máu
            ├── InventoryAuditView.jsx       # Kiểm kê kho chuyên biệt
            ├── CancellationApprovalView.jsx # Phê duyệt hủy phiếu
            ├── ReportsView.jsx              # Báo cáo thống kê
            ├── CategoriesView.jsx           # Quản lý danh mục
            └── SystemView.jsx               # Quản trị hệ thống & sao lưu
```

---

## 📞 HỖ TRỢ VÀ BẢO TRÌ
* Đơn vị phát triển: **Phòng Công nghệ Thông tin - Đội ngũ Phần mềm Y tế**
* Phiên bản hiện tại: **2.0.0 (Release 2026)**
* Chi tiết triển khai: Xem file [DEPLOY.md](DEPLOY.md).
