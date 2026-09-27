import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/guard";
import { query } from "@/lib/db";
import { createProvider, providerConfigFromRow } from "@/lib/ai/providers";

export async function POST(request: Request) {
  await requireRole("admin");
  const body = await request.json().catch(() => null) as { providerId?: string } | null;
  if (!body?.providerId) return NextResponse.json({ error: "providerId is required" }, { status: 400 });

  const result = await query("SELECT * FROM ai_provider_settings WHERE id = $1", [body.providerId]);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  const health = await createProvider(providerConfigFromRow(row)).testConnection();
  return NextResponse.json(health, { status: health.ok ? 200 : 502 });
}
