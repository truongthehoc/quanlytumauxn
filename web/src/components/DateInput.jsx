import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Calendar } from 'lucide-react';

// Convert YYYY-MM-DD -> dd/MM/yyyy
function isoToDisplay(iso) {
  if (iso && typeof iso === 'object') {
    iso = iso.target?.value || '';
  }
  if (!iso || typeof iso !== 'string') return '';
  const clean = iso.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return iso;
  const [yyyy, mm, dd] = parts;
  return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`;
}

// Convert dd/MM/yyyy -> YYYY-MM-DD (returns null if invalid)
function displayToIso(display) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(display.trim());
  if (!match) return null;
  const dd = Number(match[1]);
  const mm = Number(match[2]);
  const yyyy = Number(match[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2100) {
    return null;
  }
  return `${String(yyyy)}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

const DateInput = forwardRef(function DateInput(
  {
    value,
    onChange,
    required = false,
    className = '',
    placeholder = 'dd/MM/yyyy',
    onKeyDown,
    tabIndex,
    min,
    max,
    ...rest
  },
  ref
) {
  const normalizedValue =
    typeof value === 'object' && value !== null
      ? (value.target?.value || '')
      : (value || '');
  const [text, setText] = useState(() => isoToDisplay(normalizedValue));
  const nativeDateRef = useRef(null);
  const textInputRef = useRef(null);

  useImperativeHandle(ref, () => textInputRef.current);

  useEffect(() => {
    setText(isoToDisplay(normalizedValue));
  }, [normalizedValue]);

  const handleTextChange = (e) => {
    let raw = e.target.value.replace(/[^\d/]/g, '');
    const digitsOnly = raw.replace(/\//g, '').slice(0, 8);
    let formatted = raw;
    // Tự động định dạng dấu / khi người dùng gõ dãy số
    if (!raw.includes('/') && digitsOnly.length >= 2) {
      if (digitsOnly.length <= 2) {
        formatted = `${digitsOnly}/`;
      } else if (digitsOnly.length <= 4) {
        formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
      } else {
        formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`;
      }
    }
    setText(formatted);

    if (formatted === '') {
      onChange?.({ target: { value: '' } });
      return;
    }

    const iso = displayToIso(formatted);
    if (iso) {
      onChange?.({ target: { value: iso } });
    }
  };

  const handleBlur = () => {
    const iso = displayToIso(text);
    if (iso) {
      setText(isoToDisplay(iso));
      onChange?.({ target: { value: iso } });
    } else if (!text && !required) {
      onChange?.({ target: { value: '' } });
    } else {
      // Revert to last valid value
      setText(isoToDisplay(normalizedValue));
    }
  };

  const openPicker = () => {
    if (!nativeDateRef.current) return;
    try {
      if (typeof nativeDateRef.current.showPicker === 'function') {
        nativeDateRef.current.showPicker();
      } else {
        nativeDateRef.current.focus();
        nativeDateRef.current.click();
      }
    } catch {
      nativeDateRef.current.focus();
    }
  };

  return (
    <div className="relative flex items-center w-full">
      <input
        ref={textInputRef}
        type="text"
        inputMode="numeric"
        value={text}
        onChange={handleTextChange}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={10}
        required={required}
        tabIndex={tabIndex}
        className={`w-full pr-9 ${className}`}
        {...rest}
      />
      {/* Vùng icon lịch: hiển thị Calendar icon đẹp mắt và phủ input date trực tiếp lên trên để tương thích 100% mọi trình duyệt */}
      <div className="absolute right-0 top-0 bottom-0 w-9 flex items-center justify-center text-slate-500 hover:text-[#C5299B] transition">
        <Calendar className="w-4 h-4 pointer-events-none" />
        <input
          ref={nativeDateRef}
          type="date"
          min={min}
          max={max}
          value={typeof normalizedValue === 'string' ? normalizedValue.slice(0, 10) : ''}
          onChange={(e) => {
            const newIso = e.target.value;
            setText(isoToDisplay(newIso));
            onChange?.({ target: { value: newIso } });
          }}
          tabIndex={-1}
          aria-label="Chọn ngày từ lịch"
          title="Bấm để chọn ngày"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
      </div>
    </div>
  );
});

export default DateInput;
