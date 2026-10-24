import React, { useState } from 'react';
import { Droplet, Lock, User, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginView() {
  const { login, systemConfig } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
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

  const quickFill = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-pink-50/30 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Họa tiết nền sáng (Medical Grid, Crosses & Droplets Pattern) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none select-none"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern id="login-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
            {/* Lưới điểm tọa độ */}
            <circle cx="4" cy="4" r="1" fill="#94a3b8" opacity="0.25" />
            <circle cx="34" cy="34" r="1" fill="#94a3b8" opacity="0.25" />
            {/* Biểu tượng chữ thập y tế mờ */}
            <path
              d="M 50 14 H 58 M 54 10 V 18"
              stroke="#190072"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.1"
            />
            {/* Biểu tượng giọt máu chuyên ngành */}
            <path
              d="M 18 36 C 18 36 13 43 13 46 A 5 5 0 0 0 23 46 C 23 43 18 36 18 36 Z"
              fill="#C5299B"
              opacity="0.06"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#login-pattern)" />
      </svg>

      {/* Hiệu ứng vầng sáng mềm mại các góc */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-br from-[#190072]/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-tl from-[#C5299B]/12 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-pink-100/20 rounded-full blur-3xl pointer-events-none" />

      {/* Họa tiết trang trí viền góc dạng vòng tròn nghệ thuật */}
      <div className="absolute top-12 right-12 w-48 h-48 rounded-full border border-slate-200/60 pointer-events-none hidden md:block" />
      <div className="absolute top-16 right-16 w-40 h-40 rounded-full border border-pink-200/40 pointer-events-none hidden md:block" />
      <div className="absolute bottom-12 left-12 w-56 h-56 rounded-full border border-slate-200/50 pointer-events-none hidden md:block" />

      {/* Khung chính Đăng nhập */}
      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(25,0,114,0.15)] overflow-hidden border border-slate-200/80">
        {/* Cột trái: Thông tin Bệnh viện / Hệ thống */}
        <div className="md:col-span-6 bg-gradient-to-br from-[#190072] via-[#2c0985] to-[#C5299B] text-white p-8 flex flex-col justify-between relative overflow-hidden">
          {/* Họa tiết chìm trong banner trái */}
          <div className="absolute -top-16 -right-16 w-60 h-60 rounded-full bg-white/5 pointer-events-none border border-white/10" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-white/5 pointer-events-none border border-white/10" />
          <Droplet className="absolute -bottom-10 -right-10 w-52 h-52 text-white/[0.04] fill-white/[0.04] pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              {systemConfig.logo_url ? (
                <img
                  src={systemConfig.logo_url}
                  alt="Logo"
                  className="w-14 h-14 rounded-2xl bg-white p-1.5 object-contain shadow-lg"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/25 shadow-lg">
                  <Droplet className="w-8 h-8 text-red-200 fill-red-200" />
                </div>
              )}
              <div>
                <p className="text-xs font-normal tracking-wider text-pink-200 uppercase">
                  {systemConfig.unit_name || 'BỆNH VIỆN ĐA KHOA'}
                </p>
                <h2 className="text-base font-medium tracking-tight text-white">
                  {systemConfig.department_name || 'KHOA XÉT NGHIỆM - TỦ MÁU'}
                </h2>
              </div>
            </div>

            <h1 className="text-2xl font-normal leading-snug mb-3 text-white">
              {systemConfig.app_name || 'Hệ thống Quản lý Tủ máu Xét nghiệm'}
            </h1>
            <p className="text-sm text-pink-100/90 leading-relaxed mb-6 font-light">
              Quản lý nhập kho chế phẩm máu theo lô, theo dõi hạn sử dụng & cảnh báo tự động, xuất máu nhanh theo ABO/Rh, quản lý mượn/cho mượn đối tác và báo cáo chuẩn xét nghiệm.
            </p>

            <div className="space-y-2.5 text-xs text-pink-100 bg-black/20 p-4 rounded-2xl border border-white/10 backdrop-blur-xs">
              <div className="font-medium tracking-wider text-pink-200 mb-1">
                Tài khoản dùng thử nhanh:
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>• Quản trị viên (Toàn quyền):</span>
                <button
                  type="button"
                  onClick={() => quickFill('admin', 'admin123')}
                  className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-normal transition"
                >
                  admin / admin123
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>• KTV Xét nghiệm:</span>
                <button
                  type="button"
                  onClick={() => quickFill('ktv1', '123456')}
                  className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-normal transition"
                >
                  ktv1 / 123456
                </button>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-8 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-pink-200">
            <span>Phiên bản: v{systemConfig.app_version || '2.0.0'}</span>
            <span>PT: {systemConfig.app_developer || 'Phòng CNTT'}</span>
          </div>
        </div>

        {/* Cột phải: Form Đăng nhập */}
        <div className="md:col-span-6 p-8 md:p-10 flex flex-col justify-center bg-white">
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8] mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Xác thực hệ thống Tủ máu
            </span>
            <h2 className="text-2xl font-normal text-slate-900">Đăng nhập hệ thống</h2>
            <p className="text-sm text-slate-500 mt-1">
              Sử dụng tài khoản được phân quyền để truy cập
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-sm text-rose-700">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tên đăng nhập
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:border-[#C5299B] focus:ring-2 focus:ring-[#C5299B]/15 outline-none text-sm text-slate-900 transition"
                  placeholder="Nhập tên đăng nhập..."
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-300 focus:border-[#C5299B] focus:ring-2 focus:ring-[#C5299B]/15 outline-none text-sm text-slate-900 transition"
                  placeholder="Nhập mật khẩu..."
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-6 rounded-xl bg-[#C5299B] hover:bg-[#a82083] disabled:opacity-60 text-white font-medium text-sm shadow-lg shadow-[#C5299B]/25 transition flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              {submitting ? 'Đang xác thực...' : 'Đăng nhập vào Tủ máu'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
