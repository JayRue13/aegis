// Guest-mode storage in the browser's localStorage.

import type { ChatMessage, Conversation, KnowledgeFile, Memory, Project } from "../types";
import type { ChatStore } from "./types";

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = "aegis:v1:";

export class LocalStore implements ChatStore {
  readonly kind = "local" as const;
  constructor(private kv: KV = globalThis.localStorage) {}

  private read<T>(key: string, fallback: T): T {
    try {
      const raw = this.kv.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown) {
    const raw = JSON.stringify(value);
    try {
      this.kv.setItem(PREFIX + key, raw);
    } catch {
      // Storage full: drop image data (the heaviest part) and retry once.
      const slim = JSON.stringify(value, (k, v) => (k === "dataUrl" ? "" : v));
      this.kv.setItem(PREFIX + key, slim);
    }
  }

  private upsert<T extends { id: string }>(key: string, item: T) {
    const items = this.read<T[]>(key, []);
    const i = items.findIndex((x) => x.id === item.id);
    if (i >= 0) items[i] = item;
    else items.push(item);
    this.write(key, items);
  }

  private remove(key: string, id: string) {
    this.write(
      key,
      this.read<{ id: string }[]>(key, []).filter((x) => x.id !== id),
    );
  }

  async listConversations() {
    return this.read<Conversation[]>("conversations", []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async saveConversation(c: Conversation) {
    this.upsert("conversations", c);
  }
  async deleteConversation(id: string) {
    this.remove("conversations", id);
    this.kv.removeItem(PREFIX + `messages:${id}`);
  }

  async getMessages(conversationId: string) {
    return this.read<ChatMessage[]>(`messages:${conversationId}`, []);
  }
  async saveMessage(conversationId: string, m: ChatMessage) {
    this.upsert(`messages:${conversationId}`, m);
  }
  async deleteMessage(conversationId: string, id: string) {
    this.remove(`messages:${conversationId}`, id);
  }

  async searchMessages(query: string) {
    const q = query.toLowerCase();
    const ids: string[] = [];
    for (const c of this.read<Conversation[]>("conversations", [])) {
      const msgs = this.read<ChatMessage[]>(`messages:${c.id}`, []);
      if (msgs.some((m) => m.content.toLowerCase().includes(q))) ids.push(c.id);
    }
    return ids;
  }

  async listProjects() {
    return this.read<Project[]>("projects", []).sort((a, b) => a.name.localeCompare(b.name));
  }
  async saveProject(p: Project) {
    this.upsert("projects", p);
  }
  async deleteProject(id: string) {
    this.remove("projects", id);
    const convs = this.read<Conversation[]>("conversations", []).map((c) =>
      c.projectId === id ? { ...c, projectId: null } : c,
    );
    this.write("conversations", convs);
    this.kv.removeItem(PREFIX + `knowledge:${id}`);
  }

  async listKnowledge(projectId: string) {
    return this.read<KnowledgeFile[]>(`knowledge:${projectId}`, []);
  }
  async saveKnowledge(f: KnowledgeFile) {
    this.upsert(`knowledge:${f.projectId}`, f);
  }
  async deleteKnowledge(projectId: string, id: string) {
    this.remove(`knowledge:${projectId}`, id);
  }

  async listMemories() {
    return this.read<Memory[]>("memories", []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async saveMemory(m: Memory) {
    this.upsert("memories", m);
  }
  async deleteMemory(id: string) {
    this.remove("memories", id);
  }
}

/** In-memory KV for tests and server rendering. */
export class MemoryKV implements KV {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}
