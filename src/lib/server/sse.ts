// Parses an OpenAI-compatible server-sent-events stream into text deltas.

export interface SseDelta {
  text?: string;
  error?: string;
  done?: boolean;
}

/** Parses a single `data:` payload from a chat-completions stream. */
export function parseSseData(data: string): SseDelta | null {
  const trimmed = data.trim();
  if (!trimmed) return null;
  if (trimmed === "[DONE]") return { done: true };
  try {
    const json = JSON.parse(trimmed) as {
      choices?: { delta?: { content?: string | null; reasoning?: string | null } }[];
      error?: { message?: string } | string;
    };
    if (json.error) {
      return { error: typeof json.error === "string" ? json.error : (json.error.message ?? "Provider error") };
    }
    const text = json.choices?.[0]?.delta?.content;
    return text ? { text } : null;
  } catch {
    return null;
  }
}

/** Reads a byte stream of SSE lines and yields parsed deltas. */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseDelta> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, "");
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const parsed = parseSseData(line.slice(5));
        if (parsed) {
          yield parsed;
          if (parsed.done) return;
        }
      }
    }
    const rest = buffer.trim();
    if (rest.startsWith("data:")) {
      const parsed = parseSseData(rest.slice(5));
      if (parsed) yield parsed;
    }
  } finally {
    reader.releaseLock();
  }
}
