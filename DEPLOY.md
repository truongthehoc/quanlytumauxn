# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG QUẢN LÝ TỦ MÁU (BLOODBANK LAB)

Tài liệu này hướng dẫn chi tiết quy trình cài đặt và triển khai hệ thống **Hệ Thống Quản Lý Tủ Máu Khoa Xét Nghiệm** trên môi trường máy chủ nội bộ Bệnh viện (On-premise LAN) hoặc Máy chủ Đám mây (Cloud Server).

---

## 📋 MỤC LỤC
1. [Yêu cầu hệ thống (Prerequisites)](#1-yêu-cầu-hệ-thống-prerequisites)
2. [Tải mã nguồn dự án](#2-tải-mã-nguồn-dự-án)
3. [Phương án 1: Triển khai nhanh trên Windows Server (Khuyên dùng cho mạng LAN)](#3-phương-án-1-triển-khai-nhanh-trên-windows-server)
4. [Phương án 2: Triển khai Production chuẩn y tế với PM2 + Nginx](#4-phương-án-2-triển-khai-production-chuẩn-y-tế-với-pm2--nginx)
5. [Cấu hình truy cập trong Mạng nội bộ Bệnh viện (LAN)](#5-cấu-hình-truy-cập-trong-mạng-nội-bộ-bệnh-viện-lan)
6. [Cấu hình Sao lưu dữ liệu & Phục hồi (Backup & Disaster Recovery)](#6-cấu-hình-sao-lưu-dữ-liệu--phục-hồi)
7. [Quy trình cập nhật phiên bản mới (Update Code)](#7-quy-trình-cập-nhật-phiên-bản-mới)
8. [Xử lý sự cố thường gặp (Troubleshooting)](#8-xử-lý-sự-cố-thường-gặp)

---

## 1. YÊU CẦU HỆ THỐNG (PREREQUISITES)

### Cấu hình phần cứng tối thiểu:
* **CPU**: 2 Cores trở lên (Khuyến nghị 4 Cores).
* **RAM**: 4 GB trở lên (Khuyến nghị 8 GB để chạy mượt mà cùng hệ thống CSDL).
* **Ổ cứng**: Tối thiểu 20 GB dung lượng trống (Ưu tiên ổ SSD để tốc độ truy xuất nhanh).
* **Hệ điều hành**:
  * Windows 10 / 11 Pro hoặc Windows Server 2016 / 2019 / 2022.
  * Hoặc Linux (Ubuntu 20.04 / 22.04 LTS, Debian 11/12, CentOS/RHEL 8/9).

### Phần mềm bắt buộc cần cài đặt trước:
1. **Node.js**: Phiên bản LTS 18.x hoặc 20.x trở lên.
   * Tải tại: [https://nodejs.org/](https://nodejs.org/)
   * Kiểm tra sau khi cài: `node -v` và `npm -v`
2. **Cơ sở dữ liệu MySQL**: Phiên bản 8.0+ hoặc MariaDB 10.4+.
   * Có thể dùng: **MySQL Community Server**, hoặc bộ phần mềm **XAMPP** (rất tiện dụng cho Windows Server).
3. **Git**: Để tải và đồng bộ mã nguồn.
   * Tải tại: [https://git-scm.com/](https://git-scm.com/)

---

## 2. TẢI MÃ NGUỒN DỰ ÁN

Mở **Terminal / PowerShell** hoặc **Command Prompt**, điều hướng đến thư mục muốn cài đặt và chạy:

```bash
# Clone qua giao thức SSH (nếu đã cài đặt SSH Key)
git clone git@github.com:truongthehoc/quanlytumauxn.git Blood

# Hoặc clone qua giao thức HTTPS
git clone https://github.com/truongthehoc/quanlytumauxn.git Blood

# Di chuyển vào thư mục dự án
cd Blood
```

---

## 3. PHƯƠNG ÁN 1: TRIỂN KHAI NHANH TRÊN WINDOWS SERVER

Đây là phương án thuận tiện nhất cho các Bệnh viện đang sử dụng máy chủ Windows hoặc máy trạm chuyên dụng đặt tại Khoa Xét nghiệm.

### Bước 1: Chuẩn bị CSDL MySQL
* Mở **XAMPP Control Panel** và bấm **Start** dịch vụ MySQL (hoặc đảm bảo dịch vụ MySQL Server đã chạy).
* Mặc định tài khoản MySQL của XAMPP là: User `root`, Password ` ` (để trống).

### Bước 2: Thiết lập cấu hình môi trường Backend
Tạo file `.env` trong thư mục `server/` (dựa trên mẫu `server/.env.example`):

```ini
PORT=5005
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=blood_bank
JWT_SECRET=chuoi_khoa_bao_mat_ngau_nhien_rat_dai_cua_benh_vien_2026
```
*(Nếu MySQL có mật khẩu, hãy điền vào `DB_PASSWORD`)*.

> 💡 **Lưu ý quan trọng**: Bạn **không cần** phải tạo thủ công cơ sở dữ liệu `blood_bank` hay chạy script SQL. Hệ thống sẽ **tự động khởi tạo database, cấu trúc các bảng và dữ liệu mẫu chuẩn** ngay trong lần đầu chạy server!

### Bước 3: Khởi động hệ thống bằng 1 click (`start.bat`)
Trong thư mục gốc của dự án, nhấp đúp chuột vào file **`start.bat`** (hoặc chạy từ CMD):
```cmd
start.bat
```

**Kịch bản `start.bat` sẽ tự động:**
1. Kiểm tra môi trường Node.js.
2. Tự động chạy `npm install` nếu các thư viện chưa được tải.
3. Kiểm tra và kích hoạt dịch vụ MySQL nếu đang tắt.
4. Khởi động Backend API tại cổng `5005`.
5. Khởi động Giao diện Web tại cổng `3005`.
6. Tự động mở trình duyệt web tới địa chỉ `http://localhost:3005`.

### Khi cần dừng hệ thống:
Nhấp đúp chuột vào file **`stop.bat`** để tắt an toàn mọi tiến trình đang chạy.

---

## 4. PHƯƠNG ÁN 2: TRIỂN KHAI PRODUCTION CHUẨN Y TẾ VỚI PM2 + NGINX

Phương án này giúp hệ thống hoạt động ổn định 24/7/365, tự động bật lại khi máy chủ khởi động lại hoặc khi xảy ra sự cố đột ngột.

### Bước 1: Cài đặt thư viện
```bash
# Cài đặt cho Backend
cd server
npm install --omit=dev
cd ..

# Cài đặt cho Frontend và Build bản Production
cd web
npm install
npm run build
cd ..
```
Thư mục `web/dist` sẽ được sinh ra chứa toàn bộ mã nguồn tĩnh đã được nén tối ưu.

### Bước 2: Cài đặt PM2 (Process Manager)
Cài đặt PM2 toàn cục:
```bash
npm install -g pm2
```

### Bước 3: Khởi chạy Backend qua PM2
```bash
cd server
pm2 start src/index.js --name "bloodbank-api" -i max
pm2 save
pm2 startup
```

### Bước 4: Cấu hình Nginx làm Reverse Proxy
Cài đặt Nginx và tạo file cấu hình máy chủ `/etc/nginx/sites-available/bloodbank` (trên Linux) hoặc trong `nginx/conf/nginx.conf` (trên Windows):

```nginx
server {
    listen 80;
    server_name bloodbank.benhvien.vn 192.168.1.100;

    # Frontend - Serve file tĩnh từ thư mục web/dist
    location / {
        root /path/to/Blood/web/dist;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # Backend API - Chuyển tiếp request sang cổng 5005
    location /api/ {
        proxy_pass http://127.0.0.1:5005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Giới hạn kích thước tải lên (file backup / ảnh)
    client_max_body_size 50M;
}
```

Kiểm tra và khởi động lại Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. CẤU HÌNH TRUY CẬP TRONG MẠNG NỘI BỘ BỆNH VIỆN (LAN)

Để các máy tính tại Khoa Cấp cứu, Khoa Gây mê hồi sức, Khoa Khám bệnh có thể truy cập vào hệ thống:

1. **Thiết lập IP tĩnh cho máy chủ**:
   * Ví dụ: Đặt IP máy chủ là `192.168.1.100`.
2. **Mở cổng tường lửa (Windows Firewall / UFW)**:
   * Nếu dùng `start.bat`: Cần mở cổng `3005` (Frontend) và `5005` (Backend API).
   * Mở cổng nhanh bằng PowerShell (Run as Administrator):
   ```powershell
   New-NetFirewallRule -DisplayName "BloodBank Web" -Direction Inbound -LocalPort 3005 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "BloodBank API" -Direction Inbound -LocalPort 5005 -Protocol TCP -Action Allow
   ```
   * Nếu đã dùng Nginx: Chỉ cần mở cổng `80` (HTTP) hoặc `443` (HTTPS).
3. **Truy cập từ các máy trạm**:
   * Mở trình duyệt (Chrome, Edge, Firefox, Cốc Cốc) và gõ:
   * `http://192.168.1.100:3005` (hoặc `http://192.168.1.100` nếu qua Nginx).

---

## 6. CẤU HÌNH SAO LƯU DỮ LIỆU & PHỤC HỒI

Hệ thống đã tích hợp sẵn cơ chế **Sao lưu cơ sở dữ liệu tự động**:
1. Đăng nhập tài khoản `admin` vào hệ thống.
2. Điều hướng vào menu **Cấu hình hệ thống** -> **Sao lưu & Dữ liệu**.
3. Bật tùy chọn **Tự động sao lưu định kỳ hàng ngày**:
   * Cài đặt giờ sao lưu: Ví dụ `23:00` hàng đêm.
   * Cài đặt số lượng bản lưu giữ tối đa: Ví dụ `7` bản gần nhất.
4. Khi cần phục hồi: Chọn file backup từ danh sách và bấm **Phục hồi (Restore)**. Bản sao lưu được lưu dưới dạng file `.json` / `.sql` trong thư mục `server/backups/`.

---

## 7. QUY TRÌNH CẬP NHẬT PHIÊN BẢN MỚI

Khi có bản cập nhật tính năng mới từ kho GitHub, thực hiện theo các bước sau:

```bash
# 1. Dừng hệ thống đang chạy
stop.bat  # (hoặc pm2 stop all)

# 2. Lấy mã nguồn mới nhất từ GitHub
git pull origin main

# 3. Cập nhật thư viện mới (nếu có)
cd server
npm install
cd ../web
npm install
npm run build
cd ..

# 4. Khởi động lại hệ thống
start.bat  # (hoặc pm2 restart all)
```

---

## 8. XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

### 1. Lỗi: "Không kết nối được tới Cơ sở dữ liệu MySQL"
* **Nguyên nhân**: Dịch vụ MySQL chưa được khởi động hoặc sai mật khẩu trong `server/.env`.
* **Cách xử lý**:
  * Kiểm tra xem XAMPP MySQL hoặc MySQL Service đã Start màu xanh chưa.
  * Mở file `server/.env` kiểm tra lại `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`.

### 2. Lỗi: "Port 5005 hoặc Port 3005 already in use"
* **Nguyên nhân**: Có phiên bản cũ đang chạy ngầm chiếm cổng.
* **Cách xử lý**:
  * Chạy file `stop.bat` để quét và tắt các tiến trình chiếm cổng.
  * Hoặc mở CMD gõ:
    ```cmd
    netstat -ano | findstr "5005"
    taskkill /f /pid <MÃ_PID>
    ```

### 3. Máy trạm trong viện không mở được Web (Màn hình trắng hoặc báo Connection Timed Out)
* **Nguyên nhân**: Windows Firewall của máy chủ đang chặn kết nối ngoài vào.
* **Cách xử lý**:
  * Kiểm tra theo mục [5. Cấu hình tường lửa](#5-cấu-hình-truy-cập-trong-mạng-nội-bộ-bệnh-viện-lan).
  * Đảm bảo máy trạm và máy chủ cùng lớp mạng LAN nội bộ (ping thông IP của nhau).

---
*Mọi thắc mắc hoặc yêu cầu hỗ trợ kỹ thuật, vui lòng liên hệ Phòng CNTT / Đội ngũ Quản trị Phần mềm Bệnh viện.*
