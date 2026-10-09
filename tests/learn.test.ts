import { describe, expect, it } from "vitest";
import { dedupeFacts, parseFacts, similarity, worthLearning } from "@/lib/learn";
import { conversationToMarkdown, safeFilename } from "@/lib/export";

describe("worthLearning", () => {
  it("only fires for personal statements of reasonable length", () => {
    expect(worthLearning("I'm a junior studying computer science at a state school")).toBe(true);
    expect(worthLearning("What is the capital of France and why?")).toBe(false);
    expect(worthLearning("my name")).toBe(false);
    expect(worthLearning("Remember that I like tea and biscuits a lot")).toBe(false);
  });
});

describe("parseFacts", () => {
  it("extracts arrays from fenced or chatty replies", () => {
    expect(parseFacts('```json\n["User studies CS", "User lives in Ohio"]\n```')).toEqual([
      "User studies CS",
      "User lives in Ohio",
    ]);
    expect(parseFacts('Sure! ["User plays guitar"] hope that helps')).toEqual(["User plays guitar"]);
    expect(parseFacts("[]")).toEqual([]);
    expect(parseFacts("no facts")).toEqual([]);
    expect(parseFacts('[1, "ok", "User likes long walks"]')).toEqual(["User likes long walks"]);
    expect(parseFacts('["a","b","User one fact","User two fact","User three fact","User four fact"]')).toHaveLength(3);
  });
});

describe("dedupeFacts", () => {
  it("drops near-duplicates of existing memories and of each other", () => {
    expect(similarity("User studies computer science", "The user studies computer science")).toBe(1);
    const out = dedupeFacts(
      ["User studies computer science", "User is learning Rust", "User is learning Rust now"],
      ["User studies computer science at college"],
    );
    expect(out).toEqual(["User is learning Rust"]);
  });
});

describe("conversationToMarkdown", () => {
  it("renders a readable transcript", () => {
    const md = conversationToMarkdown(
      { id: "c", title: "Rust help", projectId: null, model: null, pinned: false, createdAt: "", updatedAt: "" },
      [
        { id: "1", role: "user", content: "What is ownership?", createdAt: "", files: [{ name: "main.rs", text: "" }] },
        { id: "2", role: "assistant", content: "Ownership is…", model: "groq:llama-3.3-70b-versatile", createdAt: "" },
      ],
    );
    expect(md).toContain("# Rust help");
    expect(md).toContain("## You");
    expect(md).toContain("_Attachments: main.rs_");
    expect(md).toContain("## AEGIS (llama-3.3-70b-versatile)");
  });

  it("makes safe filenames", () => {
    expect(safeFilename("What's up? / Plans: 2026!")).toBe("whats-up-plans-2026");
    expect(safeFilename("???")).toBe("chat");
  });
});
