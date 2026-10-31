// Signed-in storage in Supabase Postgres. Row-level security (see
// supabase/migrations) guarantees each user only ever sees their own rows.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, Conversation, KnowledgeFile, Memory, Project } from "../types";
import type { ChatStore } from "./types";

type Row = Record<string, unknown>;

const BUCKET = "attachments";
const SIGNED_URL_SECONDS = 60 * 60;

/** Decodes a base64 data: URL into a Blob for upload. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",", 2);
  const type = head.match(/^data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const bin = atob(b64 ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

function extFor(dataUrl: string): string {
  const t = dataUrl.match(/^data:image\/([a-z]+)/)?.[1] ?? "bin";
  return t === "jpeg" ? "jpg" : t;
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export class SupabaseStore implements ChatStore {
  readonly kind = "supabase" as const;
  constructor(
    private db: SupabaseClient,
    private userId: string,
  ) {}

  async listConversations(): Promise<Conversation[]> {
    const rows = check<Row[]>(
      await this.db.from("conversations").select("*").order("updated_at", { ascending: false }),
    );
    return rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      projectId: (r.project_id as string) ?? null,
      model: (r.model as string) ?? null,
      pinned: Boolean(r.pinned),
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));
  }

  async saveConversation(c: Conversation) {
    check(
      await this.db.from("conversations").upsert({
        id: c.id,
        user_id: this.userId,
        title: c.title,
        project_id: c.projectId,
        model: c.model,
        pinned: c.pinned,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      }),
    );
  }

  async deleteConversation(id: string) {
    check(await this.db.from("conversations").delete().eq("id", id));
    // Best effort: remove the conversation's stored images.
    const folder = `${this.userId}/${id}`;
    const { data } = await this.db.storage.from(BUCKET).list(folder, { limit: 1000 });
    if (data?.length) await this.db.storage.from(BUCKET).remove(data.map((f) => `${folder}/${f.name}`));
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const rows = check<Row[]>(
      await this.db
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true }),
    );
    const messages = rows.map((r) => {
      const att =
        (r.attachments as {
          files?: ChatMessage["files"];
          images?: ChatMessage["images"];
          sources?: ChatMessage["sources"];
          steps?: ChatMessage["steps"];
          actions?: ChatMessage["actions"];
        }) ?? {};
      return {
        id: r.id as string,
        role: r.role as ChatMessage["role"],
        content: r.content as string,
        model: (r.model as string) ?? undefined,
        error: Boolean(r.error) || undefined,
        files: att.files,
        images: att.images,
        sources: att.sources,
        steps: att.steps,
        actions: att.actions,
        createdAt: r.created_at as string,
      } as ChatMessage;
    });
    await this.signImages(messages);
    return messages;
  }

  /** Replaces stored image paths with short-lived signed URLs for display. */
  private async signImages(messages: ChatMessage[]) {
    const paths = messages.flatMap((m) => m.images?.map((i) => i.path).filter((p): p is string => !!p) ?? []);
    if (paths.length === 0) return;
    const { data } = await this.db.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
    for (const m of messages) {
      m.images = m.images?.map((i) => (i.path ? { ...i, dataUrl: urls.get(i.path) ?? "" } : i));
    }
  }

  async saveMessage(conversationId: string, m: ChatMessage) {
    // Images go to the private storage bucket; the database keeps only their
    // path, so the free 500 MB database is not filled with base64 data.
    const images = await Promise.all(
      (m.images ?? []).map(async (img, i) => {
        if (img.path) return { type: "image" as const, dataUrl: "", name: img.name, path: img.path };
        if (!img.dataUrl.startsWith("data:")) return { type: "image" as const, dataUrl: "", name: img.name };
        const path = `${this.userId}/${conversationId}/${m.id}-${i}.${extFor(img.dataUrl)}`;
        const { error } = await this.db.storage
          .from(BUCKET)
          .upload(path, dataUrlToBlob(img.dataUrl), { upsert: true, contentType: dataUrlToBlob(img.dataUrl).type });
        return { type: "image" as const, dataUrl: "", name: img.name, path: error ? undefined : path };
      }),
    );
    check(
      await this.db.from("messages").upsert({
        id: m.id,
        conversation_id: conversationId,
        user_id: this.userId,
        role: m.role,
        content: m.content,
        model: m.model ?? null,
        error: m.error ?? false,
        attachments: {
          files: m.files,
          images: images.length ? images : undefined,
          sources: m.sources,
          steps: m.steps,
          actions: m.actions,
        },
        created_at: m.createdAt,
      }),
    );
  }

  async deleteMessage(_conversationId: string, id: string) {
    check(await this.db.from("messages").delete().eq("id", id));
  }

  async searchMessages(query: string): Promise<string[]> {
    const escaped = query.replace(/[%_\\]/g, (c) => `\\${c}`);
    const rows = check<{ conversation_id: string }[]>(
      await this.db.from("messages").select("conversation_id").ilike("content", `%${escaped}%`).limit(200),
    );
    return [...new Set(rows.map((r) => r.conversation_id))];
  }

  async listProjects(): Promise<Project[]> {
    const rows = check<Row[]>(await this.db.from("projects").select("*").order("name"));
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      instructions: (r.instructions as string) ?? "",
      createdAt: r.created_at as string,
    }));
  }

  async saveProject(p: Project) {
    check(
      await this.db.from("projects").upsert({
        id: p.id,
        user_id: this.userId,
        name: p.name,
        instructions: p.instructions,
        created_at: p.createdAt,
      }),
    );
  }

  async deleteProject(id: string) {
    // Knowledge files go with it (on delete cascade).
    check(await this.db.from("projects").delete().eq("id", id));
  }

  async listKnowledge(projectId: string): Promise<KnowledgeFile[]> {
    const rows = check<Row[]>(
      await this.db.from("knowledge_files").select("*").eq("project_id", projectId).order("created_at"),
    );
    return rows.map((r) => ({
      id: r.id as string,
      projectId: r.project_id as string,
      name: r.name as string,
      text: r.content as string,
      createdAt: r.created_at as string,
    }));
  }

  async saveKnowledge(f: KnowledgeFile) {
    check(
      await this.db.from("knowledge_files").upsert({
        id: f.id,
        user_id: this.userId,
        project_id: f.projectId,
        name: f.name,
        content: f.text,
        created_at: f.createdAt,
      }),
    );
  }

  async deleteKnowledge(_projectId: string, id: string) {
    check(await this.db.from("knowledge_files").delete().eq("id", id));
  }

  async listMemories(): Promise<Memory[]> {
    const rows = check<Row[]>(await this.db.from("memories").select("*").order("created_at", { ascending: false }));
    return rows.map((r) => ({ id: r.id as string, content: r.content as string, createdAt: r.created_at as string }));
  }

  async saveMemory(m: Memory) {
    check(
      await this.db
        .from("memories")
        .upsert({ id: m.id, user_id: this.userId, content: m.content, created_at: m.createdAt }),
    );
  }

  async deleteMemory(id: string) {
    check(await this.db.from("memories").delete().eq("id", id));
  }
}
