"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export interface BentoSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface BentoSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: BentoSelectOption[];
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  minWidth?: string | number;
  disabled?: boolean;
}

export function BentoSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Chọn giá trị",
  className = "",
  style,
  minWidth = "180px",
  disabled = false,
}: BentoSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Đóng khi click ra bên ngoài dropdown
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

  return (
    <div
      ref={containerRef}
      className={`bento-select-wrapper ${className}`.trim()}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: minWidth,
        ...style,
      }}
    >
      {label && <label className="bento-select-label">{label}</label>}

      {/* Trigger Button */}
      <button
        type="button"
        className={`bento-select-trigger ${isOpen ? "open" : ""}`}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
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
            <span style={{ color: "var(--text-muted)" }}>{placeholder}</span>
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

      {/* Popover Menu Xổ Xuống Chuẩn Bento System Design */}
      {isOpen && (
        <div className="bento-select-dropdown" role="listbox">
          <div className="bento-select-options-list">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`bento-select-option ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  <span className="bento-select-option-text">
                    {option.icon && (
                      <span className="bento-select-option-icon">{option.icon}</span>
                    )}
                    <span>{option.label}</span>
                  </span>

                  {/* Icon Checkmark khi được chọn */}
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
            })}
          </div>
        </div>
      )}
    </div>
  );
}
