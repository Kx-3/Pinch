"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useBudget } from "@/lib/budget-store";
import { AppShell } from "@/components/layout/AppShell";
import { currency } from "@/lib/mockData";
import { pathFor, topLevelCategories, rootIdOf } from "@/lib/categories";
import { CategorySelect } from "@/components/dashboard/CategorySelect";

export default function TransactionsPage() {
  const { transactions, categorize, paymentMethods, allTags } = useBudget();
  const [query, setQuery] = useState("");
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);
  const [group, setGroup] = useState<string>("all");
  const [tag, setTag] = useState<string | null>(null);

  const methodLabel = (id: string) => paymentMethods.find((p) => p.id === id)?.label ?? "—";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (q && !t.payee.toLowerCase().includes(q) && !t.tags.some((tg) => tg.includes(q))) return false;
      if (onlyUncategorized && (t.categoryId || t.amount > 0)) return false;
      if (group !== "all" && (!t.categoryId || rootIdOf(t.categoryId) !== group)) return false;
      if (tag && !t.tags.includes(tag)) return false;
      return true;
    });
  }, [transactions, query, onlyUncategorized, group, tag]);

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
              {topLevelCategories().map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

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

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant text-label-sm uppercase text-on-surface-variant">
                <th className="px-md py-sm font-medium">Date</th>
                <th className="px-md py-sm font-medium">Payee</th>
                <th className="px-md py-sm font-medium">Category</th>
                <th className="px-md py-sm font-medium">Tags</th>
                <th className="px-md py-sm font-medium">Paid from</th>
                <th className="px-md py-sm text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-surface-container-low">
              {rows.map((t) => (
                <tr key={t.id} className="transition-colors duration-150 hover:bg-surface-container">
                  <td className="px-md py-sm text-numeric-data text-on-surface-variant">{t.date}</td>
                  <td className="px-md py-sm text-body-md font-medium">{t.payee}</td>
                  <td className="px-md py-sm">
                    {t.categoryId ? (
                      <span className="text-label-bold text-on-surface-variant">{pathFor(t.categoryId)}</span>
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
                  <td className="px-md py-sm text-label-bold font-normal text-on-surface-variant">
                    {methodLabel(t.paidFrom)}
                  </td>
                  <td
                    className={`px-md py-sm text-right text-numeric-data ${t.amount > 0 ? "text-secondary" : ""}`}
                  >
                    {currency(t.amount)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
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
    </AppShell>
  );
}
