import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { scanMergeBatch } from "@/lib/knowledge/merge-batch";
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){await requirePermission('knowledge:write');const {id}=await params;try{return NextResponse.json(await scanMergeBatch(id));}catch(error){const code=error instanceof Error?error.message:'MERGE_SCAN_FAILED';return NextResponse.json({error:code==='MERGE_PROVIDER_NOT_CONFIGURED'?'Chưa có Agent đang bật để quét gộp bài.':'Không thể hoàn tất quét gộp.',code},{status:409});}}
