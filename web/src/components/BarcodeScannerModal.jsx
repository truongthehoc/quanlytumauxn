import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  Volume2,
  VolumeX,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Barcode,
  Search,
  ArrowRight,
  Repeat,
  RefreshCw,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

// Âm thanh bip nhẹ khi quét thành công sử dụng Web Audio API (không cần file âm thanh ngoài)
function playBeepSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz nốt La (A5)
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch (e) {
    // Không cho phép nổ lỗi nếu audio context bị khóa
  }
}

// Rung phản hồi trên thiết bị di động
function triggerHaptic() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([60, 40, 60]);
    }
  } catch (e) {
    // ignore
  }
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Quét mã vạch túi máu',
  description = 'Hướng camera vào mã vạch (Code 128, Code 39, QR...) trên nhãn túi máu',
  continuous = false,
  modes = null, // e.g. [{ key: 'search', label: 'Tìm kiếm' }, { key: 'export', label: 'Xuất kho' }]
  activeMode = null,
  onModeChange = null,
}) {
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isContinuous, setIsContinuous] = useState(continuous);
  const [scannedList, setScannedList] = useState([]);
  const [lastScanned, setLastScanned] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState(null);
  const [isStarting, setIsStarting] = useState(true);
  const [scannerReady, setScannerReady] = useState(false);

  const scannerRef = useRef(null);
  const scannerContainerId = 'blood-barcode-scanner-viewport';
  const lastScannedTimeRef = useRef(0);
  const lastScannedCodeRef = useRef('');
  const fileInputRef = useRef(null);

  // Cấu hình định dạng mã vạch hỗ trợ tốt nhất cho ngành y tế/ngân hàng máu
  const formatsToSupport = [
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.DATA_MATRIX,
    Html5QrcodeSupportedFormats.CODABAR,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.ITF,
  ];

  // Khởi động Scanner
  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;
    setIsStarting(true);
    setCameraError(null);
    setScannerReady(false);
    setLastScanned(null);
    setManualCode('');

    const startScanner = async () => {
      try {
        // Kiểm tra xem trình duyệt có hỗ trợ mediaDevices không
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error(
            'Trình duyệt hoặc môi trường chưa hỗ trợ Camera trực tiếp. Hãy đảm bảo chạy qua giao thức HTTPS hoặc localhost, hoặc sử dụng tính năng tải ảnh chụp mã vạch bên dưới.'
          );
        }

        // Tạo instance
        const html5QrCode = new Html5Qrcode(scannerContainerId, {
          formatsToSupport,
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        // Lấy danh sách camera
        const devices = await Html5Qrcode.getCameras().catch(() => []);
        if (isSubscribed && devices.length > 0) {
          setCameras(devices);
        }

        // Cấu hình khung quét (qrbox tối ưu cho mã vạch 1D nằm ngang của túi máu)
        const config = {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.min(viewfinderWidth * 0.88, 360);
            const height = Math.min(viewfinderHeight * 0.5, 180);
            return {
              width: Math.max(Math.floor(width), 220),
              height: Math.max(Math.floor(height), 120),
            };
          },
          aspectRatio: 1.333333,
        };

        const handleSuccess = (decodedText) => {
          if (!isSubscribed) return;
          const cleanCode = decodedText.trim();
          if (!cleanCode) return;

          const now = Date.now();
          // Chống quét trùng lặp trong vòng 1.5 giây
          if (
            cleanCode === lastScannedCodeRef.current &&
            now - lastScannedTimeRef.current < 1500
          ) {
            return;
          }

          lastScannedTimeRef.current = now;
          lastScannedCodeRef.current = cleanCode;

          if (soundEnabled) {
            playBeepSound();
          }
          triggerHaptic();

          setLastScanned(cleanCode);
          setScannedList((prev) => [
            { code: cleanCode, time: new Date().toLocaleTimeString('vi-VN') },
            ...prev.slice(0, 19),
          ]);

          if (onScan) {
            onScan(cleanCode);
          }

          // Nếu không phải chế độ quét liên tục -> tự đóng sau 400ms
          if (!isContinuous) {
            setTimeout(() => {
              if (isSubscribed) {
                stopScanner().then(() => onClose());
              }
            }, 400);
          }
        };

        // Ưu tiên camera sau (environment)
        let cameraToUse = { facingMode: 'environment' };
        if (selectedCameraId) {
          cameraToUse = { deviceId: { exact: selectedCameraId } };
        } else if (devices.length > 0) {
          // Tìm camera sau nếu có nhãn "back", "rear", "environment"
          const backCam = devices.find(
            (c) =>
              c.label.toLowerCase().includes('back') ||
              c.label.toLowerCase().includes('rear') ||
              c.label.toLowerCase().includes('sau')
          );
          if (backCam) {
            cameraToUse = { deviceId: { exact: backCam.id } };
            setSelectedCameraId(backCam.id);
          }
        }

        await html5QrCode.start(cameraToUse, config, handleSuccess, () => {
          // Bỏ qua lỗi nhận diện khung hình không có mã
        });

        if (isSubscribed) {
          setScannerReady(true);
          setIsStarting(false);

          // Kiểm tra hỗ trợ đèn pin (Torch)
          try {
            const track = html5QrCode.getRunningTrackCameraCapabilities();
            if (track && track.torchFeature && track.torchFeature().isSupported()) {
              setHasTorch(true);
            }
          } catch (e) {
            setHasTorch(false);
          }
        }
      } catch (err) {
        console.error('Lỗi khởi động camera scanner:', err);
        if (isSubscribed) {
          setIsStarting(false);
          setCameraError(
            err.message ||
              'Không thể truy cập camera. Vui lòng cấp quyền truy cập camera trên thiết bị hoặc tải ảnh chụp mã vạch.'
          );
        }
      }
    };

    startScanner();

    return () => {
      isSubscribed = false;
      stopScanner();
    };
  }, [isOpen, selectedCameraId]);

  const stopScanner = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }
    } catch (e) {
      // ignore
    }
  };

  const handleToggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn('Không bật được đèn pin:', err);
    }
  };

  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    await stopScanner();
    setSelectedCameraId(cameras[nextIndex].id);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const clean = manualCode.trim().toUpperCase();
    if (!clean) return;

    if (soundEnabled) playBeepSound();
    triggerHaptic();

    setLastScanned(clean);
    setScannedList((prev) => [
      { code: clean, time: new Date().toLocaleTimeString('vi-VN') },
      ...prev.slice(0, 19),
    ]);

    if (onScan) {
      onScan(clean);
    }

    if (!isContinuous) {
      stopScanner().then(() => onClose());
    } else {
      setManualCode('');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !scannerRef.current) return;
    try {
      setIsStarting(true);
      const decodedResult = await scannerRef.current.scanFile(file, true);
      const clean = decodedResult.trim();
      if (clean) {
        if (soundEnabled) playBeepSound();
        triggerHaptic();
        setLastScanned(clean);
        setScannedList((prev) => [
          { code: clean, time: new Date().toLocaleTimeString('vi-VN') },
          ...prev.slice(0, 19),
        ]);
        if (onScan) onScan(clean);
        if (!isContinuous) {
          stopScanner().then(() => onClose());
        }
      }
    } catch (err) {
      alert('Không nhận diện được mã vạch trong ảnh đã chọn. Vui lòng thử ảnh rõ nét hơn hoặc nhập tay.');
    } finally {
      setIsStarting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#C5299B] to-purple-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-2">
                <span>{title}</span>
                <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-400 font-normal border border-emerald-500/30">
                  AI Scanner
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopScanner().then(() => onClose());
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs (Nếu có nhiều chế độ như Tìm kiếm, Xuất kho, Nhập kho) */}
        {modes && modes.length > 0 && (
          <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto">
            {modes.map((m) => {
              const isActive = activeMode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => onModeChange && onModeChange(m.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#C5299B] text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {m.icon && <m.icon className="w-3.5 h-3.5" />}
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Camera Viewport Container */}
        <div className="relative flex-1 bg-black min-h-[260px] sm:min-h-[320px] flex items-center justify-center overflow-hidden">
          {/* HTML5 QrCode Viewport */}
          <div
            id={scannerContainerId}
            className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
          />

          {/* Laser Guide Scanning Overlay (Khi camera đang quét) */}
          {scannerReady && !cameraError && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {/* Vùng quét mờ xung quanh */}
              <div className="relative w-[82%] max-w-[340px] h-[160px] sm:h-[180px] rounded-2xl border-2 border-[#C5299B] shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                {/* 4 góc viền phong cách công nghệ */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                {/* Laser scan line chạy lên xuống */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#C5299B] to-transparent animate-scanner-laser shadow-[0_0_12px_#C5299B]" />

                {/* Text hướng dẫn giữa khung */}
                <div className="absolute bottom-2 inset-x-0 text-center">
                  <span className="text-[11px] text-white/90 bg-black/60 px-2.5 py-0.5 rounded-full font-medium">
                    Đặt mã vạch túi máu vào khung
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Trạng thái đang khởi động Camera */}
          {isStarting && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 p-4 text-center z-10">
              <RefreshCw className="w-8 h-8 text-[#C5299B] animate-spin" />
              <p className="text-xs text-slate-300">Đang bật camera và chuẩn bị ống kính...</p>
            </div>
          )}

          {/* Lỗi truy cập Camera */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Không thể mở Camera</h4>
              <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
                {cameraError}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Upload className="w-4 h-4" />
                  <span>Tải ảnh chụp mã vạch</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Floating Camera Controls (Nút bật đèn pin, đổi camera, âm thanh) */}
          {scannerReady && !cameraError && (
            <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
              {hasTorch && (
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  className={`p-2.5 rounded-xl backdrop-blur-md border transition ${
                    torchOn
                      ? 'bg-amber-500 text-white border-amber-400 shadow-lg'
                      : 'bg-black/60 text-white/80 border-white/20 hover:bg-black/80'
                  }`}
                  title={torchOn ? 'Tắt đèn flash' : 'Bật đèn flash'}
                >
                  {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                </button>
              )}

              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  className="p-2.5 rounded-xl bg-black/60 text-white/80 border border-white/20 hover:bg-black/80 backdrop-blur-md transition"
                  title="Đổi camera trước/sau"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2.5 rounded-xl backdrop-blur-md border transition ${
                  soundEnabled
                    ? 'bg-black/60 text-emerald-400 border-white/20 hover:bg-black/80'
                    : 'bg-black/60 text-slate-400 border-white/20'
                }`}
                title={soundEnabled ? 'Đang bật âm thanh bip' : 'Tắt âm thanh'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          )}

          {/* Thông báo mã vừa quét thành công */}
          {lastScanned && (
            <div className="absolute bottom-3 inset-x-4 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="bg-emerald-500/90 text-white backdrop-blur-md px-3.5 py-2.5 rounded-2xl flex items-center justify-between shadow-xl border border-emerald-400/40">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-emerald-100 uppercase tracking-wider font-bold block">
                      Đã quét thành công
                    </span>
                    <span className="text-sm font-mono font-bold truncate block">
                      {lastScanned}
                    </span>
                  </div>
                </div>
                {!isContinuous && (
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-lg shrink-0">
                    Đang chọn...
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Quét liên tục + Tải ảnh + Nhập mã thủ công */}
        <div className="p-3.5 sm:p-4 bg-slate-900 border-t border-slate-800 space-y-3 shrink-0">
          {/* Controls Bar: Quét liên tục & Tải ảnh */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsContinuous(!isContinuous)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition ${
                isContinuous
                  ? 'bg-[#C5299B]/20 border-[#C5299B] text-pink-300 font-semibold'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Quét liên tục: {isContinuous ? 'BẬT' : 'TẮT'}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            >
              <Upload className="w-3.5 h-3.5 text-purple-400" />
              <span>Tải ảnh mã vạch</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="Hoặc nhập mã túi máu thủ công tại đây..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:border-[#C5299B] outline-none transition uppercase font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-3.5 py-2 rounded-xl bg-[#C5299B] hover:bg-[#a82083] disabled:opacity-40 disabled:hover:bg-[#C5299B] text-white text-xs font-semibold flex items-center gap-1 transition shrink-0"
            >
              <span>Xác nhận</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Lịch sử quét trong phiên nếu bật chế độ liên tục */}
          {isContinuous && scannedList.length > 0 && (
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span>Đã quét trong phiên ({scannedList.length} túi):</span>
                <button
                  type="button"
                  onClick={() => setScannedList([])}
                  className="hover:text-rose-400"
                >
                  Xóa lịch sử
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                {scannedList.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 text-pink-300 border border-slate-700 font-mono text-[11px]"
                  >
                    {item.code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
