import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearModelCache, demoEnabled, getProviders, listModels, parseModelId } from "@/lib/server/providers";

beforeEach(() => clearModelCache());

describe("getProviders", () => {
  it("only enables providers with credentials", () => {
    expect(getProviders({})).toEqual([]);
    const ids = getProviders({ GROQ_API_KEY: "g", GEMINI_API_KEY: "x", OLLAMA_BASE_URL: "http://pc:11434/" }).map(
      (p) => p.id,
    );
    expect(ids).toEqual(["groq", "gemini", "ollama"]);
    expect(getProviders({ OLLAMA_BASE_URL: "http://pc:11434/" })[0].baseUrl).toBe("http://pc:11434/v1");
  });

  it("enables demo mode only without providers unless forced", () => {
    expect(demoEnabled({})).toBe(true);
    expect(demoEnabled({ GROQ_API_KEY: "k" })).toBe(false);
    expect(demoEnabled({ GROQ_API_KEY: "k", AEGIS_DEMO_MODE: "true" })).toBe(true);
    expect(demoEnabled({ AEGIS_DEMO_MODE: "false" })).toBe(false);
  });
});

describe("parseModelId", () => {
  it("splits on the first colon only", () => {
    expect(parseModelId("openrouter:meta-llama/llama-3.3-70b-instruct:free")).toEqual({
      provider: "openrouter",
      model: "meta-llama/llama-3.3-70b-instruct:free",
    });
    expect(parseModelId("nocolon")).toBeNull();
    expect(parseModelId(":x")).toBeNull();
  });
});

describe("listModels", () => {
  it("keeps only free OpenRouter models by default", async () => {
    const [p] = getProviders({ OPENROUTER_API_KEY: "k" });
    const fetchImpl = vi.fn(async () =>
      Response.json({
        data: [
          { id: "a/paid", pricing: { prompt: "0.000001", completion: "0.000002" } },
          { id: "b/free-model:free", pricing: { prompt: "0", completion: "0" } },
          {
            id: "c/zero",
            pricing: { prompt: 0, completion: 0 },
            architecture: { input_modalities: ["text", "image"] },
          },
        ],
      }),
    );
    const models = await listModels(p, fetchImpl as unknown as typeof fetch);
    expect(models.map((m) => m.id)).toEqual([
      "openrouter:openrouter/free",
      "openrouter:b/free-model:free",
      "openrouter:c/zero",
    ]);
    expect(models[0].label).toBe("Free auto (best available)");
    expect(models[2].vision).toBe(true);
    expect(models[1].label).toBe("free-model (free)");
  });

  it("falls back to defaults when discovery fails", async () => {
    const [p] = getProviders({ GROQ_API_KEY: "k" });
    const models = await listModels(p, (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch);
    expect(models.map((m) => m.id)).toContain("groq:llama-3.3-70b-versatile");
  });

  it("uses pinned models without calling the network", async () => {
    const [p] = getProviders({ GEMINI_API_KEY: "k", GEMINI_MODELS: "gemini-x, gemini-y" });
    const fetchImpl = vi.fn();
    const models = await listModels(p, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(models.map((m) => m.id)).toEqual(["gemini:gemini-x", "gemini:gemini-y"]);
  });

  it("strips the models/ prefix Gemini uses", async () => {
    const [p] = getProviders({ GEMINI_API_KEY: "k" });
    const models = await listModels(p, (async () =>
      Response.json({
        data: [{ id: "models/gemini-2.5-flash" }, { id: "models/text-embedding-004" }],
      })) as unknown as typeof fetch);
    expect(models.map((m) => m.id)).toEqual(["gemini:gemini-2.5-flash"]);
  });
});
