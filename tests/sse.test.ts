import { describe, expect, it } from "vitest";
import { parseSseData, readSse } from "@/lib/server/sse";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

describe("parseSseData", () => {
  it("parses deltas, done and errors", () => {
    expect(parseSseData('{"choices":[{"delta":{"content":"Hi"}}]}')).toEqual({ text: "Hi" });
    expect(parseSseData("[DONE]")).toEqual({ done: true });
    expect(parseSseData('{"error":{"message":"bad"}}')).toEqual({ error: "bad" });
    expect(parseSseData('{"choices":[{"delta":{"role":"assistant"}}]}')).toBeNull();
    expect(parseSseData("not json")).toBeNull();
  });
});

describe("readSse", () => {
  it("handles events split across chunks", async () => {
    const s = streamOf([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choi',
      'ces":[{"delta":{"content":"lo"}}]}\r\n\r\n: keep-alive\n\n',
      "data: [DONE]\n\n",
      'data: {"choices":[{"delta":{"content":"ignored"}}]}\n\n',
    ]);
    const out = [];
    for await (const d of readSse(s)) out.push(d);
    expect(out).toEqual([{ text: "Hel" }, { text: "lo" }, { done: true }]);
  });
});
