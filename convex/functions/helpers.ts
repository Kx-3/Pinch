import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { listRulesForUser, applyRules } from "./rules";

/** Add `delta` to the envelope `spent` for a category (skipped when no envelope exists). */
export async function applySpentDelta(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  categoryId: string | null,
  delta: number,
): Promise<void> {
  if (!categoryId || delta === 0) return;
  const env = await ctx.db
    .query("envelopes")
    .withIndex("by_userId_and_categoryId", (q) => q.eq("userId", ownerId).eq("categoryId", categoryId))
    .first();
  if (env) {
    await ctx.db.patch(env._id, { spent: env.spent + delta });
  }
}

export type InsertTransactionArgs = {
  date: string;
  payee: string;
  categoryId: string | null;
  amount: number;
  paidFrom: string;
  tags: string[];
  type: "expense" | "income";
  status?: "pending" | "cleared" | "reconciled";
  notes?: string;
  rawPayee?: string | null;
  splits?: { categoryId: string; amount: number; note?: string }[];
};

/**
 * Create a transaction, applying rules (rename payee / set category / add tags),
 * persisting split lines, and bumping envelope spent for outflows. Shared by the
 * manual add flow and the recurring "mark paid" flow so behavior stays identical.
 */
export async function insertTransactionRecord(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  args: InsertTransactionArgs,
): Promise<Id<"transactions">> {
  const rules = await listRulesForUser(ctx, ownerId);
  const applied = applyRules(rules, {
    payee: args.payee,
    rawPayee: args.rawPayee ?? null,
    amount: args.amount,
    tags: args.tags,
    categoryId: args.categoryId,
  });
  const splits = args.splits ?? [];
  const isSplit = splits.length > 0;

  const inserted = await ctx.db.insert("transactions", {
    userId: ownerId,
    date: args.date,
    payee: applied.payee,
    categoryId: isSplit ? null : applied.categoryId,
    amount: args.amount,
    paidFrom: args.paidFrom,
    tags: applied.tags,
    type: args.type,
    status: args.status ?? "cleared",
    notes: args.notes ?? "",
    rawPayee: args.rawPayee ?? undefined,
    isSplit,
  });

  if (args.amount < 0) {
    if (isSplit) {
      for (const s of splits) {
        await ctx.db.insert("transactionSplits", {
          userId: ownerId,
          transactionId: inserted,
          categoryId: s.categoryId,
          amount: s.amount,
          note: s.note ?? "",
        });
        await applySpentDelta(ctx, ownerId, s.categoryId, Math.abs(s.amount));
      }
    } else if (applied.categoryId) {
      await applySpentDelta(ctx, ownerId, applied.categoryId, Math.abs(args.amount));
    }
  }
  return inserted;
}
