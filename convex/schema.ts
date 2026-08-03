import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	users: defineTable({
		clerkUserId: v.string(),
		name: v.string(),
		email: v.string(),
	}).index("by_clerkUserId", { fields: ["clerkUserId"] }),

	envelopes: defineTable({
		userId: v.id("users"),
		name: v.string(),
		categoryId: v.string(),
		target: v.number(),
		assigned: v.number(),
		spent: v.number(),
		pinned: v.boolean(),
		note: v.string(),
	}).index("by_userId", { fields: ["userId"] }).index("by_userId_and_categoryId", { fields: ["userId", "categoryId"] }),

	transactions: defineTable({
		ownerUserId: v.string(),
		date: v.string(),
		payee: v.string(),
		categoryId: v.nullable(v.string()),
		amount: v.number(),
		paidFrom: v.string(),
		tags: v.array(v.string()),
        type: v.union(v.literal("expense"), v.literal("income")),
	}).index("by_ownerUserId_type_date", { fields: ["ownerUserId", "type", "date"] }),

	categories: defineTable({
		ownerUserId: v.string(),
		name: v.string(),
		parentId: v.nullable(v.string()),
		color: v.number(),
		icon: v.string(),
		kind: v.union(v.literal("outflow"), v.literal("inflow")),
		accent: v.union(v.literal("primary"), v.literal("secondary"), v.literal("tertiary"), v.literal("error")),
	}).index("by_ownerUserId", { fields: ["ownerUserId"] }).index("by_ownerUserId_and_parentId", { fields: ["ownerUserId", "parentId"] }),

	scheduledOutflows: defineTable({
		ownerUserId: v.string(),
		date: v.string(),
		name: v.string(),
		categoryId: v.string(),
		amount: v.number(),
		funded: v.boolean(),
	}).index("by_ownerUserId", { fields: ["ownerUserId"] }),

	accounts: defineTable({
		ownerUserId: v.string(),
		name: v.string(),
		kind: v.string(),
		balance: v.number(),
	}).index("by_ownerUserId", { fields: ["ownerUserId"] }),

	paymentMethods: defineTable({
		ownerUserId: v.string(),
		label: v.string(),
		kind: v.string(),
		builtIn: v.boolean(),
	}).index("by_ownerUserId", { fields: ["ownerUserId"] }),

	tips: defineTable({
		rule: v.string(),
		role: v.string(),
		body: v.string(),
		author: v.string(),
	}),
});
