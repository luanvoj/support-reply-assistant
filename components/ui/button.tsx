"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    isLoading = false,
    leftIcon,
    rightIcon,
    children,
    className = "",
    disabled,
    ...props
  },
  ref
) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={`ui-btn ui-btn-${variant} ui-btn-${size} ${isLoading ? "ui-btn-loading" : ""} ${className}`.trim()}
      {...props}
    >
      {isLoading && (
        <span className="ui-btn-spinner" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle
              className="ui-spinner-track"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="ui-spinner-head"
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )}
      {!isLoading && leftIcon && <span className="ui-btn-icon-left">{leftIcon}</span>}
      <span className="ui-btn-text">{children}</span>
      {!isLoading && rightIcon && <span className="ui-btn-icon-right">{rightIcon}</span>}
    </button>
  );
});
