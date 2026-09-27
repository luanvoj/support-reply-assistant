import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guard";
import { assertSafeProviderEndpoint } from "@/lib/ai/providers";

const requestSchema = z.object({
  endpoint: z.string().url(),
  apiKey: z.string().min(10).max(500),
  deployment: z.string().trim().min(1).max(200).optional(),
});

const apiVersions = [
  "2025-04-01-preview",
  "2024-10-21",
  "2024-06-01",
  "2024-02-15-preview",
];

type AzureModel = {
  id?: unknown;
  capabilities?: { chat_completion?: unknown; inference?: unknown };
};

export async function POST(request: Request) {
  await requireRole("admin");
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Endpoint hoặc API key không hợp lệ." },
      { status: 400 },
    );
  }

  const { endpoint, apiKey, deployment } = parsed.data;
  try {
    assertSafeProviderEndpoint(endpoint);
  } catch {
    return NextResponse.json(
      { error: "Endpoint phải dùng HTTPS công khai." },
      { status: 400 },
    );
  }

  for (const apiVersion of apiVersions) {
    try {
      const response = await fetch(
        `${endpoint.replace(/\/$/, "")}/openai/models?api-version=${encodeURIComponent(apiVersion)}`,
        {
          headers: { "api-key": apiKey },
          signal: AbortSignal.timeout(12_000),
        },
      );
      if (!response.ok) continue;
      const body = (await response.json().catch(() => ({}))) as {
        data?: AzureModel[];
      };
      const models = (body.data ?? [])
        .filter((item) => typeof item.id === "string")
        .filter(
          (item) =>
            item.capabilities?.chat_completion !== false &&
            item.capabilities?.inference !== false,
        )
        .map((item) => ({ id: String(item.id), label: String(item.id) }))
        .sort((left, right) => left.label.localeCompare(right.label));
      if (deployment) {
        const deploymentResponse = await fetch(
          `${endpoint.replace(/\/$/, "")}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "api-key": apiKey },
            // Do not send temperature: current GPT-5 Azure deployments only
            // accept their default value.
            body: JSON.stringify({
              messages: [{ role: "user", content: "Reply with exactly: connection verified" }],
            }),
            signal: AbortSignal.timeout(20_000),
          },
        );
        if (!deploymentResponse.ok) {
          console.warn("[providers.azure.validate] deployment validation failed", {
            status: deploymentResponse.status,
            apiVersion,
          });
          continue;
        }
      }
      return NextResponse.json({
        apiVersion,
        models,
        deploymentVerified: Boolean(deployment),
      });
    } catch (error) {
      console.warn("[providers.azure.validate] provider request failed", {
        apiVersion,
        error: error instanceof Error ? error.message.slice(0, 240) : "unknown",
      });
      // Thử phiên bản tiếp theo; không trả chi tiết nhà cung cấp hoặc API key về client.
    }
  }

  return NextResponse.json(
    {
      error: deployment
        ? "Không thể gọi deployment Azure. Hãy kiểm tra tên deployment, API version và quyền model."
        : "Không thể kết nối Azure OpenAI. Hãy kiểm tra endpoint và API key.",
    },
    { status: 502 },
  );
}
