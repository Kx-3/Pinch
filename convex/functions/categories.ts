import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import { Doc } from "../_generated/dataModel";

const formatCategory = (doc: Doc<"categories">) => ({
  id: doc._id,
  name: doc.name,
  parentId: doc.parentId || null,
  color: doc.color,
  icon: doc.icon,
  kind: doc.kind,
  accent: doc.accent,
});

// Query to get all categories for a user (top-level only, with children attached)
export const getCategories = query({
  args: {},
  handler: async (ctx, _args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const rows = await ctx.db
      .query("categories")
      .withIndex("by_userId", (q) => q.eq("userId", owner._id))
      .order("asc")
      .take(1000);

    const categories = rows.map(formatCategory);

    // Build a tree structure with subcategories
    const topLevel = categories.filter((c) => c.parentId === null);
    return topLevel.map((parent) => ({
      ...parent,
      children: categories.filter((c) => c.parentId === parent.id),
    }));
  },
});

// Mutation to add a category
export const addCategory = mutation({
  args: {
    name: v.string(),
    parentId: v.optional(v.nullable(v.string())),
    color: v.number(),
    icon: v.string(),
    kind: v.union(v.literal("outflow"), v.literal("inflow")),
    accent: v.union(v.literal("primary"), v.literal("secondary"), v.literal("tertiary"), v.literal("error")),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const inserted = await ctx.db.insert("categories", {
      userId: owner._id,
      name: args.name,
      parentId: args.parentId || null,
      color: args.color,
      icon: args.icon,
      kind: args.kind,
      accent: args.accent,
    });

    // Every outflow category is budgetable from the start — seed its envelope.
    if (args.kind === "outflow") {
      await ctx.db.insert("envelopes", {
        userId: owner._id,
        name: args.name,
        categoryId: inserted,
        target: 0,
        assigned: 0,
        spent: 0,
        pinned: false,
        note: "",
      });
    }

    return { id: inserted, ...args, parentId: args.parentId || null };
  },
});

// Mutation to update a category
export const updateCategory = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    parentId: v.optional(v.nullable(v.string())),
    color: v.optional(v.number()),
    icon: v.optional(v.string()),
    kind: v.optional(v.union(v.literal("outflow"), v.literal("inflow"))),
    accent: v.optional(v.union(v.literal("primary"), v.literal("secondary"), v.literal("tertiary"), v.literal("error"))),
  },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== owner._id) {
      throw new Error("Category not found or not owned");
    }

    const patchData: Partial<Doc<"categories">> = {};
    if (args.name !== undefined) patchData.name = args.name;
    if (args.parentId !== undefined) patchData.parentId = args.parentId || null;
    if (args.color !== undefined) patchData.color = args.color;
    if (args.icon !== undefined) patchData.icon = args.icon;
    if (args.kind !== undefined) patchData.kind = args.kind;
    if (args.accent !== undefined) patchData.accent = args.accent;

    await ctx.db.patch(args.categoryId, patchData);
    return { id: category._id, ...patchData };
  },
});

// Mutation to delete a category
export const deleteCategory = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const owner = await getCurrentUserOrThrow(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== owner._id) {
      throw new Error("Category not found or not owned");
    }

    // Check if there are subcategories
    const subcategories = await ctx.db
      .query("categories")
      .withIndex("by_userId_and_parentId", (q) => q.eq("userId", owner._id).eq("parentId", args.categoryId))
      .take(1);

    if (subcategories.length > 0) {
      throw new Error("Cannot delete category with subcategories. Move or delete subcategories first.");
    }

    await ctx.db.delete(args.categoryId);
    return null;
  },
});
