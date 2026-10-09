import { describe, expect, it } from "vitest";
import { evaluate } from "@/lib/calc";

describe("evaluate", () => {
  it("follows operator precedence and parentheses", () => {
    expect(evaluate("2 + 3 * 4")).toBe(14);
    expect(evaluate("(2 + 3) * 4")).toBe(20);
    expect(evaluate("2 ^ 3 ^ 2")).toBe(512);
    expect(evaluate("-2 ^ 2")).toBe(-4);
    expect(evaluate("17 % 5")).toBe(2);
  });

  it("supports functions, constants and friendly symbols", () => {
    expect(evaluate("sqrt(16) + abs(-3)")).toBe(7);
    expect(evaluate("round(pi * 100) / 100")).toBe(3.14);
    expect(evaluate("1,200 × 3 ÷ 4")).toBe(900);
    expect(evaluate("log(1000)")).toBeCloseTo(3);
  });

  it("rejects anything that isn't arithmetic", () => {
    for (const bad of ["", "2 +", "process.exit()", "alert(1)", "(1", "1)", "foo(2)", "1/0"]) {
      expect(() => evaluate(bad), bad).toThrow();
    }
  });
});
