import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { env } from "@/lib/env";

function createPool() {
  const connectionUrl = new URL(env.DATABASE_URL);
  const sslMode = connectionUrl.searchParams.get("sslmode");

  if (sslMode === "require") {
    // node-postgres currently interprets sslmode=require as certificate
    // verification, unlike libpq. Supabase defines `require` as encryption
    // without CA verification; remove the URL option and provide that mode
    // explicitly so shared pooler connections work consistently.
    connectionUrl.searchParams.delete("sslmode");
    connectionUrl.searchParams.delete("uselibpqcompat");

    return new Pool({
      connectionString: connectionUrl.toString(),
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }

  return new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

declare global {
  // eslint-disable-next-line no-var
  var supportReplyAssistantPool: Pool | undefined;
}

export const db =
  global.supportReplyAssistantPool ??
  createPool();

if (process.env.NODE_ENV !== "production") {
  global.supportReplyAssistantPool = db;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return db.query<T>(text, values);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
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
