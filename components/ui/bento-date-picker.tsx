"use client";

import React, {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

export interface BentoDatePickerProps {
  label?: string;
  name?: string;
  value?: string; // Định dạng YYYY-MM-DD
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  minWidth?: string | number;
  disabled?: boolean;
  error?: string;
  hint?: string;
  id?: string;
  required?: boolean;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
}

function parseDateString(val?: string): Date | null {
  if (!val) return null;
  const parts = val.split("-");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day);
}

function formatDateToISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplayVN(val?: string): string {
  if (!val) return "";
  const parts = val.split("-");
  if (parts.length !== 3) return val;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

const MONTH_NAMES_VN = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

const WEEKDAY_NAMES_VN = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function BentoDatePicker({
  label,
  name,
  value = "",
  onChange,
  placeholder = "Chọn ngày (DD/MM/YYYY)…",
  className = "",
  style,
  minWidth,
  disabled = false,
  error,
  hint,
  id,
  required,
  min,
  max,
}: BentoDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = parseDateString(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Tháng và năm đang xem trong popup lịch
  const [viewYear, setViewYear] = useState<number>(() => {
    return selectedDate ? selectedDate.getFullYear() : today.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    return selectedDate ? selectedDate.getMonth() : today.getMonth();
  });

  // Đồng bộ view khi value bên ngoài thay đổi
  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [value]);

  // Tự động tính toán hướng mở (dropup / dropdown) tránh bị che khuất ở mép dưới màn hình/container
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Popup lịch cần khoảng 310px chiều cao
      if (spaceBelow < 320 && spaceAbove > spaceBelow) {
        setPlacement("top");
      } else {
        setPlacement("bottom");
      }
    }
  }, [isOpen]);

  // Đóng khi click ngoài hoặc nhấn Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (dayDate: Date) => {
    const iso = formatDateToISO(dayDate);
    if (onChange) {
      onChange(iso);
    }
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (onChange) {
      onChange("");
    }
  };

  const handleSelectToday = () => {
    const iso = formatDateToISO(today);
    if (onChange) {
      onChange(iso);
    }
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  // Tính toán lưới ngày trong tháng hiện tại (bao gồm các ngày đệm của tuần trước/tuần sau)
  const calendarDays = React.useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);

    // Thứ 2 là ngày bắt đầu tuần (0: T2, 1: T3, ..., 6: CN)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
      isDisabled: boolean;
    }> = [];

    // Các ngày đệm của tháng trước
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth, -i);
      const iso = formatDateToISO(d);
      const isDisabled = Boolean((min && iso < min) || (max && iso > max));
      days.push({
        date: d,
        isCurrentMonth: false,
        isSelected: Boolean(selectedDate && formatDateToISO(selectedDate) === iso),
        isToday: formatDateToISO(today) === iso,
        isDisabled,
      });
    }

    // Các ngày trong tháng này
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const d = new Date(viewYear, viewMonth, day);
      const iso = formatDateToISO(d);
      const isDisabled = Boolean((min && iso < min) || (max && iso > max));
      days.push({
        date: d,
        isCurrentMonth: true,
        isSelected: Boolean(selectedDate && formatDateToISO(selectedDate) === iso),
        isToday: formatDateToISO(today) === iso,
        isDisabled,
      });
    }

    // Các ngày đệm của tháng sau để đủ 42 ô (6 tuần) hoặc 35 ô
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remainingDays = totalSlots - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(viewYear, viewMonth + 1, i);
      const iso = formatDateToISO(d);
      const isDisabled = Boolean((min && iso < min) || (max && iso > max));
      days.push({
        date: d,
        isCurrentMonth: false,
        isSelected: Boolean(selectedDate && formatDateToISO(selectedDate) === iso),
        isToday: formatDateToISO(today) === iso,
        isDisabled,
      });
    }

    return days;
  }, [viewYear, viewMonth, selectedDate, today, min, max]);

  const datePickerId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div
      ref={containerRef}
      id={datePickerId}
      className={`bento-datepicker-wrapper ${isOpen ? "is-open" : ""} ${error ? "has-error" : ""} ${className}`.trim()}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: minWidth,
        zIndex: isOpen ? 100 : undefined,
        ...style,
      }}
    >
      {label && (
        <label className="bento-datepicker-label">
          {label}
          {required && <span style={{ color: "var(--danger-solid, #ef4444)", marginLeft: "3px" }}>*</span>}
        </label>
      )}

      {/* Trigger Button Bento */}
      <button
        type="button"
        className={`bento-datepicker-trigger ${isOpen ? "open" : ""} ${error ? "error" : ""}`}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="bento-datepicker-trigger-content">
          {/* Icon Lịch Bento */}
          <span className="bento-datepicker-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="3" ry="3" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </span>

          <span className="bento-datepicker-value">
            {value ? (
              <span style={{ fontWeight: 600, letterSpacing: "0.02em" }}>{formatDateDisplayVN(value)}</span>
            ) : (
              <span style={{ color: "var(--text-muted, #94a3b8)", fontWeight: 400 }}>{placeholder}</span>
            )}
          </span>
        </span>

        {/* Nút Xóa nhanh hoặc mũi tên */}
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              title="Xóa ngày"
              className="bento-datepicker-clear-btn"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClear();
                }
              }}
            >
              ✕
            </span>
          )}

          <span className={`bento-datepicker-chevron ${isOpen ? "open" : ""}`} aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </span>
      </button>

      {/* Popover Lịch Bento (Frosted Glass + Bo góc tròn + Phân tầng bóng đổ) */}
      {isOpen && (
        <div className={`bento-datepicker-popover placement-${placement}`} role="dialog" aria-label="Lịch chọn ngày">
          {/* Header điều hướng Tháng / Năm */}
          <div className="bento-datepicker-header">
            <button
              type="button"
              className="bento-datepicker-nav-btn"
              onClick={handlePrevMonth}
              title="Tháng trước"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="bento-datepicker-month-title">
              <strong>{MONTH_NAMES_VN[viewMonth]}</strong>
              <span>, {viewYear}</span>
            </div>

            <button
              type="button"
              className="bento-datepicker-nav-btn"
              onClick={handleNextMonth}
              title="Tháng sau"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Hàng Tiêu Đề Các Thứ Trong Tuần (T2 -> CN) */}
          <div className="bento-datepicker-weekdays">
            {WEEKDAY_NAMES_VN.map((dayName) => (
              <span key={dayName} className="bento-datepicker-weekday">
                {dayName}
              </span>
            ))}
          </div>

          {/* Lưới Ngày trong tháng */}
          <div className="bento-datepicker-grid">
            {calendarDays.map((item, idx) => {
              const dayNumber = item.date.getDate();
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={item.isDisabled}
                  className={`bento-datepicker-day ${
                    item.isSelected ? "selected" : ""
                  } ${item.isToday ? "today" : ""} ${
                    !item.isCurrentMonth ? "other-month" : ""
                  }`.trim()}
                  onClick={() => handleSelectDay(item.date)}
                >
                  <span className="bento-datepicker-day-number">{dayNumber}</span>
                  {item.isToday && !item.isSelected && <span className="bento-datepicker-today-dot" />}
                </button>
              );
            })}
          </div>

          {/* Footer Lịch Bento */}
          <div className="bento-datepicker-footer">
            <button
              type="button"
              className="bento-datepicker-footer-action secondary"
              onClick={() => handleClear()}
            >
              Xóa ngày
            </button>

            <button
              type="button"
              className="bento-datepicker-footer-action primary"
              onClick={handleSelectToday}
            >
              Hôm nay
            </button>
          </div>
        </div>
      )}

      {error && <span className="ui-field-msg ui-field-msg-error" role="alert">{error}</span>}
      {!error && hint && <span className="ui-field-msg ui-field-msg-hint">{hint}</span>}
    </div>
  );
}
