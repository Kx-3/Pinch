import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import { insertTransactionRecord } from "./helpers";
import { Doc, Id } from "../_generated/dataModel";

export type Frequency = "weekly" | "biweekly" | "monthly" | "annual";

export const frequencyValidator = v.union(
  v.literal("weekly"),
  v.literal("biweekly"),
  v.literal("monthly"),
  v.literal("annual"),
);

// ---------- Date helpers (UTC, "YYYY-MM-DD") ----------

function parseDate(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fmt(d: number): string {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate(),
  ).padStart(2, "0")}`;
}

const DAY = 86_400_000;
const addDays = (d: number, n: number) => d + n * DAY;

function advanceDate(dateStr: string, freq: Frequency): string {
  const d = parseDate(dateStr);
  switch (freq) {
    case "weekly":
      return fmt(addDays(d, 7));
    case "biweekly":
      return fmt(addDays(d, 14));
    case "monthly": {
      const dt = new Date(d);
      return fmt(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()));
    }
    case "annual": {
      const dt = new Date(d);
      return fmt(Date.UTC(dt.getUTCFullYear() + 1, dt.getUTCMonth(), dt.getUTCDate()));
    }
  }
}

function monthlyEquivalent(amount: number, freq: Frequency): number {
  const mag = Math.abs(amount);
  switch (freq) {
    case "weekly":
      return (mag * 52) / 12;
    case "biweekly":
      return (mag * 26) / 12;
    case "monthly":
      return mag;
    case "annual":
      return mag / 12;
  }
}

type Occurrence = { date: string; amount: number; paid: boolean };

function buildOccurrences(
  startDate: string,
  frequency: Frequency,
  amount: number,
  paidDates: Set<string>,
  today: number,
): Occurrence[] {
  const horizon = addDays(today, 90);
  const lookback = addDays(today, -60);
  const out: Occurrence[] = [];
  let cur = startDate;
  let guard = 0;
  while (guard++ < 4000) {
    const t = parseDate(cur);
    if (t > horizon) break;
    if (t >= lookback) out.push({ date: cur, amount, paid: paidDates.has(cur) });
    cur = advanceDate(cur, frequency);
  }
  return out;
}

type ListItem = {
  id: Id<"scheduledOutflows">;
  name: string;
  amount: number;
  kind: "expense" | "income";
  frequency: Frequency;
  startDate: string;
  categoryId: string | null;
  tags: string[];
  paidFrom: string;
  active: boolean;
  notes: string;
  lastPaid: string | null;
  projectedMonthly: number;
  status: "overdue" | "due" | "upcoming" | "paused";
  nextDue: string | null;
  occurrences: Occurrence[];
};

function formatListItem(sch: Doc<"scheduledOutflows">, today: number): ListItem {
  const paidDates = new Set(sch.paidOccurrences.map((o) => o.date));
  const occurrences = buildOccurrences(sch.startDate, sch.frequency, sch.amount, paidDates, today);
  const upcoming = occurrences.filter((o) => parseDate(o.date) >= today);
  const nextUnpaid = upcoming.find((o) => !o.paid);
  const hasOverdue = occurrences.some((o) => parseDate(o.date) < today && !o.paid);

  let status: ListItem["status"] = "upcoming";
  if (!sch.active) status = "paused";
  else if (hasOverdue) status = "overdue";
  else if (nextUnpaid && parseDate(nextUnpaid.date) <= addDays(today, 7)) status = "due";

  return {
    id: sch._id,
    name: sch.name,
    amount: sch.amount,
    kind: sch.kind,
    frequency: sch.frequency,
    startDate: sch.startDate,
    categoryId: sch.categoryId,
    tags: sch.tags,
    paidFrom: sch.paidFrom,
    active: sch.active,
    notes: sch.notes,
    lastPaid: sch.lastPaid ?? null,
    projectedMonthly: monthlyEquivalent(sch.amount, sch.frequency),
    status,
    nextDue: nextUnpaid?.date ?? null,
    occurrences,
  };
}

// ---------- Queries ----------

export const listRecurring = query({
  args: {},
  handler: async (ctx) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await ctx.db
      .query("scheduledOutflows")
      .withIndex("by_userId", (q) => q.eq("userId", owner._id))
      .order("asc")
      .take(1000);
    const today = parseDate(fmt(Date.now()));
    return rows.map((r) => formatListItem(r, today));
  },
});

export const detectRecurring = query({
  args: {},
  handler: async (ctx) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_userId_type_date", (q) => q.eq("userId", owner._id).eq("type", "expense"))
      .take(2000);

    const existing = new Set(
      (
        await ctx.db
          .query("scheduledOutflows")
          .withIndex("by_userId", (q) => q.eq("userId", owner._id))
          .take(1000)
      ).map((s) => normalize(s.name)),
    );

    const groups = new Map<string, { dates: string[]; amounts: number[]; categoryByCount: Map<string, number> }>();
    for (const tx of txs) {
      const key = normalize(tx.payee);
      if (!key || existing.has(key)) continue;
      const g =
        groups.get(key) ??
        ({ dates: [] as string[], amounts: [] as number[], categoryByCount: new Map<string, number>() } as {
          dates: string[];
          amounts: number[];
          categoryByCount: Map<string, number>;
        });
      g.dates.push(tx.date);
      g.amounts.push(Math.abs(tx.amount));
      if (tx.categoryId) g.categoryByCount.set(tx.categoryId, (g.categoryByCount.get(tx.categoryId) ?? 0) + 1);
      groups.set(key, g);
    }

    const periods: { period: Frequency; days: number }[] = [
      { period: "weekly", days: 7 },
      { period: "biweekly", days: 14 },
      { period: "monthly", days: 30 },
      { period: "annual", days: 365 },
    ];

    type Suggestion = {
      payee: string;
      frequency: Frequency;
      count: number;
      avgAmount: number;
      categoryId: string | null;
      confidence: number;
    };
    const suggestions: Suggestion[] = [];

    for (const [payee, g] of groups) {
      if (g.dates.length < 3) continue;
      const sorted = [...g.dates].sort((a, b) => parseDate(a) - parseDate(b));
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) gaps.push(Math.round((parseDate(sorted[i]) - parseDate(sorted[i - 1])) / DAY));
      if (!gaps.length) continue;
      const median = gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)];

      const closest = periods.reduce((best, p) =>
        Math.abs(p.days - median) < Math.abs(best.days - median) ? p : best,
      );
      const tolerance = closest.days === 30 ? 5 : closest.days === 365 ? 15 : Math.round(closest.days * 0.25);
      if (Math.abs(closest.days - median) > tolerance) continue;
      const matched = gaps.filter((x) => Math.abs(x - closest.days) <= Math.max(tolerance, Math.round(closest.days * 0.3)));
      const confidence = matched.length / gaps.length;

      const categoryId =
        [...g.categoryByCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const avgAmount =
        g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length;

      suggestions.push({
        payee: txPayeeLabel(sorted, txs, payee),
        frequency: closest.period,
        count: g.dates.length,
        avgAmount,
        categoryId,
        confidence,
      });
    }

    suggestions.sort((a, b) => b.confidence - a.confidence);
    return suggestions.slice(0, 12);
  },
});

// ---------- Mutations ----------

export const createRecurring = mutation({
  args: {
    name: v.string(),
    amount: v.number(),
    kind: v.union(v.literal("expense"), v.literal("income")),
    frequency: frequencyValidator,
    startDate: v.string(),
    categoryId: v.optional(v.nullable(v.string())),
    tags: v.optional(v.array(v.string())),
    paidFrom: v.string(),
    active: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    return await ctx.db.insert("scheduledOutflows", {
      userId: owner._id,
      name: args.name,
      amount: args.amount,
      kind: args.kind,
      frequency: args.frequency,
      startDate: args.startDate,
      categoryId: args.categoryId ?? null,
      tags: args.tags ?? [],
      paidFrom: args.paidFrom,
      active: args.active ?? true,
      notes: args.notes ?? "",
      paidOccurrences: [],
    });
  },
});

export const updateRecurring = mutation({
  args: {
    id: v.id("scheduledOutflows"),
    name: v.optional(v.string()),
    amount: v.optional(v.number()),
    kind: v.optional(v.union(v.literal("expense"), v.literal("income"))),
    frequency: v.optional(frequencyValidator),
    startDate: v.optional(v.string()),
    categoryId: v.optional(v.nullable(v.string())),
    tags: v.optional(v.array(v.string())),
    paidFrom: v.optional(v.string()),
    active: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const sch = await ctx.db.get(args.id);
    if (!sch || sch.userId !== owner._id) throw new Error("Recurring item not found or not owned");
    await ctx.db.patch(args.id, {
      name: args.name,
      amount: args.amount,
      kind: args.kind,
      frequency: args.frequency,
      startDate: args.startDate,
      categoryId: args.categoryId,
      tags: args.tags,
      paidFrom: args.paidFrom,
      active: args.active,
      notes: args.notes,
    });
    return null;
  },
});

export const deleteRecurring = mutation({
  args: { id: v.id("scheduledOutflows") },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const sch = await ctx.db.get(args.id);
    if (!sch || sch.userId !== owner._id) throw new Error("Recurring item not found or not owned");
    await ctx.db.delete(args.id);
    return null;
  },
});

export const markOccurrencePaid = mutation({
  args: { id: v.id("scheduledOutflows"), date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const sch = await ctx.db.get(args.id);
    if (!sch || sch.userId !== owner._id) throw new Error("Recurring item not found or not owned");

    const today = fmt(Date.now());
    // If no explicit date (or a past one), default to the next upcoming unpaid occurrence.
    let date = args.date ?? today;
    if (parseDate(date) < parseDate(today)) {
      const paidDates = new Set(sch.paidOccurrences.map((o) => o.date));
      const next = buildOccurrences(sch.startDate, sch.frequency, sch.amount, paidDates, parseDate(today)).find(
        (o) => parseDate(o.date) >= parseDate(today) && !o.paid,
      );
      date = next?.date ?? today;
    }

    const txId = await insertTransactionRecord(ctx, owner._id, {
      date,
      payee: sch.name,
      categoryId: sch.categoryId,
      amount: sch.amount,
      paidFrom: sch.paidFrom,
      tags: sch.tags,
      type: sch.kind,
      status: "cleared",
      notes: sch.notes || `Recurring: ${sch.name}`,
      rawPayee: sch.name,
    });

    const existing = sch.paidOccurrences.filter((o) => o.date !== date);
    await ctx.db.patch(args.id, {
      paidOccurrences: [...existing, { date, txId }],
      lastPaid: date,
    });
    return txId;
  },
});

// ---------- Helpers ----------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function txPayeeLabel(sortedDates: string[], txs: { payee: string; date: string }[], key: string): string {
  return txs.find((t) => normalize(t.payee) === key && t.date === sortedDates[sortedDates.length - 1])?.payee ?? key;
}