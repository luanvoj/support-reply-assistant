import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/guard";
import { roleLabel } from "@/lib/auth/users";
import { query } from "@/lib/db";

type Role = "sales" | "technical" | "admin";
const allowed = (role: Role) => role === "sales" ? ["sales", "technical", "admin"] : role === "technical" ? ["technical", "admin"] : ["admin"];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("admin");
    const { id } = await params;
    const target = await query<{ role: Role; status: string }>(`SELECT r.code AS role,u.status FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1`, [id]);
    const user = target.rows[0];
    if (!user || user.status !== "active") return NextResponse.json({ error: "Tài khoản này không thể xóa." }, { status: 404 });
    const candidates = await query<{ id: string; full_name: string; username: string; role: Role }>(
      `SELECT u.id,u.full_name,u.username,r.code AS role
       FROM users u JOIN roles r ON r.id=u.role_id
       WHERE u.id <> $1 AND u.status='active'
         AND r.code::text = ANY($2::text[])
       ORDER BY array_position($2::text[], r.code::text), u.full_name`,
      [id, allowed(user.role)],
    );
    return NextResponse.json({
      candidates: candidates.rows.map((candidate) => ({
        id: candidate.id,
        fullName: candidate.full_name,
        username: candidate.username,
        role: candidate.role,
        roleLabel: roleLabel(candidate.role),
        status: "active",
        mfaEnabled: false,
        purgeAfter: null,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Bạn không có quyền quản trị người dùng." : "Không thể tải danh sách kế thừa." }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500 });
  }
}
