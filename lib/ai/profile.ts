import { query } from "@/lib/db";

export type AssistantProfile = {
  name: string;
  roleDescription: string;
  tone: "professional" | "friendly" | "concise";
  responseLength: "concise" | "balanced" | "detailed";
  fallbackStyle: "supportive" | "direct";
  customInstructions: string;
};

export const defaultAssistantProfile: AssistantProfile = {
  name: "Trợ lý phản hồi",
  roleDescription: "Chuyên viên tư vấn nội bộ lịch sự và trung thực",
  tone: "professional",
  responseLength: "balanced",
  fallbackStyle: "supportive",
  customInstructions: "",
};

export async function getActiveAssistantProfile(): Promise<AssistantProfile> {
  const result = await query<{
    name: string;
    role_description: string;
    tone: AssistantProfile["tone"];
    response_length: AssistantProfile["responseLength"];
    fallback_style: AssistantProfile["fallbackStyle"];
    custom_instructions: string;
  }>(`SELECT name, role_description, tone, response_length, fallback_style, custom_instructions
      FROM assistant_profiles WHERE is_active = true ORDER BY updated_at DESC LIMIT 1`);
  const row = result.rows[0];
  return row
    ? {
        name: row.name,
        roleDescription: row.role_description,
        tone: row.tone,
        responseLength: row.response_length,
        fallbackStyle: row.fallback_style,
        customInstructions: row.custom_instructions,
      }
    : defaultAssistantProfile;
}

export function profilePrompt(profile: AssistantProfile) {
  const tone = {
    professional: "chuyên nghiệp, ấm áp và điềm tĩnh",
    friendly: "thân thiện, gần gũi nhưng vẫn lịch sự",
    concise: "ngắn gọn, trực diện và lịch sự",
  }[profile.tone];
  const length = {
    concise: "Ưu tiên 2–4 câu khi có thể.",
    balanced: "Trả lời vừa đủ, dễ dùng lại khi trao đổi với khách hàng.",
    detailed: "Giải thích rõ bằng các ý ngắn khi nguồn cho phép.",
  }[profile.responseLength];
  return `Tính cách do quản trị viên cấu hình: Bạn tên là ${profile.name}, vai trò ${profile.roleDescription}. Giọng điệu ${tone}. ${length} Hướng dẫn thêm: ${profile.customInstructions || "Không có."}`;
}

export function fallbackFor(profile: AssistantProfile, hasSources: boolean) {
  const prefix =
    profile.fallbackStyle === "direct"
      ? "Hiện chưa đủ căn cứ để xác nhận."
      : "Cảm ơn bạn đã gửi câu hỏi. Hiện tôi chưa có đủ căn cứ để xác nhận chính xác.";
  return hasSources
    ? `${prefix} Tôi đã tìm thấy tài liệu liên quan nhưng cần chuyên gia kiểm tra thêm trước khi tư vấn cho khách hàng. Tôi đã chuyển nội dung để được xác nhận.`
    : `${prefix} Kho tri thức nội bộ chưa có tài liệu phù hợp. Tôi đã chuyển nội dung đến chuyên gia để hỗ trợ bạn chính xác hơn.`;
}
