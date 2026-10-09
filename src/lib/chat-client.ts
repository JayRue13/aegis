// Browser side of /api/chat: sends the request and reads NDJSON events.

import type { ChatStreamEvent } from "./types";

/** Splits a growing NDJSON buffer into complete events plus the remainder. */
export function parseNdjson(buffer: string): { events: ChatStreamEvent[]; rest: string } {
  const events: ChatStreamEvent[] = [];
  let rest = buffer;
  let nl: number;
  while ((nl = rest.indexOf("\n")) >= 0) {
    const line = rest.slice(0, nl).trim();
    rest = rest.slice(nl + 1);
    if (!line) continue;
    try {
      events.push(JSON.parse(line) as ChatStreamEvent);
    } catch {
      // ignore malformed line
    }
  }
  return { events, rest };
}

export class ChatRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function streamChat(
  body: unknown,
  headers: Record<string, string>,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status})`;
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {}
    throw new ChatRequestError(message, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseNdjson(buffer);
    buffer = rest;
    for (const e of events) {
      if (e.type === "delta") onDelta(e.text);
      else if (e.type === "error") throw new ChatRequestError(e.message, 502);
      else if (e.type === "done") return;
    }
  }
}

const TEXT_EXT =
  /\.(txt|md|markdown|csv|tsv|json|jsonl|ya?ml|xml|html?|css|scss|js|jsx|ts|tsx|mjs|cjs|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|sh|bash|zsh|ps1|sql|toml|ini|cfg|conf|env|log|tex|r|lua|dart|vue|svelte)$/i;

export function isTextFile(file: { name: string; type: string }): boolean {
  return (
    file.type.startsWith("text/") ||
    /json|xml|javascript|typescript|yaml|csv/.test(file.type) ||
    TEXT_EXT.test(file.name)
  );
}

export function isImageFile(file: { type: string }): boolean {
  return /^image\/(png|jpe?g|webp|gif)$/.test(file.type);
}

/** Downscales an image to keep requests small; returns a JPEG/PNG data URL. */
export async function imageToDataUrl(file: File, maxSide = 1600): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  if (typeof document === "undefined") return raw;
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = raw;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (scale === 1 && file.size < 1_500_000) return raw;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}
