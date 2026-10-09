// Free web search. Uses, in order of preference: a SearXNG instance
// (SEARXNG_URL, self-hosted and free), Brave Search (BRAVE_SEARCH_API_KEY,
// free tier), and otherwise Wikipedia, which needs no key at all.

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

type Env = Record<string, string | undefined>;

const TIMEOUT = 8000;
const UA = "AEGIS/0.4 (personal assistant; https://github.com/JayRue13/aegis)";

export function searchProvider(env: Env = process.env): "searxng" | "brave" | "wikipedia" {
  if (env.SEARXNG_URL) return "searxng";
  if (env.BRAVE_SEARCH_API_KEY) return "brave";
  return "wikipedia";
}

/** Turns a chat message into a compact search query. */
export function toQuery(text: string): string {
  return text
    .replace(/<file[\s\S]*?<\/file>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function strip(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchWeb(
  query: string,
  { env = process.env, fetchImpl = fetch, limit = 5 }: { env?: Env; fetchImpl?: typeof fetch; limit?: number } = {},
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const provider = searchProvider(env);

  if (provider === "searxng") {
    const url = `${env.SEARXNG_URL!.replace(/\/$/, "")}/search?format=json&q=${encodeURIComponent(q)}`;
    const res = await fetchImpl(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) throw new Error(`SearXNG error ${res.status}`);
    const body = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    return (body.results ?? [])
      .filter((r) => r.url && r.title)
      .slice(0, limit)
      .map((r) => ({ title: r.title!, url: r.url!, snippet: strip(r.content ?? "") }));
  }

  if (provider === "brave") {
    const url = `https://api.search.brave.com/res/v1/web/search?count=${limit}&q=${encodeURIComponent(q)}`;
    const res = await fetchImpl(url, {
      headers: { Accept: "application/json", "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY! },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) throw new Error(`Brave Search error ${res.status}`);
    const body = (await res.json()) as { web?: { results?: { title: string; url: string; description?: string }[] } };
    return (body.web?.results ?? [])
      .slice(0, limit)
      .map((r) => ({ title: strip(r.title), url: r.url, snippet: strip(r.description ?? "") }));
  }

  // Wikipedia: search and fetch plain-text intros in one request.
  const base = env.WIKIPEDIA_API_URL ?? "https://en.wikipedia.org/w/api.php";
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: q,
    gsrlimit: String(Math.min(limit, 5)),
    prop: "extracts|info",
    exintro: "1",
    explaintext: "1",
    exchars: "1200",
    inprop: "url",
    origin: "*",
  });
  const res = await fetchImpl(`${base}?${params}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Wikipedia error ${res.status}`);
  const body = (await res.json()) as {
    query?: { pages?: { title: string; fullurl?: string; extract?: string; index?: number }[] };
  };
  return (body.query?.pages ?? [])
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .slice(0, limit)
    .map((p) => ({
      title: p.title,
      url: p.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
      snippet: (p.extract ?? "").trim(),
    }));
}

/** Formats results as numbered context the model can cite as [n]. */
export function formatResults(query: string, results: SearchResult[]): string {
  if (results.length === 0) return `Web search for "${query}" returned no results.`;
  return [
    `Web search results for "${query}" (cite as [n]):`,
    ...results.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`),
  ].join("\n\n");
}
