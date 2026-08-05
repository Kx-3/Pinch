import { query, mutation, QueryCtx, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import { Doc, Id } from "../_generated/dataModel";
import { applySpentDelta } from "./helpers";
import { listRulesForUser, applyRules } from "./rules";

const splitValidator = v.object({
  categoryId: v.string(),
  amount: v.number(),
  note: v.optional(v.string()),
});

const importRowValidator = v.object({
  date: v.string(),
  payee: v.string(),
  amount: v.number(),
  categoryId: v.optional(v.nullable(v.string())),
  tags: v.optional(v.array(v.string())),
  rawPayee: v.optional(v.string()),
  hash: v.optional(v.string()),
  paidFrom: v.optional(v.string()),
  notes: v.optional(v.string()),
});

async function getSplitsFor(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"users">,
  txId: Id<"transactions">,
) {
  return await ctx.db
    .query("transactionSplits")
    .withIndex("by_userId_and_transactionId", (q) => q.eq("userId", ownerId).eq("transactionId", txId))
    .order("asc")
    .take(50);
}

export const getSplits = query({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await getSplitsFor(ctx, owner._id, args.transactionId);
    return rows.map((r) => ({ id: r._id, categoryId: r.categoryId, amount: r.amount, note: r.note ?? "" }));
  },
});

export const updateTransaction = mutation({
  args: {
    txId: v.id("transactions"),
    date: v.optional(v.string()),
    payee: v.optional(v.string()),
    categoryId: v.optional(v.nullable(v.string())),
    amount: v.optional(v.number()),
    paidFrom: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal("pending"), v.literal("cleared"), v.literal("reconciled"))),
    splits: v.optional(v.array(splitValidator)),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const tx = await ctx.db.get(args.txId);
    if (!tx || tx.userId !== owner._id) throw new Error("Transaction not found or not owned");

    const oldIsSplit = !!tx.isSplit;
    const oldSplits = oldIsSplit ? await getSplitsFor(ctx, owner._id, tx._id) : [];
    const oldContrib = tx.amount < 0 ? Math.abs(tx.amount) : 0;
    const newAmount = args.amount ?? tx.amount;
    const newContrib = newAmount < 0 ? Math.abs(newAmount) : 0;

    // 1. Remove old contributions
    if (oldIsSplit) {
      for (const s of oldSplits) await applySpentDelta(ctx, owner._id, s.categoryId, -Math.abs(s.amount));
    } else {
      await applySpentDelta(ctx, owner._id, tx.categoryId, -oldContrib);
    }

    // 2. Write the new state
    const patch: Partial<Doc<"transactions">> = {};
    if (args.date !== undefined) patch.date = args.date;
    if (args.payee !== undefined) patch.payee = args.payee;
    if (args.amount !== undefined) patch.amount = args.amount;
    if (args.paidFrom !== undefined) patch.paidFrom = args.paidFrom;
    if (args.tags !== undefined) patch.tags = args.tags;
    if (args.notes !== undefined) patch.notes = args.notes;
    if (args.status !== undefined) patch.status = args.status;

    let newIsSplit = oldIsSplit;
    let newCategoryId: string | null = tx.categoryId;

    if (args.splits !== undefined) {
      for (const s of oldSplits) await ctx.db.delete(s._id);
      newIsSplit = args.splits.length > 0;
      newCategoryId = newIsSplit ? null : (args.categoryId !== undefined ? args.categoryId : tx.categoryId);
      if (newIsSplit) {
        for (const s of args.splits) {
          await ctx.db.insert("transactionSplits", {
            userId: owner._id,
            transactionId: tx._id,
            categoryId: s.categoryId,
            amount: s.amount,
            note: s.note ?? "",
          });
        }
      }
    } else if (oldIsSplit && args.categoryId !== undefined) {
      // Converting split -> single without an explicit splits list
      for (const s of oldSplits) await ctx.db.delete(s._id);
      newIsSplit = false;
      newCategoryId = args.categoryId;
    } else if (args.categoryId !== undefined) {
      newCategoryId = args.categoryId;
    }

    patch.isSplit = newIsSplit;
    patch.categoryId = newCategoryId;
    await ctx.db.patch(tx._id, patch);

    // 3. Add new contributions
    if (newIsSplit) {
      const finalSplits = args.splits !== undefined
        ? args.splits
        : oldSplits.map((s) => ({ categoryId: s.categoryId, amount: s.amount, note: s.note ?? "" }));
      for (const s of finalSplits) await applySpentDelta(ctx, owner._id, s.categoryId, Math.abs(s.amount));
    } else {
      await applySpentDelta(ctx, owner._id, newCategoryId, newContrib);
    }

    return { id: tx._id };
  },
});

export const deleteTransaction = mutation({
  args: { txId: v.id("transactions") },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const tx = await ctx.db.get(args.txId);
    if (!tx || tx.userId !== owner._id) throw new Error("Transaction not found or not owned");

    if (tx.isSplit) {
      const splits = await getSplitsFor(ctx, owner._id, tx._id);
      for (const s of splits) {
        await applySpentDelta(ctx, owner._id, s.categoryId, -Math.abs(s.amount));
        await ctx.db.delete(s._id);
      }
    } else if (tx.amount < 0) {
      await applySpentDelta(ctx, owner._id, tx.categoryId, -Math.abs(tx.amount));
    }
    await ctx.db.delete(tx._id);
    return null;
  },
});

export const setTransactionStatus = mutation({
  args: {
    txId: v.id("transactions"),
    status: v.union(v.literal("pending"), v.literal("cleared"), v.literal("reconciled")),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const tx = await ctx.db.get(args.txId);
    if (!tx || tx.userId !== owner._id) throw new Error("Transaction not found or not owned");
    await ctx.db.patch(tx._id, { status: args.status });
    return null;
  },
});

export const batchCategorizeTransactions = mutation({
  args: {
    txIds: v.array(v.id("transactions")),
    categoryId: v.string(),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    let updated = 0;
    for (const txId of args.txIds) {
      const tx = await ctx.db.get(txId);
      if (!tx || tx.userId !== owner._id || tx.isSplit || tx.categoryId === args.categoryId) continue;
      const contrib = tx.amount < 0 ? Math.abs(tx.amount) : 0;
      await applySpentDelta(ctx, owner._id, tx.categoryId, -contrib);
      await applySpentDelta(ctx, owner._id, args.categoryId, contrib);
      await ctx.db.patch(txId, { categoryId: args.categoryId });
      updated++;
    }
    return { updated };
  },
});

export const batchTagTransactions = mutation({
  args: {
    txIds: v.array(v.id("transactions")),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    let updated = 0;
    for (const txId of args.txIds) {
      const tx = await ctx.db.get(txId);
      if (!tx || tx.userId !== owner._id) continue;
      await ctx.db.patch(txId, { tags: Array.from(new Set([...(tx.tags ?? []), ...args.tags])) });
      updated++;
    }
    return { updated };
  },
});

export const batchDeleteTransactions = mutation({
  args: { txIds: v.array(v.id("transactions")) },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    let deleted = 0;
    for (const txId of args.txIds) {
      const tx = await ctx.db.get(txId);
      if (!tx || tx.userId !== owner._id) continue;
      if (tx.isSplit) {
        const splits = await getSplitsFor(ctx, owner._id, txId);
        for (const s of splits) {
          await applySpentDelta(ctx, owner._id, s.categoryId, -Math.abs(s.amount));
          await ctx.db.delete(s._id);
        }
      } else if (tx.amount < 0) {
        await applySpentDelta(ctx, owner._id, tx.categoryId, -Math.abs(tx.amount));
      }
      await ctx.db.delete(txId);
      deleted++;
    }
    return { deleted };
  },
});

export const previewImport = query({
  args: { rows: v.array(importRowValidator) },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rules = await listRulesForUser(ctx, owner._id);
    return args.rows.map((r, index) => {
      const applied = applyRules(rules, {
        payee: r.payee,
        rawPayee: r.rawPayee ?? null,
        amount: r.amount,
        tags: r.tags ?? [],
        categoryId: r.categoryId ?? null,
      });
      return {
        index,
        date: r.date,
        payee: applied.payee,
        rawPayee: r.rawPayee ?? "",
        amount: r.amount,
        categoryId: applied.categoryId,
        tags: applied.tags,
        hash: r.hash ?? null,
      };
    });
  },
});

export const importTransactions = mutation({
  args: {
    rows: v.array(importRowValidator),
    defaultPaidFrom: v.string(),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rules = await listRulesForUser(ctx, owner._id);
    let imported = 0;
    const skipped: number[] = [];
    for (let i = 0; i < args.rows.length; i++) {
      const r = args.rows[i];
      if (r.hash) {
        const existing = await ctx.db
          .query("transactions")
          .withIndex("by_userId_hash", (q) => q.eq("userId", owner._id).eq("hash", r.hash))
          .first();
        if (existing) {
          skipped.push(i);
          continue;
        }
      }
      const applied = applyRules(rules, {
        payee: r.payee,
        rawPayee: r.rawPayee ?? null,
        amount: r.amount,
        tags: r.tags ?? [],
        categoryId: r.categoryId ?? null,
      });
      await ctx.db.insert("transactions", {
        userId: owner._id,
        date: r.date,
        payee: applied.payee,
        categoryId: applied.categoryId,
        amount: r.amount,
        paidFrom: r.paidFrom ?? args.defaultPaidFrom,
        tags: applied.tags,
        type: r.amount < 0 ? "expense" : "income",
        status: "cleared",
        notes: r.notes ?? "",
        rawPayee: r.rawPayee ?? r.payee,
        hash: r.hash ?? undefined,
        isSplit: false,
      });
      if (r.amount < 0 && applied.categoryId) {
        await applySpentDelta(ctx, owner._id, applied.categoryId, Math.abs(r.amount));
      }
      imported++;
    }
    return { imported, skipped };
  },
});
