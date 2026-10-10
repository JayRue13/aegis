"use client";

import { memo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { IconCheck, IconCopy } from "./Icons";
import { isRunnable, runJavaScript, type RunResult } from "@/lib/runjs";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunResult | null>(null);
  const child = Array.isArray(children) ? children[0] : children;
  const className = (child as { props?: { className?: string } })?.props?.className ?? "";
  const lang = /language-([\w+#-]+)/.exec(className)?.[1];
  return (
    <div className="group/code relative">
      <div className="absolute right-2 top-2 flex items-center gap-2">
        {lang && <span className="text-[11px] uppercase tracking-wider text-faint">{lang}</span>}
        {isRunnable(lang) && (
          <button
            type="button"
            className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs text-muted transition hover:text-fg disabled:opacity-60 print:hidden"
            disabled={running}
            title="Run in a sandbox in your browser (no network, 5 second limit)"
            onClick={async () => {
              setRunning(true);
              setRun(await runJavaScript(textOf(children)));
              setRunning(false);
            }}
          >
            {running ? "Running…" : "Run"}
          </button>
        )}
        <button
          type="button"
          className="rounded-md border border-line bg-surface-2 p-1 text-muted opacity-0 transition group-hover/code:opacity-100 hover:text-fg focus:opacity-100"
          aria-label="Copy code"
          onClick={() => {
            navigator.clipboard?.writeText(textOf(children)).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
        </button>
      </div>
      <pre>{children}</pre>
      {run && (
        <output
          aria-label="Code output"
          className="-mt-2 mb-3 block max-h-72 overflow-auto rounded-b-xl border border-t-0 border-line bg-surface-2 px-3.5 py-2.5 font-mono text-xs whitespace-pre-wrap"
        >
          {run.logs.map((l, i) => (
            <div
              key={i}
              className={l.level === "error" ? "text-danger" : l.level === "warn" ? "text-muted" : undefined}
            >
              {l.text}
            </div>
          ))}
          {run.truncated && <div className="text-faint">…output truncated</div>}
          {run.error && <div className="text-danger">{run.error}</div>}
          {run.timedOut && <div className="text-danger">Stopped after 5 seconds.</div>}
          {!run.logs.length && !run.error && !run.timedOut && <div className="text-faint">(no output)</div>}
        </output>
      )}
    </div>
  );
}

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-aegis">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: CodeBlock,
          // Never auto-load images from model output: a prompt-injected page
          // could otherwise smuggle data out through an image URL.
          img: ({ src, alt }) =>
            typeof src === "string" && /^https?:/.test(src) ? (
              <a href={src} target="_blank" rel="noopener noreferrer">
                🖼 {alt || "image"}
              </a>
            ) : null,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
