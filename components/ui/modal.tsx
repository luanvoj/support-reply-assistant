"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  eyebrow?: string;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "default" | "danger" | "success";
  children?: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  eyebrow,
  size = "md",
  tone = "default",
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && tone !== "danger") {
        onClose();
      }
    };

    // Khóa cuộn trang khi mở modal
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, tone]);

  if (!isOpen) return null;

  return (
    <div
      className="ui-modal-backdrop"
      role="presentation"
      onClick={() => {
        if (tone !== "danger") onClose();
      }}
    >
      <div
        className={`ui-modal ui-modal-${size} ui-modal-tone-${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-modal-header">
          {eyebrow && <span className="ui-modal-eyebrow">{eyebrow}</span>}
          <div className="ui-modal-title-row">
            <h2 id="ui-modal-title" className="ui-modal-title">
              {title}
            </h2>
            <button
              type="button"
              className="ui-modal-close"
              aria-label="Đóng cửa sổ"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          {description && <p className="ui-modal-description">{description}</p>}
        </div>

        {children && <div className="ui-modal-body">{children}</div>}

        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  requiredValue?: string;
  typedValue?: string;
  onTypedValueChange?: (val: string) => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy bỏ",
  tone = "default",
  requiredValue,
  typedValue = "",
  onTypedValueChange,
  isLoading = false,
}: ConfirmDialogProps) {
  const isConfirmDisabled = Boolean(
    requiredValue && typedValue.trim() !== requiredValue.trim()
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      eyebrow={tone === "danger" ? "THAO TÁC KHÔNG THỂ KHÔI PHỤC" : "XÁC NHẬN THAO TÁC"}
      size="sm"
      tone={tone}
      footer={
        <div className="ui-modal-actions">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {requiredValue && (
        <div className="ui-form-field" style={{ marginTop: "1rem" }}>
          <label className="ui-label">
            Nhập chính xác <strong>{requiredValue}</strong> để xác nhận:
          </label>
          <input
            className="ui-input"
            value={typedValue}
            onChange={(e) => onTypedValueChange?.(e.target.value)}
            placeholder={requiredValue}
            autoFocus
          />
        </div>
      )}
    </Modal>
  );
}
