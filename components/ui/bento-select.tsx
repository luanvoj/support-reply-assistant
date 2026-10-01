"use client";

import React, {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export interface BentoSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface BentoSelectProps {
  label?: string;
  name?: string;
  value?: string | number;
  onChange?: (value: string) => void;
  options?: BentoSelectOption[];
  children?: ReactNode;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  minWidth?: string | number;
  disabled?: boolean;
  error?: string;
  hint?: string;
  id?: string;
  required?: boolean;
}

export function BentoSelect({
  label,
  name,
  value = "",
  onChange,
  options,
  children,
  placeholder = "Chọn giá trị…",
  className = "",
  style,
  minWidth,
  disabled = false,
  error,
  hint,
  id,
  required,
}: BentoSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const stringValue = String(value ?? "");

  // Tự động tính toán hướng mở (dropup / dropdown) tránh bị che khuất ở mép dưới viewport/container
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
        setPlacement("top");
      } else {
        setPlacement("bottom");
      }
    }
  }, [isOpen]);

  // Tự động giải quyết options từ props `options` hoặc từ thẻ `<option>` trong `children`
  const resolvedOptions: BentoSelectOption[] = React.useMemo(() => {
    if (options && options.length > 0) return options;
    if (!children) return [];

    return Children.toArray(children)
      .filter((child): child is React.ReactElement<{ value?: string | number; children?: ReactNode }> => {
        if (!isValidElement(child)) return false;
        const props = child.props as Record<string, unknown> | null;
        return Boolean(child.type === "option" || (props && typeof props === "object" && "value" in props));
      })
      .map((child) => {
        const val = String(child.props.value ?? "");
        const labelText = typeof child.props.children === "string"
          ? child.props.children
          : String(child.props.children ?? child.props.value ?? "");
        return {
          value: val,
          label: labelText,
        };
      });
  }, [options, children]);

  const selectedOption = resolvedOptions.find((opt) => opt.value === stringValue);

  // Đóng khi click ra bên ngoài hoặc nhấn phím Escape
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

  // Cuộn đến item đang chọn khi mở dropdown
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.querySelector(".bento-select-option.selected") as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen]);

  const handleSelect = (nextValue: string) => {
    if (!onChange) return;
    try {
      onChange(nextValue);
    } catch {
      // Hỗ trợ trường hợp caller mong đợi e.target.value
      (onChange as unknown as (e: { target: { value: string; name?: string } }) => void)({
        target: { value: nextValue, name: name || id },
      });
    }
    setIsOpen(false);
  };

  // Điều hướng bằng bàn phím
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      if (!isOpen) {
        e.preventDefault();
        setIsOpen(true);
      }
    }
  };

  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div
      ref={containerRef}
      id={selectId}
      className={`bento-select-wrapper ${isOpen ? "is-open" : ""} ${error ? "has-error" : ""} ${className}`.trim()}
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
        <label className="bento-select-label">
          {label}
          {required && <span style={{ color: "var(--danger-solid, #ef4444)", marginLeft: "3px" }}>*</span>}
        </label>
      )}

      {/* Trigger Button - Bo góc chuẩn Bento, hiệu ứng focus mượt mà */}
      <button
        type="button"
        className={`bento-select-trigger ${isOpen ? "open" : ""} ${error ? "error" : ""}`}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="bento-select-value">
          {selectedOption ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              {selectedOption.icon}
              <span>{selectedOption.label}</span>
            </span>
          ) : (
            <span style={{ color: "var(--text-muted, #94a3b8)", fontWeight: 400 }}>{placeholder}</span>
          )}
        </span>

        {/* Mũi tên Chevron mượt mà */}
        <span className={`bento-select-chevron ${isOpen ? "open" : ""}`} aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {/* Popover Menu Xổ Xuống Chuẩn Bento System Design (Frosted Glass + Bo góc tròn) */}
      {isOpen && (
        <div className={`bento-select-dropdown placement-${placement}`} role="listbox">
          <div ref={listRef} className="bento-select-options-list">
            {resolvedOptions.length === 0 ? (
              <div style={{ padding: "8px 12px", fontSize: "13px", color: "var(--text-muted, #94a3b8)", textAlign: "center" }}>
                Không có lựa chọn nào
              </div>
            ) : (
              resolvedOptions.map((option) => {
                const isSelected = option.value === stringValue;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`bento-select-option ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelect(option.value)}
                  >
                    <span className="bento-select-option-text">
                      {option.icon && (
                        <span className="bento-select-option-icon">{option.icon}</span>
                      )}
                      <span>{option.label}</span>
                    </span>

                    {/* Icon Checkmark tinh tế khi được chọn */}
                    {isSelected && (
                      <span className="bento-select-checkmark" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && <span className="ui-field-msg ui-field-msg-error" role="alert">{error}</span>}
      {!error && hint && <span className="ui-field-msg ui-field-msg-hint">{hint}</span>}
    </div>
  );
}
