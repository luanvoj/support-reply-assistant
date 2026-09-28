"use client";

import { type HTMLAttributes } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

export function Skeleton({
  width,
  height,
  circle = false,
  className = "",
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={`ui-skeleton ${circle ? "ui-skeleton-circle" : ""} ${className}`.trim()}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}
