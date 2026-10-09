"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";
import { Modal, buttonClass, inputClass } from "./Modal";

export function ProjectDialog({
  project,
  onSave,
  onDelete,
  onClose,
}: {
  project: Project | null;
  onSave: (name: string, instructions: string) => void;
  onDelete?: () => void;
  onClose: () => void;
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
