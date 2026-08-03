import { query, internalMutation, QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { v } from "convex/values";

export async function getCurrentUserOrThrow(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated call");
  }

  // Look up user by identity.tokenIdentifier (or identity.subject)
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) =>
      q.eq("clerkUserId", identity.subject)
    )
    .unique();

  if (!user) {
    throw new Error("User not found in database. Ensure webhooks/sync are configured.");
  }

  return user;
}

export const getUserId = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called getUserId without authentication identity");
    }

    // Check if the user already exists in your table
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", identity.subject))
      .unique();
      
    if (user !== null) {
      return user._id;
    }
  },
});

export const upsertFromClerk = internalMutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    
    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        name: args.name,
        email: args.email,
      });
      return existingUser._id;
    } else {
      await ctx.db.insert("users", args);
      return null;
    }
  }
})

export const deleteFromClerk = internalMutation({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    
    if (existingUser) {
      await ctx.db.delete(existingUser._id);
    }
  }
});
