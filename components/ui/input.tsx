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

import { BentoSelect, type BentoSelectProps } from "./bento-select";
import { BentoDatePicker, type BentoDatePickerProps } from "./bento-date-picker";

export type SelectProps = BentoSelectProps;
export const Select = BentoSelect;

export type DatePickerProps = BentoDatePickerProps;
export const DatePicker = BentoDatePicker;

