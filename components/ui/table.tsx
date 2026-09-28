"use client";

import {
  type TableHTMLAttributes,
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
  type ReactNode,
} from "react";

export function TableWrapper({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`ui-table-wrapper ${className}`.trim()}>{children}</div>;
}

export function Table({
  children,
  className = "",
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={`ui-table ${className}`.trim()} {...props}>
      {children}
    </table>
  );
}

export function TableHeader({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`ui-table-header ${className}`.trim()} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`ui-table-body ${className}`.trim()} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  children,
  className = "",
  isSelected = false,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { isSelected?: boolean }) {
  return (
    <tr
      className={`ui-table-row ${isSelected ? "ui-row-selected" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  children,
  className = "",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`ui-table-th ${className}`.trim()} {...props}>
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className = "",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`ui-table-td ${className}`.trim()} {...props}>
      {children}
    </td>
  );
}
