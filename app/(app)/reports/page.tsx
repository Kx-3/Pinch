"use client";

import { useEffect, useMemo, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AssignSimulator } from "@/components/dashboard/AssignSimulator";
import { useExpenses, useTotals, useCategoryLookup } from "@/hooks/use-budget-data";
import { currency0 } from "@/lib/mockData";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

type SpendingUnit = {
  key: string;
  name: string;
  color: number;
  spent: number;
};

export default function ReportsPage() {
  const expenses = useExpenses();
  const totals = useTotals();
  const lookup = useCategoryLookup();
  const barsRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const spentByCategory = new Map<string, number>();
    for (const t of expenses) {
      if (t.amount >= 0 || !t.categoryId) continue;
      spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + Math.abs(t.amount));
    }

    return lookup.topLevel
      .filter((c) => c.kind === "outflow")
      .map((g) => {
        const children = g.children ?? [];
        const direct = spentByCategory.get(g.id) ?? 0;
        const childRows: SpendingUnit[] = children
          .map((c) => ({ key: c.id, name: c.name, color: c.color, spent: spentByCategory.get(c.id) ?? 0 }))
          .filter((u) => u.spent > 0);
        const parentUnit: SpendingUnit[] =
          direct > 0 ? [{ key: g.id, name: g.name, color: g.color, spent: direct }] : [];

        return {
          group: g,
          total: direct + childRows.reduce((s, u) => s + u.spent, 0),
          units: children.length === 0 ? parentUnit : [...parentUnit, ...childRows],
          rows: children.length === 0 ? [] : [...parentUnit, ...childRows],
        };
      })
      .filter((g) => g.total > 0);
  }, [expenses, lookup]);

  const max = Math.max(...groups.map((g) => g.total), 1);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const segments = barsRef.current?.querySelectorAll<HTMLElement>("[data-grow]");
    segments?.forEach((seg, i) => {
      seg.animate(
        [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
        {
          duration: 300,
          delay: i * 40,
          easing: "cubic-bezier(0.23, 1, 0.32, 1)",
          fill: "both",
        },
      );
    });
  }, [groups.length]);

  return (
    <AppShell title="Reports" subtitle="Where the money actually went.">
      <div className="ghost-border rounded-lg bg-surface-container-lowest p-md">
        <h3 className="mb-md text-label-sm uppercase text-on-surface">Spending by group</h3>
        <div className="space-y-sm">
          {groups.map((g, gi) => (
            <div
              key={g.group.id}
              className="enter-rise"
              style={{ "--enter-delay": `${gi * 60}ms` } as React.CSSProperties}
            >
              <div className="mb-1 flex justify-between">
                <span className="flex items-center gap-base text-body-md text-on-surface-variant">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: `var(--chart-${g.group.color})` }}
                  />
                  {g.group.name}
                </span>
                <span className="text-numeric-data">{currency0(g.total)}</span>
              </div>

              <div ref={barsRef} className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
                <div className="flex h-full">
                  {g.units.map((u) => (
                    <div
                      key={u.key}
                      data-grow
                      title={`${u.name}: ${currency0(u.spent)}`}
                      className="h-full origin-left"
                      style={{
                        width: `${(u.spent / max) * 100}%`,
                        backgroundColor: `var(--chart-${u.color})`,
                      }}
                    />
                  ))}
                </div>
              </div>

              {g.rows.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {g.rows.map((u) => (
                    <div
                      key={u.key}
                      className="flex justify-between pl-base text-sm text-on-surface-variant"
                    >
                      <span className="flex items-center gap-base">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: `var(--chart-${u.color})` }}
                        />
                        {u.name}
                      </span>
                      <span className="text-numeric-data">{currency0(u.spent)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-md text-label-sm text-on-surface-variant">
          Total spent {currency0(totals.spent)} of {currency0(totals.income)} income.
        </p>
      </div>

      <AssignSimulator />
    </AppShell>
  );
}
