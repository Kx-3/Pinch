import { query, mutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import { Doc, Id } from "../_generated/dataModel";
import { applySpentDelta, insertTransactionRecord } from "./helpers";

const formatEnvelope = (doc: Doc<"envelopes">) => ({
  id: doc._id,
  name: doc.name,
  categoryId: doc.categoryId,
  target: doc.target,
  assigned: doc.assigned,
  spent: doc.spent,
  pinned: doc.pinned,
  note: doc.note,
  createdAt: new Date(doc._creationTime).toISOString(),
});

const formatTransaction = (doc: Doc<"transactions">) => ({
  id: doc._id,
  date: doc.date,
  payee: doc.payee,
  categoryId: doc.categoryId,
  amount: doc.amount,
  paidFrom: doc.paidFrom,
  tags: doc.tags,
  type: doc.type,
  status: doc.status ?? "cleared",
  notes: doc.notes ?? "",
  rawPayee: doc.rawPayee,
  isSplit: doc.isSplit ?? false,
});

export const getEnvelopes = query({
  args: {},
  handler: async (ctx, _args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await ctx.db
      .query("envelopes")
      .withIndex("by_userId", (q) => q.eq("userId", owner._id))
      .take(1000);
    return rows.map(formatEnvelope);
  },
});

const rangeArgs = {
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
};

export const getTransactions = query({
  args: rangeArgs,
  handler: async (ctx, { startDate, endDate }) => {
    const owner = await getCurrentUserOrThrow(ctx);
    let query = ctx.db
      .query("transactions")
      .withIndex("by_userId_type_date", (q) => q.eq("userId", owner._id));
    if (startDate && endDate) {
      query = query.filter((q) =>
        q.and(q.gte(q.field("date"), startDate), q.lte(q.field("date"), endDate)),
      );
    }
    const rows = await query.order("desc").take(1000);
    return rows.map(formatTransaction);
  },
});

export const getExpenses = query({
  args: rangeArgs,
  handler: async (ctx, { startDate, endDate }) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_userId_type_date", (q) => {
        const base = q.eq("userId", owner._id).eq("type", "expense");
        if (startDate && endDate) return base.gte("date", startDate).lte("date", endDate);
        return base;
      })
      .order("desc")
      .take(1000);
    return rows.map(formatTransaction);
  },
});

export const getPaymentMethods = query({
  args: {},
  handler: async (ctx, _args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await ctx.db
      .query("paymentMethods")
      .withIndex("by_userId", (q) => q.eq("userId", owner._id))
      .take(1000);
    return rows.map((r) => ({ id: r._id, label: r.label, kind: r.kind, builtIn: r.builtIn }));
  },
});

export const getAccounts = query({
  args: {},
  handler: async (ctx, _args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await ctx.db
      .query("accounts")
      .withIndex("by_userId", (q) => q.eq("userId", owner._id))
      .take(1000);
    return rows.map((r) => ({ id: r._id, name: r.name, kind: r.kind, balance: r.balance }));
  },
});

// ----------------- Mutations -----------------

export const addTransaction = mutation({
  args: {
    date: v.string(),
    payee: v.string(),
    categoryId: v.union(v.string(), v.null()),
    amount: v.number(),
    paidFrom: v.string(),
    tags: v.array(v.string()),
    type: v.union(v.literal("expense"), v.literal("income")),
    status: v.optional(v.union(v.literal("pending"), v.literal("cleared"), v.literal("reconciled"))),
    notes: v.optional(v.string()),
    rawPayee: v.optional(v.string()),
    splits: v.optional(
      v.array(v.object({ categoryId: v.string(), amount: v.number(), note: v.optional(v.string()) })),
    ),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const txId = await insertTransactionRecord(ctx, owner._id, {
      date: args.date,
      payee: args.payee,
      categoryId: args.categoryId,
      amount: args.amount,
      paidFrom: args.paidFrom,
      tags: args.tags,
      type: args.type,
      status: args.status ?? "cleared",
      notes: args.notes ?? "",
      rawPayee: args.rawPayee ?? null,
      splits: args.splits ?? [],
    });
    return txId;
  },
});

export const categorizeTransaction = mutation({
  args: { txId: v.id("transactions"), categoryId: v.string() },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const tx = await ctx.db.get(args.txId);
    if (!tx || tx.userId !== owner._id) throw new Error("Transaction not found or not owned");

    const contrib = tx.amount < 0 ? Math.abs(tx.amount) : 0;
    await applySpentDelta(ctx, owner._id, tx.categoryId, -contrib);
    await applySpentDelta(ctx, owner._id, args.categoryId, contrib);

    const patch: Partial<Doc<"transactions">> = { categoryId: args.categoryId };
    if (!tx.rawPayee) patch.rawPayee = tx.payee;
    await ctx.db.patch(args.txId, patch);
    return null;
  },
});

export const addEnvelope = mutation({
  args: {
    name: v.string(),
    categoryId: v.string(),
    target: v.number(),
    assigned: v.number(),
    spent: v.number(),
    pinned: v.boolean(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const insertedId = await ctx.db.insert("envelopes", {
      userId: owner._id,
      name: args.name,
      categoryId: args.categoryId,
      target: args.target,
      assigned: args.assigned,
      spent: args.spent,
      pinned: args.pinned,
      note: args.note,
    });
    return { id: insertedId, ...args };
  },
});

export const updateEnvelope = mutation({
  args: {
    envelopeId: v.id("envelopes"),
    name: v.optional(v.string()),
    target: v.optional(v.number()),
    assigned: v.optional(v.number()),
    spent: v.optional(v.number()),
    pinned: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const envelope = await ctx.db.get(args.envelopeId);
    if (!envelope || envelope.userId !== owner._id) throw new Error("Envelope not found or not owned");

    const patchData: Partial<Doc<"envelopes">> = {};
    if (args.name !== undefined) patchData.name = args.name;
    if (args.target !== undefined) patchData.target = args.target;
    if (args.assigned !== undefined) patchData.assigned = args.assigned;
    if (args.spent !== undefined) patchData.spent = args.spent;
    if (args.pinned !== undefined) patchData.pinned = args.pinned;
    if (args.note !== undefined) patchData.note = args.note;

    await ctx.db.patch(args.envelopeId, patchData);
    return { id: envelope._id, ...patchData };
  },
});

export const deleteEnvelope = mutation({
  args: { envelopeId: v.id("envelopes") },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const envelope = await ctx.db.get(args.envelopeId);
    if (!envelope || envelope.userId !== owner._id) throw new Error("Envelope not found or not owned");
    await ctx.db.delete(args.envelopeId);
    return null;
  },
});

/** Find or create the envelope for a category, so any outflow category is budgetable. */
async function getOrCreateEnvelope(
  ctx: MutationCtx,
  owner: Doc<"users">,
  categoryId: string,
  name: string,
): Promise<Id<"envelopes">> {
  const existing = await ctx.db
    .query("envelopes")
    .withIndex("by_userId_and_categoryId", (q) => q.eq("userId", owner._id).eq("categoryId", categoryId))
    .first();
  if (existing) return existing._id;
  return await ctx.db.insert("envelopes", {
    userId: owner._id,
    name,
    categoryId,
    target: 0,
    assigned: 0,
    spent: 0,
    pinned: false,
    note: "",
  });
}

export const setCategoryBudget = mutation({
  args: { categoryId: v.string(), target: v.number() },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const category = await ctx.db
      .query("categories")
      .withIndex("by_userId", (q) => q.eq("userId", owner._id))
      .filter((q) => q.eq(q.field("_id"), args.categoryId))
      .first();
    if (!category) throw new Error("Category not found");
    if (category.kind !== "outflow") throw new Error("Only outflow categories can have a budget");
    const envId = await getOrCreateEnvelope(ctx, owner, args.categoryId, category.name);
    await ctx.db.patch(envId, { target: Math.max(0, args.target) });
    return { id: envId, target: Math.max(0, args.target) };
  },
});

export const assignToEnvelope = mutation({
  args: { categoryId: v.string(), amount: v.number() },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const category = await ctx.db
      .query("categories")
      .withIndex("by_userId", (q) => q.eq("userId", owner._id))
      .filter((q) => q.eq(q.field("_id"), args.categoryId))
      .first();
    const envId = await getOrCreateEnvelope(ctx, owner, args.categoryId, category?.name ?? "Category");
    const env = await ctx.db.get(envId);
    await ctx.db.patch(envId, { assigned: (env?.assigned ?? 0) + args.amount });
    return null;
  },
});

export const togglePinEnvelope = mutation({
  args: { categoryId: v.string() },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const category = await ctx.db
      .query("categories")
      .withIndex("by_userId", (q) => q.eq("userId", owner._id))
      .filter((q) => q.eq(q.field("_id"), args.categoryId))
      .first();
    const envId = await getOrCreateEnvelope(ctx, owner, args.categoryId, category?.name ?? "Category");
    const env = await ctx.db.get(envId);
    await ctx.db.patch(envId, { pinned: !(env?.pinned ?? false) });
    return null;
  },
});

export const addPaymentMethod = mutation({
  args: { label: v.string(), kind: v.string() },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const inserted = await ctx.db.insert("paymentMethods", {
      userId: owner._id,
      label: args.label,
      kind: args.kind,
      builtIn: false,
    });
    return { id: inserted, label: args.label, kind: args.kind, builtIn: false };
  },
});

export const removePaymentMethod = mutation({
  args: { paymentMethodId: v.id("paymentMethods") },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const pm = await ctx.db.get(args.paymentMethodId);
    if (!pm || pm.userId !== owner._id) throw new Error("Not found or not owned");
    if (pm.builtIn) throw new Error("Cannot remove built-in payment method");
    await ctx.db.delete(args.paymentMethodId);
    return null;
  },
});

export const setTransactionTags = mutation({
  args: { txId: v.id("transactions"), tags: v.array(v.string()) },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const tx = await ctx.db.get(args.txId);
    if (!tx || tx.userId !== owner._id) throw new Error("Transaction not found or not owned");
    await ctx.db.patch(args.txId, { tags: args.tags });
    return null;
  },
});
