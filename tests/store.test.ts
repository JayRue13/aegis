import { describe, expect, it } from "vitest";
import { LocalStore, MemoryKV } from "@/lib/store/local";
import { exportAll, importAll } from "@/lib/store/types";
import type { Conversation } from "@/lib/types";

const conv = (id: string, updatedAt: string, projectId: string | null = null): Conversation => ({
  id,
  title: `chat ${id}`,
  projectId,
  model: null,
  pinned: false,
  createdAt: updatedAt,
  updatedAt,
});

describe("LocalStore", () => {
  it("stores, sorts, searches and deletes conversations", async () => {
    const s = new LocalStore(new MemoryKV());
    await s.saveConversation(conv("a", "2026-01-01"));
    await s.saveConversation(conv("b", "2026-02-01"));
    await s.saveMessage("a", { id: "m1", role: "user", content: "Tell me about Saturn", createdAt: "x" });
    expect((await s.listConversations()).map((c) => c.id)).toEqual(["b", "a"]);
    expect(await s.searchMessages("saturn")).toEqual(["a"]);
    await s.deleteConversation("a");
    expect(await s.getMessages("a")).toEqual([]);
    expect((await s.listConversations()).map((c) => c.id)).toEqual(["b"]);
  });

  it("upserts messages by id", async () => {
    const s = new LocalStore(new MemoryKV());
    await s.saveMessage("c", { id: "m", role: "assistant", content: "draft", createdAt: "x" });
    await s.saveMessage("c", { id: "m", role: "assistant", content: "final", createdAt: "x" });
    expect(await s.getMessages("c")).toEqual([{ id: "m", role: "assistant", content: "final", createdAt: "x" }]);
  });

  it("detaches chats when a workspace is deleted", async () => {
    const s = new LocalStore(new MemoryKV());
    await s.saveProject({ id: "p", name: "Thesis", instructions: "", createdAt: "x" });
    await s.saveConversation(conv("a", "2026-01-01", "p"));
    await s.deleteProject("p");
    expect(await s.listProjects()).toEqual([]);
    expect((await s.listConversations())[0].projectId).toBeNull();
  });

  it("drops image data when storage is full", async () => {
    class TinyKV extends MemoryKV {
      setItem(k: string, v: string) {
        if (v.length > 400) throw new Error("QuotaExceededError");
        super.setItem(k, v);
      }
    }
    const s = new LocalStore(new TinyKV());
    await s.saveMessage("c", {
      id: "m",
      role: "user",
      content: "look",
      images: [{ type: "image", dataUrl: "data:image/png;base64," + "A".repeat(1000), name: "cat.png" }],
      createdAt: "x",
    });
    const [m] = await s.getMessages("c");
    expect(m.images?.[0]).toEqual({ type: "image", dataUrl: "", name: "cat.png" });
  });

  it("round-trips a backup", async () => {
    const a = new LocalStore(new MemoryKV());
    await a.saveConversation(conv("a", "2026-01-01"));
    await a.saveMessage("a", { id: "m", role: "user", content: "hi", createdAt: "x" });
    await a.saveMemory({ id: "k", content: "likes tea", createdAt: "x" });
    const b = new LocalStore(new MemoryKV());
    await importAll(b, await exportAll(a));
    expect(await b.getMessages("a")).toHaveLength(1);
    expect((await b.listMemories())[0].content).toBe("likes tea");
  });
});
