import { describe, expect, it } from "vitest";
import { buildSystemPrompt, toProviderMessages } from "@/lib/prompt";
import type { ChatMessage } from "@/lib/types";

const msg = (role: ChatMessage["role"], content: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: Math.random().toString(36),
  role,
  content,
  createdAt: "2026-01-01T00:00:00Z",
  ...extra,
});

describe("buildSystemPrompt", () => {
  it("adds workspace knowledge excerpts as information, not instructions", () => {
    const p = buildSystemPrompt({
      projectName: "Car",
      knowledge: [{ name: 'manual "v2".txt', text: "Tyre pressure: 2.4 bar." }],
    });
    expect(p).toContain("## Workspace knowledge");
    expect(p).toContain("not instructions");
    expect(p).toContain(`<knowledge file="manual 'v2'.txt">\nTyre pressure: 2.4 bar.\n</knowledge>`);
  });

  it("includes date, name, workspace and memories", () => {
    const p = buildSystemPrompt({
      now: new Date("2026-10-09T12:00:00Z"),
      userName: "Jay",
      projectName: "Thesis",
      projectInstructions: "Use APA style.",
      memories: [{ id: "1", content: "Studies CS", createdAt: "x" }],
    });
    expect(p).toContain("2026-10-09");
    expect(p).toContain("Jay");
    expect(p).toContain("Workspace: Thesis");
    expect(p).toContain("Use APA style.");
    expect(p).toContain("- Studies CS");
  });

  it("omits optional sections", () => {
    const p = buildSystemPrompt({});
    expect(p).not.toContain("Workspace");
    expect(p).not.toContain("remember");
  });
});

describe("toProviderMessages", () => {
  it("prepends the system prompt and drops errors", () => {
    const out = toProviderMessages(
      [msg("user", "hi"), msg("assistant", "oops", { error: true }), msg("user", "again")],
      "SYS",
    );
    expect(out.map((m) => m.role)).toEqual(["system", "user", "user"]);
    expect(out[0].content).toBe("SYS");
  });

  it("inlines attached files", () => {
    const out = toProviderMessages([msg("user", "summarize", { files: [{ name: "a.md", text: "# Title" }] })], "S");
    expect(out[1].content).toContain('<file name="a.md">');
    expect(out[1].content).toContain("# Title");
    expect(String(out[1].content).endsWith("summarize")).toBe(true);
  });

  it("sends images only on the latest user turn", () => {
    const img = { type: "image" as const, dataUrl: "data:image/png;base64,AAA" };
    const out = toProviderMessages(
      [
        msg("user", "what is this", { images: [img] }),
        msg("assistant", "a cat"),
        msg("user", "and this?", { images: [img] }),
      ],
      "S",
    );
    expect(typeof out[1].content).toBe("string");
    expect(out[1].content).toContain("image(s) attached earlier");
    expect(Array.isArray(out[3].content)).toBe(true);
  });

  it("limits history length", () => {
    const many = Array.from({ length: 100 }, (_, i) => msg(i % 2 ? "assistant" : "user", `m${i}`));
    expect(toProviderMessages(many, "S", { maxMessages: 10 })).toHaveLength(11);
  });
});
