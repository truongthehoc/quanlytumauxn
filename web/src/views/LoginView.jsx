import React, { useState } from 'react';
import {
  Droplet,
  Lock,
  User,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Code2,
  Tag,
  Bell,
  Activity,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginView() {
  const { login, systemConfig } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Đăng nhập thất bại, vui lòng kiểm tra lại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Họa tiết lưới điểm kỹ thuật đồng đều, không gradient */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none select-none opacity-50"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern id="login-tech-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="16" cy="16" r="1.2" fill="#94a3b8" />
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#login-tech-grid)" />
      </svg>

      {/* Khung chính Đăng nhập */}
      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        {/* Cột trái: Thông tin Bệnh viện & Các chức năng đặc biệt */}
        <div className="md:col-span-6 bg-[#190072] text-white p-8 flex flex-col justify-between relative">
          <div>
            {/* Đơn vị & Khoa */}
            <div className="flex items-center gap-3 mb-6">
              {systemConfig.logo_url ? (
                <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                  <img
                    src={systemConfig.logo_url}
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-sm shrink-0">
                  <Droplet className="w-6 h-6 text-[#C5299B] fill-[#C5299B]" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-wider text-slate-300 uppercase truncate">
                  {systemConfig.unit_name || 'BỆNH VIỆN ĐA KHOA'}
                </p>
                <h2 className="text-sm font-semibold tracking-tight text-white truncate">
                  {systemConfig.department_name || 'KHOA XÉT NGHIỆM - TỦ MÁU'}
                </h2>
              </div>
            </div>

            {/* Tên phần mềm & Mô tả */}
            <h1 className="text-xl font-bold leading-snug mb-2.5 text-white">
              {systemConfig.app_name || 'Hệ thống Quản lý Tủ máu Xét nghiệm'}
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Giải pháp toàn diện quản lý nhập - xuất - tồn chế phẩm máu, cảnh báo tự động hạn sử dụng và chuẩn hóa quy trình xét nghiệm.
            </p>

            {/* Các chức năng đặc biệt của hệ thống */}
            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-[#C5299B]/30 text-[#f59bdc] flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Giám sát & Cảnh báo HSD</div>
                  <div className="text-[11px] text-slate-300 leading-snug mt-0.5">
                    Tự động phân loại mốc hạn dùng theo màu sắc và cảnh báo túi máu sắp hết hạn.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Cấp phát nhanh ABO / Rh</div>
                  <div className="text-[11px] text-slate-300 leading-snug mt-0.5">
                    Xuất máu theo khoa lâm sàng, mượn/cho mượn đối tác và kiểm kê tồn kho chính xác.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Kiểm soát & Phê duyệt hủy</div>
                  <div className="text-[11px] text-slate-300 leading-snug mt-0.5">
                    Quy trình duyệt hủy 2 bước an toàn, phân quyền chi tiết và lưu vết lịch sử thao tác.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer thông tin phiên bản & phát triển */}
          <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Phiên bản v{systemConfig.app_version || '2.0.1'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{systemConfig.app_developer || 'Phòng CNTT'}</span>
            </div>
          </div>
        </div>

        {/* Cột phải: Form Đăng nhập */}
        <div className="md:col-span-6 p-8 md:p-10 flex flex-col justify-between bg-white">
          <div>
            {/* Góc phải trên: Badge Xác thực hệ thống */}
            <div className="flex items-center justify-end mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8]">
                <ShieldCheck className="w-3.5 h-3.5" />
                Xác thực hệ thống
              </span>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Đăng nhập hệ thống</h2>
              <p className="text-xs text-slate-500 mt-1">
                Sử dụng tài khoản được phân quyền để truy cập
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
              {/* Field Tên đăng nhập - Không lưu cache autofill */}
              <div>
                <label
                  htmlFor="bb_login_username"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Tên đăng nhập
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="bb_login_username"
                    name="bb_login_user_field"
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#C5299B] focus:ring-2 focus:ring-[#C5299B]/15 outline-none text-sm text-slate-900 transition bg-white"
                    placeholder="Nhập tên đăng nhập..."
                    required
                  />
                </div>
              </div>

              {/* Field Mật khẩu - Không lưu cache autofill */}
              <div>
                <label
                  htmlFor="bb_login_password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="bb_login_password"
                    name="bb_login_password_field"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 focus:border-[#C5299B] focus:ring-2 focus:ring-[#C5299B]/15 outline-none text-sm text-slate-900 transition bg-white"
                    placeholder="Nhập mật khẩu..."
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Nút Đăng nhập có hiệu ứng động */}
              <button
                type="submit"
                disabled={submitting}
                className="group relative w-full py-3 px-6 rounded-xl bg-[#C5299B] hover:bg-[#a82083] disabled:opacity-60 text-white font-medium text-sm transition-all duration-200 shadow-md shadow-[#C5299B]/20 hover:shadow-lg hover:shadow-[#C5299B]/30 active:scale-[0.99] flex items-center justify-center gap-2 mt-4 cursor-pointer overflow-hidden"
              >
                {/* Tia sáng quét nhẹ qua nút khi hover */}
                <span className="absolute inset-0 w-full h-full bg-white/15 -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />

                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang xác thực...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-semibold tracking-wide">
                    <span className="inline-block transition-transform duration-200 group-hover:translate-x-1 font-bold text-base">
                      &gt;
                    </span>
                    <span>Đăng nhập</span>
                  </span>
                )}
              </button>
            </form>
          </div>

          <div className="mt-8 text-center text-[11px] text-slate-400">
            Hệ thống quản lý an toàn & bảo mật thông tin nội bộ
          </div>
        </div>
      </div>
    </div>
  );
}
