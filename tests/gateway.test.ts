import { describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { describeHttpError, GatewayError, streamCompletion, toEventStream } from "@/lib/server/gateway";
import { parseNdjson } from "@/lib/chat-client";

async function collect(gen: AsyncGenerator<string>) {
  let s = "";
  for await (const t of gen) s += t;
  return s;
}

/** Starts a fake OpenAI-compatible server on a random port. */
async function fakeProvider(handler: (body: Record<string, unknown>, res: import("node:http").ServerResponse) => void) {
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => handler(JSON.parse(raw || "{}"), res));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

describe("streamCompletion", () => {
  it("streams from an OpenAI-compatible endpoint end to end", async () => {
    let seen: Record<string, unknown> = {};
    const fake = await fakeProvider((body, res) => {
      seen = body;
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n');
      res.write('data: {"choices":[{"delta":{"content":", Jay"}}]}\n\n');
      res.end("data: [DONE]\n\n");
    });
    try {
      const text = await collect(
        streamCompletion({
          modelId: "custom:my-model",
          messages: [{ role: "user", content: "hi" }],
          env: { CUSTOM_OPENAI_BASE_URL: fake.url, CUSTOM_OPENAI_MODELS: "my-model" },
        }),
      );
      expect(text).toBe("Hello, Jay");
      expect(seen.model).toBe("my-model");
      expect(seen.stream).toBe(true);
    } finally {
      await fake.close();
    }
  });

  it("turns HTTP errors into readable GatewayErrors", async () => {
    const fake = await fakeProvider((_b, res) => {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end('{"error":{"message":"invalid key"}}');
    });
    try {
      await expect(
        collect(streamCompletion({ modelId: "custom:m", messages: [], env: { CUSTOM_OPENAI_BASE_URL: fake.url } })),
      ).rejects.toThrow(/rejected the API key/);
    } finally {
      await fake.close();
    }
  });

  it("rejects unknown providers", async () => {
    await expect(collect(streamCompletion({ modelId: "nope:x", messages: [], env: {} }))).rejects.toBeInstanceOf(
      GatewayError,
    );
  });

  it("serves the demo model without any configuration", async () => {
    const text = await collect(
      streamCompletion({ modelId: "demo:aegis-demo", messages: [{ role: "user", content: "ping" }], env: {} }),
    );
    expect(text).toContain("ping");
    expect(text).toContain("demo mode");
  });
});

describe("toEventStream", () => {
  it("encodes deltas, then done", async () => {
    async function* gen() {
      yield "a";
      yield "b";
    }
    const text = await new Response(toEventStream(gen())).text();
    expect(parseNdjson(text).events).toEqual([
      { type: "delta", text: "a" },
      { type: "delta", text: "b" },
      { type: "done" },
    ]);
  });

  it("encodes a mid-stream failure as an error event", async () => {
    async function* gen(): AsyncGenerator<string> {
      yield "partial";
      throw new Error("boom");
    }
    const { events } = parseNdjson(await new Response(toEventStream(gen())).text());
    expect(events.at(-1)).toEqual({ type: "error", message: "boom" });
  });
});

describe("describeHttpError", () => {
  it("explains common statuses", () => {
    expect(describeHttpError("Groq", 429, "")).toMatch(/rate limit/);
    expect(describeHttpError("Groq", 404, '{"error":{"message":"no such model"}}')).toMatch(/no such model/);
    expect(describeHttpError("Groq", 500, "oops")).toBe("Groq error 500: oops");
  });
});
