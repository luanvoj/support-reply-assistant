"use client";

import { type HTMLAttributes, type ReactNode } from "react";

export type BadgeVariant = "brand" | "success" | "warning" | "danger" | "info" | "neutral";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
}

export function Badge({
  variant = "neutral",
  size = "md",
  dot = false,
  pulse = false,
  children,
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`ui-badge ui-badge-${variant} ui-badge-${size} ${className}`.trim()}
      {...props}
    >
      {dot && (
        <span
          className={`ui-badge-dot ${pulse ? "ui-badge-dot-pulse" : ""}`}
          aria-hidden="true"
        />
      )}
      <span className="ui-badge-label">{children}</span>
    </span>
  );
}
