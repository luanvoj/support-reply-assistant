import { NextResponse } from "next/server";
import { z } from "zod";

import {
  defaultAssistantProfile,
  getActiveAssistantProfile,
} from "@/lib/ai/profile";
import { requireRole } from "@/lib/auth/guard";
import { query, withTransaction } from "@/lib/db";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(60),
  roleDescription: z.string().trim().min(10).max(300),
  tone: z.enum(["professional", "friendly", "concise"]),
  responseLength: z.enum(["concise", "balanced", "detailed"]),
  fallbackStyle: z.enum(["supportive", "direct"]),
  customInstructions: z.string().trim().max(1500),
});

function unsafeInstruction(value: string) {
  return /(bỏ qua|ghi đè|ignore).{0,80}(nguồn|quy tắc|hướng dẫn)|tiết lộ.{0,40}(khóa|key|prompt|bí mật)/i.test(
    value,
  );
}

export async function GET() {
  await requireRole("admin");
  return NextResponse.json({ profile: await getActiveAssistantProfile() });
}

export async function PUT(request: Request) {
  const session = await requireRole("admin");
  const parsed = profileSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  if (unsafeInstruction(parsed.data.customInstructions)) {
    return NextResponse.json(
      {
        error:
          "Hướng dẫn bổ sung không được yêu cầu bỏ qua quy tắc an toàn hoặc tiết lộ thông tin bảo mật.",
      },
      { status: 400 },
    );
  }
  const profile = await withTransaction(async (client) => {
    await client.query(
      "UPDATE assistant_profiles SET is_active = false WHERE is_active = true",
    );
    const result = await client.query(
      `INSERT INTO assistant_profiles (name, role_description, tone, response_length, fallback_style, custom_instructions, is_active, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,$7)
       RETURNING name, role_description, tone, response_length, fallback_style, custom_instructions`,
      [
        parsed.data.name,
        parsed.data.roleDescription,
        parsed.data.tone,
        parsed.data.responseLength,
        parsed.data.fallbackStyle,
        parsed.data.customInstructions,
        session.userId,
      ],
    );
    return result.rows[0];
  });
  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  await requireRole("admin");
  const parsed = profileSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  return NextResponse.json({
    profile: parsed.data,
    fallbackExample: `Chào bạn! Tôi là ${parsed.data.name}. Tôi sẵn sàng hỗ trợ tra cứu thông tin đã được xác minh.`,
  });
}
