import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guard";
import { query, withTransaction } from "@/lib/db";
import { encryptSecret } from "@/lib/security/secrets";

const providerSchema = z.object({
  providerType: z.enum(["gemini", "azure_openai"]),
  displayName: z.string().min(1).max(100),
  endpoint: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  deployment: z.string().optional(),
  model: z.string().optional(),
  apiVersion: z.string().optional(),
  fallbackPriority: z.number().int().min(0).max(100).optional(),
});
const providerActivationSchema = z.object({ providerId: z.string().uuid(), isEnabled: z.boolean() });

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
    `SELECT p.id, p.provider_type, p.display_name, p.endpoint, p.deployment, p.model,
            p.api_version, p.is_enabled, p.is_default, p.fallback_priority, p.updated_at,
            COALESCE(h.state, 'closed') AS runtime_state, h.opened_until, h.last_failure_code, h.last_success_at
     FROM ai_provider_settings p
     LEFT JOIN ai_provider_runtime_health h ON h.provider_id = p.id
     ORDER BY p.is_enabled DESC, p.is_default DESC, p.updated_at DESC, p.fallback_priority NULLS LAST, p.display_name`,
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
    const existing = await client.query<{ id: string; api_key_encrypted: string; is_enabled: boolean; is_default: boolean }>(
      `SELECT id, api_key_encrypted, is_enabled, is_default FROM ai_provider_settings
       WHERE provider_type = $1
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1 FOR UPDATE`,
      [provider.providerType],
    );
    if (!existing.rows[0] && !provider.apiKey) {
      throw new Error("API_KEY_REQUIRED");
    }
    const values = [
      provider.displayName,
      provider.endpoint ?? null,
      provider.apiKey ? encryptSecret(provider.apiKey) : existing.rows[0]!.api_key_encrypted,
      provider.deployment ?? null,
      provider.model ?? null,
      provider.apiVersion ?? null,
      provider.fallbackPriority ?? null,
      session.userId,
    ];

    if (existing.rows[0]) {
      const result = await client.query(
        `UPDATE ai_provider_settings
         SET display_name = $1, endpoint = $2, api_key_encrypted = $3, deployment = $4,
             model = $5, api_version = $6, fallback_priority = $7,
             updated_by = $8, updated_at = now()
         WHERE id = $9
         RETURNING id, provider_type, display_name, endpoint, deployment, model,
                   api_version, is_enabled, is_default, fallback_priority, updated_at`,
        [...values, existing.rows[0].id],
      );
      return result.rows[0];
    }

    const result = await client.query(
      `INSERT INTO ai_provider_settings
        (provider_type, display_name, endpoint, api_key_encrypted, deployment, model,
         api_version, is_enabled, is_default, fallback_priority, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false,false,$8,$9,$9)
       RETURNING id, provider_type, display_name, endpoint, deployment, model,
                 api_version, is_enabled, is_default, fallback_priority, updated_at`,
      [provider.providerType, ...values],
    );
    return result.rows[0];
  });
  return NextResponse.json({ provider: savedProvider });
}

export async function PATCH(request: Request) {
  const session = await requireRole("admin");
  const parsed = providerActivationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const result = await withTransaction(async (client) => {
    await client.query("SELECT id FROM ai_provider_settings FOR UPDATE");
    const selected = await client.query<{ id: string; display_name: string; provider_type: string; endpoint: string | null; deployment: string | null; model: string | null }>(
      "SELECT id, display_name, provider_type, endpoint, deployment, model FROM ai_provider_settings WHERE id = $1 FOR UPDATE",
      [parsed.data.providerId],
    );
    if (!selected.rows[0]) throw new Error("PROVIDER_NOT_FOUND");
    if (parsed.data.isEnabled && (!selected.rows[0].model || (selected.rows[0].provider_type === "azure_openai" && (!selected.rows[0].endpoint || !selected.rows[0].deployment)))) {
      throw new Error("PROVIDER_NOT_READY");
    }
    if (parsed.data.isEnabled) {
      await client.query("UPDATE ai_provider_settings SET is_enabled=false, is_default=false, updated_at=now(), updated_by=$1 WHERE is_enabled=true", [session.userId]);
    }
    await client.query(
      "UPDATE ai_provider_settings SET is_enabled=$1, is_default=$1, updated_at=now(), updated_by=$2 WHERE id=$3",
      [parsed.data.isEnabled, session.userId, parsed.data.providerId],
    );
    await client.query(
      `INSERT INTO ai_provider_runtime_health (provider_id, state, consecutive_failures, opened_until, half_open_until, last_failure_code, updated_at)
       VALUES ($1, 'closed', 0, NULL, NULL, NULL, now())
       ON CONFLICT (provider_id) DO UPDATE SET state='closed', consecutive_failures=0, opened_until=NULL, half_open_until=NULL, last_failure_code=NULL, updated_at=now()`,
      [parsed.data.providerId],
    );
    return selected.rows[0];
  }).catch((error) => error instanceof Error && (error.message === "PROVIDER_NOT_FOUND" || error.message === "PROVIDER_NOT_READY") ? error.message : Promise.reject(error));
  if (result === "PROVIDER_NOT_FOUND") return NextResponse.json({ error: "Không tìm thấy Agent." }, { status: 404 });
  if (result === "PROVIDER_NOT_READY") return NextResponse.json({ error: "Cần lưu cấu hình Agent hợp lệ trước khi bật." }, { status: 409 });
  return NextResponse.json({ provider: result, isEnabled: parsed.data.isEnabled });
}
