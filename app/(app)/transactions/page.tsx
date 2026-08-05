"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, Pencil, Wand2, Trash2, Upload } from "lucide-react";
import {
  useTransactions,
  usePaymentMethods,
  useAllTags,
  useCategorizeTransaction,
  useCategoryLookup,
  useBatchCategorize,
  useBatchDelete,
  useBatchTag,
} from "@/hooks/use-budget-data";
import { AppShell } from "@/components/layout/AppShell";
import { currency } from "@/lib/mockData";
import { CategorySelect } from "@/components/dashboard/CategorySelect";
import { TagInput } from "@/components/dashboard/TagInput";
import { EditTransactionDialog } from "@/components/dashboard/EditTransactionDialog";
import { CreateRuleDialog } from "@/components/dashboard/CreateRuleDialog";
import type { Transaction } from "@/lib/mockData";

const statusDot: Record<Transaction["status"], string> = {
  pending: "bg-tertiary",
  cleared: "bg-secondary",
  reconciled: "bg-primary",
};

export default function TransactionsPage() {
  const transactions = useTransactions();
  const categorize = useCategorizeTransaction();
  const paymentMethods = usePaymentMethods();
  const allTags = useAllTags();
  const lookup = useCategoryLookup();
  const batchCategorize = useBatchCategorize();
  const batchDelete = useBatchDelete();
  const batchTag = useBatchTag();

  const [query, setQuery] = useState("");
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);
  const [group, setGroup] = useState<string>("all");
  const [tag, setTag] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [ruleSource, setRuleSource] = useState<{ payee: string; categoryId?: string | null } | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);

  const methodLabel = (id: string) => paymentMethods.find((p) => p.id === id)?.label ?? "—";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (q && !t.payee.toLowerCase().includes(q) && !t.tags.some((tg) => tg.includes(q))) return false;
      if (onlyUncategorized && (t.categoryId || t.amount > 0)) return false;
      if (group !== "all" && (!t.categoryId || lookup.rootIdOf(t.categoryId) !== group)) return false;
      if (tag && !t.tags.includes(tag)) return false;
      return true;
    });
  }, [transactions, query, onlyUncategorized, group, tag, lookup]);

  const selectedIds = [...selected];

  const toggleAll = () => {
    const all = rows.map((r) => r.id);
    setSelected((s) => (s.size === rows.length ? new Set() : new Set(all)));
  };

  const clearSelection = () => {
    setSelected(new Set());
    setDeleteArmed(false);
  };

  const onBatchCategorize = (categoryId: string) => {
    if (!categoryId || !selectedIds.length) return;
    batchCategorize(selectedIds, categoryId);
    clearSelection();
  };

  const onBatchDelete = () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    batchDelete(selectedIds);
    clearSelection();
  };

  return (
    <AppShell title="Transactions" subtitle="Every dollar that moved this cycle.">
      <div className="ghost-border overflow-hidden rounded-lg bg-surface-container-lowest">
        <div className="flex flex-wrap items-center justify-between gap-sm border-b border-outline-variant px-md py-sm">
          <div className="flex flex-wrap items-center gap-base">
            <div className="flex items-center gap-base rounded-md border border-outline-variant bg-surface-container-low px-sm py-2 focus-within:border-primary">
              <Search className="h-4 w-4 text-on-surface-variant" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search payees or tags…"
                aria-label="Search transactions"
                className="w-48 bg-transparent text-label-bold font-normal outline-none placeholder:text-on-surface-variant"
              />
            </div>

            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              aria-label="Filter by category"
              className="rounded-md border border-outline-variant bg-surface-container-low px-sm py-2 text-label-bold font-normal outline-none focus:border-primary"
            >
              <option value="all">All categories</option>
              {lookup.topLevel.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setOnlyUncategorized((v) => !v)}
              aria-pressed={onlyUncategorized}
              className={`pressable rounded-md px-sm py-2 text-label-sm uppercase ${
                onlyUncategorized
                  ? "bg-primary/10 text-primary"
                  : "border border-outline-variant text-on-surface-variant hover:text-primary"
              }`}
            >
              Uncategorized only
            </button>
          </div>

          <Link
            href="/transactions/import"
            className="pressable flex items-center gap-1 rounded-md bg-primary px-sm py-2 text-label-sm uppercase text-on-primary hover:bg-primary-container"
          >
            <Upload className="h-4 w-4" /> Import CSV
          </Link>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-base border-b border-outline-variant px-md py-sm">
            <span className="text-label-sm uppercase text-on-surface-variant">Tags</span>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setTag(tag === t ? null : t)}
                aria-pressed={tag === t}
                className={`pressable rounded-full px-2 py-0.5 text-label-sm uppercase ${
                  tag === t
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-low text-on-surface-variant hover:text-primary"
                }`}
              >
                {t}
              </button>
            ))}
            {tag && (
              <button
                onClick={() => setTag(null)}
                className="pressable flex items-center gap-1 text-label-sm uppercase text-on-surface-variant hover:text-primary"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        )}

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-base border-b border-outline-variant bg-surface-container px-md py-sm">
            <span className="text-label-sm uppercase text-on-surface-variant">
              {selected.size} selected
            </span>
            <CategorySelect
              value=""
              placeholder="Categorize selected…"
              onChange={onBatchCategorize}
              className="w-56"
            />
            <div className="w-64">
              <TagInput
                value={[]}
                suggestions={allTags}
                onChange={(tags) => {
                  if (tags.length) {
                    batchTag(selectedIds, tags);
                    clearSelection();
                  }
                }}
              />
            </div>
            <button
              onClick={onBatchDelete}
              className={`pressable flex items-center gap-1 rounded-md px-sm py-2 text-label-sm uppercase ${
                deleteArmed ? "bg-error text-on-primary" : "border border-outline-variant text-on-surface-variant hover:border-error hover:text-error"
              }`}
            >
              <Trash2 className="h-4 w-4" />
              {deleteArmed ? "Confirm delete" : "Delete"}
            </button>
            <button
              onClick={clearSelection}
              className="pressable flex items-center gap-1 text-label-sm uppercase text-on-surface-variant hover:text-primary"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant text-label-sm uppercase text-on-surface-variant">
                <th className="px-md py-sm font-medium">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onChange={toggleAll}
                    aria-label="Select all rows"
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                </th>
                <th className="px-md py-sm font-medium">Date</th>
                <th className="px-md py-sm font-medium">Payee</th>
                <th className="px-md py-sm font-medium">Category</th>
                <th className="px-md py-sm font-medium">Tags</th>
                <th className="px-md py-sm font-medium">Notes</th>
                <th className="px-md py-sm font-medium">Paid from</th>
                <th className="px-md py-sm text-right font-medium">Amount</th>
                <th className="px-md py-sm"></th>
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-surface-container-low">
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className={`transition-colors duration-150 hover:bg-surface-container ${selected.has(t.id) ? "bg-primary/5" : ""}`}
                >
                  <td className="px-md py-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(t.id);
                        else next.delete(t.id);
                        setSelected(next);
                        setDeleteArmed(false);
                      }}
                      aria-label={`Select ${t.payee}`}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                  </td>
                  <td className="px-md py-sm text-numeric-data text-on-surface-variant">
                    <span className="flex items-center gap-base">
                      <span
                        title={`${t.status[0].toUpperCase()}${t.status.slice(1)}`}
                        className={`h-2 w-2 shrink-0 rounded-full ${statusDot[t.status]}`}
                      />
                      {t.date}
                    </span>
                  </td>
                  <td className="px-md py-sm text-body-md font-medium">
                    {t.payee}
                    {t.isSplit && (
                      <span className="ml-1 text-label-sm uppercase text-tertiary">split</span>
                    )}
                  </td>
                  <td className="px-md py-sm">
                    {t.categoryId ? (
                      <span className="text-label-bold text-on-surface-variant">{lookup.pathFor(t.categoryId)}</span>
                    ) : t.amount > 0 ? (
                      <span className="text-label-sm uppercase text-secondary">Inflow</span>
                    ) : (
                      <CategorySelect
                        value=""
                        placeholder="Categorize…"
                        onChange={(id) => id && categorize(t.id, id)}
                        className="w-44"
                      />
                    )}
                  </td>
                  <td className="px-md py-sm">
                    <div className="flex flex-wrap gap-1">
                      {t.tags.map((tg) => (
                        <button
                          key={tg}
                          onClick={() => setTag(tg)}
                          className="pressable rounded-full bg-primary/10 px-2 py-0.5 text-label-sm uppercase text-primary"
                        >
                          {tg}
                        </button>
                      ))}
                      {t.tags.length === 0 && <span className="text-label-sm text-on-surface-variant">—</span>}
                    </div>
                  </td>
                  <td className="px-md py-sm">
                    {t.notes ? (
                      <span title={t.notes} className="block max-w-[12rem] truncate text-label-bold font-normal text-on-surface-variant">
                        {t.notes}
                      </span>
                    ) : (
                      <span className="text-label-sm text-on-surface-variant">—</span>
                    )}
                  </td>
                  <td className="px-md py-sm text-label-bold font-normal text-on-surface-variant">
                    {methodLabel(t.paidFrom)}
                  </td>
                  <td
                    className={`px-md py-sm text-right text-numeric-data ${t.amount > 0 ? "text-secondary" : ""}`}
                  >
                    {currency(t.amount)}
                  </td>
                  <td className="px-md py-sm">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setRuleSource({ payee: t.payee, categoryId: t.categoryId })}
                        aria-label={`Create a rule for ${t.payee}`}
                        title="Always set category for this payee"
                        className="pressable rounded-md p-1 text-on-surface-variant hover:text-primary"
                      >
                        <Wand2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditing(t)}
                        aria-label={`Edit ${t.payee}`}
                        className="pressable rounded-md p-1 text-on-surface-variant hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr className="animate-in fade-in duration-200">
                  <td
                    colSpan={9}
                    className="px-md py-lg text-center text-label-bold font-normal text-on-surface-variant"
                  >
                    Nothing matches that filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EditTransactionDialog transaction={editing} open={!!editing} onOpenChange={(v) => !v && setEditing(null)} />
      <CreateRuleDialog
        open={!!ruleSource}
        onOpenChange={(v) => !v && setRuleSource(null)}
        sourcePayee={ruleSource?.payee ?? ""}
        defaultCategoryId={ruleSource?.categoryId}
      />
    </AppShell>
  );
}
