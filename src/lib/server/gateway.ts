// Streams a chat completion from the selected provider as NDJSON events.

import type { ChatStreamEvent } from "../types";
import type { OpenAIMessage } from "../prompt";
import { authHeaders, getProviders, parseModelId, type ProviderConfig } from "./providers";
import { readSse } from "./sse";

export interface StreamOptions {
  modelId: string;
  messages: OpenAIMessage[];
  signal?: AbortSignal;
  temperature?: number;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function resolveProvider(
  modelId: string,
  env: Record<string, string | undefined> = process.env,
): { provider: ProviderConfig; model: string } {
  const parsed = parseModelId(modelId);
  if (!parsed) throw new GatewayError(`Invalid model id "${modelId}"`);
  const provider = getProviders(env).find((p) => p.id === parsed.provider);
  if (!provider) throw new GatewayError(`Provider "${parsed.provider}" is not configured`);
  return { provider, model: parsed.model };
}

/** Yields text deltas from a provider; throws GatewayError on failures. */
export async function* streamCompletion(opts: StreamOptions): AsyncGenerator<string> {
  const parsed = parseModelId(opts.modelId);
  if (parsed?.provider === "demo") {
    yield* demoStream(opts.messages, opts.signal);
    return;
  }
  const { provider, model } = resolveProvider(opts.modelId, opts.env);
  const fetchImpl = opts.fetchImpl ?? fetch;

  let res: Response;
  try {
    res = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(provider) },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        stream: true,
        temperature: opts.temperature ?? 0.7,
      }),
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    throw new GatewayError(`Could not reach ${provider.label}: ${(err as Error).message}`, 502);
  }

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new GatewayError(describeHttpError(provider.label, res.status, detail), res.status === 429 ? 429 : 502);
  }

  for await (const delta of readSse(res.body)) {
    if (delta.error) throw new GatewayError(`${provider.label}: ${delta.error}`, 502);
    if (delta.done) return;
    if (delta.text) yield delta.text;
  }
}

export function describeHttpError(label: string, status: number, body: string): string {
  let message = "";
  try {
    const json = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    message = (typeof json.error === "string" ? json.error : json.error?.message) ?? json.message ?? "";
  } catch {
    message = body.slice(0, 200);
  }
  if (status === 401 || status === 403)
    return `${label} rejected the API key (${status}). Check the key in your environment settings.`;
  if (status === 429) return `${label} rate limit reached. Wait a moment or pick another model.`;
  if (status === 404) return `${label} does not offer that model (${message || "not found"}).`;
  return `${label} error ${status}${message ? `: ${message}` : ""}`;
}

/** Converts a delta generator into an NDJSON byte stream for the browser. */
export function toEventStream(gen: AsyncGenerator<string>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const send = (c: ReadableStreamDefaultController<Uint8Array>, e: ChatStreamEvent) =>
    c.enqueue(enc.encode(JSON.stringify(e) + "\n"));
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const text of gen) send(controller, { type: "delta", text });
        send(controller, { type: "done" });
      } catch (err) {
        send(controller, { type: "error", message: (err as Error).message || "Unknown error" });
      } finally {
        controller.close();
      }
    },
    async cancel() {
      await gen.return(undefined);
    },
  });
}

function lastUserText(messages: OpenAIMessage[]): string {
  const m = [...messages].reverse().find((x) => x.role === "user");
  if (!m) return "";
  if (typeof m.content === "string") return m.content;
  return m.content.map((p) => (p.type === "text" ? p.text : "[image]")).join(" ");
}

/** Offline demo model so the app is usable before any API key is configured. */
export async function* demoStream(messages: OpenAIMessage[], signal?: AbortSignal): AsyncGenerator<string> {
  const question = lastUserText(messages)
    .replace(/<file[\s\S]*?<\/file>\s*/g, "")
    .trim();
  const remembered = (typeof messages[0]?.content === "string" ? messages[0].content : "").includes(
    "What you remember about the user",
  );
  const reply = [
    `**AEGIS demo mode.** You said: “${question.slice(0, 300) || "(empty)"}”`,
    "",
    "No model provider is configured yet, so this reply is generated locally. To get real answers, add at least one free key to the server environment:",
    "",
    "- `OPENROUTER_API_KEY` (free models at openrouter.ai)",
    "- `GEMINI_API_KEY` (free tier at aistudio.google.com)",
    "- `GROQ_API_KEY` (free tier at console.groq.com)",
    "- `OLLAMA_BASE_URL` to use your own Ollama server",
    "",
    remembered
      ? "_Your saved memories were included in this request._"
      : "_Tip: say “remember that …” to save a memory._",
  ].join("\n");
  for (const word of reply.split(/(?<=\s)/)) {
    if (signal?.aborted) return;
    yield word;
    await new Promise((r) => setTimeout(r, 8));
  }
}
