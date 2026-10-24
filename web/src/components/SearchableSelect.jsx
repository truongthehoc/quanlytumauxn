import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Plus, Check } from 'lucide-react';

function removeAccents(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const SearchableSelect = forwardRef(function SearchableSelect(
  {
    options = [],
    value,
    onChange,
    onAfterSelect = null,
    placeholder = '-- Chọn --',
    required = false,
    disabled = false,
    className = '',
    onAddNew = null,
    addNewLabel = '+ Thêm mới...',
  },
  ref
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hoveredVal, setHoveredVal] = useState(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 220 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((o) => String(o.value) === String(value)),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = removeAccents(query.trim());
    if (!q) return options;
    return options.filter(
      (o) =>
        removeAccents(o.label).includes(q) ||
        (o.subLabel && removeAccents(o.subLabel).includes(q))
    );
  }, [options, query]);

  const updateCoords = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  const handleOpen = () => {
    if (disabled) return;
    updateCoords();
    setQuery('');
    setOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  useImperativeHandle(ref, () => ({
    focus: () => {
      handleOpen();
    },
  }));

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
        setQuery('');
      }
    };
    const handleScrollOrResize = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      updateCoords();
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open]);

  return (
    <div ref={triggerRef} className="relative w-full min-w-0">
      {/* Hidden required input for native form validation */}
      {required && (
        <input
          type="text"
          value={value ?? ''}
          onChange={() => {}}
          required
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only pointer-events-none absolute inset-0 opacity-0 w-full h-full"
        />
      )}

      {/* Trigger / Inline Search Input (Fixed Size, No Layout Shift) */}
      <div
        tabIndex={disabled ? -1 : 0}
        data-open={open}
        onClick={() => {
          if (!open) handleOpen();
        }}
        onFocus={() => {
          if (!open) handleOpen();
        }}
        className={`searchable-select-trigger relative w-full min-w-0 overflow-hidden flex items-center justify-between gap-1.5 cursor-pointer transition outline-none ${
          disabled
            ? 'opacity-60 cursor-not-allowed bg-slate-100'
            : className.includes('bg-')
            ? ''
            : required
            ? 'bg-yellow-50'
            : 'bg-white'
        } ${className}`}
      >
        <span
          className={`w-0 min-w-0 flex-1 truncate text-left select-none ${
            open ? 'invisible' : ''
          } ${selectedOption ? 'text-slate-900' : 'text-slate-500'}`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        {open && (
          <input
            ref={inputRef}
            type="text"
            size={1}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHoveredVal(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!filteredOptions.length) return;
                const idx = filteredOptions.findIndex(
                  (o) => String(o.value) === String(hoveredVal)
                );
                const nextIdx =
                  idx < 0 || idx >= filteredOptions.length - 1 ? 0 : idx + 1;
                setHoveredVal(filteredOptions[nextIdx].value);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!filteredOptions.length) return;
                const idx = filteredOptions.findIndex(
                  (o) => String(o.value) === String(hoveredVal)
                );
                const prevIdx =
                  idx <= 0 ? filteredOptions.length - 1 : idx - 1;
                setHoveredVal(filteredOptions[prevIdx].value);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const target =
                  filteredOptions.find(
                    (o) => String(o.value) === String(hoveredVal)
                  ) || filteredOptions[0];
                if (target) {
                  onChange?.(target.value);
                  setOpen(false);
                  setQuery('');
                  setHoveredVal(null);
                  onAfterSelect?.(target.value);
                }
              } else if (e.key === 'Tab') {
                if (e.shiftKey) {
                  setOpen(false);
                  setQuery('');
                  return;
                }
                e.preventDefault();
                const target =
                  filteredOptions.find(
                    (o) => String(o.value) === String(hoveredVal)
                  ) || filteredOptions[0];
                if (target) {
                  onChange?.(target.value);
                  setOpen(false);
                  setQuery('');
                  setHoveredVal(null);
                  onAfterSelect?.(target.value);
                } else {
                  setOpen(false);
                  setQuery('');
                  setHoveredVal(null);
                  onAfterSelect?.(null);
                }
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
                setQuery('');
              }
            }}
            placeholder={selectedOption ? selectedOption.label : placeholder}
            style={{ border: 'none', boxShadow: 'none', outline: 'none' }}
            className="searchable-select-input absolute inset-y-0 left-3 right-8 bg-transparent border-0 outline-none text-sm text-slate-900 placeholder:text-slate-400"
          />
        )}

        <ChevronDown
          onClick={(e) => {
            e.stopPropagation();
            if (open) {
              setOpen(false);
              setQuery('');
            } else {
              handleOpen();
            }
          }}
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
            open ? 'rotate-180 text-[#C5299B]' : ''
          }`}
        />
      </div>

      {/* Portal Dropdown Menu */}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: 9999,
            }}
            className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden"
          >
            <div className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-50">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-400 text-center">
                  Không tìm thấy kết quả phù hợp
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(value);
                  const isHovered = String(hoveredVal) === String(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onMouseEnter={() => setHoveredVal(opt.value)}
                      onMouseLeave={() => setHoveredVal(null)}
                      onClick={() => {
                        onChange?.(opt.value);
                        setOpen(false);
                        setQuery('');
                        setHoveredVal(null);
                        onAfterSelect?.(opt.value);
                      }}
                      className={`w-full px-3 py-2.5 text-left text-sm flex items-center justify-between gap-2 transition ${
                        isHovered
                          ? 'bg-[#C5299B] text-white'
                          : isSelected
                          ? 'bg-[#fdf2fa] text-[#C5299B]'
                          : 'text-slate-700'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && (
                        <Check
                          className={`w-4 h-4 shrink-0 ${
                            isHovered ? 'text-white' : 'text-[#C5299B]'
                          }`}
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {onAddNew && (
              <div className="border-t border-slate-200 p-1.5 bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setQuery('');
                    onAddNew();
                  }}
                  className="w-full px-3 py-2 rounded-lg text-xs text-[#C5299B] hover:bg-[#C5299B] hover:text-white flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{addNewLabel}</span>
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
});

export default SearchableSelect;
