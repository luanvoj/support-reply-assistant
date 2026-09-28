import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import type { PoolClient } from "pg";

import { containsUnsupportedMedia, replaceArticleChunks } from "@/lib/knowledge/article";

export const IMPORT_COLUMNS = ["title", "content_markdown", "summary", "service_group", "response_policy", "source_priority", "review_due_at"] as const;
export type ImportRow = { rowNumber: number; title: string; contentMarkdown: string; summary?: string; serviceGroup?: string; responsePolicy: "grounded" | "escalate"; sourcePriority: number; reviewDueAt?: string; errors: string[]; finalTitle?: string };

const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function templateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Kho tri thức");
  worksheet.columns = IMPORT_COLUMNS.map((header) => ({ header, key: header, width: header === "content_markdown" ? 56 : 24 }));
  worksheet.addRow({
    title: "Hướng dẫn đổi mật khẩu",
    content_markdown: "## Điều kiện\nNgười dùng đã xác minh email.\n\n## Các bước\n1. Mở trang đăng nhập.\n2. Chọn Quên mật khẩu.",
    summary: "Quy trình đổi mật khẩu",
    service_group: "Tài khoản",
    response_policy: "grounded",
    source_priority: 80,
    review_due_at: "2027-01-01",
  });
  return workbook;
}

function asText(value: unknown) { return String(value ?? "").trim(); }

export async function parseImportFile(buffer: ArrayBuffer, fileName: string): Promise<ImportRow[]> {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension !== "csv" && extension !== "xlsx") throw new Error("Chỉ hỗ trợ tệp CSV UTF-8 hoặc Excel (.xlsx).");

  const workbook = new ExcelJS.Workbook();
  try {
    const input = Buffer.from(buffer) as unknown as Buffer;
    if (extension === "xlsx") await workbook.xlsx.load(input as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    else await workbook.csv.read(Readable.from([input]));
  } catch {
    throw new Error("Không thể đọc tệp. Hãy dùng CSV UTF-8 hoặc XLSX hợp lệ.");
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Tệp chưa có trang dữ liệu.");
  if (sheet.rowCount > 201) throw new Error("Mỗi lần import tối đa 200 bài viết.");

  const headers = sheet.getRow(1).values as unknown[];
  const columnNames = new Map<number, string>();
  headers.forEach((value, index) => {
    const header = asText(value instanceof Object && "text" in value ? (value as { text?: unknown }).text : value);
    if (header) columnNames.set(index, header);
  });

  const rows: ImportRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const raw: Record<string, unknown> = {};
    let hasValue = false;
    columnNames.forEach((header, index) => {
      const cell = row.getCell(index);
      const value = cell.text || (cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.value);
      if (asText(value)) hasValue = true;
      raw[header] = value;
    });
    if (hasValue) rows.push(validateRow(raw, rowNumber));
  }
  if (rows.length > 200) throw new Error("Mỗi lần import tối đa 200 bài viết.");
  return rows;
}

export async function templateBuffer(format: "csv" | "xlsx") {
  const workbook = templateWorkbook();
  const buffer = format === "xlsx" ? await workbook.xlsx.writeBuffer() : await workbook.csv.writeBuffer();
  return new Uint8Array(buffer);
}

export const importContentType = (format: "csv" | "xlsx") => format === "xlsx" ? EXCEL_MIME : "text/csv; charset=utf-8";

function validateRow(raw: Record<string, unknown>, rowNumber: number): ImportRow {
  const title = asText(raw.title); const contentMarkdown = asText(raw.content_markdown);
  const summary = asText(raw.summary); const serviceGroup = asText(raw.service_group);
  const policy = asText(raw.response_policy || "grounded"); const priorityText = asText(raw.source_priority || "50"); const review = asText(raw.review_due_at);
  const errors: string[] = [];
  if (title.length < 3 || title.length > 120) errors.push("Tiêu đề cần từ 3 đến 120 ký tự.");
  if (contentMarkdown.length < 20 || contentMarkdown.length > 30000) errors.push("Nội dung cần từ 20 đến 30.000 ký tự.");
  if (containsUnsupportedMedia(contentMarkdown)) errors.push("Chỉ nhận văn bản; không nhận hình ảnh hoặc nhúng media.");
  if (summary.length > 300) errors.push("Tóm tắt tối đa 300 ký tự.");
  if (serviceGroup.length > 80) errors.push("Nhóm dịch vụ tối đa 80 ký tự.");
  if (!["grounded", "partial", "escalate"].includes(policy)) errors.push("response_policy chỉ là grounded hoặc escalate.");
  const sourcePriority = Number(priorityText);
  if (!Number.isInteger(sourcePriority) || sourcePriority < 0 || sourcePriority > 100) errors.push("source_priority phải là số nguyên từ 0 đến 100.");
  if (review && Number.isNaN(Date.parse(review))) errors.push("review_due_at phải là ngày hợp lệ YYYY-MM-DD.");
  return { rowNumber, title, contentMarkdown, summary: summary || undefined, serviceGroup: serviceGroup || undefined, responsePolicy: policy === "grounded" ? "grounded" : "escalate", sourcePriority: Number.isFinite(sourcePriority) ? sourcePriority : 50, reviewDueAt: review || undefined, errors };
}

function slug(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `bai-viet-${Date.now()}`; }
export async function nextTitle(client: PoolClient, proposed: string) {
  const result = await client.query<{ title: string }>("SELECT title FROM knowledge_articles WHERE lower(title) LIKE lower($1)", [`${proposed}%`]);
  const used = new Set(result.rows.map((row) => row.title.toLocaleLowerCase("vi-VN")));
  if (!used.has(proposed.toLocaleLowerCase("vi-VN"))) return proposed;
  let suffix = 1; while (used.has(`${proposed} (${suffix})`.toLocaleLowerCase("vi-VN"))) suffix += 1;
  return `${proposed} (${suffix})`;
}

export async function insertImportedArticle(client: PoolClient, row: ImportRow, actorId: string, batchId: string, fileName: string) {
  const title = await nextTitle(client, row.title); const articleSlug = `${slug(title)}-${batchId.slice(0, 8)}-${row.rowNumber}`;
  const inserted = await client.query<{ id: string }>("INSERT INTO knowledge_articles (title,slug,content_markdown,summary,status,is_verified,source_priority,service_group,response_policy,review_due_at,source_key,source_file,created_by,reviewed_by,published_at) VALUES ($1,$2,$3,$4,'published',true,$5,$6,$7,$8,$9,$10,$11,$11,now()) RETURNING id", [title, articleSlug, row.contentMarkdown, row.summary ?? null, row.sourcePriority, row.serviceGroup ?? null, row.responsePolicy, row.reviewDueAt ? new Date(row.reviewDueAt).toISOString() : null, `import:${batchId}:${row.rowNumber}`, fileName, actorId]);
  await replaceArticleChunks(client, inserted.rows[0].id, title, row.contentMarkdown);
  await client.query("INSERT INTO knowledge_article_audits (article_id,actor_id,action,version,details) VALUES($1,$2,'imported',1,$3)", [inserted.rows[0].id, actorId, JSON.stringify({ batchId, rowNumber: row.rowNumber, originalTitle: row.title })]);
  return { id: inserted.rows[0].id, title };
}
