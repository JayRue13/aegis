import { describe, expect, it } from "vitest";
import { extractRememberRequest, scoreMemory, selectMemories, tokenize } from "@/lib/memory";
import type { Memory } from "@/lib/types";

const mem = (id: string, content: string, createdAt = `2026-01-${id.padStart(2, "0")}`): Memory => ({
  id,
  content,
  createdAt,
});

describe("extractRememberRequest", () => {
  it("captures the first sentence after 'remember that'", () => {
    expect(extractRememberRequest("Remember that I study computer science. Can you help?")).toBe(
      "I study computer science",
    );
    expect(extractRememberRequest("please remember my birthday is May 3")).toBe("My birthday is May 3");
    expect(extractRememberRequest("Keep in mind that I prefer TypeScript!")).toBe("I prefer TypeScript");
  });

  it("ignores reminders, questions and normal messages", () => {
    expect(extractRememberRequest("Remember to buy milk")).toBeNull();
    expect(extractRememberRequest("Remember when we talked about React?")).toBeNull();
    expect(extractRememberRequest("Do you remember what I said?")).toBeNull();
    expect(extractRememberRequest("Write a poem about memory")).toBeNull();
    expect(extractRememberRequest("remember hi")).toBeNull();
  });
});

describe("memory ranking", () => {
  it("tokenizes without stopwords", () => {
    expect(tokenize("I am learning the Rust language!")).toEqual(["am", "learning", "rust", "language"]);
  });

  it("scores related memories higher", () => {
    expect(scoreMemory("I am learning Rust", "help me with rust lifetimes")).toBeGreaterThan(0);
    expect(scoreMemory("My dog is named Max", "help me with rust lifetimes")).toBe(0);
  });

  it("returns everything when under the limit", () => {
    const all = [mem("1", "a fact"), mem("2", "another fact")];
    expect(selectMemories(all, "anything")).toHaveLength(2);
  });

  it("keeps recent memories and adds relevant ones when over the limit", () => {
    const memories = Array.from({ length: 30 }, (_, i) => mem(String(i + 1), `filler fact number ${i + 1}`));
    memories[2] = mem("3", "I play guitar in a band");
    const picked = selectMemories(memories, "suggest a guitar song", { maxTotal: 5, recent: 2 });
    const ids = picked.map((m) => m.id);
    expect(ids).toContain("30");
    expect(ids).toContain("29");
    expect(ids).toContain("3");
    expect(picked.length).toBeLessThanOrEqual(5);
  });

  it("caps the total characters", () => {
    const big = [mem("1", "x".repeat(3000)), mem("2", "y".repeat(3000))];
    expect(selectMemories(big, "q", { maxChars: 4000 })).toHaveLength(1);
  });
});
