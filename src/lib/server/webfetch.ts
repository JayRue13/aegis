// Reads web pages that the user links to, so the model can use them as
// context. Guards against server-side request forgery: only http(s), only
// public IP addresses (checked at connect time, so DNS tricks don't help),
// limited redirects, size and time.

import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

export interface PageResult {
  url: string;
  ok: boolean;
  title?: string;
  text?: string;
  error?: string;
}

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 40_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb") ||
      lower.startsWith("ff")
    );
  }
  return true;
}

/** Finds up to `max` distinct http(s) URLs in text. */
export function findUrls(text: string, max = 3): string[] {
  const found = text.match(/\bhttps?:\/\/[^\s<>"'`)\]]+/gi) ?? [];
  const out: string[] = [];
  for (const raw of found) {
    const url = raw.replace(/[.,;:!?]+$/, "");
    try {
      const u = new URL(url);
      if (!out.includes(u.href)) out.push(u.href);
    } catch {}
    if (out.length >= max) break;
  }
  return out;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Converts an HTML document to readable plain text (title + main content). */
export function htmlToText(html: string): { title: string; text: string } {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "").replace(/\s+/g, " ");
  let body = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  body = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe|template)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<h([1-6])\b[^>]*>/gi, (_m, n: string) => "\n\n" + "#".repeat(Number(n)) + " ")
    .replace(/<\/(p|div|section|h[1-6]|li|tr|table|blockquote|pre|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const text = decode(body)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title, text };
}

function guardedLookup(
  hostname: string,
  options: object,
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const list = addresses as LookupAddress[];
    const bad = list.find((a) => isPrivateAddress(a.address));
    if (bad || list.length === 0) {
      const e = new Error(`Blocked non-public address for ${hostname}`) as NodeJS.ErrnoException;
      e.code = "EBLOCKED";
      return callback(e, []);
    }
    const wantAll = (options as { all?: boolean }).all;
    if (wantAll) callback(null, list);
    else callback(null, list[0].address, list[0].family);
  });
}

let agent: Agent | null = null;
function publicAgent(): Agent {
  agent ??= new Agent({ connect: { lookup: guardedLookup as never, timeout: TIMEOUT_MS } });
  return agent;
}

export interface FetchPageOptions {
  /** Tests only: allow loopback/private targets. */
  allowPrivate?: boolean;
}

export async function fetchPage(url: string, opts: FetchPageOptions = {}): Promise<PageResult> {
  let current = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const u = new URL(current);
      if (u.protocol !== "http:" && u.protocol !== "https:") return { url, ok: false, error: "Only http(s) links" };
      if (u.username || u.password) return { url, ok: false, error: "Links with credentials are not fetched" };
      if (
        !opts.allowPrivate &&
        isIP(u.hostname.replace(/^\[|\]$/g, "")) &&
        isPrivateAddress(u.hostname.replace(/^\[|\]$/g, ""))
      ) {
        return { url, ok: false, error: "Private addresses are not fetched" };
      }
      const res = await undiciFetch(current, {
        redirect: "manual",
        dispatcher: opts.allowPrivate ? undefined : publicAgent(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "User-Agent": "AEGIS/0.3 (+link reader)",
          Accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.5",
        },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, current).href;
        await res.body?.cancel();
        continue;
      }
      if (!res.ok) return { url, ok: false, error: `HTTP ${res.status}` };
      const type = res.headers.get("content-type") ?? "";
      if (!/text\/|json|xml/.test(type)) {
        await res.body?.cancel();
        return { url, ok: false, error: `Unsupported content (${type.split(";")[0] || "unknown"})` };
      }
      const raw = await readLimited(res.body as unknown as ReadableStream | null, MAX_BYTES);
      if (/html/.test(type)) {
        const { title, text } = htmlToText(raw);
        return { url: current, ok: true, title: title || u.hostname, text: text.slice(0, MAX_TEXT) };
      }
      return { url: current, ok: true, title: u.pathname.split("/").pop() || u.hostname, text: raw.slice(0, MAX_TEXT) };
    }
    return { url, ok: false, error: "Too many redirects" };
  } catch (err) {
    const e = err as Error & { cause?: { code?: string } };
    if (e.cause?.code === "EBLOCKED" || /Blocked non-public/.test(String(e.cause ?? e.message))) {
      return { url, ok: false, error: "Private addresses are not fetched" };
    }
    return { url, ok: false, error: e.name === "TimeoutError" ? "Timed out" : "Could not load" };
  }
}

async function readLimited(body: ReadableStream | null, max: number): Promise<string> {
  if (!body) return "";
  const reader = (body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(Math.min(size, max));
  let off = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.length, all.length - off));
    all.set(part, off);
    off += part.length;
    if (off >= all.length) break;
  }
  return new TextDecoder().decode(all);
}
