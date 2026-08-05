import { query, mutation, QueryCtx, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import { Doc, Id } from "../_generated/dataModel";
import { applySpentDelta } from "./helpers";

export type RuleCandidate = {
  payee: string;
  rawPayee?: string | null;
  amount: number;
  tags: string[];
  categoryId: string | null;
};

export async function listRulesForUser(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"users">,
): Promise<Doc<"rules">[]> {
  return await ctx.db
    .query("rules")
    .withIndex("by_userId_priority", (q) => q.eq("userId", ownerId))
    .order("asc")
    .take(100);
}

const matchesRule = (rule: Doc<"rules">, tx: RuleCandidate): boolean => {
  const value =
    rule.conditionField === "amount"
      ? String(tx.amount)
      : rule.conditionField === "rawPayee"
        ? (tx.rawPayee ?? tx.payee)
        : tx.payee;
  const needle = rule.conditionValue;
  switch (rule.conditionOp) {
    case "contains":
      return value.toLowerCase().includes(needle.toLowerCase());
    case "equals":
      return value.toLowerCase() === needle.toLowerCase();
    case "starts_with":
      return value.toLowerCase().startsWith(needle.toLowerCase());
    case "greater_than":
      return Math.abs(tx.amount) > Number(needle) || false;
  }
};

/** First matching rule by priority wins; applies its category/rename/tag actions. */
export function applyRules(
  rules: Doc<"rules">[],
  tx: RuleCandidate,
): { payee: string; tags: string[]; categoryId: string | null } {
  let payee = tx.payee;
  let tags = [...tx.tags];
  let categoryId = tx.categoryId;
  for (const rule of rules) {
    if (!matchesRule(rule, tx)) continue;
    if (rule.actionSetCategory) categoryId = rule.actionSetCategory;
    if (rule.actionRenamePayee) payee = rule.actionRenamePayee;
    if (rule.actionAddTags && rule.actionAddTags.length) {
      tags = Array.from(new Set([...tags, ...rule.actionAddTags]));
    }
    break;
  }
  return { payee, tags, categoryId };
}

export const listRules = query({
  args: {},
  handler: async (ctx) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await listRulesForUser(ctx, owner._id);
    return rows.map((r) => ({
      id: r._id,
      priority: r.priority,
      conditionField: r.conditionField,
      conditionOp: r.conditionOp,
      conditionValue: r.conditionValue,
      actionSetCategory: r.actionSetCategory ?? null,
      actionRenamePayee: r.actionRenamePayee ?? null,
      actionAddTags: r.actionAddTags ?? [],
    }));
  },
});

export const createRule = mutation({
  args: {
    conditionField: v.union(v.literal("payee"), v.literal("amount"), v.literal("rawPayee")),
    conditionOp: v.union(v.literal("contains"), v.literal("equals"), v.literal("starts_with"), v.literal("greater_than")),
    conditionValue: v.string(),
    actionSetCategory: v.optional(v.string()),
    actionRenamePayee: v.optional(v.string()),
    actionAddTags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const last = await ctx.db
      .query("rules")
      .withIndex("by_userId_priority", (q) => q.eq("userId", owner._id))
      .order("desc")
      .first();
    const inserted = await ctx.db.insert("rules", {
      userId: owner._id,
      priority: (last?.priority ?? 0) + 1,
      conditionField: args.conditionField,
      conditionOp: args.conditionOp,
      conditionValue: args.conditionValue,
      actionSetCategory: args.actionSetCategory ?? undefined,
      actionRenamePayee: args.actionRenamePayee ?? undefined,
      actionAddTags: args.actionAddTags && args.actionAddTags.length ? args.actionAddTags : undefined,
    });
    return { id: inserted };
  },
});

export const updateRule = mutation({
  args: {
    ruleId: v.id("rules"),
    conditionField: v.optional(v.union(v.literal("payee"), v.literal("amount"), v.literal("rawPayee"))),
    conditionOp: v.optional(v.union(v.literal("contains"), v.literal("equals"), v.literal("starts_with"), v.literal("greater_than"))),
    conditionValue: v.optional(v.string()),
    actionSetCategory: v.optional(v.nullable(v.string())),
    actionRenamePayee: v.optional(v.nullable(v.string())),
    actionAddTags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || rule.userId !== owner._id) throw new Error("Rule not found or not owned");
    const patch: Partial<Doc<"rules">> = {};
    if (args.conditionField !== undefined) patch.conditionField = args.conditionField;
    if (args.conditionOp !== undefined) patch.conditionOp = args.conditionOp;
    if (args.conditionValue !== undefined) patch.conditionValue = args.conditionValue;
    if (args.actionSetCategory !== undefined) patch.actionSetCategory = args.actionSetCategory ?? undefined;
    if (args.actionRenamePayee !== undefined) patch.actionRenamePayee = args.actionRenamePayee ?? undefined;
    if (args.actionAddTags !== undefined) {
      patch.actionAddTags = args.actionAddTags.length ? args.actionAddTags : undefined;
    }
    await ctx.db.patch(rule._id, patch);
    return { id: rule._id };
  },
});

export const deleteRule = mutation({
  args: { ruleId: v.id("rules") },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || rule.userId !== owner._id) throw new Error("Rule not found or not owned");
    await ctx.db.delete(rule._id);
    return null;
  },
});

export const moveRule = mutation({
  args: { ruleId: v.id("rules"), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || rule.userId !== owner._id) throw new Error("Rule not found or not owned");

    const all = await ctx.db
      .query("rules")
      .withIndex("by_userId_priority", (q) => q.eq("userId", owner._id))
      .order("asc")
      .take(100);
    const idx = all.findIndex((r) => r._id === rule._id);
    const swapIdx = args.direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= all.length) return null;
    await ctx.db.patch(rule._id, { priority: all[swapIdx].priority });
    await ctx.db.patch(all[swapIdx]._id, { priority: rule.priority });
    return null;
  },
});

export const createRuleFromTransaction = mutation({
  args: {
    sourcePayee: v.string(),
    categoryId: v.optional(v.string()),
    renamePayee: v.optional(v.string()),
    addTags: v.optional(v.array(v.string())),
    applyToExisting: v.boolean(),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const last = await ctx.db
      .query("rules")
      .withIndex("by_userId_priority", (q) => q.eq("userId", owner._id))
      .order("desc")
      .first();
    await ctx.db.insert("rules", {
      userId: owner._id,
      priority: (last?.priority ?? 0) + 1,
      conditionField: "payee",
      conditionOp: "contains",
      conditionValue: args.sourcePayee,
      actionSetCategory: args.categoryId ?? undefined,
      actionRenamePayee: args.renamePayee ?? undefined,
      actionAddTags: args.addTags && args.addTags.length ? args.addTags : undefined,
    });

    if (!args.applyToExisting) return { applied: 0 };

    const needle = args.sourcePayee.toLowerCase();
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_userId_type_date", (q) => q.eq("userId", owner._id))
      .order("desc")
      .take(1000);
    let applied = 0;
    for (const tx of txs) {
      if (tx.isSplit || !tx.payee.toLowerCase().includes(needle)) continue;
      const patch: Partial<Doc<"transactions">> = {};
      if (args.categoryId && tx.categoryId !== args.categoryId) {
        const contrib = tx.amount < 0 ? Math.abs(tx.amount) : 0;
        await applySpentDelta(ctx, owner._id, tx.categoryId, -contrib);
        await applySpentDelta(ctx, owner._id, args.categoryId, contrib);
        patch.categoryId = args.categoryId;
      }
      if (args.renamePayee && tx.payee !== args.renamePayee) patch.payee = args.renamePayee;
      if (args.addTags && args.addTags.length) {
        patch.tags = Array.from(new Set([...(tx.tags ?? []), ...args.addTags]));
      }
      if (Object.keys(patch).length) {
        await ctx.db.patch(tx._id, patch);
        applied++;
      }
    }
    return { applied };
  },
});
