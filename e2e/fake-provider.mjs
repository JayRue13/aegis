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

function toolCalls(res) {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const chunk = (tool_calls) => `data: ${JSON.stringify({ choices: [{ delta: { tool_calls } }] })}\n\n`;
  res.write(chunk([{ index: 0, id: "call_calc", function: { name: "calculator", arguments: '{"expression":' } }]));
  res.write(chunk([{ index: 0, function: { arguments: '"6*7"}' } }]));
  res.write(chunk([{ index: 1, id: "call_mem", function: { name: "save_memory", arguments: '{"fact":"Favorite number is 42"}' } }]));
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
    // Agent mode: first ask for two tools, then answer using their results.
    const tail = body.messages?.at(-1);
    if (body.tools && tail?.role === "user") return toolCalls(res);
    if (tail?.role === "tool") {
      const results = body.messages.filter((m) => m.role === "tool").map((m) => m.content.split("\n")[0]);
      return stream(res, `Agent result: ${results.join(" | ")}`);
    }
    if (system.includes("extract durable facts")) return stream(res, '["User is training to be a pilot"]');
    const remembered = system.includes("What you remember about the user") ? " [memories received]" : "";
    const searched = lastText.includes("Web search results") ? " [search received]" : "";
    const known = system.match(/<knowledge file="([^"]+)">\n([^\n]*)/);
    const knowledge = known ? ` [knowledge: ${known[1]}: ${known[2]}]` : "";
    const moded = system.includes("Research mode") ? " [research mode]" : "";
    stream(res, `Echo: ${lastText.split("\n").pop()}${remembered}${searched}${moded}${knowledge}`);
  });
}).listen(port, "127.0.0.1");
