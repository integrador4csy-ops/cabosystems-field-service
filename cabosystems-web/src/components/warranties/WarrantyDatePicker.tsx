import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { layoutViewport } from '../../lib/layoutViewport';

interface WarrantyDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  locale?: string;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
  todayKey?: string;
  className?: string;
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const WEEKDAYS_EN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

export function WarrantyDatePicker({
  value,
  onChange,
  locale = 'es',
  placeholder,
  disabled = false,
  compact = false,
  todayKey,
  className = '',
}: WarrantyDatePickerProps) {
  const isEn = locale.startsWith('en');
  const uid = useId();
  const triggerRef = useRef<HTMLDivElement>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);

  // Parse initial selected date or default to today
  const today = useMemo(() => {
    if (todayKey && /^\d{4}-\d{2}-\d{2}$/.test(todayKey)) {
      const [year, month, day] = todayKey.split('-').map(Number);
      return { year, month: month - 1, day, key: todayKey };
    }
    const d = new Date();
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      key: toDateKey(d.getFullYear(), d.getMonth(), d.getDate()),
    };
  }, [todayKey]);

  const parsedValue = useMemo(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    return { year: y, month: m - 1, day: d, key: value };
  }, [value]);

  // Current viewing month in calendar
  const [viewYear, setViewYear] = useState(() => parsedValue?.year ?? today.year);
  const [viewMonth, setViewMonth] = useState(() => parsedValue?.month ?? today.month);

  // Sync viewing month when value changes
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.year);
      setViewMonth(parsedValue.month);
    }
  }, [parsedValue]);

  // Position popover
  useLayoutEffect(() => {
    if (!open || disabled) return;

    const position = () => {
      const layout = layoutViewport();
      const anchor = triggerRef.current ? layout.rect(triggerRef.current) : null;
      const panel = panelRef.current;
      if (!anchor || !panel) return;

      const width = 290;
      const height = 330;

      // Check vertical space
      const spaceBelow = layout.height - anchor.bottom - 12;
      const spaceAbove = anchor.top - 12;
      const upwards = spaceBelow < height && spaceAbove > spaceBelow;

      const left = Math.max(10, Math.min(anchor.left, layout.width - width - 10));
      const top = upwards
        ? Math.max(10, anchor.top - height - 4)
        : anchor.bottom + 4;

      panel.style.width = `${width}px`;
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.visibility = 'visible';
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !triggerRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        dateButtonRef.current?.focus();
      }
    };

    position();
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, disabled]);

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const selectDate = (key: string) => {
    onChange(key);
    setOpen(false);
  };

  const clearDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
  };

  const chooseToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(today.key);
    setViewYear(today.year);
    setViewMonth(today.month);
    setOpen(false);
  };

  // Generate calendar days (Monday first)
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
    const daysInCurrent = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { key: string; day: number; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({ key: toDateKey(y, m, d), day: d, isCurrentMonth: false });
    }

    // Current month
    for (let d = 1; d <= daysInCurrent; d++) {
      cells.push({ key: toDateKey(viewYear, viewMonth, d), day: d, isCurrentMonth: true });
    }

    // Next month padding to reach 35 or 42 cells
    const targetTotal = cells.length > 35 ? 42 : 35;
    const remaining = targetTotal - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({ key: toDateKey(y, m, d), day: d, isCurrentMonth: false });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const monthLabel = isEn ? MONTH_NAMES_EN[viewMonth] : MONTH_NAMES_ES[viewMonth];
  const weekdays = isEn ? WEEKDAYS_EN : WEEKDAYS_ES;

  const displayFormatted = useMemo(() => {
    if (!parsedValue) return '';
    const dateObj = new Date(parsedValue.year, parsedValue.month, parsedValue.day);
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(dateObj);
  }, [parsedValue, locale]);

  const isTodaySelected = parsedValue?.key === today.key;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={triggerRef}
        className={`flex ${compact ? 'h-8 gap-0.5 pl-2 pr-0.5 text-[11.5px]' : 'h-11 gap-1 pl-3 pr-1.5 text-sm'} w-full items-center rounded-lg border bg-white transition-colors ${
          open
            ? 'border-brand-500 ring-2 ring-brand-500/15'
            : 'border-slate-200 hover:border-slate-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15'
        } ${disabled ? 'cursor-not-allowed opacity-50 bg-slate-50' : ''}`}
      >
        <button
          ref={dateButtonRef}
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? uid : undefined}
          className={`flex h-full min-w-0 flex-1 items-center text-left outline-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={`min-w-0 flex-1 truncate whitespace-nowrap ${displayFormatted ? 'font-medium text-slate-800' : 'text-slate-400'}`}>
            {displayFormatted || placeholder || (isEn ? 'dd/mm/yyyy' : 'dd/mm/aaaa')}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5 text-slate-400">
          <button
            type="button"
            disabled={disabled}
            aria-pressed={isTodaySelected}
            onClick={chooseToday}
            className={`${compact ? 'h-6 px-1 text-[10.5px]' : 'h-7 px-2.5 text-xs'} shrink-0 rounded-md bg-white text-slate-900 transition-colors hover:bg-slate-100 ${
              isTodaySelected ? 'font-bold' : 'font-semibold'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {isEn ? 'Today' : 'Hoy'}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen(!open)}
            aria-label={isEn ? 'Open calendar' : 'Abrir calendario'}
            className={`flex ${compact ? 'h-6 w-5' : 'h-8 w-8'} items-center justify-center rounded-md transition-colors hover:bg-slate-100 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <CalendarDays size={compact ? 12 : 16} className={open ? 'text-brand-500' : 'text-slate-400'} />
          </button>
          {displayFormatted && !disabled && (
            <button
              type="button"
              onClick={clearDate}
              aria-label={isEn ? 'Clear date' : 'Borrar fecha'}
              title={isEn ? 'Clear date' : 'Borrar fecha'}
              className={`flex ${compact ? 'h-5 w-4' : 'h-6 w-6'} items-center justify-center rounded-md hover:bg-slate-100 hover:text-slate-600`}
            >
              <X size={compact ? 10 : 13} />
            </button>
          )}
        </div>
      </div>

      {open &&
        !disabled &&
        createPortal(
          <div
            ref={panelRef}
            id={uid}
            role="dialog"
            aria-modal="true"
            aria-label={isEn ? 'Choose date' : 'Seleccionar fecha'}
            className="fixed z-[1300] rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xl transition-all"
            style={{ visibility: 'hidden' }}
          >
            {/* Header: Month, Year, Arrows */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-900 capitalize tracking-tight">
                {monthLabel} {viewYear}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  aria-label={isEn ? 'Previous month' : 'Mes anterior'}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  aria-label={isEn ? 'Next month' : 'Mes siguiente'}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-1 pt-2.5 pb-1 text-center">
              {weekdays.map((day) => (
                <span key={day} className="text-[11px] font-semibold text-slate-400">
                  {day}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {calendarCells.map((cell) => {
                const isSelected = parsedValue?.key === cell.key;
                const isToday = today.key === cell.key;

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => selectDate(cell.key)}
                    className={`h-8 w-8 mx-auto flex items-center justify-center rounded-lg text-xs transition-colors ${
                      isSelected
                        ? 'bg-brand-500 font-bold text-white shadow-xs'
                        : isToday
                        ? 'font-bold text-brand-600 bg-orange-50 border border-brand-300'
                        : cell.isCurrentMonth
                        ? 'text-slate-700 hover:bg-orange-50/70 hover:text-orange-950'
                        : 'text-slate-300 hover:bg-slate-50 hover:text-slate-500'
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* Footer actions */}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
              <button
                type="button"
                onClick={chooseToday}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
              >
                {isEn ? 'Today' : 'Hoy'}
              </button>
              {displayFormatted && (
                <button
                  type="button"
                  onClick={clearDate}
                  className="text-xs font-medium text-slate-400 hover:text-slate-600 hover:underline"
                >
                  {isEn ? 'Clear' : 'Borrar'}
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
