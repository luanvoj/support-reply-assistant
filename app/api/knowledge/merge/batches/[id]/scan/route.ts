import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { withAuthorizationErrors, isAuthorizationError } from "@/lib/auth/guard";
import { query } from "@/lib/db";

/** @deprecated Merge work is claimed by the durable worker, never by a browser request. */
export const POST = withAuthorizationErrors(async function POST(_:Request,{params}:{params:Promise<{id:string}>}) {
  await requirePermission("knowledge:write");
  const { id } = await params;
  const batch = await query<{ id: string; status: string }>("SELECT id,status FROM knowledge_merge_batches WHERE id=$1", [id]);
  if (!batch.rows[0]) return NextResponse.json({ error: "Không tìm thấy đợt gộp." }, { status: 404 });
  return NextResponse.json({ batch: batch.rows[0], code: "MERGE_WORKER_REQUIRED" }, { status: 202 });
});
