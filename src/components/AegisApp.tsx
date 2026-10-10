"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AgentAction, ChatMessage, Conversation, Memory, ModelInfo, Project } from "@/lib/types";
import type { ChatStore } from "@/lib/store/types";
import { exportAll, importAll, type Backup } from "@/lib/store/types";
import { LocalStore } from "@/lib/store/local";
import { SupabaseStore } from "@/lib/store/supabase";
import { getSupabase } from "@/lib/supabase-client";
import { ChatRequestError, extractDocument, streamChat } from "@/lib/chat-client";
import { extractRememberRequest } from "@/lib/memory";
import { cn, deriveTitle, nowIso, uid } from "@/lib/util";
import { Sidebar } from "./Sidebar";
import { MessageItem } from "./MessageItem";
import { Composer, type ComposerSubmit } from "./Composer";
import { MemoryPanel } from "./MemoryPanel";
import { UsagePanel } from "./UsagePanel";
import { fetchUsage } from "@/lib/usage";
import { ProjectDialog } from "./ProjectDialog";
import { SettingsPanel, type Health, type Theme } from "./SettingsPanel";
import { Logo } from "./Logo";
import { IconDownload, IconMenu, IconPlus } from "./Icons";
import { conversationToMarkdown, safeFilename } from "@/lib/export";
import { worthLearning } from "@/lib/learn";

const PREF = {
  model: "aegis:model",
  theme: "aegis:theme",
  name: "aegis:name",
  code: "aegis:access-code",
  learn: "aegis:learn",
  mode: "aegis:mode",
  instructions: "aegis:instructions",
};

function readPref(key: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
}

const noopSubscribe = () => () => {};

const SUGGESTIONS = [
  { title: "Plan my week", prompt: "Help me plan a realistic week around classes, work and one personal project." },
  {
    title: "Explain a concept",
    prompt: "Explain how transformers in machine learning work, like I'm a smart beginner.",
  },
  {
    title: "Debug some code",
    prompt: "I'll paste some code that isn't working. Ask me what you need, then help me fix it.",
  },
  {
    title: "Brainstorm ideas",
    prompt: "Brainstorm 10 low-cost side project ideas that use AI and could help other students.",
  },
];

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function AegisApp() {
  const supabase = getSupabase();
  // false during server render and hydration, true afterwards.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [model, setModel] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [streamingId, setStreamingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchHits, setSearchHits] = useState<{ q: string; ids: Set<string> } | null>(null);
  const [panel, setPanel] = useState<null | "settings" | "memory" | "usage" | { project: Project | null }>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [theme, setTheme] = useState<Theme>(() => (readPref(PREF.theme) as Theme) || "system");
  const [userName, setUserName] = useState(() => readPref(PREF.name));
  const [accessCode, setAccessCode] = useState(() => readPref(PREF.code));
  const [learn, setLearn] = useState(() => readPref(PREF.learn, "on") !== "off");
  const [mode, setMode] = useState(() => readPref(PREF.mode, "chat"));
  const [webSearch, setWebSearch] = useState(false);
  const [customInstructions, setCustomInstructions] = useState(() => readPref(PREF.instructions));

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const localStore = useMemo(() => (mounted ? new LocalStore() : null), [mounted]);
  const store: ChatStore | null = useMemo(() => {
    if (!mounted) return null;
    if (supabase && session) return new SupabaseStore(supabase, session.user.id);
    return localStore;
  }, [mounted, supabase, session, localStore]);

  // ---- boot -------------------------------------------------------------
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    if (accessCode) h["x-aegis-access-code"] = accessCode;
    return h;
  }, [session, accessCode]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    if (!mounted || !authReady) return;
    let cancelled = false;
    fetch("/api/models", { headers: authHeaders() })
      .then(async (r) => {
        const body = (await r.json()) as { models: ModelInfo[]; defaultModel: string | null; error?: string };
        if (cancelled) return;
        if (!r.ok) {
          setApiError(body.error ?? "Could not load models.");
          setModels([]);
          return;
        }
        setApiError(null);
        setModels(body.models);
        const saved = readPref(PREF.model);
        setModel(body.models.some((m) => m.id === saved) ? saved : body.defaultModel);
      })
      .catch(() => !cancelled && setApiError("Could not reach the AEGIS server."));
    return () => {
      cancelled = true;
    };
  }, [mounted, authReady, authHeaders]);

  const refreshLists = useCallback(async () => {
    if (!store) return;
    try {
      const [c, p, m] = await Promise.all([store.listConversations(), store.listProjects(), store.listMemories()]);
      setConversations(c);
      setProjects(p);
      setMemories(m);
    } catch (err) {
      setToast(`Couldn't load your data: ${(err as Error).message}`);
    }
  }, [store]);

  // Reload everything when the store changes (sign in / sign out).
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setActiveId(null);
      setMessages([]);
      refreshLists();
    });
    return () => {
      cancelled = true;
    };
  }, [refreshLists]);

  // ---- theme ------------------------------------------------------------
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    writePref(PREF.theme, theme === "system" ? "" : theme);
  }, [theme, mounted]);

  // ---- search -----------------------------------------------------------
  const query = search.trim();
  useEffect(() => {
    if (!store || query.length < 2) return;
    const t = setTimeout(() => {
      store
        .searchMessages(query)
        .then((ids) => setSearchHits({ q: query, ids: new Set(ids) }))
        .catch(() => setSearchHits(null));
    }, 200);
    return () => clearTimeout(t);
  }, [query, store]);
  const matchedIds = query.length >= 2 && searchHits?.q === query ? searchHits.ids : null;

  // ---- toast ------------------------------------------------------------
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- scrolling --------------------------------------------------------
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // ---- conversation actions ----------------------------------------------
  const stop = useCallback(() => abortRef.current?.abort(), []);

  const openConversation = useCallback(
    async (id: string) => {
      if (!store) return;
      stop();
      setActiveId(id);
      setSidebarOpen(false);
      stickToBottom.current = true;
      const conv = conversations.find((c) => c.id === id);
      if (conv?.model && models.some((m) => m.id === conv.model)) setModel(conv.model);
      try {
        setMessages(await store.getMessages(id));
      } catch (err) {
        setToast(`Couldn't open chat: ${(err as Error).message}`);
      }
    },
    [store, stop, conversations, models],
  );

  const newChat = useCallback(() => {
    stop();
    setActiveId(null);
    setMessages([]);
    setSidebarOpen(false);
  }, [stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        newChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat]);

  // Background: ask the model for durable facts about the user and save them.
  const learnFrom = useCallback(
    (userText: string, assistantText: string) => {
      if (!store || !model) return;
      fetch("/api/memory/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ model, userText, assistantText, existing: memories.map((m) => m.content) }),
      })
        .then((r) => (r.ok ? r.json() : { facts: [] }))
        .then(async ({ facts }: { facts: string[] }) => {
          if (!facts?.length) return;
          const created = facts.map((content) => ({ id: uid(), content, createdAt: nowIso() }));
          for (const m of created) await store.saveMemory(m);
          setMemories((prev) => [...created, ...prev]);
          setToast(created.length === 1 ? `Learned: “${created[0].content}”` : `Learned ${created.length} new things`);
        })
        .catch(() => {});
    },
    [store, model, memories, authHeaders],
  );

  const runCompletion = useCallback(
    async (conv: Conversation, history: ChatMessage[]) => {
      if (!store || !model) return;
      const assistant: ChatMessage = { id: uid(), role: "assistant", content: "", model, createdAt: nowIso() };
      setMessages([...history, assistant]);
      setStreamingId(assistant.id);
      const controller = new AbortController();
      abortRef.current = controller;

      const project = projects.find((p) => p.id === conv.projectId) ?? null;
      let text = "";
      let frame = 0;
      const flush = () => {
        frame = 0;
        setMessages((prev) => prev.map((m) => (m.id === assistant.id ? { ...m, content: text } : m)));
      };

      let final: ChatMessage = assistant;
      // Sources, tool steps and proposed actions arrive alongside the text.
      let extra: Pick<ChatMessage, "sources" | "steps" | "actions"> = {};
      try {
        await streamChat(
          {
            model,
            messages: history,
            memories,
            project: project ? { name: project.name, instructions: project.instructions } : null,
            userName: userName || undefined,
            customInstructions: customInstructions || undefined,
            mode,
            webSearch: webSearch || undefined,
          },
          authHeaders(),
          (delta) => {
            text += delta;
            if (!frame) frame = requestAnimationFrame(flush);
          },
          controller.signal,
          undefined,
          (e) => {
            if (e.type === "sources") extra = { ...extra, sources: [...(extra.sources ?? []), ...e.sources] };
            else if (e.type === "step") extra = { ...extra, steps: [...(extra.steps ?? []), e.step] };
            else extra = { ...extra, actions: [...(extra.actions ?? []), e.action] };
            const snapshot = extra;
            setMessages((prev) => prev.map((m) => (m.id === assistant.id ? { ...m, ...snapshot } : m)));
          },
        );
        final = { ...assistant, content: text || (extra.actions?.length ? "" : "_(empty response)_"), ...extra };
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          final = { ...assistant, content: text || "_(stopped)_", ...extra };
        } else {
          const msg = err instanceof ChatRequestError ? err.message : `Something went wrong: ${(err as Error).message}`;
          final = text
            ? { ...assistant, content: `${text}\n\n_(interrupted: ${msg})_`, ...extra }
            : { ...assistant, content: msg, error: true };
          if (err instanceof ChatRequestError && (err.status === 401 || err.status === 403)) setApiError(msg);
        }
      } finally {
        if (frame) cancelAnimationFrame(frame);
        abortRef.current = null;
        setStreamingId(null);
      }

      setMessages((prev) => prev.map((m) => (m.id === assistant.id ? final : m)));
      const lastUser = [...history].reverse().find((m) => m.role === "user");
      if (learn && !final.error && text && lastUser && !model.startsWith("demo:") && worthLearning(lastUser.content)) {
        learnFrom(lastUser.content, text);
      }
      try {
        await store.saveMessage(conv.id, final);
        const updated = { ...conv, model, updatedAt: nowIso() };
        await store.saveConversation(updated);
        setConversations((prev) => [updated, ...prev.filter((c) => c.id !== conv.id)]);
      } catch (err) {
        setToast(`Couldn't save reply: ${(err as Error).message}`);
      }
    },
    [store, model, projects, memories, userName, authHeaders, learn, learnFrom, customInstructions, mode, webSearch],
  );

  const loadUsage = useCallback(() => {
    if (!supabase) return Promise.reject(new Error("Sign-in is not configured."));
    return fetchUsage(supabase);
  }, [supabase]);

  const addMemory = useCallback(
    async (content: string) => {
      if (!store) return;
      const m: Memory = { id: uid(), content, createdAt: nowIso() };
      await store.saveMemory(m);
      setMemories((prev) => [m, ...prev]);
      setToast(`Remembered: “${content.length > 60 ? content.slice(0, 60) + "…" : content}”`);
    },
    [store],
  );

  const send = useCallback(
    async (input: ComposerSubmit, base?: ChatMessage[]) => {
      if (!store) return;
      if (!model) {
        setToast("No model available. Check Settings.");
        return;
      }
      if (!navigator.onLine) {
        setToast("You're offline. Reconnect to send.");
        return;
      }
      stickToBottom.current = true;
      let conv = conversations.find((c) => c.id === activeId) ?? null;
      const now = nowIso();
      if (!conv) {
        conv = {
          id: uid(),
          title: deriveTitle(input.text || input.files[0]?.name || "Image"),
          projectId: activeProjectId,
          model,
          pinned: false,
          createdAt: now,
          updatedAt: now,
        };
        await store.saveConversation(conv);
        setConversations((prev) => [conv!, ...prev]);
        setActiveId(conv.id);
      }
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: input.text,
        images: input.images.length ? input.images : undefined,
        files: input.files.length ? input.files : undefined,
        createdAt: now,
      };
      try {
        await store.saveMessage(conv.id, userMsg);
      } catch (err) {
        setToast(`Couldn't save message: ${(err as Error).message}`);
      }
      const fact = extractRememberRequest(input.text);
      if (fact) addMemory(fact).catch(() => {});
      await runCompletion(conv, [...(base ?? messages), userMsg]);
    },
    [store, model, conversations, activeId, activeProjectId, messages, runCompletion, addMemory],
  );

  const regenerate = useCallback(async () => {
    if (!store || !activeId) return;
    const conv = conversations.find((c) => c.id === activeId);
    const last = messages[messages.length - 1];
    if (!conv || last?.role !== "assistant") return;
    await store.deleteMessage(conv.id, last.id).catch(() => {});
    await runCompletion(conv, messages.slice(0, -1));
  }, [store, activeId, conversations, messages, runCompletion]);

  const editAndResend = useCallback(
    async (messageId: string, text: string) => {
      if (!store || !activeId) return;
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      const original = messages[idx];
      for (const m of messages.slice(idx)) await store.deleteMessage(activeId, m.id).catch(() => {});
      const base = messages.slice(0, idx);
      setMessages(base);
      await send({ text, images: original.images ?? [], files: original.files ?? [] }, base);
    },
    [store, activeId, messages, send],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!store) return;
      if (!window.confirm("Delete this chat? This can't be undone.")) return;
      await store.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeId) newChat();
    },
    [store, activeId, newChat],
  );

  const updateConversation = useCallback(
    async (c: Conversation) => {
      if (!store) return;
      await store.saveConversation(c);
      setConversations((prev) => prev.map((x) => (x.id === c.id ? c : x)));
    },
    [store],
  );

  const saveProject = useCallback(
    async (existing: Project | null, name: string, instructions: string) => {
      if (!store) return;
      const p: Project = existing
        ? { ...existing, name, instructions }
        : { id: uid(), name, instructions, createdAt: nowIso() };
      await store.saveProject(p);
      setProjects((prev) => [...prev.filter((x) => x.id !== p.id), p].sort((a, b) => a.name.localeCompare(b.name)));
      setActiveProjectId(p.id);
      setPanel(null);
    },
    [store],
  );

  // Applies or dismisses a change the agent proposed, then records the decision.
  const decideAction = useCallback(
    async (messageId: string, action: AgentAction, approve: boolean) => {
      if (!store || !activeId) return;
      try {
        if (approve && action.kind === "save_memory") await addMemory(action.payload.fact);
        if (approve && action.kind === "create_workspace") {
          const p: Project = {
            id: uid(),
            name: action.payload.name,
            instructions: action.payload.instructions ?? "",
            createdAt: nowIso(),
          };
          await store.saveProject(p);
          setProjects((prev) => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)));
          setToast(`Created workspace “${p.name}”`);
        }
      } catch (err) {
        setToast(`Couldn't apply that: ${(err as Error).message}`);
        return;
      }
      const status: AgentAction["status"] = approve ? "approved" : "dismissed";
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;
      const updated = { ...msg, actions: msg.actions?.map((a) => (a.id === action.id ? { ...a, status } : a)) };
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
      await store.saveMessage(activeId, updated).catch(() => {});
    },
    [store, activeId, messages, addMemory],
  );

  const deleteProject = useCallback(
    async (p: Project) => {
      if (!store) return;
      if (!window.confirm(`Delete workspace “${p.name}”? Its chats are kept.`)) return;
      await store.deleteProject(p.id);
      if (activeProjectId === p.id) setActiveProjectId(null);
      setPanel(null);
      refreshLists();
    },
    [store, activeProjectId, refreshLists],
  );

  // ---- render -----------------------------------------------------------
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const activeConv = conversations.find((c) => c.id === activeId) ?? null;
  const modelLabel = (id?: string) => models.find((m) => m.id === id)?.label ?? id?.split(":").slice(1).join(":");
  const accountLabel = session?.user.email ?? (supabase ? "Guest (not signed in)" : "Personal");
  const storageLabel = store?.kind === "supabase" ? "Synced" : "This device";

  const sidebar = (
    <Sidebar
      conversations={conversations}
      projects={projects}
      activeId={activeId}
      activeProjectId={activeProjectId}
      matchedIds={matchedIds}
      search={search}
      onSearch={setSearch}
      onSelect={openConversation}
      onNew={newChat}
      onDelete={deleteConversation}
      onTogglePin={(c) => updateConversation({ ...c, pinned: !c.pinned })}
      onRename={(c, title) => updateConversation({ ...c, title })}
      onSelectProject={(id) => {
        setActiveProjectId(id);
        newChat();
      }}
      onEditProject={(p) => setPanel({ project: p })}
      onNewProject={() => setPanel({ project: null })}
      onOpenMemory={() => setPanel("memory")}
      onOpenSettings={() => setPanel("settings")}
      accountLabel={accountLabel}
      storageLabel={storageLabel}
      onClose={() => setSidebarOpen(false)}
    />
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden w-[280px] shrink-0 border-r border-line md:block">{sidebar}</div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="animate-fade-up absolute inset-y-0 left-0 w-[85%] max-w-[320px] border-r border-line bg-surface">
            {sidebar}
          </div>
        </div>
      )}

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 px-3 md:px-6">
          <button
            className="rounded-lg p-2 text-muted hover:bg-surface-2 md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <IconMenu />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium" data-testid="chat-title">
              {activeConv?.title ?? (activeProject ? activeProject.name : "New chat")}
            </h1>
            {activeProject && activeConv && <p className="truncate text-xs text-faint">{activeProject.name}</p>}
          </div>
          {activeConv && messages.length > 0 && !streamingId && (
            <button
              className="rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-fg"
              aria-label="Download chat as Markdown"
              title="Download chat as Markdown"
              onClick={() => {
                const blob = new Blob([conversationToMarkdown(activeConv, messages)], { type: "text/markdown" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${safeFilename(activeConv.title)}.md`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              <IconDownload />
            </button>
          )}
          <button
            className="rounded-lg p-2 text-muted hover:bg-surface-2 md:hidden"
            onClick={newChat}
            aria-label="New chat"
          >
            <IconPlus />
          </button>
        </header>

        {!online && (
          <div className="mx-auto mb-2 w-full max-w-3xl px-4">
            <div
              className="rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-muted"
              role="status"
              data-testid="offline-banner"
            >
              You&apos;re offline. Saved chats on this device are still readable; sending resumes when you reconnect.
            </div>
          </div>
        )}

        {apiError && (
          <div className="mx-auto mb-2 w-full max-w-3xl px-4">
            <div
              className="flex items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm"
              role="alert"
            >
              <span>{apiError}</span>
              <button
                className="shrink-0 font-medium underline underline-offset-2"
                onClick={() => setPanel("settings")}
              >
                Open settings
              </button>
            </div>
          </div>
        )}

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-5 pb-10 text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 -z-10 rounded-full bg-accent/25 blur-3xl" />
                <Logo size={64} />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl" suppressHydrationWarning>
                <span className="gradient-text">{mounted ? greeting(userName) : "Welcome"}</span>
              </h2>
              <p className="mt-2 text-sm text-muted">
                {activeProject ? `Working in ${activeProject.name}. ` : ""}How can I help today?
              </p>
              <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.title}
                    onClick={() => send({ text: s.prompt, images: [], files: [] })}
                    disabled={!model || !!streamingId}
                    className="group rounded-2xl border border-line bg-surface/60 px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface disabled:opacity-50"
                  >
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-faint">{s.prompt}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-7 px-4 pb-8 pt-4 sm:px-6" data-testid="messages">
              {messages.map((m, i) => (
                <MessageItem
                  key={m.id}
                  message={m}
                  streaming={streamingId === m.id}
                  isLast={i === messages.length - 1}
                  modelLabel={m.role === "assistant" ? modelLabel(m.model) : undefined}
                  onRegenerate={!streamingId ? regenerate : undefined}
                  onEdit={m.role === "user" && !streamingId ? (t) => editAndResend(m.id, t) : undefined}
                  onDecide={(a, approve) => decideAction(m.id, a, approve)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mx-auto w-full max-w-3xl shrink-0 px-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:px-6">
          <Composer
            onSend={(input) => send(input)}
            onStop={stop}
            streaming={!!streamingId}
            models={models}
            model={model}
            onModelChange={(id) => {
              setModel(id);
              writePref(PREF.model, id);
            }}
            disabled={!store}
            autoFocusKey={activeId}
            mode={mode}
            onModeChange={(m) => {
              setMode(m);
              writePref(PREF.mode, m === "chat" ? "" : m);
            }}
            webSearch={webSearch}
            onWebSearchChange={setWebSearch}
            onExtract={async (file) => {
              const doc = await extractDocument(file, authHeaders());
              return { name: doc.pages ? `${doc.name} (${doc.pages} pages)` : doc.name, text: doc.text };
            }}
          />
          <p className="py-2 text-center text-[11px] text-faint">
            AEGIS can make mistakes. Check important information.
          </p>
        </div>

        {toast && (
          <div className="animate-fade-up pointer-events-none absolute inset-x-0 bottom-36 z-30 flex justify-center px-4">
            <div
              className={cn("glass rounded-full border border-line-strong px-4 py-2 text-sm shadow-[var(--shadow)]")}
              role="status"
            >
              {toast}
            </div>
          </div>
        )}
      </main>

      {panel === "usage" && supabase && (
        <UsagePanel load={loadUsage} dailyLimit={health?.dailyLimit} onClose={() => setPanel(null)} />
      )}

      {panel === "memory" && (
        <MemoryPanel
          memories={memories}
          onAdd={(t) => addMemory(t).catch((e) => setToast((e as Error).message))}
          onDelete={async (id) => {
            await store?.deleteMemory(id);
            setMemories((prev) => prev.filter((m) => m.id !== id));
          }}
          onClose={() => setPanel(null)}
        />
      )}

      {panel && typeof panel === "object" && (
        <ProjectDialog
          project={panel.project}
          onSave={(name, instructions) => saveProject(panel.project, name, instructions)}
          onDelete={panel.project ? () => deleteProject(panel.project!) : undefined}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === "settings" && (
        <SettingsPanel
          health={health}
          supabaseEnabled={!!supabase}
          userEmail={session?.user.email ?? null}
          oauthProviders={(process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)}
          onSignIn={async (email) => {
            if (!supabase) return "Sign-in is not configured.";
            const { error } = await supabase.auth.signInWithOtp({
              email,
              options: { emailRedirectTo: window.location.origin },
            });
            return error ? error.message : "Check your inbox for a sign-in link.";
          }}
          onOAuth={(provider) => {
            supabase?.auth.signInWithOAuth({
              provider: provider as "github" | "google",
              options: { redirectTo: window.location.origin },
            });
          }}
          onSignOut={async () => {
            await supabase?.auth.signOut();
            setPanel(null);
          }}
          onOpenUsage={() => setPanel("usage")}
          onCopyLocalToCloud={async () => {
            if (!store || !localStore || store.kind !== "supabase") return "Sign in first.";
            try {
              const backup = await exportAll(localStore);
              await importAll(store, backup);
              await refreshLists();
              return `Copied ${backup.conversations.length} chats and ${backup.memories.length} memories.`;
            } catch (err) {
              return `Copy failed: ${(err as Error).message}`;
            }
          }}
          accessCode={accessCode}
          onAccessCode={(c) => {
            setAccessCode(c);
            writePref(PREF.code, c);
          }}
          userName={userName}
          onUserName={(n) => {
            setUserName(n);
            writePref(PREF.name, n);
          }}
          theme={theme}
          onTheme={setTheme}
          customInstructions={customInstructions}
          onCustomInstructions={(t) => {
            setCustomInstructions(t);
            writePref(PREF.instructions, t);
          }}
          learn={learn}
          onLearn={(on) => {
            setLearn(on);
            writePref(PREF.learn, on ? "on" : "off");
          }}
          onExport={async () => {
            if (!store) return;
            const data = await exportAll(store);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `aegis-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
          onImport={async (file) => {
            if (!store) return "Not ready.";
            try {
              const data = JSON.parse(await file.text()) as Backup;
              await importAll(store, data);
              await refreshLists();
              return `Imported ${data.conversations.length} chats.`;
            } catch (err) {
              return `Import failed: ${(err as Error).message}`;
            }
          }}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}
