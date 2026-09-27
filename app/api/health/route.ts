import { NextResponse } from "next/server";

import { query } from "@/lib/db";

export async function GET() {
  try {
    const result = await query<{ ok: boolean }>("SELECT true AS ok");
    return NextResponse.json({
      status: "ok",
      database: result.rows[0]?.ok === true ? "ok" : "error",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", database: "error", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
