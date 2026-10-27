"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BudgetTable } from "@/components/budget/budget-table";
import { IncomeBanner } from "@/components/budget/income-banner";
import { getMonthWindow, monthKeyOf } from "@/lib/month";
import { useBudgets, useSetAssignedAmount, useCategoryLookup, useTransactions } from "@/hooks/use-budget-data";

export default function BudgetPage() {
  const [monthOffset, setMonthOffset] = useState(0);
  const budgets = useBudgets();
  const transactions = useTransactions();
  const lookup = useCategoryLookup();
  const setAssigned = useSetAssignedAmount();

  const window = useMemo(() => getMonthWindow(monthOffset), [monthOffset]);
  const month = window.monthKey;

  /** Optimistic overrides keyed `${categoryId}:${month}` so the grid updates instantly. */
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const incomeCents = useMemo(() => {
    let sum = 0;
    for (const t of transactions) {
      if (t.amount > 0 && monthKeyOf(t.date) === month) sum += Math.round(t.amount * 100);
    }
    return sum;
  }, [transactions, month]);

  const assignedCents = useMemo(() => {
    let sum = 0;
    for (const b of budgets) if (b.month === month) sum += b.assignedCents;
    for (const [key, cents] of Object.entries(overrides)) {
      if (key.endsWith(`:${month}`)) sum += cents;
    }
    return sum;
  }, [budgets, overrides, month]);

  const updateAssigned = (categoryId: string, m: string, cents: number) => {
    setOverrides((prev) => ({ ...prev, [`${categoryId}:${m}`]: cents }));
    void setAssigned(categoryId, m, cents);
  };

  return (
    <AppShell title="Budget" subtitle="Give every dollar a job.">
      <div className="flex flex-col gap-md">
        {/* MONTH NAVIGATION */}
        <div className="flex items-center justify-between gap-sm rounded-lg bg-surface-container-lowest py-md">
          <button
            onClick={() => setMonthOffset((m) => m - 1)}
            aria-label="Previous month"
            className="pressable rounded-full border border-outline-variant bg-surface-container-lowest p-2 text-on-surface-variant hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0 text-center">
            <p className="truncate text-headline-sm uppercase text-on-surface-variant">
              {window.label}: {window.range}
            </p>
            {monthOffset !== 0 && (
              <button
                onClick={() => setMonthOffset(0)}
                className="pressable mt-1 text-label-sm uppercase text-primary hover:underline"
              >
                Back to current month
              </button>
            )}
          </div>

          <button
            onClick={() => setMonthOffset((m) => m + 1)}
            aria-label="Next month"
            className="pressable rounded-full border border-outline-variant bg-surface-container-lowest p-2 text-on-surface-variant hover:text-primary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <IncomeBanner
          label={window.label}
          range={window.range}
          incomeCents={incomeCents}
          assignedCents={assignedCents}
        />

        <BudgetTable
          month={month}
          budgets={budgets}
          transactions={transactions}
          lookup={lookup}
          overrides={overrides}
          onUpdateAssigned={updateAssigned}
        />
      </div>
    </AppShell>
  );
}