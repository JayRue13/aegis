"use client";

import { useState } from "react";
import type { AgentAction, ChatMessage } from "@/lib/types";
import { Markdown } from "./Markdown";
import { Logo } from "./Logo";
import { IconCheck, IconCopy, IconEdit, IconFile, IconRefresh, IconSpeaker, IconStop } from "./Icons";
import { cn, hostOf } from "@/lib/util";

export function MessageItem({
  message,
  streaming,
  isLast,
  modelLabel,
  onRegenerate,
  onEdit,
  onDecide,
}: {
  message: ChatMessage;
  streaming: boolean;
  isLast: boolean;
  modelLabel?: string;
  onRegenerate?: () => void;
  onEdit?: (text: string) => void;
  onDecide?: (action: AgentAction, approve: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const speak = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const plain = message.content
      .replace(/```[\s\S]*?```/g, " (code omitted) ")
      .replace(/[#*_`>|]/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1");
    const u = new SpeechSynthesisUtterance(plain);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const isUser = message.role === "user";

  const copy = () =>
    navigator.clipboard?.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });

  if (isUser) {
    return (
      <div className="group animate-fade-up flex flex-col items-end gap-1.5" data-role="user">
        {(message.images?.length || message.files?.length) && (
          <div className="flex max-w-[85%] flex-wrap justify-end gap-2">
            {message.images?.map((img, i) =>
              img.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={img.dataUrl}
                  alt={img.name ?? "attached image"}
                  className="h-28 w-28 rounded-xl border border-line object-cover"
                />
              ) : (
                <span key={i} className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-muted">
                  🖼 {img.name ?? "image"}
                </span>
              ),
            )}
            {message.files?.map((f, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-muted"
              >
                <IconFile width={14} height={14} /> {f.name}
              </span>
            ))}
          </div>
        )}
        {editing ? (
          <div className="w-full max-w-[85%]">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-24 w-full resize-y rounded-2xl border border-accent/40 bg-surface-2 px-4 py-3 text-[0.95rem] outline-none"
              autoFocus
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface-2"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                className="btn-accent rounded-lg px-3 py-1.5 text-sm font-medium"
                onClick={() => {
                  setEditing(false);
                  if (draft.trim() && onEdit) onEdit(draft.trim());
                }}
              >
                Save & send
              </button>
            </div>
          </div>
        ) : (
          message.content && (
            <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-surface-3 px-4 py-2.5 text-[0.95rem] leading-relaxed">
              {message.content}
            </div>
          )
        )}
        {!editing && (
          <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 print:hidden">
            <ActionButton label={copied ? "Copied" : "Copy"} onClick={copy}>
              {copied ? <IconCheck width={15} height={15} /> : <IconCopy width={15} height={15} />}
            </ActionButton>
            {onEdit && !streaming && (
              <ActionButton
                label="Edit"
                onClick={() => {
                  setDraft(message.content);
                  setEditing(true);
                }}
              >
                <IconEdit width={15} height={15} />
              </ActionButton>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="group animate-fade-up flex gap-3.5" data-role="assistant">
      <div className="mt-0.5 shrink-0">
        <Logo size={24} animated={streaming && !message.content} />
      </div>
      <div className="min-w-0 flex-1">
        {message.sources && message.sources.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5" data-testid="sources">
            {message.sources.map((src) => (
              <a
                key={src.url}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                title={src.ok ? src.url : `${src.url}: ${src.error}`}
                className={cn(
                  "flex max-w-64 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition hover:bg-surface-2",
                  src.ok
                    ? "border-line text-muted"
                    : "border-danger/30 text-danger/80 line-through decoration-danger/40",
                )}
              >
                <span className="truncate">{src.ok ? `Read: ${src.title ?? hostOf(src.url)}` : hostOf(src.url)}</span>
              </a>
            ))}
          </div>
        )}
        {message.steps && message.steps.length > 0 && (
          <ul className="mb-2 space-y-1 text-xs text-muted" data-testid="agent-steps" aria-label="Tools used">
            {message.steps.map((step, i) => (
              <li key={i} className="flex flex-wrap items-center gap-1.5">
                <span aria-hidden="true" className={step.ok ? "text-accent" : "text-danger"}>
                  {step.ok ? "✓" : "!"}
                </span>
                <span>{step.label}</span>
                {step.links?.slice(0, 5).map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="max-w-48 truncate rounded-full border border-line px-2 py-0.5 hover:bg-surface-2"
                  >
                    {l.title || hostOf(l.url)}
                  </a>
                ))}
              </li>
            ))}
          </ul>
        )}
        {message.error ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
            {message.content}
          </div>
        ) : message.content ? (
          <div className={cn(streaming && "is-streaming")}>
            <Markdown text={message.content} />
          </div>
        ) : !streaming && message.actions?.length ? null : (
          <div className="flex h-7 items-center text-sm text-faint">Thinking…</div>
        )}
        {message.actions?.map((action) => (
          <div
            key={action.id}
            className="mt-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm"
            data-testid="agent-action"
            role="group"
            aria-label="Proposed change"
          >
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">AEGIS wants to</div>
            <div className="mb-3">{action.summary}</div>
            {action.kind === "create_workspace" && action.payload.instructions && (
              <p className="mb-3 line-clamp-3 text-xs text-muted">{action.payload.instructions}</p>
            )}
            {action.status === "pending" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={streaming || !onDecide}
                  onClick={() => onDecide?.(action, true)}
                  className="btn-accent rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={streaming || !onDecide}
                  onClick={() => onDecide?.(action, false)}
                  className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface-3 disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <div className="text-xs text-muted" role="status">
                {action.status === "approved" ? "✓ Approved" : "Dismissed"}
              </div>
            )}
          </div>
        ))}
        {!streaming && message.content && (
          <div className="mt-2 flex items-center gap-1 opacity-60 transition group-hover:opacity-100 print:hidden">
            <ActionButton label={copied ? "Copied" : "Copy"} onClick={copy}>
              {copied ? <IconCheck width={15} height={15} /> : <IconCopy width={15} height={15} />}
            </ActionButton>
            {canSpeak && (
              <ActionButton label={speaking ? "Stop reading" : "Read aloud"} onClick={speak}>
                {speaking ? <IconStop width={15} height={15} /> : <IconSpeaker width={15} height={15} />}
              </ActionButton>
            )}
            {isLast && onRegenerate && (
              <ActionButton label="Regenerate" onClick={onRegenerate}>
                <IconRefresh width={15} height={15} />
              </ActionButton>
            )}
            {modelLabel && <span className="ml-2 text-xs text-faint">{modelLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-fg"
    >
      {children}
    </button>
  );
}
