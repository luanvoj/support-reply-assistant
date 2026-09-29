import ExcelJS from "exceljs";

export type OperationalLogExportRow = {
  summary: string;
  created_at: string;
  actor_email: string;
  category?: "account" | "authentication" | "knowledge" | "configuration";
  action?: string;
  details?: Record<string, unknown> | null;
  target_snapshot?: Record<string, unknown> | null;
};

export type OperationalLogExportFormat = "csv" | "xlsx";

export const operationalLogExportContentType = (format: OperationalLogExportFormat) =>
  format === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv; charset=utf-8";

function vietnamDateTime(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("day")}/${part("month")}/${part("year")}`, time: `${part("hour")}:${part("minute")}:${part("second")}` };
}

const categoryLabels: Record<string, string> = {
  account: "Quản trị tài khoản",
  authentication: "Đăng nhập & Xác thực",
  knowledge: "Kho tri thức",
  configuration: "Cấu hình hệ thống",
};

/**
 * Phân tích và diễn giải chi tiết đối tượng bị tác động từ trường details hoặc target_snapshot
 */
function resolveLogContext(row: OperationalLogExportRow): { actionDescription: string; targetDetail: string } {
  const details = row.details ?? {};
  const target = row.target_snapshot ?? {};
  let targetDetail = "-";
  let actionDescription = row.summary;

  // 1. Trường hợp thao tác trên bài viết tri thức
  if (details.title || details.articleId) {
    const title = String(details.title ?? "Không rõ tiêu đề");
    const id = details.articleId ? ` [Mã: ${details.articleId}]` : "";
    targetDetail = `Bài viết: "${title}"${id}`;
    // Bổ sung tên bài viết vào mô tả hành động nếu chưa có
    if (!actionDescription.includes(title)) {
      actionDescription = `${row.summary}: "${title}"`;
    }
  }
  // 2. Trường hợp thao tác trên tài khoản người dùng
  else if (target.username || target.fullName || target.email) {
    const name = target.fullName ? `${target.fullName} (@${target.username})` : `@${target.username}`;
    const role = target.role ? ` - Vai trò: ${target.role}` : "";
    targetDetail = `Tài khoản: ${name}${role}`;
  }
  // 3. Trường hợp cập nhật cấu hình thời hạn lưu trữ
  else if (details.retentionDays !== undefined) {
    targetDetail = `Thời hạn lưu trữ nhật ký: ${details.retentionDays} ngày`;
  }
  // 4. Trường hợp cấu hình nhà cung cấp AI
  else if (details.providerId) {
    targetDetail = `Nhà cung cấp AI: ${details.providerId}`;
  }

  return { actionDescription, targetDetail };
}

export async function operationalLogExportBuffer(rows: OperationalLogExportRow[], format: OperationalLogExportFormat) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Nhật ký vận hành", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Thời điểm", key: "date", width: 15 },
    { header: "Thời gian", key: "time", width: 13 },
    { header: "Người thực hiện", key: "email", width: 30 },
    { header: "Phân loại", key: "category", width: 24 },
    { header: "Hành động thực hiện", key: "action", width: 50 },
    { header: "Chi tiết đối tượng tác động", key: "target", width: 55 },
  ];

  // Định dạng dòng Header chuyên nghiệp
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F46E5" }, // Indigo thương hiệu
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  for (const row of rows) {
    const timestamp = vietnamDateTime(row.created_at);
    const { actionDescription, targetDetail } = resolveLogContext(row);
    const categoryName = (row.category && categoryLabels[row.category]) ? categoryLabels[row.category] : (row.category ?? "Hệ thống");

    const addedRow = sheet.addRow({
      date: timestamp.date,
      time: timestamp.time,
      email: row.actor_email,
      category: categoryName,
      action: actionDescription,
      target: targetDetail,
    });

    addedRow.height = 22;
    addedRow.alignment = { vertical: "middle" };
    addedRow.getCell("date").alignment = { vertical: "middle", horizontal: "center" };
    addedRow.getCell("time").alignment = { vertical: "middle", horizontal: "center" };

    // Đường viền nhẹ ngăn cách giữa các ô
    addedRow.eachCell((cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFF1F5F9" } },
      };
    });
  }

  // Bật bộ lọc tự động trên thanh tiêu đề
  sheet.autoFilter = { from: "A1", to: "F1" };

  const buffer = format === "xlsx" ? await workbook.xlsx.writeBuffer() : await workbook.csv.writeBuffer();
  return format === "csv" ? Buffer.concat([Buffer.from("\uFEFF"), Buffer.from(buffer)]) : new Uint8Array(buffer);
}
