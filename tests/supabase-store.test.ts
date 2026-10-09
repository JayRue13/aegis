import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dataUrlToBlob, SupabaseStore } from "@/lib/store/supabase";

/** Just enough of the supabase-js client for SupabaseStore's message and image paths. */
function fakeClient() {
  const tables: Record<string, Record<string, unknown>[]> = { messages: [], conversations: [] };
  const files = new Map<string, Blob>();
  const query = (table: string) => {
    let rows = tables[table];
    const q = {
      select: () => q,
      eq: (col: string, v: unknown) => ((rows = rows.filter((r) => r[col] === v)), q),
      order: () => q,
      then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
    };
    return q;
  };
  const client = {
    from: (table: string) => ({
      upsert: async (row: Record<string, unknown>) => {
        tables[table] = [...tables[table].filter((r) => r.id !== row.id), row];
        return { data: null, error: null };
      },
      select: () => query(table),
      delete: () => ({
        eq: async (col: string, v: unknown) => {
          tables[table] = tables[table].filter((r) => r[col] !== v);
          return { data: null, error: null };
        },
      }),
    }),
    storage: {
      from: () => ({
        upload: async (path: string, blob: Blob) => (files.set(path, blob), { data: { path }, error: null }),
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((p) => ({ path: p, signedUrl: `https://signed.example/${p}` })),
          error: null,
        }),
        list: async (folder: string) => ({
          data: [...files.keys()].filter((k) => k.startsWith(folder + "/")).map((k) => ({ name: k.split("/").pop() })),
          error: null,
        }),
        remove: async (paths: string[]) => (paths.forEach((p) => files.delete(p)), { data: null, error: null }),
      }),
    },
  };
  return { client: client as unknown as SupabaseClient, tables, files };
}

const PNG = "data:image/png;base64," + btoa("fake-png-bytes");

describe("SupabaseStore images", () => {
  it("uploads images to the user's folder and stores only the path", async () => {
    const { client, tables, files } = fakeClient();
    const store = new SupabaseStore(client, "user-1");
    await store.saveMessage("conv-1", {
      id: "m1",
      role: "user",
      content: "look",
      images: [{ type: "image", dataUrl: PNG, name: "cat.png" }],
      createdAt: "2026-01-01",
    });
    expect([...files.keys()]).toEqual(["user-1/conv-1/m1-0.png"]);
    const att = tables.messages[0].attachments as { images: { dataUrl: string; path: string }[] };
    expect(att.images[0]).toMatchObject({ dataUrl: "", path: "user-1/conv-1/m1-0.png" });
    expect(JSON.stringify(tables.messages)).not.toContain("base64");

    const [m] = await store.getMessages("conv-1");
    expect(m.images?.[0].dataUrl).toBe("https://signed.example/user-1/conv-1/m1-0.png");
  });

  it("removes stored images when a conversation is deleted", async () => {
    const { client, files } = fakeClient();
    const store = new SupabaseStore(client, "user-1");
    await store.saveMessage("conv-1", {
      id: "m1",
      role: "user",
      content: "",
      images: [{ type: "image", dataUrl: PNG }],
      createdAt: "x",
    });
    await store.deleteConversation("conv-1");
    expect(files.size).toBe(0);
  });

  it("decodes data URLs", async () => {
    const blob = dataUrlToBlob(PNG);
    expect(blob.type).toBe("image/png");
    expect(await blob.text()).toBe("fake-png-bytes");
  });
});
