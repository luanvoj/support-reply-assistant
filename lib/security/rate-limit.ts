import { createHmac } from "node:crypto";

import { query, withTransaction } from "@/lib/db";
import { env } from "@/lib/env";

type Limit = { scope: string; key: string; maxAttempts: number; windowSeconds: number; blockSeconds: number };
type LimitRow = { blocked_until: string | null };
export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

const loginGlobal: Limit = { scope: "login:global", key: "global", maxAttempts: 100, windowSeconds: 60, blockSeconds: 60 };
const loginIp = (ip: string): Limit => ({ scope: "login:ip", key: ip, maxAttempts: 10, windowSeconds: 900, blockSeconds: 900 });
const loginIdentity = (identity: string): Limit => ({ scope: "login:identity", key: identity, maxAttempts: 5, windowSeconds: 900, blockSeconds: 900 });
const mfaIp = (ip: string): Limit => ({ scope: "mfa:ip", key: ip, maxAttempts: 10, windowSeconds: 900, blockSeconds: 900 });
const mfaChallenge = (fingerprint: string): Limit => ({ scope: "mfa:challenge", key: fingerprint, maxAttempts: 5, windowSeconds: 300, blockSeconds: 300 });

function keyHash(value: string) { return createHmac("sha256", env.AUTH_SECRET).update(value).digest("base64url"); }
function retryAfter(blockedUntil: string | null) { return blockedUntil ? Math.max(1, Math.ceil((new Date(blockedUntil).getTime() - Date.now()) / 1000)) : 0; }

async function isBlocked(limit: Limit): Promise<RateLimitResult> {
  const result = await query<LimitRow>("SELECT blocked_until FROM auth_rate_limit_buckets WHERE scope=$1 AND key_hash=$2", [limit.scope, keyHash(limit.key)]);
  const seconds = retryAfter(result.rows[0]?.blocked_until ?? null);
  return { allowed: seconds === 0, retryAfterSeconds: seconds };
}

async function record(limit: Limit): Promise<RateLimitResult> {
  return withTransaction(async (client) => {
    const result = await client.query<LimitRow>(
      `INSERT INTO auth_rate_limit_buckets(scope,key_hash,window_started_at,attempt_count,blocked_until,updated_at)
       VALUES($1,$2,now(),1,NULL,now())
       ON CONFLICT(scope,key_hash) DO UPDATE SET
         attempt_count=CASE WHEN auth_rate_limit_buckets.window_started_at < now()-make_interval(secs=>$4::int) THEN 1 ELSE auth_rate_limit_buckets.attempt_count+1 END,
         window_started_at=CASE WHEN auth_rate_limit_buckets.window_started_at < now()-make_interval(secs=>$4::int) THEN now() ELSE auth_rate_limit_buckets.window_started_at END,
         blocked_until=CASE
           WHEN auth_rate_limit_buckets.window_started_at < now()-make_interval(secs=>$4::int) THEN NULL
           WHEN auth_rate_limit_buckets.blocked_until > now() THEN auth_rate_limit_buckets.blocked_until
           WHEN auth_rate_limit_buckets.attempt_count+1 >= $3 THEN now()+make_interval(secs=>$5::int)
           ELSE NULL END,
         updated_at=now()
       RETURNING blocked_until`,
      [limit.scope, keyHash(limit.key), limit.maxAttempts, limit.windowSeconds, limit.blockSeconds],
    );
    const seconds = retryAfter(result.rows[0]?.blocked_until ?? null);
    return { allowed: seconds === 0, retryAfterSeconds: seconds };
  });
}

async function clear(limit: Limit) { await query("DELETE FROM auth_rate_limit_buckets WHERE scope=$1 AND key_hash=$2", [limit.scope, keyHash(limit.key)]); }
export function normalizedIdentity(identity: string) { return identity.trim().toLowerCase(); }
export function requestClientKey(request: Request) {
  if (process.env.TRUST_PROXY !== "true") return "unknown";
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function checkLoginRequest(request: Request, identity: string) {
  for (const limit of [loginGlobal, loginIp(requestClientKey(request)), loginIdentity(normalizedIdentity(identity))]) {
    const status = await isBlocked(limit); if (!status.allowed) return status;
  }
  return record(loginGlobal);
}
export async function recordLoginFailure(request: Request, identity: string) {
  const results = await Promise.all([record(loginIp(requestClientKey(request))), record(loginIdentity(normalizedIdentity(identity)))]);
  return results.find((result) => !result.allowed) ?? { allowed: true, retryAfterSeconds: 0 };
}
export async function clearLoginFailures(request: Request, identity: string) { await Promise.all([clear(loginIp(requestClientKey(request))), clear(loginIdentity(normalizedIdentity(identity)))]); }
export async function checkMfaRequest(request: Request, fingerprint: string) {
  for (const limit of [mfaIp(requestClientKey(request)), mfaChallenge(fingerprint)]) { const status = await isBlocked(limit); if (!status.allowed) return status; }
  return { allowed: true, retryAfterSeconds: 0 };
}
export async function recordMfaFailure(request: Request, fingerprint: string) {
  const results = await Promise.all([record(mfaIp(requestClientKey(request))), record(mfaChallenge(fingerprint))]);
  return results.find((result) => !result.allowed) ?? { allowed: true, retryAfterSeconds: 0 };
}
export async function clearMfaFailures(request: Request, fingerprint: string) { await Promise.all([clear(mfaIp(requestClientKey(request))), clear(mfaChallenge(fingerprint))]); }
