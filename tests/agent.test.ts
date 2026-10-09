import { describe, expect, it } from "vitest";
import { runAgent, runTool, TOOLS, type AgentEvent } from "@/lib/server/agent";

const ENV = { CUSTOM_OPENAI_BASE_URL: "http://fake.test/v1", CUSTOM_OPENAI_MODELS: "m" };

function sse(chunks: unknown[]): Response {
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}
const text = (t: string) => ({ choices: [{ delta: { content: t } }] });
const call = (index: number, id: string | undefined, name: string | undefined, args: string) => ({
  choices: [{ delta: { tool_calls: [{ index, id, function: { name, arguments: args } }] } }],
});

async function collect(gen: AsyncGenerator<AgentEvent>) {
  const events: AgentEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

describe("runTool", () => {
  it("calculates and reports the step", async () => {
    const out = await runTool("calculator", { expression: "12 * 7" });
    expect(out.result).toBe("84");
    expect(out.step).toMatchObject({ tool: "calculator", ok: true });
  });

  it("only proposes changes to the user's data", async () => {
    const mem = await runTool("save_memory", { fact: "Jay prefers metric units" });
    expect(mem.action).toEqual({
      kind: "save_memory",
      summary: "Remember: “Jay prefers metric units”",
      payload: { fact: "Jay prefers metric units" },
    });
    expect(mem.result).toMatch(/only if they approve/);
    const ws = await runTool("create_workspace", { name: "Trip", instructions: "Plan Japan" });
    expect(ws.action?.payload).toEqual({ name: "Trip", instructions: "Plan Japan" });
    expect((await runTool("save_memory", {})).action).toBeUndefined();
  });

  it("uses injected search and read implementations", async () => {
    const s = await runTool(
      "web_search",
      { query: "aegis" },
      { search: async () => [{ title: "A", url: "https://a.example", snippet: "x" }] },
    );
    expect(s.step?.links).toEqual([{ url: "https://a.example", title: "A" }]);
    const r = await runTool(
      "read_url",
      { url: "http://10.0.0.1" },
      { read: async (url) => ({ url, ok: false, error: "Private address" }) },
    );
    expect(r.step?.ok).toBe(false);
    expect(r.result).toMatch(/Private address/);
  });

  it("handles dates and unknown tools", async () => {
    const d = await runTool("current_datetime", {}, { now: () => new Date("2026-10-09T12:00:00Z") });
    expect(d.result).toBe("2026-10-09T12:00:00.000Z");
    expect((await runTool("rm_rf", {})).result).toMatch(/unknown tool/);
  });

  it("declares a JSON schema for every tool", () => {
    expect(TOOLS.map((t) => t.function.name)).toEqual([
      "web_search",
      "read_url",
      "calculator",
      "current_datetime",
      "save_memory",
      "create_workspace",
    ]);
  });
});

describe("runAgent", () => {
  it("runs streamed tool calls and feeds results back to the model", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      if (bodies.length === 1) {
        // Arguments arrive split across chunks, as real providers send them.
        return sse([
          call(0, "c1", "calculator", '{"expres'),
          call(0, undefined, undefined, 'sion":"6*7"}'),
          call(1, "c2", "save_memory", '{"fact":"likes 42"}'),
        ]);
      }
      return sse([text("The answer is "), text("42.")]);
    }) as unknown as typeof fetch;

    const events = await collect(
      runAgent({ modelId: "custom:m", messages: [{ role: "user", content: "6*7?" }], env: ENV, fetchImpl }),
    );
    expect(events.filter((e) => e.type === "delta").map((e) => (e as { text: string }).text).join("")).toBe(
      "The answer is 42.",
    );
    expect(events.find((e) => e.type === "step")).toMatchObject({ step: { label: "Calculated 6*7 = 42" } });
    const action = events.find((e) => e.type === "action");
    expect(action).toMatchObject({ action: { kind: "save_memory", status: "pending" } });

    expect(bodies[0].tools).toBeDefined();
    const second = bodies[1].messages as { role: string; tool_call_id?: string; content: string }[];
    expect(second.at(-3)).toMatchObject({ role: "assistant" });
    expect(second.at(-2)).toEqual({ role: "tool", tool_call_id: "c1", content: "42" });
    expect(second.at(-1)).toMatchObject({ role: "tool", tool_call_id: "c2" });
  });

  it("falls back to plain chat when the model rejects tools", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      if (body.tools) return new Response('{"error":"tools not supported"}', { status: 400 });
      return sse([text("plain answer")]);
    }) as unknown as typeof fetch;
    const events = await collect(
      runAgent({ modelId: "custom:m", messages: [{ role: "user", content: "hi" }], env: ENV, fetchImpl }),
    );
    expect(events[0]).toMatchObject({ type: "step", step: { ok: false } });
    expect(events.at(-1)).toEqual({ type: "delta", text: "plain answer" });
    expect(bodies).toHaveLength(2);
  });

  it("stops offering tools after the round limit", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      return body.tools ? sse([call(0, "c", "current_datetime", "{}")]) : sse([text("done")]);
    }) as unknown as typeof fetch;
    const events = await collect(
      runAgent({ modelId: "custom:m", messages: [{ role: "user", content: "loop" }], env: ENV, fetchImpl }),
    );
    expect(bodies).toHaveLength(6);
    expect(bodies.at(-1)?.tools).toBeUndefined();
    expect(events.at(-1)).toEqual({ type: "delta", text: "done" });
  });

  it("explains that the demo model can't use tools", async () => {
    const events = await collect(runAgent({ modelId: "demo:aegis-demo", messages: [] }));
    expect(events[0]).toMatchObject({ type: "delta" });
  });
});
