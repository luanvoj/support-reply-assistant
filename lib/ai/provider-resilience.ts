import type { GenerateAnswerInput, GenerateAnswerOutput } from "@/lib/ai/provider";
import { ProviderRequestError } from "@/lib/ai/provider";
import { createProvider, providerConfigFromRow } from "@/lib/ai/providers";
import { query, withTransaction } from "@/lib/db";

export type ProviderAvailability =
  | "available"
  | "not_configured"
  | "cooldown"
  | "rate_limited"
  | "temporarily_unavailable"
  | "misconfigured";

type Attempt = { allowed: true } | { allowed: false; availability: ProviderAvailability; retryAfterSeconds?: number };

export async function providerAvailableForOptionalWork(row: Record<string, unknown> | undefined) {
  if (!row) return false;
  const health = await query<{ state: string; opened_until: Date | null; half_open_until: Date | null }>(
    "SELECT state, opened_until, half_open_until FROM ai_provider_runtime_health WHERE provider_id=$1",
    [String(row.id)],
  );
  const item = health.rows[0];
  const now = Date.now();
  return !item || ((item.state !== "open" || !item.opened_until || new Date(item.opened_until).getTime() <= now) && (item.state !== "half_open" || !item.half_open_until || new Date(item.half_open_until).getTime() <= now));
}

function classify(error: unknown): { availability: ProviderAvailability; retryable: boolean; retryAfterMs?: number } {
  if (error instanceof ProviderRequestError) {
    if (error.status === 429) return { availability: "rate_limited", retryable: true, retryAfterMs: error.retryAfterMs };
    if (error.status === 408 || (error.status !== undefined && error.status >= 500)) return { availability: "temporarily_unavailable", retryable: true, retryAfterMs: error.retryAfterMs };
    if (error.status === 400 || error.status === 401 || error.status === 403) return { availability: "misconfigured", retryable: false };
  }
  return { availability: "temporarily_unavailable", retryable: true };
}

function cooldownMs(availability: ProviderAvailability, retryAfterMs?: number) {
  if (availability === "misconfigured") return 15 * 60_000;
  if (availability === "rate_limited") return Math.max(5 * 60_000, retryAfterMs ?? 0);
  return 60_000;
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function claimAttempt(providerId: string): Promise<Attempt> {
  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO ai_provider_runtime_health (provider_id) VALUES ($1)
       ON CONFLICT (provider_id) DO NOTHING`,
      [providerId],
    );
    const health = await client.query<{ state: "closed" | "open" | "half_open"; opened_until: Date | null; half_open_until: Date | null }>(
      `SELECT state, opened_until, half_open_until FROM ai_provider_runtime_health
       WHERE provider_id = $1 FOR UPDATE`,
      [providerId],
    );
    const row = health.rows[0];
    const now = Date.now();
    const openedUntil = row?.opened_until ? new Date(row.opened_until).getTime() : 0;
    const halfOpenUntil = row?.half_open_until ? new Date(row.half_open_until).getTime() : 0;
    if (row?.state === "open" && openedUntil > now) {
      return { allowed: false, availability: "cooldown" as const, retryAfterSeconds: Math.ceil((openedUntil - now) / 1000) };
    }
    if (row?.state === "half_open" && halfOpenUntil > now) {
      return { allowed: false, availability: "cooldown" as const, retryAfterSeconds: Math.ceil((halfOpenUntil - now) / 1000) };
    }
    if (row?.state === "open" || row?.state === "half_open") {
      await client.query(
        `UPDATE ai_provider_runtime_health
         SET state = 'half_open', half_open_until = now() + interval '15 seconds', updated_at = now()
         WHERE provider_id = $1`,
        [providerId],
      );
    }
    return { allowed: true };
  });
}

async function recordSuccess(providerId: string) {
  await query(
    `UPDATE ai_provider_runtime_health
     SET state = 'closed', consecutive_failures = 0, opened_until = NULL, half_open_until = NULL,
         last_failure_code = NULL, last_success_at = now(), updated_at = now()
     WHERE provider_id = $1`,
    [providerId],
  );
}

async function recordFailure(providerId: string, availability: ProviderAvailability, retryAfterMs?: number) {
  const duration = cooldownMs(availability, retryAfterMs);
  await query(
    `UPDATE ai_provider_runtime_health
     SET state = 'open', consecutive_failures = consecutive_failures + 1,
         opened_until = now() + ($2::bigint * interval '1 millisecond'), half_open_until = NULL,
         last_failure_code = $3, updated_at = now()
     WHERE provider_id = $1`,
    [providerId, duration, availability],
  );
  return Math.ceil(duration / 1000);
}

export async function generateResilientAnswer(
  row: Record<string, unknown> | undefined,
  input: GenerateAnswerInput,
): Promise<{ result?: GenerateAnswerOutput; availability: ProviderAvailability; retryAfterSeconds?: number }> {
  if (!row) return { availability: "not_configured" };
  const providerId = String(row.id);
  const claim = await claimAttempt(providerId);
  if (!claim.allowed) return { availability: claim.availability, retryAfterSeconds: claim.retryAfterSeconds };

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await createProvider(providerConfigFromRow(row)).generateAnswer(input);
      await recordSuccess(providerId);
      return { result, availability: "available" };
    } catch (error) {
      lastError = error;
      const failure = classify(error);
      const delay = Math.min(failure.retryAfterMs ?? (250 + Math.round(Math.random() * 250)), 1_000);
      if (!failure.retryable || attempt === 1 || delay > 1_000) break;
      await sleep(delay);
    }
  }
  const failure = classify(lastError);
  return {
    availability: failure.availability,
    retryAfterSeconds: await recordFailure(providerId, failure.availability, failure.retryAfterMs),
  };
}
