"use client";

import { useState } from "react";
import type { Memory } from "@/lib/types";
import { Modal, buttonClass, inputClass } from "./Modal";
import { IconTrash } from "./Icons";

export function MemoryPanel({
  memories,
  onAdd,
  onDelete,
  onClose,
}: {
  memories: Memory[];
  onAdd: (text: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <Modal title="Memory" onClose={onClose}>
      <p className="mb-4 text-sm text-muted">
        AEGIS includes the most relevant of these facts in every conversation. You can also say{" "}
        <em className="text-fg">“remember that …”</em> in any chat.
      </p>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) {
            onAdd(draft.trim());
            setDraft("");
          }
        }}
      >
        <input
          className={inputClass}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. I study computer science"
          maxLength={1000}
          aria-label="New memory"
        />
        <button className={`${buttonClass} btn-accent shrink-0`} disabled={!draft.trim()}>
          Add
        </button>
      </form>
      <ul className="space-y-1.5" data-testid="memory-list">
        {memories.map((m) => (
          <li
            key={m.id}
            className="group flex items-start gap-3 rounded-xl border border-line bg-surface-2/50 px-3.5 py-2.5 text-sm"
          >
            <span className="flex-1">{m.content}</span>
            <button
              onClick={() => onDelete(m.id)}
              className="rounded-md p-1 text-faint transition hover:text-danger"
              aria-label="Forget this"
            >
              <IconTrash width={15} height={15} />
            </button>
          </li>
        ))}
        {memories.length === 0 && <li className="py-6 text-center text-sm text-faint">Nothing remembered yet.</li>}
      </ul>
    </Modal>
  );
}
