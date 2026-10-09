import { describe, expect, it, vi } from "vitest";
import { formatResults, searchProvider, searchWeb, toQuery } from "@/lib/server/search";
import { buildSystemPrompt } from "@/lib/prompt";
import { getMode, MODES } from "@/lib/modes";

const json = (body: unknown) => vi.fn(async () => Response.json(body)) as unknown as typeof fetch;

describe("searchProvider", () => {
  it("prefers SearXNG, then Brave, then Wikipedia", () => {
    expect(searchProvider({ SEARXNG_URL: "http://s", BRAVE_SEARCH_API_KEY: "k" })).toBe("searxng");
    expect(searchProvider({ BRAVE_SEARCH_API_KEY: "k" })).toBe("brave");
    expect(searchProvider({})).toBe("wikipedia");
  });
});

describe("searchWeb", () => {
  it("parses Wikipedia results in rank order", async () => {
    const fetchImpl = json({
      query: {
        pages: [
          { title: "Second", index: 2, fullurl: "https://en.wikipedia.org/wiki/Second", extract: "Two." },
          { title: "First", index: 1, fullurl: "https://en.wikipedia.org/wiki/First", extract: "One." },
        ],
      },
    });
    const r = await searchWeb("photosynthesis", { env: {}, fetchImpl });
    expect(r.map((x) => x.title)).toEqual(["First", "Second"]);
    expect(String((fetchImpl as unknown as { mock: { calls: string[][] } }).mock.calls[0][0])).toContain(
      "gsrsearch=photosynthesis",
    );
  });

  it("parses SearXNG and Brave responses", async () => {
    const sx = await searchWeb("q", {
      env: { SEARXNG_URL: "http://searx.local/" },
      fetchImpl: json({
        results: [{ title: "A", url: "https://a.com", content: "<b>alpha</b>" }, { title: "no url" }],
      }),
    });
    expect(sx).toEqual([{ title: "A", url: "https://a.com", snippet: "alpha" }]);
    const br = await searchWeb("q", {
      env: { BRAVE_SEARCH_API_KEY: "k" },
      fetchImpl: json({ web: { results: [{ title: "B &amp; C", url: "https://b.com", description: "beta" }] } }),
    });
    expect(br).toEqual([{ title: "B & C", url: "https://b.com", snippet: "beta" }]);
  });

  it("throws on provider errors and skips empty queries", async () => {
    await expect(
      searchWeb("q", {
        env: {},
        fetchImpl: (async () => new Response("", { status: 503 })) as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/503/);
    expect(await searchWeb("   ", { env: {} })).toEqual([]);
  });
});

describe("query and formatting", () => {
  it("strips files and links from the query", () => {
    expect(toQuery('<file name="a">secret</file> what is https://x.com rust?')).toBe("what is rust?");
  });
  it("numbers results for citation", () => {
    const text = formatResults("rust", [{ title: "Rust", url: "https://r", snippet: "A language" }]);
    expect(text).toContain("[1] Rust");
    expect(formatResults("x", [])).toContain("no results");
  });
});

describe("modes and instructions", () => {
  it("adds mode and custom instructions to the system prompt", () => {
    const p = buildSystemPrompt({ modePrompt: getMode("code").prompt, customInstructions: "Be brief." });
    expect(p).toContain("Code mode");
    expect(p).toContain("standing instructions\nBe brief.");
  });
  it("falls back to chat for unknown modes; research searches", () => {
    expect(getMode("nope").id).toBe("chat");
    expect(MODES.find((m) => m.id === "research")?.search).toBe(true);
  });
});
