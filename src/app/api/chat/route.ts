import { checkAccess, rateLimit } from "@/lib/server/access";
import { checkDailyQuota } from "@/lib/server/quota";
import { GatewayError, streamCompletion, toEventStream } from "@/lib/server/gateway";
import { chatRequestSchema } from "@/lib/server/schema";
import { buildSystemPrompt, toProviderMessages } from "@/lib/prompt";
import { selectMemories } from "@/lib/memory";
import { fetchPage, findUrls } from "@/lib/server/webfetch";
import { formatResults, searchWeb, toQuery } from "@/lib/server/search";
import { getMode } from "@/lib/modes";
import { AGENT_PROMPT, runAgent } from "@/lib/server/agent";
import type { ChatMessage, ChatStreamEvent, SourceRef } from "@/lib/types";

export const maxDuration = 60;

function json(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const access = await checkAccess(req);
  if (!access.ok) return json(access.status, access.message);

  const perMinute = Number(process.env.AEGIS_RATE_LIMIT_PER_MIN ?? 20);
  if (!rateLimit(access.identity, perMinute)) {
    return json(429, "Too many messages in a minute. Take a breath and try again.");
  }

  const quota = await checkDailyQuota(access);
  if (!quota.ok) {
    return json(429, `You've used today's ${quota.limit} messages. The limit resets at midnight UTC.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, "Request body must be JSON.");
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return json(400, `Invalid request: ${parsed.error.issues[0]?.message ?? "bad input"}`);
  const input = parsed.data;

  let history = input.messages as ChatMessage[];
  const lastUser = [...history].reverse().find((m) => m.role === "user");

  // Read pages the user linked to in this message and add them as context.
  let sources: SourceRef[] = [];
  if (lastUser && process.env.AEGIS_LINK_READER !== "false") {
    const urls = findUrls(lastUser.content);
    if (urls.length) {
      const pages = await Promise.all(urls.map((u) => fetchPage(u)));
      sources = pages.map(({ url, ok, title, error }) => ({ url, ok, title, error }));
      const files = pages.filter((p) => p.ok && p.text).map((p) => ({ name: `${p.title} (${p.url})`, text: p.text! }));
      if (files.length) {
        history = history.map((m) => (m.id === lastUser.id ? { ...m, files: [...(m.files ?? []), ...files] } : m));
      }
    }
  }
  // Web search (explicit toggle, or a mode that searches by default).
  const mode = getMode(input.mode);
  if (lastUser && (input.webSearch ?? mode.search) && process.env.AEGIS_WEB_SEARCH !== "false") {
    const query = toQuery(lastUser.content);
    if (query) {
      try {
        const results = await searchWeb(query);
        sources = [...sources, ...results.map((r) => ({ url: r.url, title: r.title, ok: true }))];
        const file = { name: "Web search results", text: formatResults(query, results) };
        history = history.map((m) => (m.id === lastUser.id ? { ...m, files: [...(m.files ?? []), file] } : m));
      } catch {
        sources = [
          ...sources,
          { url: "https://search.invalid/", title: "Web search", ok: false, error: "Search failed" },
        ];
      }
    }
  }

  const memories = selectMemories(input.memories ?? [], lastUser?.content ?? "");
  const system = buildSystemPrompt({
    memories,
    projectName: input.project?.name,
    projectInstructions: input.project?.instructions,
    knowledge: input.project?.knowledge,
    userName: input.userName,
    customInstructions: input.customInstructions,
    modePrompt: mode.agent ? AGENT_PROMPT : mode.prompt,
  });

  const providerMessages = toProviderMessages(history, system);
  const gen: AsyncGenerator<string | ChatStreamEvent> = mode.agent
    ? runAgent({ modelId: input.model, messages: providerMessages, signal: req.signal })
    : streamCompletion({
        modelId: input.model,
        messages: providerMessages,
        temperature: input.temperature,
        signal: req.signal,
      });

  // Surface configuration errors (unknown provider, bad key) as HTTP errors
  // instead of a stream, so the client can show them plainly.
  let first: IteratorResult<string | ChatStreamEvent>;
  try {
    first = await gen.next();
  } catch (err) {
    const status = err instanceof GatewayError ? err.status : 500;
    return json(status, (err as Error).message);
  }

  async function* replay(): AsyncGenerator<string | ChatStreamEvent> {
    if (!first.done) yield first.value;
    yield* gen;
  }

  const preamble: ChatStreamEvent[] = sources.length ? [{ type: "sources", sources }] : [];
  return new Response(toEventStream(replay(), preamble), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
