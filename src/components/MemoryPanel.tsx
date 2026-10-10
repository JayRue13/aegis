"use client";

import { useState } from "react";
import type { Memory } from "@/lib/types";
import { Modal, buttonClass, inputClass } from "./Modal";
import { IconEdit, IconTrash } from "./Icons";

/** Show the filter box once the list is long enough to need one. */
const FILTER_AT = 6;

export function MemoryPanel({
  memories,
  onAdd,
  onEdit,
  onDelete,
  onClose,
}: {
  memories: Memory[];
  onAdd: (text: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const q = filter.trim().toLowerCase();
  const shown = q ? memories.filter((m) => m.content.toLowerCase().includes(q)) : memories;

  const saveEdit = () => {
    if (!editing) return;
    const text = editing.text.trim();
    const original = memories.find((m) => m.id === editing.id)?.content;
    if (text && text !== original) onEdit(editing.id, text);
    setEditing(null);
  };

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
      {memories.length >= FILTER_AT && (
        <input
          type="search"
          className={`${inputClass} mb-3`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${memories.length} memories`}
          aria-label="Filter memories"
        />
      )}
      <ul className="space-y-1.5" data-testid="memory-list">
        {shown.map((m) =>
          editing?.id === m.id ? (
            <li key={m.id} className="rounded-xl border border-accent/60 bg-surface-2/50 p-2">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEdit();
                }}
              >
                <input
                  className={inputClass}
                  value={editing.text}
                  onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      // Cancel the edit without closing the dialog.
                      e.stopPropagation();
                      setEditing(null);
                    }
                  }}
                  maxLength={1000}
                  aria-label="Edit memory"
                  autoFocus
                />
                <button className={`${buttonClass} btn-accent shrink-0`} disabled={!editing.text.trim()}>
                  Save
                </button>
                <button
                  type="button"
                  className={`${buttonClass} shrink-0 border border-line hover:bg-surface-2`}
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </form>
            </li>
          ) : (
            <li
              key={m.id}
              className="group flex items-start gap-1 rounded-xl border border-line bg-surface-2/50 py-2.5 pr-2 pl-3.5 text-sm"
            >
              <span className="flex-1 pr-2">{m.content}</span>
              <button
                onClick={() => setEditing({ id: m.id, text: m.content })}
                className="rounded-md p-1 text-faint transition hover:text-fg"
                aria-label={`Edit “${m.content.slice(0, 40)}”`}
              >
                <IconEdit width={15} height={15} />
              </button>
              <button
                onClick={() => onDelete(m.id)}
                className="rounded-md p-1 text-faint transition hover:text-danger"
                aria-label="Forget this"
              >
                <IconTrash width={15} height={15} />
              </button>
            </li>
          ),
        )}
        {memories.length === 0 && <li className="py-6 text-center text-sm text-faint">Nothing remembered yet.</li>}
        {memories.length > 0 && shown.length === 0 && (
          <li className="py-6 text-center text-sm text-faint">No memories match “{filter.trim()}”.</li>
        )}
      </ul>
    </Modal>
  );
}
