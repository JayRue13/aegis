"use client";

import { useState } from "react";
import type { KnowledgeFile, Project } from "@/lib/types";
import { Modal, buttonClass, inputClass } from "./Modal";

export function ProjectDialog({
  project,
  onSave,
  onDelete,
  onClose,
  knowledge,
  knowledgeBusy = false,
  onAddKnowledge,
  onDeleteKnowledge,
}: {
  project: Project | null;
  onSave: (name: string, instructions: string) => void;
  onDelete?: () => void;
  onClose: () => void;
  /** Knowledge files of an existing workspace (undefined while loading or for a new one). */
  knowledge?: KnowledgeFile[];
  knowledgeBusy?: boolean;
  onAddKnowledge?: (files: File[]) => void;
  onDeleteKnowledge?: (file: KnowledgeFile) => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [instructions, setInstructions] = useState(project?.instructions ?? "");
  return (
    <Modal title={project ? "Edit workspace" : "New workspace"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim(), instructions);
        }}
      >
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Name</span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Thesis, Startup, Spanish practice"
            maxLength={200}
            autoFocus
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Instructions</span>
          <textarea
            className={`${inputClass} min-h-36 resize-y`}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Context and preferences AEGIS should apply to every chat in this workspace."
            maxLength={20000}
          />
        </label>
        {project && onAddKnowledge ? (
          <section className="space-y-2" aria-labelledby="knowledge-heading">
            <div className="flex items-center justify-between gap-3">
              <h3 id="knowledge-heading" className="text-sm font-medium">
                Knowledge files
              </h3>
              <label className={`${buttonClass} cursor-pointer border border-line text-muted hover:bg-surface-2`}>
                Add files
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  aria-label="Add knowledge files"
                  accept=".txt,.md,.markdown,.csv,.json,.pdf,.docx,.html,.xml,.yaml,.yml,text/*"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (files.length) onAddKnowledge(files);
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-muted">
              AEGIS reads the most relevant parts of these files in every chat in this workspace. Text, Markdown,
              PDF and Word files work.
            </p>
            <ul className="space-y-1.5" data-testid="knowledge-list">
              {knowledge?.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">{f.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-faint">
                    {Math.max(1, Math.round(f.text.length / 1000))}k chars
                    <button
                      type="button"
                      onClick={() => onDeleteKnowledge?.(f)}
                      className="rounded-lg px-2 py-1 text-muted hover:bg-surface-2 hover:text-danger"
                      aria-label={`Remove ${f.name}`}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
              {knowledge && knowledge.length === 0 && !knowledgeBusy && (
                <li className="text-xs text-faint">No files yet.</li>
              )}
            </ul>
            {(knowledgeBusy || !knowledge) && (
              <p className="text-xs text-muted" role="status">
                {knowledgeBusy ? "Reading files…" : "Loading…"}
              </p>
            )}
          </section>
        ) : (
          !project && <p className="text-xs text-muted">Save the workspace, then open it again to add knowledge files.</p>
        )}
        <div className="flex items-center justify-between pt-1">
          {onDelete ? (
            <button type="button" onClick={onDelete} className={`${buttonClass} text-danger hover:bg-danger/10`}>
              Delete workspace
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={`${buttonClass} text-muted hover:bg-surface-2`}>
              Cancel
            </button>
            <button className={`${buttonClass} btn-accent`} disabled={!name.trim()}>
              Save
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
