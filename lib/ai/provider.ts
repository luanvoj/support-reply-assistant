export type ProviderType = "gemini" | "azure_openai";

export type ProviderConfig = {
  type: ProviderType;
  displayName: string;
  endpoint?: string;
  apiKey: string;
  deployment?: string;
  model?: string;
  apiVersion?: string;
};

export type GenerateAnswerInput = {
  question: string;
  context: Array<{ content: string; sourceTitle: string; score: number; responsePolicy?: "grounded" | "escalate" }>;
  history?: Array<{ sender: "user" | "assistant"; content: string }>;
  persona?: string;
};

export type GenerateAnswerOutput = {
  answer: string;
  provider: ProviderType;
};

export interface LLMProvider {
  testConnection(): Promise<{ ok: boolean; message: string }>;
  generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerOutput>;
  rewriteAnswer(input: { question: string; answer: string }): Promise<string>;
  summarizeContext(context: string): Promise<string>;
  rerankContext(input: { question: string; candidates: Array<{ id: string; title: string; content: string }> }): Promise<string>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(message = "No AI provider is configured") {
    super(message);
    this.name = "ProviderNotConfiguredError";
  }
}

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}
