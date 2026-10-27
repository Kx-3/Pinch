import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import { Doc } from "../_generated/dataModel";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const formatBudget = (doc: Doc<"budgets">) => ({
  categoryId: doc.categoryId,
  month: doc.month,
  assignedCents: doc.assignedCents,
});

export const getBudgets = query({
  args: {},
  handler: async (ctx) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await ctx.db
      .query("budgets")
      .withIndex("by_userId", (q) => q.eq("userId", owner._id))
      .take(2000);
    return rows.map(formatBudget);
  },
});

/** Set the assigned amount (integer cents) for a category in a given month. Upserts. */
export const setAssignedAmount = mutation({
  args: {
    categoryId: v.string(),
    month: v.string(),
    assignedCents: v.number(),
  },
  handler: async (ctx, args) => {
    if (!/^[+-]?\d+$/.test(String(args.assignedCents))) {
      throw new Error("assignedCents must be an integer");
    }
    if (!MONTH_RE.test(args.month)) {
      throw new Error("month must be formatted as YYYY-MM");
    }

    const owner = await getCurrentUserOrThrow(ctx);
    const category = await ctx.db
      .query("categories")
      .withIndex("by_userId", (q) => q.eq("userId", owner._id))
      .filter((q) => q.eq(q.field("_id"), args.categoryId))
      .first();
    if (!category) throw new Error("Category not found");

    const existing = await ctx.db
      .query("budgets")
      .withIndex("by_userId_categoryId_month", (q) =>
        q.eq("userId", owner._id).eq("categoryId", args.categoryId).eq("month", args.month),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { assignedCents: args.assignedCents });
    } else {
      await ctx.db.insert("budgets", {
        userId: owner._id,
        categoryId: args.categoryId,
        month: args.month,
        assignedCents: args.assignedCents,
      });
    }

    return { categoryId: args.categoryId, month: args.month, assignedCents: args.assignedCents };
  },
});