import React, { useState } from 'react';
import { Droplet, Lock, User, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginView() {
  const { login, systemConfig } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
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
    <div className="min-h-screen bg-gradient-to-br from-[#190072] via-[#11004d] to-[#C5299B] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/10">
        {/* Left Banner */}
        <div className="md:col-span-6 bg-gradient-to-br from-[#190072] via-[#2c0985] to-[#C5299B] text-white p-8 flex flex-col justify-between relative overflow-hidden">
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
                <p className="text-xs font-normal  tracking-wider text-red-200">
                  {systemConfig.unit_name || 'BỆNH VIỆN ĐA KHOA'}
                </p>
                <h2 className="text-base font-normal  tracking-tight text-white">
                  {systemConfig.department_name || 'KHOA XÉT NGHIỆM - TỦ MÁU'}
                </h2>
              </div>
            </div>

            <h1 className="text-2xl font-normal leading-snug mb-3">
              {systemConfig.app_name || 'Hệ thống Quản lý Tủ máu Khoa Xét nghiệm'}
            </h1>
            <p className="text-sm text-red-100/90 leading-relaxed mb-6">
              Quản lý nhập kho chế phẩm máu theo lô, theo dõi hạn sử dụng & cảnh báo tự động, xuất máu nhanh theo ABO/Rh, quản lý mượn/cho mượn đối tác và báo cáo chuẩn xét nghiệm.
            </p>

            <div className="space-y-2.5 text-xs text-red-100 bg-black/20 p-4 rounded-2xl border border-white/10">
              <div className="font-normal  tracking-wider text-red-200 mb-1">
                Tài khoản dùng thử nhanh:
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>• Quản trị viên (Toàn quyền):</span>
                <button
                  type="button"
                  onClick={() => quickFill('admin', 'admin123')}
                  className="px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-white font-normal transition"
                >
                  admin / admin123
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>• KTV Xét nghiệm:</span>
                <button
                  type="button"
                  onClick={() => quickFill('ktv1', '123456')}
                  className="px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-white font-normal transition"
                >
                  ktv1 / 123456
                </button>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-8 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-red-200">
            <span>Phiên bản: v{systemConfig.app_version || '2.0.0'}</span>
            <span>PT: {systemConfig.app_developer || 'Phòng CNTT'}</span>
          </div>
        </div>

        {/* Right Form */}
        <div className="md:col-span-6 p-8 md:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-normal bg-[#fdf2fa] text-[#C5299B] border border-[#f5c6e8] mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Xác thực hệ thống Tủ máu
            </span>
            <h2 className="text-2xl font-normal text-slate-900">Đăng nhập hệ thống</h2>
            <p className="text-sm text-slate-500 mt-1">
              Sử dụng tài khoản được phân quyền để truy cập
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#fdf2fa] border border-[#f5c6e8] flex items-center gap-2.5 text-sm text-[#C5299B]">
              <AlertCircle className="w-5 h-5 shrink-0 text-[#C5299B]" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-normal  text-slate-600 mb-1.5">
                Tên đăng nhập
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:border-[#C5299B] focus:ring-2 focus:ring-red-100 outline-none text-sm font-normal"
                  placeholder="Nhập username..."
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-normal  text-slate-600 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:border-[#C5299B] focus:ring-2 focus:ring-red-100 outline-none text-sm font-normal"
                  placeholder="Nhập mật khẩu..."
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-6 rounded-xl bg-[#C5299B] hover:bg-[#a82083] disabled:opacity-60 text-white font-normal text-sm shadow-lg shadow-[#C5299B]/25 transition flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? 'Đang xác thực...' : 'Đăng nhập vào Tủ máu'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
