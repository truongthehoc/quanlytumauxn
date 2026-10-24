import React from 'react';

/**
 * ToggleSwitch component - Dạng nút gạt bật/tắt (ON/OFF)
 * @param {boolean|number} checked - Trạng thái bật/tắt (1/0 hoặc true/false)
 * @param {function} onChange - Callback khi người dùng gạt nút (nhận true/false hoặc 1/0)
 * @param {string} label - Tiêu đề nhãn phía trên (ví dụ: "Trạng thái")
 * @param {string} onText - Nhãn mô tả khi bật (mặc định: "Đang sử dụng")
 * @param {string} offText - Nhãn mô tả khi tắt (mặc định: "Ngưng sử dụng")
 * @param {boolean} disabled - Vô hiệu hóa
 */
export default function ToggleSwitch({
  checked = 1,
  onChange,
  label,
  onText = 'Đang sử dụng',
  offText = 'Ngưng sử dụng',
  disabled = false,
  className = '',
}) {
  const isChecked = Boolean(Number(checked));

  const handleToggle = () => {
    if (disabled) return;
    if (onChange) {
      // Return 1 or 0 for compatibility with database is_active fields
      onChange(isChecked ? 0 : 1);
    }
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="block text-xs font-normal text-slate-600 mb-1">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2.5 h-[38px]">
        <button
          type="button"
          role="switch"
          aria-checked={isChecked}
          disabled={disabled}
          onClick={handleToggle}
          className={`relative inline-flex items-center h-7 w-14 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#C5299B] select-none ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          } ${isChecked ? 'bg-emerald-500' : 'bg-slate-300'}`}
        >
          {/* Inner ON/OFF text */}
          <span
            className={`absolute text-[10px] font-extrabold tracking-wider pointer-events-none transition-all duration-200 ${
              isChecked
                ? 'left-2 text-white opacity-100'
                : 'right-2 text-slate-600 opacity-100'
            }`}
          >
            {isChecked ? 'ON' : 'OFF'}
          </span>

          {/* Sliding Knob */}
          <span
            className={`inline-block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
              isChecked ? 'translate-x-[32px]' : 'translate-x-[4px]'
            }`}
          />
        </button>

        {/* Status text badge */}
        <span
          onClick={handleToggle}
          className={`text-xs font-semibold cursor-pointer select-none px-2.5 py-1 rounded-lg transition-colors ${
            isChecked
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
              : 'text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200'
          }`}
        >
          {isChecked ? onText : offText}
        </span>
      </div>
    </div>
  );
}
