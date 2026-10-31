// Storage abstraction: the app talks to a ChatStore, which is either the
// browser's localStorage (guest mode) or Supabase (signed-in, synced).

import type { ChatMessage, Conversation, KnowledgeFile, Memory, Project } from "../types";

export interface ChatStore {
  readonly kind: "local" | "supabase";
  listConversations(): Promise<Conversation[]>;
  saveConversation(c: Conversation): Promise<void>;
  deleteConversation(id: string): Promise<void>;

  getMessages(conversationId: string): Promise<ChatMessage[]>;
  saveMessage(conversationId: string, m: ChatMessage): Promise<void>;
  deleteMessage(conversationId: string, id: string): Promise<void>;
  /** Ids of conversations whose messages contain the query (case-insensitive). */
  searchMessages(query: string): Promise<string[]>;

  listProjects(): Promise<Project[]>;
  saveProject(p: Project): Promise<void>;
  /** Also deletes the workspace's knowledge files. */
  deleteProject(id: string): Promise<void>;

  listKnowledge(projectId: string): Promise<KnowledgeFile[]>;
  saveKnowledge(f: KnowledgeFile): Promise<void>;
  deleteKnowledge(projectId: string, id: string): Promise<void>;

  listMemories(): Promise<Memory[]>;
  saveMemory(m: Memory): Promise<void>;
  deleteMemory(id: string): Promise<void>;
}

export interface Backup {
  version: 1;
  exportedAt: string;
  conversations: (Conversation & { messages: ChatMessage[] })[];
  projects: Project[];
  memories: Memory[];
  /** Added after version 1 shipped; older backups omit it. */
  knowledge?: KnowledgeFile[];
}

export async function exportAll(store: ChatStore): Promise<Backup> {
  const conversations = await store.listConversations();
  const projects = await store.listProjects();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    conversations: await Promise.all(
      conversations.map(async (c) => ({ ...c, messages: await store.getMessages(c.id) })),
    ),
    projects,
    memories: await store.listMemories(),
    knowledge: (await Promise.all(projects.map((p) => store.listKnowledge(p.id)))).flat(),
  };
}

/** Copies a backup into a store. Existing items with the same id are overwritten. */
export async function importAll(store: ChatStore, backup: Backup): Promise<void> {
  if (backup.version !== 1) throw new Error("Unsupported backup version");
  for (const p of backup.projects) await store.saveProject(p);
  for (const m of backup.memories) await store.saveMemory(m);
  for (const f of backup.knowledge ?? []) await store.saveKnowledge(f);
  for (const { messages, ...c } of backup.conversations) {
    await store.saveConversation(c);
    for (const m of messages) await store.saveMessage(c.id, m);
  }
}
