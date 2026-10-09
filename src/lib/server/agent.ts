// Agent mode: lets the model call tools in a loop. Read-only tools (search,
// read a page, calculate, date/time) run on the server. Tools that change
// the user's data (save a memory, create a workspace) are only *proposed*:
// the browser shows an approval card and nothing happens unless the user
// clicks Approve.

import { randomUUID } from "node:crypto";
import type { OpenAIMessage } from "../prompt";
import type { AgentAction, AgentStep } from "../types";
import { evaluate } from "../calc";
import { authHeaders, parseModelId } from "./providers";
import { describeHttpError, GatewayError, resolveProvider } from "./gateway";
import { readSse } from "./sse";
import { formatResults, searchWeb } from "./search";
import { fetchPage } from "./webfetch";

export const MAX_TOOL_ROUNDS = 5;

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type AgentMessage =
  | OpenAIMessage
  | { role: "assistant"; content: string | null; tool_calls: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type AgentEvent =
  { type: "delta"; text: string } | { type: "step"; step: AgentStep } | { type: "action"; action: AgentAction };

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[]) => ({
  type: "function" as const,
  function: { name, description, parameters: { type: "object", properties, required } },
});

export const TOOLS = [
  fn("web_search", "Search the web for current or factual information.", { query: { type: "string" } }, ["query"]),
  fn("read_url", "Read the text of a public web page.", { url: { type: "string" } }, ["url"]),
  fn(
    "calculator",
    "Evaluate an arithmetic expression exactly. Supports + - * / % ^, parentheses, sqrt, abs, round, floor, ceil, ln, log, sin, cos, tan, pi, e.",
    { expression: { type: "string" } },
    ["expression"],
  ),
  fn("current_datetime", "Get the current date and time in UTC.", {}, []),
  fn(
    "save_memory",
    "Propose saving a lasting fact about the user to long-term memory. The user must approve it.",
    { fact: { type: "string" } },
    ["fact"],
  ),
  fn(
    "create_workspace",
    "Propose creating a workspace (project folder) with instructions. The user must approve it.",
    { name: { type: "string" }, instructions: { type: "string" } },
    ["name"],
  ),
];

export const AGENT_PROMPT =
  "You are in Agent mode and can call tools. Use them when they make the answer more accurate: search or read pages for facts that may have changed, use the calculator for any non-trivial arithmetic, and current_datetime for dates. save_memory and create_workspace only propose changes; the user decides. Cite pages you used as [n] with their URLs. Do not call tools when you can answer directly.";

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");

/** Runs one tool call. Returns the text for the model plus what to show the user. */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  deps: { search?: typeof searchWeb; read?: typeof fetchPage; now?: () => Date } = {},
): Promise<{ result: string; step?: AgentStep; action?: Omit<AgentAction, "id" | "status"> }> {
  const search = deps.search ?? searchWeb;
  const read = deps.read ?? fetchPage;
  switch (name) {
    case "web_search": {
      const query = str(args.query, 200);
      if (!query) return { result: "Error: query is required" };
      try {
        const results = await search(query);
        return {
          result: formatResults(query, results),
          step: {
            tool: name,
            label: `Searched the web for “${query}”`,
            ok: true,
            links: results.map((r) => ({ url: r.url, title: r.title })),
          },
        };
      } catch {
        return {
          result: "Error: search failed",
          step: { tool: name, label: `Search failed for “${query}”`, ok: false },
        };
      }
    }
    case "read_url": {
      const url = str(args.url, 2000);
      const page = await read(url);
      if (!page.ok) {
        return {
          result: `Error: ${page.error}`,
          step: { tool: name, label: `Couldn't read ${url} (${page.error})`, ok: false },
        };
      }
      return {
        result: `${page.title}\nURL: ${page.url}\n\n${page.text?.slice(0, 20_000)}`,
        step: { tool: name, label: `Read “${page.title}”`, ok: true, links: [{ url: page.url, title: page.title }] },
      };
    }
    case "calculator": {
      const expression = str(args.expression, 500);
      try {
        const value = evaluate(expression);
        const shown = Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(12)));
        return { result: shown, step: { tool: name, label: `Calculated ${expression} = ${shown}`, ok: true } };
      } catch (err) {
        return {
          result: `Error: ${(err as Error).message}`,
          step: { tool: name, label: `Couldn't calculate ${expression}`, ok: false },
        };
      }
    }
    case "current_datetime": {
      const now = (deps.now ?? (() => new Date()))();
      return { result: now.toISOString(), step: { tool: name, label: "Checked the date and time", ok: true } };
    }
    case "save_memory": {
      const fact = str(args.fact, 500).trim();
      if (!fact) return { result: "Error: fact is required" };
      return {
        result: "Proposed to the user. It is saved only if they approve.",
        action: { kind: "save_memory", summary: `Remember: “${fact}”`, payload: { fact } },
      };
    }
    case "create_workspace": {
      const wsName = str(args.name, 200).trim();
      if (!wsName) return { result: "Error: name is required" };
      return {
        result: "Proposed to the user. It is created only if they approve.",
        action: {
          kind: "create_workspace",
          summary: `Create workspace “${wsName}”`,
          payload: { name: wsName, instructions: str(args.instructions, 20_000) },
        },
      };
    }
    default:
      return { result: `Error: unknown tool ${name}` };
  }
}

interface RoundResult {
  text: string;
  toolCalls: ToolCall[];
}

async function* streamRound(
  modelId: string,
  messages: AgentMessage[],
  withTools: boolean,
  opts: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; signal?: AbortSignal },
): AsyncGenerator<string, RoundResult> {
  const { provider, model } = resolveProvider(modelId, opts.env);
  const res = await (opts.fetchImpl ?? fetch)(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(provider) },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.4,
      ...(withTools ? { tools: TOOLS, tool_choice: "auto" } : {}),
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new GatewayError(describeHttpError(provider.label, res.status, detail), res.status);
  }
  let text = "";
  const calls = new Map<number, ToolCall>();
  for await (const d of readSse(res.body)) {
    if (d.error) throw new GatewayError(`${provider.label}: ${d.error}`, 502);
    if (d.done) break;
    if (d.text) {
      text += d.text;
      yield d.text;
    }
    for (const t of d.toolCalls ?? []) {
      const c = calls.get(t.index) ?? {
        id: t.id ?? `call_${t.index}`,
        type: "function" as const,
        function: { name: "", arguments: "" },
      };
      if (t.id) c.id = t.id;
      if (t.name) c.function.name += t.name;
      if (t.args) c.function.arguments += t.args;
      calls.set(t.index, c);
    }
  }
  return { text, toolCalls: [...calls.values()].filter((c) => c.function.name) };
}

/** The agent loop: stream, run requested tools, feed results back, repeat. */
export async function* runAgent(opts: {
  modelId: string;
  messages: OpenAIMessage[];
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  deps?: Parameters<typeof runTool>[2];
}): AsyncGenerator<AgentEvent> {
  if (parseModelId(opts.modelId)?.provider === "demo") {
    yield {
      type: "delta",
      text: "Agent mode needs a real model. Add a free API key (see Settings → Server status), then try again.",
    };
    return;
  }
  const convo: AgentMessage[] = [...opts.messages];
  let withTools = true;
  let actionCount = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const lastRound = round === MAX_TOOL_ROUNDS;
    let gen = streamRound(opts.modelId, convo, withTools && !lastRound, opts);
    let r: IteratorResult<string, RoundResult>;
    try {
      r = await gen.next();
    } catch (err) {
      // Some free models reject the `tools` parameter: fall back to plain chat once.
      if (
        withTools &&
        err instanceof GatewayError &&
        (err.status === 400 || err.status === 404 || err.status === 422)
      ) {
        withTools = false;
        yield {
          type: "step",
          step: { tool: "none", label: "This model can't use tools, so it answered directly", ok: false },
        };
        gen = streamRound(opts.modelId, convo, false, opts);
        r = await gen.next();
      } else throw err;
    }
    while (!r.done) {
      yield { type: "delta", text: r.value };
      r = await gen.next();
    }
    const { text, toolCalls } = r.value;
    if (toolCalls.length === 0) return;

    convo.push({ role: "assistant", content: text || null, tool_calls: toolCalls });
    for (const call of toolCalls) {
      const out = await runTool(call.function.name, parseArgs(call.function.arguments), opts.deps);
      if (out.step) yield { type: "step", step: out.step };
      if (out.action && actionCount < 5) {
        actionCount++;
        yield { type: "action", action: { ...out.action, id: randomUUID(), status: "pending" } };
      }
      convo.push({ role: "tool", tool_call_id: call.id, content: out.result });
    }
  }
}
