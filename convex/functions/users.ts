import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const storeUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication identity");
    }

    // Check if the user already exists in your table
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", identity.tokenIdentifier))
      .unique();

    if (user !== null) {
      // If the user exists, optionally update their info if it changed
      if (user.name !== identity.name || user.email !== identity.email) {
        await ctx.db.patch(user._id, { 
          name: identity.name ?? user.name, 
          email: identity.email ?? user.email 
        });
      }
      return user._id;
    }

    // If the user is new, insert them into the table
    const inserted = await ctx.db.insert("users", {
      clerkUserId: identity.tokenIdentifier,
      name: identity.name ?? "Anonymous",
      email: identity.email ?? "",
      initials: identity.name ? identity.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() : "AN",
    });
    return inserted;
  },
});
