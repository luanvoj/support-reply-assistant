import { z } from "zod";

export const roleCodes = ["sales", "technical", "admin"] as const;
export const userStatuses = ["active", "disabled", "purged"] as const;

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Tên đăng nhập cần ít nhất 3 ký tự.")
  .max(50, "Tên đăng nhập tối đa 50 ký tự.")
  .regex(/^[a-zA-Z0-9._-]+$/, "Tên đăng nhập chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.");

export const passwordSchema = z
  .string()
  .min(8, "Mật khẩu cần ít nhất 8 ký tự.")
  .max(128, "Mật khẩu tối đa 128 ký tự.")
  .refine((value) => /[a-z]/.test(value), "Mật khẩu cần có chữ thường.")
  .refine((value) => /[A-Z]/.test(value), "Mật khẩu cần có chữ IN HOA.")
  .refine((value) => /[^a-zA-Z0-9]/.test(value), "Mật khẩu cần có ký tự đặc biệt.");

export function passwordChecklist(value: string) {
  return {
    minimumLength: value.length >= 8,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    specialCharacter: /[^a-zA-Z0-9]/.test(value),
  };
}

export function passwordStrength(value: string): "weak" | "medium" | "strong" {
  const checklist = passwordChecklist(value);
  if (!Object.values(checklist).every(Boolean)) return "weak";
  return value.length >= 12 && (/\d/.test(value) || (value.match(/[^a-zA-Z0-9]/g)?.length ?? 0) >= 2)
    ? "strong"
    : "medium";
}

export function roleLabel(role: string) {
  return role === "admin" ? "Quản trị viên" : role === "technical" ? "Chuyên gia" : "Người dùng";
}
