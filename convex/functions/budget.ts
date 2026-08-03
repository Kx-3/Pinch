import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import { Doc } from "../_generated/dataModel";

// const getOwnerUserId = async (ctx: any): Promise<string> => {
//   const identity = await ctx.auth.getUserIdentity();
  
//   if (!identity || Object.keys(identity).length === 0) {
//     throw new Error("Authentication required - no identity found");
//   }
  
//   // Clerk uses 'subject' as the user ID field
//   const owner = identity.subject;
//   if (!owner) {
//     throw new Error(`User ID not found. Available identity fields: ${Object.keys(identity).join(', ')}`);
//   }
//   return owner;
// };

const formatEnvelope = (doc: Doc<"envelopes">) => ({
  id: doc._id,
  name: doc.name,
  categoryId: doc.categoryId,
  target: doc.target,
  assigned: doc.assigned,
  spent: doc.spent,
  pinned: doc.pinned,
  note: doc.note,
  // Fixed: _creationTime is a timestamp number in Convex
  createdAt: new Date(doc._creationTime).toISOString(),
});

export const getEnvelopes = query({
  args: {},
  handler: async (ctx, _args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await ctx.db
      .query("envelopes")
      .withIndex("by_userId", (q: any) => q.eq("userId", owner._id))
      .collect();
    return rows.map(formatEnvelope);
  },
});

export const getEnvelopesByCategoryId = query({
  args: { categoryId: v.string() },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await ctx.db
      .query("envelopes")
      .withIndex("by_userId_and_categoryId", (q: any) => q.eq("userId", owner._id).eq("categoryId", args.categoryId))
      .collect();
    return rows.map(formatEnvelope);
  },
});

export const getTransactions = query({
  args: {},
  handler: async (ctx, _args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_ownerUserId_type_date", (q: any) => q.eq("ownerUserId", owner._id))
      .order("desc")
      .collect();
    return rows.map((r: any) => ({ id: r._id, date: r.date, payee: r.payee, categoryId: r.categoryId, amount: r.amount, paidFrom: r.paidFrom, tags: r.tags, type: r.type }));
  },
});
export const getExpenses = query({
  args: {},
  handler: async (ctx, _args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_ownerUserId_type_date", (q: any) => q.eq("ownerUserId", owner._id).eq("type", "expense"))
      .order("desc")
      .collect();
    return rows.map((r: any) => ({ id: r._id, date: r.date, payee: r.payee, categoryId: r.categoryId, amount: r.amount, paidFrom: r.paidFrom, tags: r.tags, type: r.type }));
  },
});

export const getPaymentMethods = query({
  args: {},
  handler: async (ctx, _args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await ctx.db.query("paymentMethods").withIndex("by_ownerUserId", (q: any) => q.eq("ownerUserId", owner._id)).collect();
    return rows.map((r: any) => ({ id: r._id, label: r.label, kind: r.kind, builtIn: !!r.builtIn }));
  },
});

export const getAccounts = query({
  args: {},
  handler: async (ctx, _args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await ctx.db.query("accounts").withIndex("by_ownerUserId", (q: any) => q.eq("ownerUserId", owner._id)).collect();
    return rows.map((r: any) => ({ id: r._id, name: r.name, kind: r.kind, balance: r.balance }));
  },
});

export const getScheduledOutflows = query({
  args: {},
  handler: async (ctx, _args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await ctx.db.query("scheduledOutflows").withIndex("by_ownerUserId", (q: any) => q.eq("ownerUserId", owner._id)).collect();
    return rows.map((r: any) => ({ id: r._id, date: r.date, name: r.name, categoryId: r.categoryId, amount: r.amount, funded: r.funded }));
  },
});

export const getTips = query({
  args: {},
  handler: async (ctx, _args) => {
    const rows = await ctx.db.query("tips").collect();
    return rows.map((r: any) => ({ id: r._id, rule: r.rule, role: r.role, body: r.body, author: r.author }));
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
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const tx = {
      ownerUserId: owner._id,
      date: args.date,
      payee: args.payee,
      categoryId: args.categoryId,
      amount: args.amount,
      paidFrom: args.paidFrom,
      tags: args.tags,
      type: args.type,
    };
    const inserted = await ctx.db.insert("transactions", tx);

    // Update envelope spent if this is an outflow with a category
    if (args.amount < 0 && args.categoryId) {
      const envs = await ctx.db.query("envelopes").withIndex("by_userId", (q: any) => q.eq("userId", owner._id)).collect();
      const env = envs.find((e: any) => e.categoryId === args.categoryId);
      if (env) {
        await ctx.db.patch(env._id, { spent: env.spent + Math.abs(args.amount) });
      }
    }
    return inserted;
  },
});

export const categorizeTransaction = mutation({
  args: { txId: v.string(), categoryId: v.string() },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const tx = await ctx.db.get(args.txId);
    if (!tx || tx.ownerUserId !== owner._id) throw new Error("Transaction not found or not owned");
    
    // Update the transaction's category
    await ctx.db.patch(args.txId, { categoryId: args.categoryId });
    
    // Update envelope spent based on the amount
    if (tx.amount < 0 && args.categoryId) {
      const envs = await ctx.db.query("envelopes").withIndex("by_userId", (q: any) => q.eq("userId", owner._id)).collect();
      const env = envs.find((e: any) => e.categoryId === args.categoryId);
      if (env) {
        await ctx.db.patch(env._id, { spent: env.spent + Math.abs(tx.amount) });
      }
    }
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
    const envelope = {
      userId: owner._id,
      name: args.name,
      categoryId: args.categoryId,
      target: args.target,
      assigned: args.assigned,
      spent: args.spent,
      pinned: args.pinned,
      note: args.note,
    };
    const insertedId = await ctx.db.insert("envelopes", envelope);
    return { id: insertedId, ...envelope };
  },
});

export const updateEnvelope = mutation({
  args: {
    envelopeId: v.string(),
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
    if (!envelope || envelope.ownerUserId !== owner._id) throw new Error("Envelope not found or not owned");
    
    const patchData: any = {};
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
  args: { envelopeId: v.string() },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const envelope = await ctx.db.get(args.envelopeId);
    if (!envelope || envelope.ownerUserId !== owner._id) throw new Error("Envelope not found or not owned");
    await ctx.db.delete(args.envelopeId);
    return null;
  },
});

export const assignToEnvelope = mutation({
  args: { categoryId: v.string(), amount: v.number() },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const envs = await ctx.db.query("envelopes").withIndex("by_ownerUserId", (q: any) => q.eq("ownerUserId", owner._id)).collect();
    const env = envs.find((e: any) => e.categoryId === args.categoryId);
    if (!env) throw new Error("Envelope not found");
    await ctx.db.patch(env._id, { assigned: env.assigned + args.amount });
    return null;
  },
});

export const togglePinEnvelope = mutation({
  args: { categoryId: v.string() },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const envs = await ctx.db.query("envelopes").withIndex("by_ownerUserId", (q: any) => q.eq("ownerUserId", owner._id)).collect();
    const env = envs.find((e: any) => e.categoryId === args.categoryId);
    if (!env) throw new Error("Envelope not found");
    await ctx.db.patch(env._id, { pinned: !env.pinned });
    return null;
  },
});

export const addPaymentMethod = mutation({
  args: { label: v.string(), kind: v.string() },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const doc = { ownerUserId: owner._id, label: args.label, kind: args.kind, builtIn: false };
    const inserted = await ctx.db.insert("paymentMethods", doc);
    return { id: inserted._id, label: inserted.label, kind: inserted.kind, builtIn: !!inserted.builtIn };
  },
});

export const removePaymentMethod = mutation({
  args: { paymentMethodId: v.string() },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const pm = await ctx.db.get(args.paymentMethodId);
    if (!pm || pm.ownerUserId !== owner._id) throw new Error("Not found or not owned");
    if (pm.builtIn) throw new Error("Cannot remove built-in payment method");
    await ctx.db.delete(args.paymentMethodId);
    return null;
  },
});

export const setTransactionTags = mutation({
  args: { txId: v.string(), tags: v.array(v.string()) },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const tx = await ctx.db.get(args.txId);
    if (!tx || tx.ownerUserId !== owner._id) throw new Error("Transaction not found or not owned");
    await ctx.db.patch(args.txId, { tags: args.tags });
    return null;
  },
});

export const fundScheduledOutflow = mutation({
  args: { scheduledId: v.string() },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const sch = await ctx.db.get(args.scheduledId);
    if (!sch || sch.ownerUserId !== owner._id) throw new Error("Scheduled outflow not found");
    if (sch.funded) return null;
    await ctx.db.patch(args.scheduledId, { funded: true });
    // Optionally credit the envelope assigned amount
    const envs = await ctx.db.query("envelopes").withIndex("by_ownerUserId", (q: any) => q.eq("ownerUserId", owner._id)).collect();
    const env = envs.find((e: any) => e.categoryId === sch.categoryId);
    if (env) await ctx.db.patch(env._id, { assigned: env.assigned + sch.amount });
    return null;
  },
});
