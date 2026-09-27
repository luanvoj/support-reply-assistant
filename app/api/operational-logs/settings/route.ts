import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { query } from "@/lib/db";
import { getUserLogSnapshot, writeOperationalLog } from "@/lib/operational-log";
const schema=z.object({retentionDays:z.number().int().min(7).max(3650)});
export async function GET(){try{await requireRole("admin");const r=await query<{retention_days:number}>("SELECT retention_days FROM operational_log_settings WHERE id=true");return NextResponse.json({retentionDays:r.rows[0]?.retention_days??90});}catch{return NextResponse.json({error:"Bạn không có quyền xem cấu hình log."},{status:403});}}
export async function PUT(request:Request){try{const s=await requireRole("admin");const p=schema.safeParse(await request.json().catch(()=>null));if(!p.success)return NextResponse.json({error:p.error.flatten()},{status:400});await query("UPDATE operational_log_settings SET retention_days=$1,updated_by=$2,updated_at=now() WHERE id=true",[p.data.retentionDays,s.userId]);const actorSnapshot=await getUserLogSnapshot(s.userId);await writeOperationalLog({category:"configuration",action:"operational_log_retention_updated",summary:`${actorSnapshot.username} đã cập nhật thời hạn lưu nhật ký`,actorUserId:s.userId,actorSnapshot,details:{retentionDays:p.data.retentionDays}});return NextResponse.json({ok:true});}catch{return NextResponse.json({error:"Không thể cập nhật cấu hình log."},{status:403});}}
