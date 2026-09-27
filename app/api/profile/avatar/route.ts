import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/guard";
import { query } from "@/lib/db";
import {
  AVATAR_CONTENT_TYPE,
  AVATAR_MAX_BYTES,
  normalizeAvatar,
  readUserAvatar,
  removeUserAvatar,
  saveUserAvatar,
} from "@/lib/storage/user-avatar";

export const runtime = "nodejs";

const allowedClientTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET() {
  try {
    const session = await requireRole("sales", "technical", "admin");
    const result = await query<{ avatar_key: string | null }>("SELECT avatar_key FROM users WHERE id = $1", [session.userId]);
    if (!result.rows[0]?.avatar_key) return new NextResponse(null, { status: 404 });
    const image = await readUserAvatar(session.userId);
    return new NextResponse(new Uint8Array(image), {
      headers: { "content-type": AVATAR_CONTENT_TYPE, "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole("sales", "technical", "admin");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Hãy chọn một ảnh đại diện." }, { status: 400 });
    if (!allowedClientTypes.has(file.type)) return NextResponse.json({ error: "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP." }, { status: 400 });
    if (file.size === 0 || file.size > AVATAR_MAX_BYTES) return NextResponse.json({ error: "Ảnh đại diện phải có dung lượng tối đa 5 MB." }, { status: 400 });

    const normalized = await normalizeAvatar(Buffer.from(await file.arrayBuffer()));
    const key = await saveUserAvatar(session.userId, normalized);
    await query(
      "UPDATE users SET avatar_key = $1, avatar_content_type = $2, avatar_size_bytes = $3, updated_at = now() WHERE id = $4",
      [key, AVATAR_CONTENT_TYPE, normalized.length, session.userId],
    );
    await query(
      "INSERT INTO user_lifecycle_events(user_id, actor_id, event_type, details) VALUES ($1, $1, 'updated', $2::jsonb)",
      [session.userId, JSON.stringify({ avatarUpdated: true })],
    );
    return NextResponse.json({ avatarUrl: "/api/profile/avatar" });
  } catch (error) {
    const message = error instanceof Error && ["AVATAR_SIZE_INVALID", "AVATAR_TYPE_INVALID", "AVATAR_DIMENSIONS_INVALID"].includes(error.message)
      ? "Tệp tải lên không phải ảnh hợp lệ hoặc không đáp ứng giới hạn cho phép."
      : "Không thể cập nhật ảnh đại diện.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const session = await requireRole("sales", "technical", "admin");
    await query(
      "UPDATE users SET avatar_key = NULL, avatar_content_type = NULL, avatar_size_bytes = NULL, updated_at = now() WHERE id = $1",
      [session.userId],
    );
    await removeUserAvatar(session.userId);
    await query(
      "INSERT INTO user_lifecycle_events(user_id, actor_id, event_type, details) VALUES ($1, $1, 'updated', $2::jsonb)",
      [session.userId, JSON.stringify({ avatarRemoved: true })],
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Không thể xóa ảnh đại diện." }, { status: 400 });
  }
}
