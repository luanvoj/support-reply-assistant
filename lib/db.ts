import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { getEnv } from "@/lib/env";

function createPool() {
  const { DATABASE_URL } = getEnv();
  const connectionUrl = new URL(DATABASE_URL);
  const sslMode = connectionUrl.searchParams.get("sslmode");

  if (sslMode === "require") {
    connectionUrl.searchParams.delete("sslmode");
    connectionUrl.searchParams.delete("uselibpqcompat");
    return new Pool({ connectionString: connectionUrl.toString(), ssl: { rejectUnauthorized: false }, max: 10, idleTimeoutMillis: 30_000 });
  }
  return new Pool({ connectionString: DATABASE_URL, max: 10, idleTimeoutMillis: 30_000 });
}

declare global {
  // eslint-disable-next-line no-var
  var supportReplyAssistantPool: Pool | undefined;
}

let runtimePool: Pool | undefined;
export function getDb() {
  if (process.env.NODE_ENV !== "production" && global.supportReplyAssistantPool) return global.supportReplyAssistantPool;
  if (!runtimePool) {
    runtimePool = createPool();
    if (process.env.NODE_ENV !== "production") global.supportReplyAssistantPool = runtimePool;
  }
  return runtimePool;
}

// Keep the existing script-facing Pool API without creating a connection pool at import time.
export const db = new Proxy({} as Pool, {
  get(_target, property) {
    const pool = getDb();
    const value = Reflect.get(pool, property, pool);
    return typeof value === "function" ? value.bind(pool) : value;
  },
});

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  return getDb().query<T>(text, values);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
