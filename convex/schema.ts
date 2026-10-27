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
		userId: v.id("users"),
		date: v.string(),
		payee: v.string(),
		categoryId: v.nullable(v.string()),
		amount: v.number(),
		paidFrom: v.string(),
		tags: v.array(v.string()),
		type: v.union(v.literal("expense"), v.literal("income")),
		status: v.optional(v.union(v.literal("pending"), v.literal("cleared"), v.literal("reconciled"))),
		notes: v.optional(v.string()),
		rawPayee: v.optional(v.string()),
		hash: v.optional(v.string()),
		isSplit: v.optional(v.boolean()),
	}).index("by_userId_type_date", { fields: ["userId", "type", "date"] }).index("by_userId_hash", { fields: ["userId", "hash"] }),

	transactionSplits: defineTable({
		userId: v.id("users"),
		transactionId: v.id("transactions"),
		categoryId: v.string(),
		amount: v.number(),
		note: v.optional(v.string()),
	}).index("by_userId_and_transactionId", { fields: ["userId", "transactionId"] }),

	rules: defineTable({
		userId: v.id("users"),
		priority: v.number(),
		conditionField: v.union(v.literal("payee"), v.literal("amount"), v.literal("rawPayee")),
		conditionOp: v.union(v.literal("contains"), v.literal("equals"), v.literal("starts_with"), v.literal("greater_than")),
		conditionValue: v.string(),
		actionSetCategory: v.optional(v.string()),
		actionRenamePayee: v.optional(v.string()),
		actionAddTags: v.optional(v.array(v.string())),
	}).index("by_userId_priority", { fields: ["userId", "priority"] }),

	categories: defineTable({
		userId: v.id("users"),
		name: v.string(),
		parentId: v.nullable(v.string()),
		color: v.number(),
		icon: v.string(),
		kind: v.union(v.literal("outflow"), v.literal("inflow")),
		accent: v.union(v.literal("primary"), v.literal("secondary"), v.literal("tertiary"), v.literal("error")),
	}).index("by_userId", { fields: ["userId"] }).index("by_userId_and_parentId", { fields: ["userId", "parentId"] }),

	budgets: defineTable({
		userId: v.id("users"),
		categoryId: v.string(),
		month: v.string(),
		assignedCents: v.number(),
	})
		.index("by_userId", { fields: ["userId"] })
		.index("by_userId_month", { fields: ["userId", "month"] })
		.index("by_userId_categoryId_month", { fields: ["userId", "categoryId", "month"] }),

	scheduledOutflows: defineTable({
		userId: v.id("users"),
		name: v.string(),
		amount: v.number(),
		kind: v.union(v.literal("expense"), v.literal("income")),
		frequency: v.union(v.literal("weekly"), v.literal("biweekly"), v.literal("monthly"), v.literal("annual")),
		startDate: v.string(),
		categoryId: v.nullable(v.string()),
		tags: v.array(v.string()),
		paidFrom: v.string(),
		active: v.boolean(),
		notes: v.string(),
		lastPaid: v.optional(v.string()),
		paidOccurrences: v.array(
			v.object({ date: v.string(), txId: v.optional(v.id("transactions")) }),
		),
	}).index("by_userId", { fields: ["userId"] }),

	accounts: defineTable({
		userId: v.id("users"),
		name: v.string(),
		kind: v.string(),
		balance: v.number(),
	}).index("by_userId", { fields: ["userId"] }),

	paymentMethods: defineTable({
		userId: v.id("users"),
		label: v.string(),
		kind: v.string(),
		builtIn: v.boolean(),
	}).index("by_userId", { fields: ["userId"] }),

	tips: defineTable({
		rule: v.string(),
		role: v.string(),
		body: v.string(),
		author: v.string(),
	}),
});
