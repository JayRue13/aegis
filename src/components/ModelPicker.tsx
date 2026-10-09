"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ModelInfo } from "@/lib/types";
import { IconCheck, IconChevron, IconSearch } from "./Icons";
import { cn } from "@/lib/util";

const PROVIDER_LABEL: Record<string, string> = {
  openrouter: "OpenRouter",
  groq: "Groq",
  gemini: "Gemini",
  ollama: "Ollama",
  custom: "Custom",
  demo: "Demo",
};

export function ModelPicker({
  models,
  value,
  onChange,
  disabled,
}: {
  models: ModelInfo[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const current = models.find((m) => m.id === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const groups = useMemo(() => {
    const needle = q.toLowerCase();
    const map = new Map<string, ModelInfo[]>();
    for (const m of models) {
      if (needle && !m.id.toLowerCase().includes(needle) && !m.label.toLowerCase().includes(needle)) continue;
      map.set(m.provider, [...(map.get(m.provider) ?? []), m]);
    }
    return [...map.entries()];
  }, [models, q]);

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        disabled={disabled || models.length === 0}
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-50 sm:max-w-xs"
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="model-picker"
      >
        <span className="truncate">{current ? current.label : models.length ? "Choose model" : "No models"}</span>
        <IconChevron width={14} height={14} className={cn("shrink-0 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="animate-fade-up absolute bottom-full left-0 z-30 mb-2 w-[min(22rem,85vw)] overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
          {models.length > 8 && (
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <IconSearch width={15} height={15} className="text-faint" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search models"
                className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
              />
            </div>
          )}
          <div className="max-h-80 overflow-y-auto p-1.5" role="listbox">
            {groups.map(([provider, list]) => (
              <div key={provider} className="mb-1">
                <div className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-faint">
                  {PROVIDER_LABEL[provider] ?? provider}
                </div>
                {list.map((m) => (
                  <button
                    key={m.id}
                    role="option"
                    aria-selected={m.id === value}
                    onClick={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition hover:bg-surface-2",
                      m.id === value && "bg-surface-2",
                    )}
                  >
                    <span className="truncate">{m.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {m.vision && (
                        <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">vision</span>
                      )}
                      {m.id === value && <IconCheck width={15} height={15} className="text-accent" />}
                    </span>
                  </button>
                ))}
              </div>
            ))}
            {groups.length === 0 && <div className="px-3 py-6 text-center text-sm text-faint">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}
