// Runs JavaScript from a chat reply in a sandbox: a hidden iframe with an
// opaque origin (sandbox="allow-scripts") whose own CSP blocks all network
// access, and inside it a Worker so an endless loop can be stopped without
// freezing the page. The code never sees AEGIS's storage, cookies or APIs.

export interface RunLog {
  level: "log" | "info" | "warn" | "error" | "debug";
  text: string;
}

export interface RunResult {
  logs: RunLog[];
  error?: string;
  timedOut?: boolean;
  truncated?: boolean;
}

const MAX_LINES = 200;
const MAX_CHARS = 20_000;

/** Languages the Run button accepts. */
export function isRunnable(lang: string | undefined): boolean {
  return !!lang && ["js", "javascript", "mjs"].includes(lang.toLowerCase());
}

// Prelude for the worker: route console output to the iframe, then run the
// user's code inside an async function so top-level await works.
const PRELUDE = `
const fmt = (v) => {
  if (typeof v === "string") return v;
  if (v instanceof Error) return v.stack || String(v);
  try { const s = JSON.stringify(v, null, 2); return s === undefined ? String(v) : s; } catch { return String(v); }
};
for (const level of ["log", "info", "warn", "error", "debug"]) {
  console[level] = (...args) => postMessage({ type: "log", level, text: args.map(fmt).join(" ") });
}
`;

/** Builds the worker script. Exported for tests. */
export function workerSource(code: string): string {
  return `${PRELUDE}
(async () => {
${code}
})().then(
  () => postMessage({ type: "done" }),
  (e) => postMessage({ type: "error", text: (e && e.stack) || String(e) }),
);
`;
}

/** The sandboxed iframe document. It runs one worker and relays its messages. */
export function frameDocument(timeoutMs: number): string {
  return `<!doctype html><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:">
<script>
addEventListener("message", (e) => {
  if (e.source !== parent) return;
  const send = (m) => parent.postMessage(m, "*");
  let worker;
  try {
    worker = new Worker(URL.createObjectURL(new Blob([e.data], { type: "text/javascript" })));
  } catch (err) {
    return send({ type: "error", text: String(err) });
  }
  const timer = setTimeout(() => { worker.terminate(); send({ type: "timeout" }); }, ${timeoutMs});
  worker.onmessage = (m) => {
    send(m.data);
    if (m.data.type === "done" || m.data.type === "error") { clearTimeout(timer); worker.terminate(); }
  };
  worker.onerror = (err) => {
    err.preventDefault();
    clearTimeout(timer);
    worker.terminate();
    send({ type: "error", text: err.message || "Script error" });
  };
}, { once: true });
</script>`;
}

export function runJavaScript(code: string, { timeoutMs = 5000 }: { timeoutMs?: number } = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const result: RunResult = { logs: [] };
    let chars = 0;
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.display = "none";
    frame.srcdoc = frameDocument(timeoutMs);

    const finish = () => {
      clearTimeout(backstop);
      window.removeEventListener("message", onMessage);
      frame.remove();
      resolve(result);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow) return;
      const m = e.data as { type?: string; level?: RunLog["level"]; text?: string };
      if (m.type === "log") {
        const text = String(m.text ?? "");
        if (result.logs.length >= MAX_LINES || chars + text.length > MAX_CHARS) {
          result.truncated = true;
          return;
        }
        chars += text.length;
        result.logs.push({ level: m.level ?? "log", text });
      } else if (m.type === "error") {
        result.error = String(m.text ?? "Error");
        finish();
      } else if (m.type === "timeout") {
        result.timedOut = true;
        finish();
      } else if (m.type === "done") {
        finish();
      }
    };
    // In case the frame never answers (for example, blocked by a browser policy).
    const backstop = setTimeout(() => {
      result.timedOut = true;
      finish();
    }, timeoutMs + 2000);

    window.addEventListener("message", onMessage);
    frame.addEventListener("load", () => frame.contentWindow?.postMessage(workerSource(code), "*"), { once: true });
    document.body.appendChild(frame);
  });
}
