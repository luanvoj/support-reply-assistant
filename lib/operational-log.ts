import type { PoolClient } from "pg";

import { query } from "@/lib/db";

export type OperationalLogInput = {
  category: "account" | "authentication" | "knowledge" | "configuration";
  action: string;
  summary: string;
  actorUserId?: string | null;
  actorSnapshot?: Record<string, string>;
  targetUserId?: string | null;
  targetSnapshot?: Record<string, string>;
  details?: Record<string, unknown>;
};

type Queryable = Pick<PoolClient, "query">;

/** Stores only redacted operational metadata. Never pass passwords, keys, OTP or chat content. */
export async function writeOperationalLog(input: OperationalLogInput, client?: Queryable) {
  const executor = client ?? { query };
  await executor.query(
    `INSERT INTO operational_logs
      (category, action, summary, actor_user_id, actor_snapshot, target_user_id, target_snapshot, details)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8::jsonb)`,
    [input.category, input.action, input.summary, input.actorUserId ?? null,
      JSON.stringify(input.actorSnapshot ?? {}), input.targetUserId ?? null,
      JSON.stringify(input.targetSnapshot ?? {}), JSON.stringify(input.details ?? {})],
  );
}

export async function getUserLogSnapshot(userId: string, client?: Queryable): Promise<Record<string, string>> {
  const executor = client ?? { query };
  const result = await executor.query<{ full_name: string; username: string; email: string; role: string }>(
    `SELECT u.full_name, u.username, u.email, r.code AS role
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [userId],
  );
  const user = result.rows[0];
  return user ? { fullName: user.full_name, username: user.username, email: user.email, role: user.role } : { userId };
}
