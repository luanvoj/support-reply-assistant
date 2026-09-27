export type Chunk = {
  index: number;
  content: string;
  contextHint: string;
  tokenCount: number;
};

function estimateTokens(value: string): number {
  return Math.ceil(value.trim().split(/\s+/).filter(Boolean).length * 1.3);
}

export function chunkMarkdown(markdown: string, maxTokens = 350, overlapParagraphs = 1): Chunk[] {
  const paragraphs = markdown.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const chunks: Chunk[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const paragraph of paragraphs) {
    const tokens = estimateTokens(paragraph);
    if (current.length && currentTokens + tokens > maxTokens) {
      const content = current.join("\n\n");
      chunks.push({
        index: chunks.length,
        content,
        contextHint: content.split("\n")[0].slice(0, 160),
        tokenCount: currentTokens,
      });
      current = current.slice(-overlapParagraphs);
      currentTokens = estimateTokens(current.join("\n\n"));
    }
    current.push(paragraph);
    currentTokens += tokens;
  }

  if (current.length) {
    const content = current.join("\n\n");
    chunks.push({
      index: chunks.length,
      content,
      contextHint: content.split("\n")[0].slice(0, 160),
      tokenCount: currentTokens,
    });
  }
  return chunks;
}
