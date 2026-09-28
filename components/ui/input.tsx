"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, rightIcon, id, className = "", ...props },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className={`ui-form-field ${error ? "ui-field-error" : ""}`}>
      {label && (
        <label htmlFor={inputId} className="ui-label">
          {label}
        </label>
      )}
      <div className="ui-input-wrapper">
        {leftIcon && <span className="ui-input-icon-left">{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={`ui-input ${leftIcon ? "ui-input-has-left" : ""} ${rightIcon ? "ui-input-has-right" : ""} ${className}`.trim()}
          {...props}
        />
        {rightIcon && <span className="ui-input-icon-right">{rightIcon}</span>}
      </div>
      {error && <span className="ui-field-msg ui-field-msg-error" role="alert">{error}</span>}
      {!error && hint && <span className="ui-field-msg ui-field-msg-hint">{hint}</span>}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, className = "", ...props },
  ref
) {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className={`ui-form-field ${error ? "ui-field-error" : ""}`}>
      {label && (
        <label htmlFor={textareaId} className="ui-label">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className={`ui-textarea ${className}`.trim()}
        {...props}
      />
      {error && <span className="ui-field-msg ui-field-msg-error" role="alert">{error}</span>}
      {!error && hint && <span className="ui-field-msg ui-field-msg-hint">{hint}</span>}
    </div>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, id, children, className = "", ...props },
  ref
) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className={`ui-form-field ${error ? "ui-field-error" : ""}`}>
      {label && (
        <label htmlFor={selectId} className="ui-label">
          {label}
        </label>
      )}
      <div className="ui-select-wrapper">
        <select
          ref={ref}
          id={selectId}
          className={`ui-select ${className}`.trim()}
          {...props}
        >
          {children}
        </select>
        <span className="ui-select-chevron" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>
      {error && <span className="ui-field-msg ui-field-msg-error" role="alert">{error}</span>}
      {!error && hint && <span className="ui-field-msg ui-field-msg-hint">{hint}</span>}
    </div>
  );
});
