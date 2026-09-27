import { NextResponse } from "next/server";
import { z } from "zod";

import { hashPassword } from "@/lib/auth/password";
import { requireRole } from "@/lib/auth/guard";
import { passwordSchema, roleCodes, roleLabel, usernameSchema } from "@/lib/auth/users";
import { query, withTransaction } from "@/lib/db";

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  username: usernameSchema,
  email: z.string().trim().email().max(254),
  password: passwordSchema,
  passwordConfirmation: z.string(),
  role: z.enum(roleCodes),
}).refine((value) => value.password === value.passwordConfirmation, {
  path: ["passwordConfirmation"], message: "Hai mật khẩu chưa trùng khớp.",
});

type UserRow = { id: string; full_name: string; username: string; email: string; role: "sales" | "technical" | "admin"; status: string; last_login_at: string | null; disabled_at: string | null; purge_after: string | null; created_at: string };

function asUser(row: UserRow) {
  return { id: row.id, fullName: row.full_name, username: row.username, email: row.email, role: row.role, roleLabel: roleLabel(row.role), status: row.status, lastLoginAt: row.last_login_at, disabledAt: row.disabled_at, purgeAfter: row.purge_after, createdAt: row.created_at };
}

const selectUsers = `SELECT u.id, u.full_name, u.username, u.email, r.code AS role, u.status, u.last_login_at, u.disabled_at, u.purge_after, u.created_at
  FROM users u JOIN roles r ON r.id = u.role_id`;

export async function GET(request: Request) {
  try {
    await requireRole("admin");
    const params = new URL(request.url).searchParams;
    const requestedPage = Number(params.get("page") ?? 1);
    const requestedPageSize = Number(params.get("pageSize") ?? 20);
    const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
    const pageSize = Number.isFinite(requestedPageSize) ? Math.min(100, Math.max(10, requestedPageSize)) : 20;
    const roleParam = params.get("role");
    const statusParam = params.get("status");
    const role = roleCodes.includes(roleParam as (typeof roleCodes)[number]) ? roleParam : null;
    const status = ["active", "disabled", "purged"].includes(statusParam ?? "") ? statusParam : null;
    const search = params.get("search")?.trim().slice(0, 100) || null;
    const filters = ` WHERE ($1::text IS NULL OR r.code::text = $1)
      AND ($2::text IS NULL OR u.status::text = $2)
      AND ($3::text IS NULL OR u.full_name ILIKE '%' || $3 || '%' OR u.username ILIKE '%' || $3 || '%' OR u.email ILIKE '%' || $3 || '%')`;
    const result = await query<UserRow>(`${selectUsers}${filters} ORDER BY CASE u.status WHEN 'active' THEN 0 WHEN 'disabled' THEN 1 ELSE 2 END, u.created_at DESC LIMIT $4 OFFSET $5`, [role, status, search, pageSize, (page - 1) * pageSize]);
    const total = await query<{ count: number }>(`SELECT count(*)::int AS count FROM users u JOIN roles r ON r.id = u.role_id${filters}`, [role, status, search]);
    return NextResponse.json({ users: result.rows.map(asUser), pagination: { page, pageSize, total: total.rows[0]?.count ?? 0 } });
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền quản trị người dùng." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole("admin");
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    const passwordHash = await hashPassword(input.password);
    const created = await withTransaction(async (client) => {
      const role = await client.query<{ id: string }>("SELECT id FROM roles WHERE code = $1", [input.role]);
      const roleId = role.rows[0]?.id;
      if (!roleId) throw new Error("ROLE_NOT_FOUND");
      const user = await client.query<UserRow>(
        `INSERT INTO users(full_name, username, email, password_hash, role_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, full_name, username, email, 'sales'::user_role AS role, status, last_login_at, disabled_at, purge_after, created_at`,
        [input.fullName, input.username, input.email, passwordHash, roleId],
      );
      const createdUser = user.rows[0];
      if (!createdUser) throw new Error("CREATE_FAILED");
      await client.query(
        "INSERT INTO user_lifecycle_events(user_id, actor_id, event_type, details) VALUES ($1, $2, 'created', $3::jsonb)",
        [createdUser.id, actor.userId, JSON.stringify({ role: input.role })],
      );
      return createdUser;
    });
    return NextResponse.json({ user: asUser({ ...created, role: input.role }) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "Bạn không có quyền quản trị người dùng." }, { status: 403 });
    if (String(error).includes("users_username_ci_idx") || String(error).includes("users_email_key")) return NextResponse.json({ error: "Email hoặc tên đăng nhập đã được sử dụng." }, { status: 409 });
    return NextResponse.json({ error: "Không thể tạo người dùng." }, { status: 500 });
  }
}
