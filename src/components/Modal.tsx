"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconX } from "./Icons";

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);

  // Move focus into the dialog, keep Tab inside it, and restore focus on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`animate-fade-up relative outline-none max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-6 shadow-[var(--shadow)] sm:rounded-3xl ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-fg"
            aria-label="Close"
          >
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-fg placeholder:text-faint outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20";

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
