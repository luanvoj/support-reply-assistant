"use client";

import { useMemo } from "react";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  src?: string | null;
  fullName?: string | null;
  alt?: string;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({
  src,
  fullName,
  alt = "Ảnh đại diện",
  size = "md",
  className = "",
}: AvatarProps) {
  const initials = useMemo(() => {
    if (!fullName) return "?";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [fullName]);

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`ui-avatar ui-avatar-img ui-avatar-${size} ${className}`.trim()}
      />
    );
  }

  return (
    <span
      className={`ui-avatar ui-avatar-initials ui-avatar-${size} ${className}`.trim()}
      aria-label={fullName ?? alt}
    >
      {initials}
    </span>
  );
}
