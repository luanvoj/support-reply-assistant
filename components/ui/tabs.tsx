"use client";

import { type ReactNode } from "react";

export interface TabItem {
  key: string;
  label: string;
  count?: number | string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  variant?: "segmented" | "underline" | "pills";
  size?: "sm" | "md";
  className?: string;
}

export function Tabs({
  items,
  activeKey,
  onChange,
  variant = "segmented",
  size = "md",
  className = "",
}: TabsProps) {
  return (
    <div
      role="tablist"
      className={`ui-tabs ui-tabs-${variant} ui-tabs-${size} ${className}`.trim()}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            disabled={item.disabled}
            className={`ui-tab-item ${isActive ? "ui-tab-active" : ""}`}
            onClick={() => !item.disabled && onChange(item.key)}
          >
            {item.icon && <span className="ui-tab-icon">{item.icon}</span>}
            <span className="ui-tab-label">{item.label}</span>
            {item.count !== undefined && item.count !== null && (
              <span className={`ui-tab-badge ${isActive ? "ui-tab-badge-active" : ""}`}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
