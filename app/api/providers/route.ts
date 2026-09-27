import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guard";
import { query, withTransaction } from "@/lib/db";
import { encryptSecret } from "@/lib/security/secrets";

const providerSchema = z.object({
  providerType: z.enum(["gemini", "azure_openai"]),
  displayName: z.string().min(1).max(100),
  endpoint: z.string().url().optional(),
  apiKey: z.string().min(1),
  deployment: z.string().optional(),
  model: z.string().optional(),
  apiVersion: z.string().optional(),
  isEnabled: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  fallbackPriority: z.number().int().min(0).max(100).optional(),
});

function isUnsafeEndpoint(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return true;
    return (
      host === "localhost" ||
      host === "::1" ||
      host === "0.0.0.0" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
  } catch {
    return true;
  }
}

export async function GET() {
  await requireRole("admin");
  const result = await query(
    `SELECT id, provider_type, display_name, endpoint, deployment, model,
            api_version, is_enabled, is_default, fallback_priority, updated_at
     FROM ai_provider_settings ORDER BY is_enabled DESC, is_default DESC, updated_at DESC, fallback_priority NULLS LAST, display_name`,
  );
  return NextResponse.json({ providers: result.rows });
}

export async function POST(request: Request) {
  const session = await requireRole("admin");
  const parsed = providerSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  const provider = parsed.data;
  if (isUnsafeEndpoint(provider.endpoint))
    return NextResponse.json(
      {
        error:
          "Provider endpoint must use HTTPS and cannot target a private/local address",
      },
      { status: 400 },
    );
  const savedProvider = await withTransaction(async (client) => {
    // Chỉ một Agent được bật tại một thời điểm; tránh để các lần lưu tạo nhiều provider hoạt động.
    await client.query(
      `UPDATE ai_provider_settings
       SET is_enabled = false, is_default = false, updated_at = now(), updated_by = $1
       WHERE provider_type <> $2 AND is_enabled = true`,
      [session.userId, provider.providerType],
    );

    const existing = await client.query<{ id: string }>(
      `SELECT id FROM ai_provider_settings
       WHERE provider_type = $1
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1 FOR UPDATE`,
      [provider.providerType],
    );
    const values = [
      provider.displayName,
      provider.endpoint ?? null,
      encryptSecret(provider.apiKey),
      provider.deployment ?? null,
      provider.model ?? null,
      provider.apiVersion ?? null,
      provider.isEnabled,
      provider.isDefault,
      provider.fallbackPriority ?? null,
      session.userId,
    ];

    if (existing.rows[0]) {
      const result = await client.query(
        `UPDATE ai_provider_settings
         SET display_name = $1, endpoint = $2, api_key_encrypted = $3, deployment = $4,
             model = $5, api_version = $6, is_enabled = $7, is_default = $8,
             fallback_priority = $9, updated_by = $10, updated_at = now()
         WHERE id = $11
         RETURNING id, provider_type, display_name, endpoint, deployment, model,
                   api_version, is_enabled, is_default, fallback_priority, updated_at`,
        [...values, existing.rows[0].id],
      );
      await client.query(
        `UPDATE ai_provider_settings
         SET is_enabled = false, is_default = false, updated_at = now(), updated_by = $1
         WHERE provider_type = $2 AND id <> $3 AND (is_enabled = true OR is_default = true)`,
        [session.userId, provider.providerType, existing.rows[0].id],
      );
      return result.rows[0];
    }

    const result = await client.query(
      `INSERT INTO ai_provider_settings
        (provider_type, display_name, endpoint, api_key_encrypted, deployment, model,
         api_version, is_enabled, is_default, fallback_priority, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
       RETURNING id, provider_type, display_name, endpoint, deployment, model,
                 api_version, is_enabled, is_default, fallback_priority, updated_at`,
      [provider.providerType, ...values],
    );
    return result.rows[0];
  });
  return NextResponse.json({ provider: savedProvider });
}
