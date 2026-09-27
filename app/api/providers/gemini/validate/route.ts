import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guard";

const schema = z.object({ apiKey: z.string().trim().min(10).max(500) });

export async function POST(request: Request) {
  await requireRole("admin");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "API key không hợp lệ." }, { status: 400 });

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(parsed.data.apiKey)}`, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Không thể kết nối Gemini bằng API key này." }, { status: 422 });
    const body = await response.json() as { models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }> };
    const models = (body.models ?? [])
      .filter((item) => item.name && item.supportedGenerationMethods?.includes("generateContent"))
      .map((item) => ({ id: item.name!.replace(/^models\//, ""), label: item.displayName ?? item.name!.replace(/^models\//, "") }));
    if (!models.length) return NextResponse.json({ error: "API key hợp lệ nhưng không có model tạo nội dung khả dụng." }, { status: 422 });
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ error: "Không thể kiểm tra kết nối Gemini. Hãy thử lại." }, { status: 502 });
  }
}
