import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { Doc } from "../_generated/dataModel";

const getOwnerUserId = async (ctx: any): Promise<string> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || !identity.subject) {
    throw new Error("Authentication required");
  }
  return identity.subject;
};

// Query to get all categories for a user (top-level only)
export const getCategories = query({
  args: {},
  handler: async (ctx, _args) => {
    const owner = await getOwnerUserId(ctx);
    const rows = await ctx.db
      .query("categories")
      .withIndex("by_ownerUserId", (q: any) => q.eq("ownerUserId", owner))
      .order("asc")
      .take(1000);
    
    // Build a tree structure with subcategories
    const categories: any[] = rows.map((r: any) => ({
      id: r._id,
      name: r.name,
      parentId: r.parentId,
      color: r.color,
      icon: r.icon,
      kind: r.kind,
      accent: r.accent,
    }));
    
    // Group by parent
    const topLevel = categories.filter((c) => c.parentId === null);
    const withChildren = topLevel.map((parent) => ({
      ...parent,
      children: categories.filter((c) => c.parentId === parent.id),
    }));
    
    return withChildren;
  },
});

// Query to get a single category by ID
export const getCategoryById = query({
  args: { categoryId: v.string() },
  handler: async (ctx, args) => {
    const owner = await getOwnerUserId(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.ownerUserId !== owner) {
      return null;
    }
    return {
      id: category._id,
      name: category.name,
      parentId: category.parentId,
      color: category.color,
      icon: category.icon,
      kind: category.kind,
      accent: category.accent,
    };
  },
});

// Query to get categories for a specific kind (inflow/outflow)
export const getCategoriesByKind = query({
  args: { kind: v.union(v.literal("outflow"), v.literal("inflow")) },
  handler: async (ctx, args) => {
    const owner = await getOwnerUserId(ctx);
    const rows = await ctx.db
      .query("categories")
      .withIndex("by_ownerUserId", (q: any) => q.eq("ownerUserId", owner))
      .filter((q: any, p: any) => q.eq(p.kind, args.kind))
      .order("asc")
      .take(1000);
    
    const categories: any[] = rows.map((r: any) => ({
      id: r._id,
      name: r.name,
      parentId: r.parentId,
      color: r.color,
      icon: r.icon,
      kind: r.kind,
      accent: r.accent,
    }));
    
    // Build tree
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
    parentId: v.optional(v.string()),
    color: v.number(),
    icon: v.string(),
    kind: v.union(v.literal("outflow"), v.literal("inflow")),
    accent: v.union(v.literal("primary"), v.literal("secondary"), v.literal("tertiary"), v.literal("error")),
  },
  handler: async (ctx, args) => {
    const owner = await getOwnerUserId(ctx);
    const category = {
      ownerUserId: owner,
      name: args.name,
      parentId: args.parentId ?? null,
      color: args.color,
      icon: args.icon,
      kind: args.kind,
      accent: args.accent,
    };
    const inserted = await ctx.db.insert("categories", category);
    return { id: inserted._id, ...category };
  },
});

// Mutation to update a category
export const updateCategory = mutation({
  args: {
    categoryId: v.string(),
    name: v.optional(v.string()),
    parentId: v.optional(v.nullable(v.string())),
    color: v.optional(v.number()),
    icon: v.optional(v.string()),
    kind: v.optional(v.union(v.literal("outflow"), v.literal("inflow"))),
    accent: v.optional(v.union(v.literal("primary"), v.literal("secondary"), v.literal("tertiary"), v.literal("error"))),
  },
  handler: async (ctx, args) => {
    const owner = await getOwnerUserId(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.ownerUserId !== owner) {
      throw new Error("Category not found or not owned");
    }
    
    const patchData: any = {};
    if (args.name !== undefined) patchData.name = args.name;
    if (args.parentId !== undefined) patchData.parentId = args.parentId;
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
  args: { categoryId: v.string() },
  handler: async (ctx, args) => {
    const owner = await getOwnerUserId(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.ownerUserId !== owner) {
      throw new Error("Category not found or not owned");
    }
    
    // Check if there are subcategories
    const subcategories = await ctx.db
      .query("categories")
      .withIndex("by_ownerUserId_and_parentId", (q: any) => q.eq("ownerUserId", owner).eq("parentId", args.categoryId))
      .take(1);
    
    if (subcategories.length > 0) {
      throw new Error("Cannot delete category with subcategories. Move or delete subcategories first.");
    }
    
    await ctx.db.delete(args.categoryId);
    return null;
  },
});

// Mutation to create a subcategory (helper)
export const addSubcategory = mutation({
  args: {
    parentId: v.string(),
    name: v.string(),
    color: v.number(),
    icon: v.string(),
    kind: v.union(v.literal("outflow"), v.literal("inflow")),
    accent: v.union(v.literal("primary"), v.literal("secondary"), v.literal("tertiary"), v.literal("error")),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(api.functions.addCategory, {
      name: args.name,
      parentId: args.parentId,
      color: args.color,
      icon: args.icon,
      kind: args.kind,
      accent: args.accent,
    });
  },
});
