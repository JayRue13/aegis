// Safe arithmetic evaluator for the agent's calculator tool (no eval).
// Supports + - * / % ^, parentheses, unary minus, constants pi and e, and
// functions sqrt, abs, round, floor, ceil, ln, log (base 10), sin, cos, tan.

const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  ln: Math.log,
  log: Math.log10,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

export function evaluate(expression: string): number {
  const src = expression.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/,/g, "");
  if (src.length === 0 || src.length > 500) throw new Error("Invalid expression");
  let i = 0;

  const peek = () => src[i];
  const eat = (c: string) => {
    if (src[i] === c) {
      i++;
      return true;
    }
    return false;
  };

  function primary(): number {
    if (eat("(")) {
      const v = expr();
      if (!eat(")")) throw new Error("Missing )");
      return v;
    }
    const num = src.slice(i).match(/^\d+(\.\d+)?(e[+-]?\d+)?|^\.\d+/i);
    if (num) {
      i += num[0].length;
      return Number(num[0]);
    }
    const word = src.slice(i).match(/^[a-z]+/i);
    if (word) {
      const name = word[0].toLowerCase();
      i += word[0].length;
      if (name in CONSTS) return CONSTS[name];
      if (name in FUNCS) {
        if (!eat("(")) throw new Error(`${name} needs (`);
        const v = expr();
        if (!eat(")")) throw new Error("Missing )");
        return FUNCS[name](v);
      }
      throw new Error(`Unknown name ${name}`);
    }
    throw new Error(`Unexpected ${peek() ?? "end"}`);
  }

  function unary(): number {
    if (eat("-")) return -unary();
    if (eat("+")) return unary();
    return power();
  }

  function power(): number {
    const base = primary();
    if (eat("^")) return base ** unary();
    return base;
  }

  function term(): number {
    let v = unary();
    for (;;) {
      if (eat("*")) v *= unary();
      else if (eat("/")) v /= unary();
      else if (eat("%")) v %= unary();
      else return v;
    }
  }

  function expr(): number {
    let v = term();
    for (;;) {
      if (eat("+")) v += term();
      else if (eat("-")) v -= term();
      else return v;
    }
  }

  const result = expr();
  if (i !== src.length) throw new Error(`Unexpected ${src[i]}`);
  if (!Number.isFinite(result)) throw new Error("Result is not a finite number");
  return result;
}
