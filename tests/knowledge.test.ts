import { describe, expect, it } from "vitest";
import { chunkText, selectKnowledge } from "@/lib/knowledge";

const para = (topic: string, n = 12) =>
  Array.from({ length: n }, (_, i) => `Sentence ${i} is about ${topic} and nothing else.`).join(" ");

describe("chunkText", () => {
  it("keeps short text as one chunk and drops empty text", () => {
    expect(chunkText("  hello  ")).toEqual(["hello"]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("splits long text into overlapping chunks at sentence breaks", () => {
    const text = para("rockets", 80);
    const chunks = chunkText(text, 500, 100);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.length <= 500)).toBe(true);
    expect(chunks.slice(0, -1).every((c) => c.endsWith("."))).toBe(true);
    // Consecutive chunks overlap: the next one starts inside the previous one.
    expect(chunks[0]).toContain(chunks[1].slice(0, 30));
  });
});

describe("selectKnowledge", () => {
  it("sends small workspaces whole", () => {
    const files = [
      { name: "a.md", text: "Our wifi password policy." },
      { name: "b.md", text: "  " },
    ];
    expect(selectKnowledge(files, "anything")).toEqual([{ name: "a.md", text: "Our wifi password policy." }]);
  });

  it("picks the chunks that match the question in large workspaces", () => {
    const files = [
      { name: "garden.md", text: para("tomatoes", 60) },
      { name: "car.md", text: para("brakes", 60) + " The tyre pressure should be 2.4 bar." + para("brakes", 60) },
    ];
    const picked = selectKnowledge(files, "What tyre pressure should I use?", { maxChunks: 2, maxChars: 3000 });
    expect(picked.length).toBeGreaterThan(0);
    expect(picked[0].name).toBe("car.md");
    expect(picked[0].text).toContain("2.4 bar");
    expect(picked.reduce((n, p) => n + p.text.length, 0)).toBeLessThanOrEqual(3000);
  });

  it("sends nothing from a large workspace when the question has no matches", () => {
    const files = [{ name: "garden.md", text: para("tomatoes", 200) }];
    expect(selectKnowledge(files, "hi")).toEqual([]);
    expect(selectKnowledge(files, "quantum chromodynamics")).toEqual([]);
  });
});
