const CURRENCY_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Format an integer cents amount as a currency string, e.g. 123456 -> "$1,235". */
export function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  return CURRENCY_FMT.format(rounded / 100);
}

/** Format cents with cents precision always shown, e.g. 123456 -> "$1,234.56". */
export function formatCentsExact(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parse a user-typed amount ("$1,234.56", "1.5k", "1234") or math expression
 * ("500 + 250", "(1000/4)*5") into integer cents. Returns null for invalid input.
 */
export function parseCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const tokens = tokenize(trimmed);
  if (!tokens) return null;

  const value = evalTokens(tokens);
  if (value === null || !Number.isFinite(value)) return null;

  return Math.round(value * 100);
}

type Token =
  | { type: "num"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "paren"; value: "(" | ")" };

/** Strip currency clutter and split into numbers, operators and parentheses. */
function tokenize(input: string): Token[] | null {
  const chars = input.toLowerCase().replace(/,/g, "");
  const tokens: Token[] = [];
  let i = 0;

  while (i < chars.length) {
    const c = chars[i];

    if (c >= "0" && c <= "9") {
      let j = i;
      let hasDot = false;
      while (j < chars.length) {
        const ch = chars[j];
        if (ch === "." && !hasDot) {
          hasDot = true;
          j++;
          continue;
        }
        if (ch >= "0" && ch <= "9") {
          j++;
          continue;
        }
        break;
      }
      tokens.push({ type: "num", value: Number(chars.slice(i, j)) });
      i = j;
      continue;
    }

    if (c === "." && /[0-9]/.test(chars[i + 1] ?? "")) {
      let j = i;
      let hasDot = false;
      while (j < chars.length) {
        const ch = chars[j];
        if (ch === "." && !hasDot) {
          hasDot = true;
          j++;
          continue;
        }
        if (ch >= "0" && ch <= "9") {
          j++;
          continue;
        }
        break;
      }
      tokens.push({ type: "num", value: Number(chars.slice(i, j)) });
      i = j;
      continue;
    }

    if (c === "+" || c === "-" || c === "*" || c === "/") {
      tokens.push({ type: "op", value: c });
      i++;
      continue;
    }

    if (c === "(" || c === ")") {
      tokens.push({ type: "paren", value: c });
      i++;
      continue;
    }

    if (c === "$") {
      i++;
      continue;
    }

    if (c === "k") {
      // "1.5k" => 1500: multiply the previous token's number.
      const prev = tokens[tokens.length - 1];
      if (!prev || prev.type !== "num") return null;
      prev.value *= 1000;
      i++;
      continue;
    }

    if (c === " " || c === "\t") {
      i++;
      continue;
    }

    return null;
  }

  return tokens.length ? tokens : null;
}

/** Recursive-descent evaluation with unary +/- and operator precedence. */
function evalTokens(tokens: Token[]): number | null {
  let index = 0;
  const peek = (): Token | undefined => tokens[index];
  const next = (): Token | undefined => tokens[index++];

  const parseAddSub = (): number | null => {
    let left = parseMulDiv();
    if (left === null) return null;
    for (;;) {
      const op = peek();
      if (op?.type !== "op" || (op.value !== "+" && op.value !== "-")) return left;
      next();
      const right = parseMulDiv();
      if (right === null) return null;
      left = op.value === "+" ? left + right : left - right;
    }
  };

  const parseMulDiv = (): number | null => {
    let left = parseUnary();
    if (left === null) return null;
    for (;;) {
      const op = peek();
      if (op?.type !== "op" || (op.value !== "*" && op.value !== "/")) return left;
      next();
      const right = parseUnary();
      if (right === null) return null;
      left = op.value === "*" ? left * right : safeDivide(left, right);
    }
  };

  const parseUnary = (): number | null => {
    const op = peek();
    if (op?.type === "op" && (op.value === "+" || op.value === "-")) {
      next();
      const operand = parseUnary();
      if (operand === null) return null;
      return op.value === "-" ? -operand : operand;
    }
    return parsePrimary();
  };

  const parsePrimary = (): number | null => {
    const t = next();
    if (!t) return null;
    if (t.type === "num") return t.value;
    if (t.type === "paren" && t.value === "(") {
      const inner = parseAddSub();
      const close = next();
      if (inner === null || !close || close.type !== "paren" || close.value !== ")") return null;
      return inner;
    }
    return null;
  };

  const result = parseAddSub();
  return index === tokens.length ? result : null;
}

function safeDivide(a: number, b: number): number {
  return b === 0 ? NaN : a / b;
}