import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { query } from "@/lib/db";
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){await requirePermission("knowledge:write");const {id}=await params;const r=await query("UPDATE knowledge_merge_batches SET status='cancelled',cancelled_at=now() WHERE id=$1 AND status IN ('queued','scanning','generating') RETURNING id,status",[id]);return r.rows[0]?NextResponse.json({batch:r.rows[0]}):NextResponse.json({error:'Đợt gộp không thể hủy ở trạng thái hiện tại.'},{status:409});}
