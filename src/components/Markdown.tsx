"use client";

import { memo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { IconCheck, IconCopy } from "./Icons";

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
  const child = Array.isArray(children) ? children[0] : children;
  const className = (child as { props?: { className?: string } })?.props?.className ?? "";
  const lang = /language-([\w+#-]+)/.exec(className)?.[1];
  return (
    <div className="group/code relative">
      <div className="absolute right-2 top-2 flex items-center gap-2">
        {lang && <span className="text-[11px] uppercase tracking-wider text-faint">{lang}</span>}
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
