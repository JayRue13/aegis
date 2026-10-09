// Model provider registry. Every real provider speaks the OpenAI-compatible
// chat-completions API, so one adapter covers OpenRouter, Groq, Gemini,
// Ollama and any custom endpoint. Keys stay on the server.

import type { ModelInfo } from "../types";

export interface ProviderConfig {
  id: string;
  label: string;
  baseUrl: string;
  apiKey?: string;
  /** Models to offer when the provider's /models listing is unavailable. */
  defaultModels: string[];
  /** Optional explicit model list from env; overrides discovery. */
  pinnedModels?: string[];
  /** Filter applied to discovered model ids. */
  filter?: (model: DiscoveredModel) => boolean;
  extraHeaders?: Record<string, string>;
}

export interface DiscoveredModel {
  id: string;
  pricing?: { prompt?: string | number; completion?: string | number };
  architecture?: { input_modalities?: string[] };
}

type Env = Record<string, string | undefined>;

function list(value: string | undefined): string[] | undefined {
  const items = value
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items && items.length > 0 ? items : undefined;
}

function isFree(m: DiscoveredModel): boolean {
  if (m.id.endsWith(":free")) return true;
  const p = Number(m.pricing?.prompt ?? NaN);
  const c = Number(m.pricing?.completion ?? NaN);
  return p === 0 && c === 0;
}

/** Builds the list of configured providers from environment variables. */
export function getProviders(env: Env = process.env): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  if (env.OPENROUTER_API_KEY) {
    const allowPaid = env.OPENROUTER_ALLOW_PAID === "true";
    providers.push({
      id: "openrouter",
      label: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: env.OPENROUTER_API_KEY,
      defaultModels: ["meta-llama/llama-3.3-70b-instruct:free"],
      pinnedModels: list(env.OPENROUTER_MODELS),
      // Free models only unless paid usage is explicitly enabled.
      filter: allowPaid ? undefined : isFree,
      extraHeaders: {
        "HTTP-Referer": env.AEGIS_PUBLIC_URL ?? "https://github.com/JayRue13/aegis",
        "X-Title": "AEGIS",
      },
    });
  }

  if (env.GROQ_API_KEY) {
    providers.push({
      id: "groq",
      label: "Groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: env.GROQ_API_KEY,
      defaultModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
      pinnedModels: list(env.GROQ_MODELS),
      filter: (m) => !/whisper|tts|guard|embed/i.test(m.id),
    });
  }

  if (env.GEMINI_API_KEY) {
    providers.push({
      id: "gemini",
      label: "Google Gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: env.GEMINI_API_KEY,
      defaultModels: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
      pinnedModels: list(env.GEMINI_MODELS),
      filter: (m) => /gemini/i.test(m.id) && !/embed|tts|image|live/i.test(m.id),
    });
  }

  if (env.OLLAMA_BASE_URL) {
    providers.push({
      id: "ollama",
      label: "Ollama",
      baseUrl: env.OLLAMA_BASE_URL.replace(/\/$/, "") + "/v1",
      apiKey: env.OLLAMA_API_KEY,
      defaultModels: ["qwen3:4b"],
      pinnedModels: list(env.OLLAMA_MODELS),
    });
  }

  if (env.CUSTOM_OPENAI_BASE_URL) {
    providers.push({
      id: "custom",
      label: env.CUSTOM_OPENAI_LABEL ?? "Custom",
      baseUrl: env.CUSTOM_OPENAI_BASE_URL.replace(/\/$/, ""),
      apiKey: env.CUSTOM_OPENAI_API_KEY,
      defaultModels: list(env.CUSTOM_OPENAI_MODELS) ?? [],
      pinnedModels: list(env.CUSTOM_OPENAI_MODELS),
    });
  }

  return providers;
}

/** Demo mode runs when no provider is configured, or when explicitly enabled. */
export function demoEnabled(env: Env = process.env): boolean {
  if (env.AEGIS_DEMO_MODE === "true") return true;
  if (env.AEGIS_DEMO_MODE === "false") return false;
  return getProviders(env).length === 0;
}

export const DEMO_MODEL: ModelInfo = {
  id: "demo:aegis-demo",
  provider: "demo",
  label: "AEGIS Demo (offline)",
};

/** Splits "provider:model/with:colons" into its two parts. */
export function parseModelId(id: string): { provider: string; model: string } | null {
  const i = id.indexOf(":");
  if (i <= 0 || i === id.length - 1) return null;
  return { provider: id.slice(0, i), model: id.slice(i + 1) };
}

function prettyLabel(model: string): string {
  const base = model.split("/").pop() ?? model;
  return base.replace(/:free$/, " (free)");
}

const VISION_HINT = /vision|gemini|llava|gpt-4o|qwen.*vl|pixtral|llama-4|gemma-3/i;

export function toModelInfo(provider: ProviderConfig, m: DiscoveredModel | string): ModelInfo {
  const d = typeof m === "string" ? { id: m } : m;
  const vision = d.architecture?.input_modalities?.includes("image") ?? VISION_HINT.test(d.id);
  return {
    id: `${provider.id}:${d.id}`,
    provider: provider.id,
    label: prettyLabel(d.id),
    vision,
  };
}

const cache = new Map<string, { at: number; models: ModelInfo[] }>();
const CACHE_MS = 60 * 60 * 1000;
const MAX_MODELS_PER_PROVIDER = 25;

/** Lists a provider's models, discovering them from /models when possible. */
export async function listModels(provider: ProviderConfig, fetchImpl: typeof fetch = fetch): Promise<ModelInfo[]> {
  if (provider.pinnedModels) return provider.pinnedModels.map((m) => toModelInfo(provider, m));

  const hit = cache.get(provider.id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.models;

  let models: ModelInfo[];
  try {
    const res = await fetchImpl(`${provider.baseUrl}/models`, {
      headers: authHeaders(provider),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { data?: DiscoveredModel[]; models?: DiscoveredModel[] };
    const found = (body.data ?? body.models ?? [])
      .map((m) => ({ ...m, id: m.id.replace(/^models\//, "") }))
      .filter((m) => (provider.filter ? provider.filter(m) : true))
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, MAX_MODELS_PER_PROVIDER);
    models = found.length > 0 ? found.map((m) => toModelInfo(provider, m)) : fallback(provider);
  } catch {
    models = fallback(provider);
  }
  cache.set(provider.id, { at: Date.now(), models });
  return models;
}

function fallback(provider: ProviderConfig): ModelInfo[] {
  return provider.defaultModels.map((m) => toModelInfo(provider, m));
}

export function authHeaders(provider: ProviderConfig): Record<string, string> {
  return {
    ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
    ...(provider.extraHeaders ?? {}),
  };
}

/** Test helper. */
export function clearModelCache() {
  cache.clear();
}
