// A tiny OpenAI-compatible server used by the browser tests, so the real
// provider code path (not just demo mode) is exercised end to end.
import { createServer } from "node:http";

const port = Number(process.env.FAKE_PROVIDER_PORT ?? 3199);

function stream(res, text) {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  for (const piece of text.match(/.{1,6}/gs) ?? []) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
  }
  res.end("data: [DONE]\n\n");
}

createServer((req, res) => {
  if (req.url === "/v1/health") return res.end("ok");
  if (req.url?.startsWith("/search")) {
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        results: [{ title: "Pilot training basics", url: "https://example.com/pilot", content: "Study weather." }],
      }),
    );
  }
  if (req.url === "/v1/models") {
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ data: [{ id: "echo-1" }] }));
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    const system = body.messages?.[0]?.content ?? "";
    const last = [...(body.messages ?? [])].reverse().find((m) => m.role === "user");
    const lastText = typeof last?.content === "string" ? last.content : "";
    if (system.includes("extract durable facts")) return stream(res, '["User is training to be a pilot"]');
    const remembered = system.includes("What you remember about the user") ? " [memories received]" : "";
    const searched = lastText.includes("Web search results") ? " [search received]" : "";
    const moded = system.includes("Research mode") ? " [research mode]" : "";
    stream(res, `Echo: ${lastText.split("\n").pop()}${remembered}${searched}${moded}`);
  });
}).listen(port, "127.0.0.1");
