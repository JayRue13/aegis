import { describe, expect, it } from "vitest";
import { frameDocument, isRunnable, workerSource } from "@/lib/runjs";

describe("runjs", () => {
  it("only offers Run for JavaScript", () => {
    expect(isRunnable("js")).toBe(true);
    expect(isRunnable("JavaScript")).toBe(true);
    expect(isRunnable("python")).toBe(false);
    expect(isRunnable(undefined)).toBe(false);
  });

  it("wraps code in an async function and reports completion", () => {
    const src = workerSource("await 1;\nconsole.log('hi');");
    expect(src).toContain("(async () => {\nawait 1;\nconsole.log('hi');\n})()");
    expect(src).toContain('postMessage({ type: "done" })');
    expect(src).not.toContain("eval(");
  });

  it("locks the sandbox frame down to no network", () => {
    const doc = frameDocument(5000);
    expect(doc).toContain("default-src 'none'");
    expect(doc).not.toMatch(/connect-src/);
    expect(doc).toContain("5000");
  });
});
