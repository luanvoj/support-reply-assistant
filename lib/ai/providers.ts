import { decryptSecret } from "@/lib/security/secrets";
import type {
  GenerateAnswerInput,
  GenerateAnswerOutput,
  LLMProvider,
  ProviderConfig,
} from "@/lib/ai/provider";

type TextResponse = {
  answer: string;
  provider: GenerateAnswerOutput["provider"];
};

export function assertSafeProviderEndpoint(value: string | undefined) {
  if (!value) return;
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    host === "localhost" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    throw new Error(
      "Provider endpoint must use HTTPS and cannot target a private/local address",
    );
  }
}

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Keep diagnostic context useful without ever including the request URL,
    // headers, or credential values in an error/log.
    const providerMessage =
      typeof (body as { error?: { message?: unknown } }).error?.message ===
      "string"
        ? (body as { error: { message: string } }).error.message
            .replace(/(?:api[-_ ]?key|authorization)\s*[:=]\s*\S+/gi, "[redacted]")
            .slice(0, 240)
        : "";
    throw new Error(
      `Provider request failed (${response.status})${providerMessage ? `: ${providerMessage}` : ""}`,
    );
  }
  return body as Record<string, unknown>;
}

function promptFor(input: GenerateAnswerInput) {
  const history = (input.history ?? [])
    .map(
      (item) =>
        `${item.sender === "user" ? "Nhân viên" : "Trợ lý"}: ${item.content}`,
    )
    .join("\n");
  const sources = input.context
    .map(
      (item, index) =>
        `[${index + 1}] ${item.sourceTitle} (${item.score.toFixed(2)}, policy: ${item.responsePolicy ?? "grounded"})\n${item.content}`,
    )
    .join("\n\n");
  return [
    "Bạn là Trợ lý phản hồi — một chuyên viên tư vấn nội bộ lịch sự, nhẹ nhàng, chủ động và trung thực.",
    "Trả lời bằng tiếng Việt tự nhiên, ngắn gọn, dễ để nhân viên dùng lại khi trao đổi với khách hàng.",
    "Với mọi thông tin nghiệp vụ/kỹ thuật, chỉ được khẳng định điều có trong nguồn đã xác minh; trích dẫn số nguồn trong ngoặc vuông.",
    "Không suy đoán, không bịa quy trình, chính sách, cấu hình hoặc cam kết thay mặt doanh nghiệp.",
    "Nếu không có nguồn, chỉ được đáp các câu xã giao hoặc định hướng chung không mang tính sự thật; không được trả lời nội dung nghiệp vụ.",
    "Khi nguồn chưa đủ cho một câu hỏi nghiệp vụ, hãy nói rõ bạn cần chuyên gia xác nhận, với giọng điệu hỗ trợ và tôn trọng.",
    "Nếu một nguồn có policy: escalate, không tự hướng dẫn xử lý chi tiết hay hứa hẹn kết quả; xác nhận tiếp nhận và nói sẽ chuyển chuyên gia. Nếu policy: partial, chỉ trả lời phần có căn cứ và nêu rõ giới hạn.",
    input.persona ?? "",
    `Lịch sử gần nhất:\n${history || "Chưa có lượt trò chuyện trước."}`,
    `Câu hỏi: ${input.question}`,
    `Nguồn đã xác minh:\n${sources || "Không có nguồn đã xác minh."}`,
  ].join("\n\n");
}

class GeminiProvider implements LLMProvider {
  constructor(private readonly config: ProviderConfig) {}

  private get endpoint() {
    return this.config.endpoint ?? "https://generativelanguage.googleapis.com";
  }

  private async generate(prompt: string) {
    assertSafeProviderEndpoint(this.config.endpoint);
    const model = this.config.model ?? "gemini-1.5-flash";
    const response = await fetch(
      `${this.endpoint.replace(/\/$/, "")}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );
    const body = await readJson(response);
    const candidates = body.candidates as
      Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
    return (
      candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? ""
    );
  }

  async testConnection() {
    try {
      await this.generate("Reply with exactly: connection verified");
      return { ok: true, message: "Connection verified" };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  async generateAnswer(input: GenerateAnswerInput) {
    return {
      answer: await this.generate(promptFor(input)),
      provider: "gemini" as const,
    };
  }
  async rewriteAnswer(input: { question: string; answer: string }) {
    return this.generate(
      `Rewrite this support answer concisely without adding facts.\nQuestion: ${input.question}\nAnswer: ${input.answer}`,
    );
  }
  async summarizeContext(context: string) {
    return this.generate(
      `Summarize only these verified support notes:\n${context}`,
    );
  }
  async rerankContext(input: { question: string; candidates: Array<{ id: string; title: string; content: string }> }) {
    return this.generate(rerankPrompt(input));
  }
}

class AzureOpenAIProvider implements LLMProvider {
  constructor(private readonly config: ProviderConfig) {}

  private async generate(prompt: string) {
    if (
      !this.config.endpoint ||
      !this.config.deployment ||
      !this.config.apiVersion
    )
      throw new Error(
        "Azure endpoint, deployment, and API version are required",
      );
    assertSafeProviderEndpoint(this.config.endpoint);
    const url = `${this.config.endpoint.replace(/\/$/, "")}/openai/deployments/${this.config.deployment}/chat/completions?api-version=${encodeURIComponent(this.config.apiVersion)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "api-key": this.config.apiKey,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const body = await readJson(response);
    const choices = body.choices as
      Array<{ message?: { content?: string } }> | undefined;
    return choices?.[0]?.message?.content?.trim() ?? "";
  }

  async testConnection() {
    try {
      await this.generate("Reply with exactly: connection verified");
      return { ok: true, message: "Connection verified" };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }
  async generateAnswer(input: GenerateAnswerInput) {
    return {
      answer: await this.generate(promptFor(input)),
      provider: "azure_openai" as const,
    };
  }
  async rewriteAnswer(input: { question: string; answer: string }) {
    return this.generate(
      `Rewrite this support answer concisely without adding facts.\nQuestion: ${input.question}\nAnswer: ${input.answer}`,
    );
  }
  async summarizeContext(context: string) {
    return this.generate(
      `Summarize only these verified support notes:\n${context}`,
    );
  }
  async rerankContext(input: { question: string; candidates: Array<{ id: string; title: string; content: string }> }) {
    return this.generate(rerankPrompt(input));
  }
}

function rerankPrompt(input: { question: string; candidates: Array<{ id: string; title: string; content: string }> }) {
  return [
    "Bạn là bộ xếp hạng nguồn tri thức. Không trả lời câu hỏi của người dùng.",
    "Chỉ chọn đoạn trực tiếp, chính xác và đủ căn cứ cho câu hỏi. Loại bỏ đoạn cùng từ khóa nhưng sai ngữ cảnh.",
    "Trả về DUY NHẤT JSON hợp lệ: {\"results\":[{\"id\":\"...\",\"score\":0.0,\"reason\":\"...\"}]}. Score từ 0 đến 1. Chỉ dùng id có trong danh sách.",
    `Câu hỏi: ${input.question}`,
    `Ứng viên:\n${input.candidates.map((item) => `ID: ${item.id}\nTiêu đề: ${item.title}\nNội dung: ${item.content.slice(0, 1200)}`).join("\n\n")}`,
  ].join("\n\n");
}

export function createProvider(config: ProviderConfig): LLMProvider {
  return config.type === "gemini"
    ? new GeminiProvider(config)
    : new AzureOpenAIProvider(config);
}

export function providerConfigFromRow(
  row: Record<string, unknown>,
): ProviderConfig {
  return {
    type: row.provider_type as ProviderConfig["type"],
    displayName: String(row.display_name),
    endpoint: row.endpoint ? String(row.endpoint) : undefined,
    apiKey: decryptSecret(String(row.api_key_encrypted)),
    deployment: row.deployment ? String(row.deployment) : undefined,
    model: row.model ? String(row.model) : undefined,
    apiVersion: row.api_version ? String(row.api_version) : undefined,
  };
}
