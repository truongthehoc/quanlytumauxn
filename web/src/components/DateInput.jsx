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
    ...rest
  },
  ref
) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const nativeDateRef = useRef(null);
  const textInputRef = useRef(null);

  useImperativeHandle(ref, () => textInputRef.current);

  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  const handleTextChange = (e) => {
    let raw = e.target.value.replace(/[^\d/]/g, '');
    // Auto-insert slashes when typing digits
    const digitsOnly = raw.replace(/\//g, '');
    if (
      raw.length > text.length &&
      !raw.includes('/') &&
      digitsOnly.length >= 2
    ) {
      if (digitsOnly.length <= 2) {
        raw = `${digitsOnly}/`;
      } else if (digitsOnly.length <= 4) {
        raw = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
      } else {
        raw = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4, 8)}`;
      }
    }
    setText(raw);

    if (raw === '') {
      onChange?.({ target: { value: '' } });
      return;
    }

    const iso = displayToIso(raw);
    if (iso) {
      onChange?.({ target: { value: iso } });
    }
  };

  const handleBlur = () => {
    const iso = displayToIso(text);
    if (iso) {
      setText(isoToDisplay(iso));
    } else if (!text && !required) {
      onChange?.({ target: { value: '' } });
    } else {
      // Revert to last valid value
      setText(isoToDisplay(value));
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
        className={`w-full pr-8 ${className}`}
        {...rest}
      />
      <button
        type="button"
        onClick={openPicker}
        tabIndex={-1}
        className="absolute right-2.5 text-slate-500 hover:text-[#C5299B] transition"
        title="Chọn ngày"
      >
        <Calendar className="w-4 h-4" />
      </button>
      <input
        ref={nativeDateRef}
        type="date"
        value={value ? String(value).slice(0, 10) : ''}
        onChange={(e) => {
          const newIso = e.target.value;
          setText(isoToDisplay(newIso));
          onChange?.({ target: { value: newIso } });
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only pointer-events-none absolute right-0 bottom-0 w-0 h-0 opacity-0"
      />
    </div>
  );
});

export default DateInput;
