"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type {
  Account,
  PaymentMethod,
  PaymentMethodKind,
  Recurring,
  RecurringSuggestion,
  Transaction,
  TransactionSplit,
  Rule,
  RuleConditionField,
  RuleConditionOp,
} from "@/lib/mockData";
import type { Accent } from "@/lib/categories";

export interface ServerCategory {
  id: string;
  name: string;
  parentId: string | null;
  color: number;
  icon: string;
  kind: "outflow" | "inflow";
  accent: Accent;
  children?: ServerCategory[];
}

export interface BudgetEnvelope {
  id: string;
  categoryId: string;
  name: string;
  target: number;
  assigned: number;
  spent: number;
  pinned: boolean;
  note: string;
  createdAt: string;
  group: string;
  accent: Accent;
  color: number;
  path: string;
}

export interface Totals {
  assigned: number;
  spent: number;
  income: number;
  overspent: BudgetEnvelope[];
  underfunded: BudgetEnvelope[];
  uncategorized: Transaction[];
}

// ---------- Queries ----------

export function useEnvelopes(): BudgetEnvelope[] {
  const raw = useQuery(api.functions.budget.getEnvelopes, {});
  const categories = useCategories();
  return useMemo(() => enrichEnvelopes(raw ?? [], categories), [raw, categories]);
}

export function useTransactions(): Transaction[] {
  return useQuery(api.functions.budget.getTransactions, {}) ?? [];
}

export function useExpenses(): Transaction[] {
  return useQuery(api.functions.budget.getExpenses, {}) ?? [];
}

export function useAccounts(): Account[] {
  const rows = useQuery(api.functions.budget.getAccounts, {});
  return useMemo(
    () => (rows ?? []).map((r) => ({ id: r.id, name: r.name, kind: r.kind as Account["kind"], balance: r.balance })),
    [rows],
  );
}

export function usePaymentMethods(): PaymentMethod[] {
  const rows = useQuery(api.functions.budget.getPaymentMethods, {});
  return useMemo(
    () =>
      (rows ?? []).map((r) => ({
        id: r.id,
        label: r.label,
        kind: r.kind as PaymentMethod["kind"],
        builtIn: r.builtIn,
      })),
    [rows],
  );
}

export function useCategories(): ServerCategory[] {
  return useQuery(api.functions.categories.getCategories, {}) ?? [];
}

export function useAllTags(): string[] {
  const transactions = useTransactions();
  return useMemo(
    () => Array.from(new Set(transactions.flatMap((t) => t.tags))).sort(),
    [transactions],
  );
}

export function useTotals(): Totals {
  const envelopes = useEnvelopes();
  const expenses = useExpenses();
  const transactions = useTransactions();
  return useMemo(() => {
    const assigned = envelopes.reduce((s, e) => s + e.assigned, 0);
    const spent = expenses.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const income = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    return {
      assigned,
      spent,
      income,
      overspent: envelopes.filter((e) => e.spent > e.assigned),
      underfunded: envelopes.filter((e) => e.assigned < e.target),
      uncategorized: expenses.filter((t) => !t.categoryId && t.amount < 0),
    };
  }, [envelopes, expenses, transactions]);
}

export function useReadyToAssign(): number {
  const { income, assigned } = useTotals();
  return income - assigned;
}

// ---------- Category lookup helpers (server categories) ----------

export function useCategoryLookup() {
  const categories = useCategories();
  return useMemo(() => {
    const flat = categories.flatMap((c) => [c, ...(c.children ?? [])]);
    const byId = new Map(flat.map((c) => [c.id, c]));
    return {
      flat,
      byId,
      topLevel: categories,
      childrenOf: (parentId: string): ServerCategory[] => byId.get(parentId)?.children ?? [],
      nameOf: (id: string) => byId.get(id)?.name ?? id,
      pathFor: (id: string) => {
        const cat = byId.get(id);
        if (!cat) return "";
        const parent = cat.parentId ? byId.get(cat.parentId) : undefined;
        return parent ? `${parent.name} › ${cat.name}` : cat.name;
      },
      rootIdOf: (id: string) => byId.get(id)?.parentId ?? id,
      colorOf: (id: string) => {
        const cat = byId.get(id);
        const root = cat?.parentId ? byId.get(cat.parentId) : cat;
        return `var(--chart-${root?.color ?? cat?.color ?? 6})`;
      },
      budgetable: () =>
        flat.filter((c) => c.kind === "outflow" && (byId.get(c.id)?.children?.length ?? 0) === 0),
    };
  }, [categories]);
}

function enrichEnvelopes(
  raw: Array<{
    id: string;
    name: string;
    categoryId: string;
    target: number;
    assigned: number;
    spent: number;
    pinned: boolean;
    note: string;
    createdAt: string;
  }>,
  tree: ServerCategory[],
): BudgetEnvelope[] {
  const flat = tree.flatMap((c) => [c, ...(c.children ?? [])]);
  const byId = new Map(flat.map((c) => [c.id, c]));
  return raw.map((e) => {
    const cat = byId.get(e.categoryId);
    const parent = cat?.parentId ? byId.get(cat.parentId) : undefined;
    return {
      ...e,
      id: e.categoryId,
      name: cat?.name ?? e.name,
      accent: cat?.accent ?? "primary",
      color: cat?.color ?? 6,
      group: parent?.id ?? cat?.id ?? e.categoryId,
      path: parent ? `${parent.name} › ${cat?.name}` : (cat?.name ?? e.categoryId),
    };
  });
}

// ---------- Mutations ----------

function failToast(action: string, e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`Error ${action}:`, e);
  toast.error(`Failed to ${action}`, { description: message });
}

export type AddTransactionInput = Omit<Transaction, "id" | "status" | "notes" | "isSplit"> & {
  status?: Transaction["status"];
  notes?: string;
  splits?: { categoryId: string; amount: number; note?: string }[];
};

export function useAddTransaction() {
  const mutate = useMutation(api.functions.budget.addTransaction);
  return useCallback(
    (tx: AddTransactionInput) =>
      mutate({ ...tx, status: tx.status ?? "cleared", notes: tx.notes ?? "" }).catch((e) =>
        failToast("add transaction", e),
      ),
    [mutate],
  );
}

export function useCategorizeTransaction() {
  const mutate = useMutation(api.functions.budget.categorizeTransaction);
  return useCallback(
    (txId: string, categoryId: string) =>
      mutate({ txId: txId as Id<"transactions">, categoryId }).catch((e) =>
        failToast("categorize transaction", e),
      ),
    [mutate],
  );
}

export function useAssignToEnvelope() {
  const mutate = useMutation(api.functions.budget.assignToEnvelope);
  return useCallback(
    (categoryId: string, amount: number) =>
      mutate({ categoryId, amount }).catch((e) => failToast("assign to envelope", e)),
    [mutate],
  );
}

export function useSetBudget() {
  const mutate = useMutation(api.functions.budget.setCategoryBudget);
  return useCallback(
    async (categoryId: string, target: number): Promise<boolean> => {
      try {
        await mutate({ categoryId, target });
        toast("Budget saved");
        return true;
      } catch (e) {
        failToast("set budget", e);
        return false;
      }
    },
    [mutate],
  );
}

export function useTogglePin() {
  const mutate = useMutation(api.functions.budget.togglePinEnvelope);
  return useCallback(
    (categoryId: string) => mutate({ categoryId }).catch((e) => failToast("toggle pin", e)),
    [mutate],
  );
}

export function useRecurring(): Recurring[] {
  return useQuery(api.functions.recurring.listRecurring, {}) ?? [];
}

export function useDetectRecurring(): RecurringSuggestion[] {
  return useQuery(api.functions.recurring.detectRecurring, {}) ?? [];
}

export type RecurringInput = {
  name: string;
  amount: number;
  kind: "expense" | "income";
  frequency: Recurring["frequency"];
  startDate: string;
  categoryId: string | null;
  tags: string[];
  paidFrom: string;
  active?: boolean;
  notes?: string;
};

export function useCreateRecurring() {
  const mutate = useMutation(api.functions.recurring.createRecurring);
  return useCallback(
    async (input: RecurringInput): Promise<boolean> => {
      try {
        await mutate({
          name: input.name,
          amount: input.amount,
          kind: input.kind,
          frequency: input.frequency,
          startDate: input.startDate,
          categoryId: input.categoryId,
          tags: input.tags,
          paidFrom: input.paidFrom,
          active: input.active ?? true,
          notes: input.notes ?? "",
        });
        toast("Recurring item created");
        return true;
      } catch (e) {
        failToast("create recurring item", e);
        return false;
      }
    },
    [mutate],
  );
}

export function useUpdateRecurring() {
  const mutate = useMutation(api.functions.recurring.updateRecurring);
  return useCallback(
    async (id: string, patch: Partial<RecurringInput>): Promise<boolean> => {
      try {
        await mutate({
          id: id as Id<"scheduledOutflows">,
          name: patch.name,
          amount: patch.amount,
          kind: patch.kind,
          frequency: patch.frequency,
          startDate: patch.startDate,
          categoryId: patch.categoryId === undefined ? undefined : patch.categoryId,
          tags: patch.tags,
          paidFrom: patch.paidFrom,
          active: patch.active,
          notes: patch.notes,
        });
        toast("Recurring item updated");
        return true;
      } catch (e) {
        failToast("update recurring item", e);
        return false;
      }
    },
    [mutate],
  );
}

export function useDeleteRecurring() {
  const mutate = useMutation(api.functions.recurring.deleteRecurring);
  return useCallback(
    (id: string) =>
      mutate({ id: id as Id<"scheduledOutflows"> }).catch((e) => failToast("delete recurring item", e)),
    [mutate],
  );
}

export function useMarkOccurrencePaid() {
  const mutate = useMutation(api.functions.recurring.markOccurrencePaid);
  return useCallback(
    (id: string, date?: string) =>
      mutate({ id: id as Id<"scheduledOutflows">, date }).catch((e) => failToast("mark paid", e)),
    [mutate],
  );
}

export function useAddPaymentMethod() {
  const mutate = useMutation(api.functions.budget.addPaymentMethod);
  return useCallback(
    async (label: string, kind: PaymentMethodKind): Promise<string | null> => {
      try {
        const res = await mutate({ label, kind });
        const id = res.id ?? null;
        if (id) toast("Payment method added");
        return id;
      } catch (e) {
        failToast("add payment method", e);
        return null;
      }
    },
    [mutate],
  );
}

export function useRemovePaymentMethod() {
  const mutate = useMutation(api.functions.budget.removePaymentMethod);
  return useCallback(
    (id: string) =>
      mutate({ paymentMethodId: id as Id<"paymentMethods"> }).catch((e) =>
        failToast("remove payment method", e),
      ),
    [mutate],
  );
}

export function useSplits(transactionId: string | null): TransactionSplit[] {
  return useQuery(
    api.functions.transactions.getSplits,
    transactionId ? { transactionId: transactionId as Id<"transactions"> } : "skip",
  ) ?? [];
}

export function useRules(): Rule[] {
  return useQuery(api.functions.rules.listRules, {}) ?? [];
}

export function useAddRule() {
  const mutate = useMutation(api.functions.rules.createRule);
  return useCallback(
    async (rule: RuleInput): Promise<boolean> => {
      try {
        await mutate({
          conditionField: rule.conditionField,
          conditionOp: rule.conditionOp,
          conditionValue: rule.conditionValue,
          actionSetCategory: rule.actionSetCategory ?? undefined,
          actionRenamePayee: rule.actionRenamePayee ?? undefined,
          actionAddTags: rule.actionAddTags?.length ? rule.actionAddTags : undefined,
        });
        toast("Rule created");
        return true;
      } catch (e) {
        failToast("create rule", e);
        return false;
      }
    },
    [mutate],
  );
}

export function useUpdateRule() {
  const mutate = useMutation(api.functions.rules.updateRule);
  return useCallback(
    async (ruleId: string, data: Partial<RuleInput>) => {
      try {
        await mutate({ ruleId: ruleId as Id<"rules">, ...data });
        toast("Rule updated");
      } catch (e) {
        failToast("update rule", e);
      }
    },
    [mutate],
  );
}

export function useDeleteRule() {
  const mutate = useMutation(api.functions.rules.deleteRule);
  return useCallback(
    async (ruleId: string) => {
      try {
        await mutate({ ruleId: ruleId as Id<"rules"> });
        toast("Rule deleted");
      } catch (e) {
        failToast("delete rule", e);
      }
    },
    [mutate],
  );
}

export function useMoveRule() {
  const mutate = useMutation(api.functions.rules.moveRule);
  return useCallback(
    (ruleId: string, direction: "up" | "down") =>
      mutate({ ruleId: ruleId as Id<"rules">, direction }).catch((e) => failToast("reorder rule", e)),
    [mutate],
  );
}

export function useCreateRuleFromTransaction() {
  const mutate = useMutation(api.functions.rules.createRuleFromTransaction);
  return useCallback(
    async (input: {
      sourcePayee: string;
      categoryId?: string;
      renamePayee?: string;
      addTags?: string[];
      applyToExisting: boolean;
    }): Promise<number | null> => {
      try {
        const res = await mutate(input);
        toast("Rule created");
        return res.applied ?? null;
      } catch (e) {
        failToast("create rule", e);
        return null;
      }
    },
    [mutate],
  );
}

export function useUpdateTransaction() {
  const mutate = useMutation(api.functions.transactions.updateTransaction);
  return useCallback(
    async (txId: string, data: UpdateTransactionInput): Promise<boolean> => {
      try {
        await mutate({ txId: txId as Id<"transactions">, ...data });
        return true;
      } catch (e) {
        failToast("update transaction", e);
        return false;
      }
    },
    [mutate],
  );
}

export function useDeleteTransaction() {
  const mutate = useMutation(api.functions.transactions.deleteTransaction);
  return useCallback(
    (txId: string) => mutate({ txId: txId as Id<"transactions"> }).catch((e) => failToast("delete transaction", e)),
    [mutate],
  );
}

export function useSetTransactionStatus() {
  const mutate = useMutation(api.functions.transactions.setTransactionStatus);
  return useCallback(
    (txId: string, status: "pending" | "cleared" | "reconciled") =>
      mutate({ txId: txId as Id<"transactions">, status }).catch((e) => failToast("set status", e)),
    [mutate],
  );
}

export function useBatchCategorize() {
  const mutate = useMutation(api.functions.transactions.batchCategorizeTransactions);
  return useCallback(
    (txIds: string[], categoryId: string) =>
      mutate({ txIds: txIds as Id<"transactions">[], categoryId }).catch((e) => failToast("batch categorize", e)),
    [mutate],
  );
}

export function useBatchTag() {
  const mutate = useMutation(api.functions.transactions.batchTagTransactions);
  return useCallback(
    (txIds: string[], tags: string[]) =>
      mutate({ txIds: txIds as Id<"transactions">[], tags }).catch((e) => failToast("batch tag", e)),
    [mutate],
  );
}

export function useBatchDelete() {
  const mutate = useMutation(api.functions.transactions.batchDeleteTransactions);
  return useCallback(
    (txIds: string[]) =>
      mutate({ txIds: txIds as Id<"transactions">[] }).catch((e) => failToast("batch delete", e)),
    [mutate],
  );
}

export function useImportTransactions() {
  const mutate = useMutation(api.functions.transactions.importTransactions);
  return useCallback(
    async (rows: ImportRow[], defaultPaidFrom: string): Promise<{ imported: number; skipped: number[] } | null> => {
      try {
        const res = await mutate({ rows, defaultPaidFrom });
        toast("Import complete");
        return res;
      } catch (e) {
        failToast("import transactions", e);
        return null;
      }
    },
    [mutate],
  );
}

export type RuleInput = {
  conditionField: RuleConditionField;
  conditionOp: RuleConditionOp;
  conditionValue: string;
  actionSetCategory?: string | null;
  actionRenamePayee?: string | null;
  actionAddTags?: string[];
};

export type UpdateTransactionInput = {
  date?: string;
  payee?: string;
  categoryId?: string | null;
  amount?: number;
  paidFrom?: string;
  tags?: string[];
  notes?: string;
  status?: "pending" | "cleared" | "reconciled";
  splits?: { categoryId: string; amount: number; note?: string }[];
};

export type ImportRow = {
  date: string;
  payee: string;
  amount: number;
  categoryId?: string | null;
  tags?: string[];
  rawPayee?: string;
  hash?: string;
  paidFrom?: string;
  notes?: string;
};

type CategoryInput = {
  name: string;
  parentId?: string | null;
  color: number;
  icon: string;
  kind: "outflow" | "inflow";
  accent: Accent;
};

type CategoryPatch = Partial<Omit<CategoryInput, "name">> & { name?: string };

export function useAddCategory() {
  const mutate = useMutation(api.functions.categories.addCategory);
  return useCallback(
    async (category: CategoryInput): Promise<string | null> => {
      try {
        const res = await mutate({ ...category, parentId: category.parentId || null });
        const id = res.id ?? null;
        if (id) toast("Category created");
        return id;
      } catch (e) {
        failToast("create category", e);
        return null;
      }
    },
    [mutate],
  );
}

export function useUpdateCategory() {
  const mutate = useMutation(api.functions.categories.updateCategory);
  return useCallback(
    async (categoryId: string, data: CategoryPatch) => {
      try {
        const parentId = data.parentId == null || data.parentId === "" ? null : data.parentId;
        await mutate({ categoryId: categoryId as Id<"categories">, ...data, parentId });
        toast("Category updated");
      } catch (e) {
        failToast("update category", e);
      }
    },
    [mutate],
  );
}

export function useDeleteCategory() {
  const mutate = useMutation(api.functions.categories.deleteCategory);
  return useCallback(
    async (categoryId: string) => {
      try {
        await mutate({ categoryId: categoryId as Id<"categories"> });
        toast("Category deleted");
      } catch (e) {
        failToast("delete category", e);
      }
    },
    [mutate],
  );
}
