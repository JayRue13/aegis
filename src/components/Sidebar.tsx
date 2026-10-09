"use client";

import { useMemo, useState } from "react";
import type { Conversation, Project } from "@/lib/types";
import { cn, recencyGroup } from "@/lib/util";
import { Logo } from "./Logo";
import {
  IconBrain,
  IconEdit,
  IconFolder,
  IconPin,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTrash,
  IconUser,
  IconX,
} from "./Icons";

export function Sidebar({
  conversations,
  projects,
  activeId,
  activeProjectId,
  matchedIds,
  search,
  onSearch,
  onSelect,
  onNew,
  onDelete,
  onTogglePin,
  onRename,
  onSelectProject,
  onEditProject,
  onNewProject,
  onOpenMemory,
  onOpenSettings,
  accountLabel,
  storageLabel,
  onClose,
}: {
  conversations: Conversation[];
  projects: Project[];
  activeId: string | null;
  activeProjectId: string | null;
  matchedIds: Set<string> | null;
  search: string;
  onSearch: (q: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onTogglePin: (c: Conversation) => void;
  onRename: (c: Conversation, title: string) => void;
  onSelectProject: (id: string | null) => void;
  onEditProject: (p: Project) => void;
  onNewProject: () => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  accountLabel: string;
  storageLabel: string;
  onClose?: () => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (activeProjectId && c.projectId !== activeProjectId) return false;
      if (!q) return true;
      return c.title.toLowerCase().includes(q) || matchedIds?.has(c.id);
    });
  }, [conversations, activeProjectId, search, matchedIds]);

  const groups = useMemo(() => {
    const out: [string, Conversation[]][] = [];
    const pinned = visible.filter((c) => c.pinned);
    if (pinned.length) out.push(["Pinned", pinned]);
    const map = new Map<string, Conversation[]>();
    for (const c of visible.filter((c) => !c.pinned)) {
      const g = recencyGroup(c.updatedAt);
      map.set(g, [...(map.get(g) ?? []), c]);
    }
    return [...out, ...map.entries()];
  }, [visible]);

  return (
    <aside className="flex h-full w-full flex-col bg-surface/70 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-center gap-2.5">
          <Logo size={26} />
          <span className="text-[15px] font-semibold tracking-[0.18em]">AEGIS</span>
        </div>
        {onClose && (
          <button
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 md:hidden"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <IconX />
          </button>
        )}
      </div>

      <div className="space-y-2 px-3 pt-2">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-sm font-medium transition hover:border-line-strong hover:bg-surface-2"
          data-testid="new-chat"
        >
          <IconPlus width={16} height={16} /> New chat
          <kbd className="ml-auto hidden text-[11px] text-faint sm:inline">Ctrl K</kbd>
        </button>
        <label className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition focus-within:bg-surface-2 hover:bg-surface-2/60">
          <IconSearch width={15} height={15} />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search chats"
            className="w-full bg-transparent outline-none placeholder:text-faint"
            aria-label="Search chats"
          />
        </label>
      </div>

      <div className="mt-3 px-3">
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-faint">Workspaces</span>
          <button
            onClick={onNewProject}
            className="rounded-md p-1 text-faint hover:bg-surface-2 hover:text-fg"
            aria-label="New workspace"
          >
            <IconPlus width={14} height={14} />
          </button>
        </div>
        <button
          onClick={() => onSelectProject(null)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition hover:bg-surface-2",
            activeProjectId === null ? "text-fg" : "text-muted",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-accent to-accent-2" /> All chats
        </button>
        {projects.map((p) => (
          <div key={p.id} className="group flex items-center">
            <button
              onClick={() => onSelectProject(p.id)}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition hover:bg-surface-2",
                activeProjectId === p.id ? "bg-surface-2 text-fg" : "text-muted",
              )}
            >
              <IconFolder width={15} height={15} className="shrink-0" />
              <span className="truncate">{p.name}</span>
            </button>
            <button
              onClick={() => onEditProject(p)}
              className="rounded-md p-1 text-faint opacity-0 transition hover:text-fg group-hover:opacity-100"
              aria-label={`Edit ${p.name}`}
            >
              <IconEdit width={14} height={14} />
            </button>
          </div>
        ))}
      </div>

      <nav className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3" aria-label="Conversations">
        {groups.map(([label, items]) => (
          <div key={label} className="mb-3">
            <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-faint">{label}</div>
            {items.map((c) =>
              renaming === c.id ? (
                <input
                  key={c.id}
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={() => {
                    if (renameDraft.trim()) onRename(c, renameDraft.trim());
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  className="w-full rounded-lg border border-accent/50 bg-surface-2 px-2.5 py-1.5 text-sm outline-none"
                />
              ) : (
                <div
                  key={c.id}
                  className={cn(
                    "group relative flex items-center rounded-lg transition",
                    c.id === activeId ? "bg-surface-3" : "hover:bg-surface-2",
                  )}
                >
                  <button
                    onClick={() => onSelect(c.id)}
                    onDoubleClick={() => {
                      setRenameDraft(c.title);
                      setRenaming(c.id);
                    }}
                    className={cn(
                      "min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm",
                      c.id === activeId ? "text-fg" : "text-muted",
                    )}
                    title={c.title}
                  >
                    {c.title}
                  </button>
                  <div className="absolute right-1 hidden items-center gap-0.5 rounded-md bg-surface-2 group-hover:flex">
                    <IconAction label={c.pinned ? "Unpin" : "Pin"} onClick={() => onTogglePin(c)}>
                      <IconPin width={14} height={14} />
                    </IconAction>
                    <IconAction
                      label="Rename"
                      onClick={() => {
                        setRenameDraft(c.title);
                        setRenaming(c.id);
                      }}
                    >
                      <IconEdit width={14} height={14} />
                    </IconAction>
                    <IconAction label="Delete" onClick={() => onDelete(c.id)}>
                      <IconTrash width={14} height={14} />
                    </IconAction>
                  </div>
                </div>
              ),
            )}
          </div>
        ))}
        {visible.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-faint">{search ? "No chats match." : "No chats yet."}</p>
        )}
      </nav>

      <div className="border-t border-line px-3 py-3">
        <button
          onClick={onOpenMemory}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-fg"
        >
          <IconBrain width={16} height={16} /> Memory
        </button>
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-fg"
          data-testid="open-settings"
        >
          <IconSettings width={16} height={16} /> Settings
        </button>
        <div className="mt-1 flex items-center gap-2.5 px-2.5 py-2 text-xs text-faint">
          <IconUser width={15} height={15} />
          <span className="truncate">{accountLabel}</span>
          <span className="ml-auto shrink-0 rounded-md border border-line px-1.5 py-0.5">{storageLabel}</span>
        </div>
      </div>
    </aside>
  );
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={label}
      aria-label={label}
      className="rounded-md p-1 text-faint transition hover:bg-surface-3 hover:text-fg"
    >
      {children}
    </button>
  );
}
