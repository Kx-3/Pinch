"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { currency, enrichLine, type Account, type Envelope, type PaymentMethod, type PaymentMethodKind, type ScheduledOutflow, type Transaction } from "@/lib/mockData";
import { categoryById, rootIdOf } from "@/lib/categories";
import type { Category, Subcategory } from "@/lib/mockData";

export interface MockUser {
  name: string;
  email: string;
  initials: string;
}

interface BudgetState {
  envelopes: Envelope[];
  transactions: Transaction[];
  scheduled: ScheduledOutflow[];
  accounts: Account[];
  paymentMethods: PaymentMethod[];
  categories: Category[];
  allTags: string[];
  readyToAssign: number;
  user: MockUser | null;
  /** id of the category shown in the quick-view drawer */
  quickViewId: string | null;
  setQuickViewId: (id: string | null) => void;
  authOpen: false | "login" | "signup";
  setAuthOpen: (v: false | "login" | "signup") => void;
  login: () => void;
  logout: () => void;
  assign: (categoryId: string, amount: number) => void;
  autoAssign: () => void;
  coverOverspending: () => void;
  togglePin: (categoryId: string) => void;
  addTransaction: (tx: Omit<Transaction, "id">) => void;
  categorize: (txId: string, categoryId: string) => void;
  setTransactionTags: (txId: string, tags: string[]) => void;
  fundScheduled: (id: string) => void;
  addPaymentMethod: (label: string, kind: PaymentMethodKind) => Promise<string | null>;
  removePaymentMethod: (id: string) => void;
  addEnvelope: (envelope: any) => Promise<string | null>;
  updateEnvelope: (envelopeId: string, data: any) => Promise<void>;
  deleteEnvelope: (envelopeId: string) => Promise<void>;
  getCategory: (id: string) => Category | undefined;
  getCategoryChildren: (parentId: string) => Subcategory[];
  addCategory: (category: any) => Promise<string | null>;
  updateCategory: (categoryId: string, data: any) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  getCategoryTree: () => Category[];
  /** assigned + spent rolled up per top-level category */
  groupTotals: Record<string, { assigned: number; spent: number; target: number }>;
  totals: {
    assigned: number;
    spent: number;
    income: number;
    overspent: Envelope[];
    underfunded: Envelope[];
    uncategorized: Transaction[];
  };
}

const BudgetContext = createContext<BudgetState | null>(null);

export function BudgetProvider({ children }: { children: ReactNode }) {
  // Convex-backed reactive queries with loading/error states
  const envelopesResult = useQuery(api.functions.budget.getEnvelopes, {});
  const transactionsResult = useQuery(api.functions.budget.getTransactions, {});
  const scheduledResult = useQuery(api.functions.budget.getScheduledOutflows, {});
  const accountsResult = useQuery(api.functions.budget.getAccounts, {});
  const paymentMethodsResult = useQuery(api.functions.budget.getPaymentMethods, {});
  const categoriesResult = useQuery(api.functions.categories.getCategories, {});

  const addTransactionMut = useMutation(api.functions.budget.addTransaction);
  const categorizeMut = useMutation(api.functions.budget.categorizeTransaction);
  const assignMut = useMutation(api.functions.budget.assignToEnvelope);
  const togglePinMut = useMutation(api.functions.budget.togglePinEnvelope);
  const addPaymentMethodMut = useMutation(api.functions.budget.addPaymentMethod);
  const removePaymentMethodMut = useMutation(api.functions.budget.removePaymentMethod);
  const fundScheduledMut = useMutation(api.functions.budget.fundScheduledOutflow);
  const setTransactionTagsMut = useMutation(api.functions.budget.setTransactionTags);
  const addEnvelopeMut = useMutation(api.functions.budget.addEnvelope);
  const updateEnvelopeMut = useMutation(api.functions.budget.updateEnvelope);
  const deleteEnvelopeMut = useMutation(api.functions.budget.deleteEnvelope);
  const addCategoryMut = useMutation(api.functions.categories.addCategory);
  const updateCategoryMut = useMutation(api.functions.categories.updateCategory);
  const deleteCategoryMut = useMutation(api.functions.categories.deleteCategory);

  const [readyToAssign] = useState(2840);
  const [user, setUser] = useState<MockUser | null>(null);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState<false | "login" | "signup">(false);

  // Handle loading states and errors
  const envelopes = envelopesResult ?? [];
  const transactions = transactionsResult ?? [];
  const scheduled = scheduledResult ?? [];
  const accounts = accountsResult ?? [];
  const paymentMethods = paymentMethodsResult ?? [];
  const categories: Category[] = categoriesResult ?? [];

  const nameOf = (id: string) => categoryById(id)?.name ?? id;

  const assign = useCallback((categoryId: string, amount: number) => {
    assignMut({ categoryId, amount }).catch((e) => {
      console.error("Error assigning to envelope:", e);
      toast.error("Failed to assign", { description: String(e.message || e) });
    });
  }, [assignMut]);

  const autoAssign = useCallback(() => {
    toast("Auto-assign is not implemented server-side yet", { description: "Use assign for single envelopes." });
  }, []);

  const coverOverspending = useCallback(() => {
    toast("Cover overspending must be implemented server-side", { description: "Not implemented yet." });
  }, []);

  const togglePin = useCallback((categoryId: string) => {
    togglePinMut({ categoryId }).catch((e) => {
      console.error("Error toggling pin:", e);
      toast.error("Failed to toggle pin", { description: String(e.message || e) });
    });
  }, [togglePinMut]);

  const addTransaction = useCallback((tx: Omit<Transaction, "id">) => {
    addTransactionMut(tx).catch((e) => {
      console.error("Error adding transaction:", e);
      toast.error("Failed to add transaction", { description: String(e.message || e) });
    });
  }, [addTransactionMut]);

  const categorize = useCallback((txId: string, categoryId: string) => {
    categorizeMut({ txId, categoryId }).catch((e) => {
      console.error("Error categorizing transaction:", e);
      toast.error("Failed to categorize", { description: String(e.message || e) });
    });
  }, [categorizeMut]);

  const setTransactionTags = useCallback((txId: string, tags: string[]) => {
    setTransactionTagsMut({ txId, tags }).catch((e) => {
      console.error("Error setting transaction tags:", e);
      toast.error("Failed to set tags", { description: String(e.message || e) });
    });
  }, [setTransactionTagsMut]);

  const fundScheduled = useCallback((id: string) => {
    fundScheduledMut({ scheduledId: id }).catch((e) => {
      console.error("Error funding scheduled outflow:", e);
      toast.error("Failed to fund", { description: String(e.message || e) });
    });
  }, [fundScheduledMut]);

  const addPaymentMethod = useCallback(async (label: string, kind: PaymentMethodKind) => {
    try {
      const res = await addPaymentMethodMut({ label, kind });
      const id = (res && (res.id ?? res._id)) ?? null;
      if (id) toast("Payment method added");
      return id;
    } catch (e: any) {
      console.error("Error adding payment method:", e);
      toast.error("Failed to add payment method", { description: String(e.message || e) });
      return null;
    }
  }, [addPaymentMethodMut]);

  const removePaymentMethod = useCallback((id: string) => {
    removePaymentMethodMut({ paymentMethodId: id }).catch((e) => {
      console.error("Error removing payment method:", e);
      toast.error("Failed to remove", { description: String(e.message || e) });
    });
  }, [removePaymentMethodMut]);

  const addEnvelope = useCallback(async (envelope: any) => {
    try {
      const res = await addEnvelopeMut(envelope);
      const id = (res && (res.id ?? res._id)) ?? null;
      if (id) toast("Envelope created");
      return id;
    } catch (e: any) {
      console.error("Error adding envelope:", e);
      toast.error("Failed to create envelope", { description: String(e.message || e) });
      return null;
    }
  }, [addEnvelopeMut]);

  const updateEnvelope = useCallback(async (envelopeId: string, data: any) => {
    try {
      await updateEnvelopeMut({ envelopeId, ...data });
      toast("Envelope updated");
    } catch (e: any) {
      console.error("Error updating envelope:", e);
      toast.error("Failed to update envelope", { description: String(e.message || e) });
    }
  }, [updateEnvelopeMut]);

  const deleteEnvelope = useCallback(async (envelopeId: string) => {
    try {
      await deleteEnvelopeMut({ envelopeId });
      toast("Envelope deleted");
    } catch (e: any) {
      console.error("Error deleting envelope:", e);
      toast.error("Failed to delete envelope", { description: String(e.message || e) });
    }
  }, [deleteEnvelopeMut]);

  const getCategory = useCallback((id: string) => {
    return categories.find((c) => c.id === id);
  }, [categories]);

  const getCategoryChildren = useCallback((parentId: string) => {
    return categories.filter((c) => c.parentId === parentId) as Subcategory[];
  }, [categories]);

  const getCategoryTree = useCallback(() => {
    const topLevel = categories.filter((c) => c.parentId === null);
    return topLevel.map((parent) => ({
      ...parent,
      children: categories.filter((c) => c.parentId === parent.id) as Subcategory[],
    }));
  }, [categories]);

  const addCategory = useCallback(async (category: any) => {
    try {
      const res = await addCategoryMut(category);
      const id = (res && (res.id ?? res._id)) ?? null;
      if (id) toast("Category created");
      return id;
    } catch (e: any) {
      console.error("Error adding category:", e);
      toast.error("Failed to create category", { description: String(e.message || e) });
      return null;
    }
  }, [addCategoryMut]);

  const updateCategory = useCallback(async (categoryId: string, data: any) => {
    try {
      await updateCategoryMut({ categoryId, ...data });
      toast("Category updated");
    } catch (e: any) {
      console.error("Error updating category:", e);
      toast.error("Failed to update category", { description: String(e.message || e) });
    }
  }, [updateCategoryMut]);

  const deleteCategory = useCallback(async (categoryId: string) => {
    try {
      await deleteCategoryMut({ categoryId });
      toast("Category deleted");
    } catch (e: any) {
      console.error("Error deleting category:", e);
      toast.error("Failed to delete category", { description: String(e.message || e) });
    }
  }, [deleteCategoryMut]);

  const allTags = useMemo(
    () => Array.from(new Set(transactions.flatMap((t) => t.tags))).sort(),
    [transactions],
  );

  const groupTotals = useMemo(() => {
    const acc: Record<string, { assigned: number; spent: number; target: number }> = {};
    for (const l of envelopes) {
      const root = rootIdOf(l.categoryId);
      acc[root] ??= { assigned: 0, spent: 0, target: 0 };
      acc[root].assigned += l.assigned;
      acc[root].spent += l.spent;
      acc[root].target += l.target;
    }
    return acc;
  }, [envelopes]);

  const totals = useMemo(() => {
    const assigned = envelopes.reduce((s, e) => s + e.assigned, 0);
    const spent = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const income = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    return {
      assigned,
      spent,
      income,
      overspent: envelopes.filter((e) => e.spent > e.assigned),
      underfunded: envelopes.filter((e) => e.assigned < e.target),
      uncategorized: transactions.filter((t) => !t.categoryId && t.amount < 0),
    };
  }, [envelopes, transactions]);

  const value: BudgetState = {
    envelopes,
    transactions,
    scheduled,
    accounts,
    paymentMethods,
    categories,
    allTags,
    readyToAssign,
    user,
    quickViewId,
    setQuickViewId,
    authOpen,
    setAuthOpen,
    login: () => setUser({ name: "Alex Moreau", email: "alex@pinch.app", initials: "AM" }),
    logout: () => {
      setUser(null);
      toast("Signed out", { description: "Your mock session was cleared." });
    },
    assign,
    autoAssign,
    coverOverspending,
    togglePin,
    addTransaction,
    categorize,
    setTransactionTags,
    fundScheduled,
    addPaymentMethod,
    removePaymentMethod,
    addEnvelope,
    updateEnvelope,
    deleteEnvelope,
    getCategory,
    getCategoryChildren,
    addCategory,
    updateCategory,
    deleteCategory,
    getCategoryTree,
    groupTotals,
    totals,
  };

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget() {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error("useBudget must be used inside <BudgetProvider>");
  return ctx;
}
