import { describe, expect, it } from "vitest";
import { deriveTitle, recencyGroup } from "@/lib/util";
import { isTextFile, parseNdjson } from "@/lib/chat-client";

describe("deriveTitle", () => {
  it("cleans markdown and truncates on a word boundary", () => {
    expect(deriveTitle("  **Hello**   world ")).toBe("Hello world");
    expect(deriveTitle("```js\ncode\n```")).toBe("New chat");
    const t = deriveTitle("Explain the difference between processes and threads in operating systems please");
    expect(t.endsWith("…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(49);
  });
});

describe("recencyGroup", () => {
  const now = new Date(2026, 9, 9, 12);
  it("buckets dates", () => {
    expect(recencyGroup(new Date(2026, 9, 9, 8).toISOString(), now)).toBe("Today");
    expect(recencyGroup(new Date(2026, 9, 8, 8).toISOString(), now)).toBe("Yesterday");
    expect(recencyGroup(new Date(2026, 9, 4).toISOString(), now)).toBe("Previous 7 days");
    expect(recencyGroup(new Date(2026, 8, 20).toISOString(), now)).toBe("Previous 30 days");
    expect(recencyGroup(new Date(2025, 0, 1).toISOString(), now)).toBe("Older");
  });
});

describe("parseNdjson", () => {
  it("keeps partial lines for the next chunk", () => {
    const { events, rest } = parseNdjson('{"type":"delta","text":"a"}\n{"type":"de');
    expect(events).toEqual([{ type: "delta", text: "a" }]);
    expect(rest).toBe('{"type":"de');
  });
});

describe("isTextFile", () => {
  it("recognises code and text files", () => {
    expect(isTextFile({ name: "main.py", type: "" })).toBe(true);
    expect(isTextFile({ name: "notes", type: "text/plain" })).toBe(true);
    expect(isTextFile({ name: "photo.heic", type: "image/heic" })).toBe(false);
  });
});
