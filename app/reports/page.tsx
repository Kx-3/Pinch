"use client";

import { AppShell } from "@/components/layout/AppShell";
import { AssignSimulator } from "@/components/dashboard/AssignSimulator";
import { useBudget } from "@/lib/budget-store";
import { currency0 } from "@/lib/mockData";
import { categoryColor, topLevelCategories } from "@/lib/categories";

export default function ReportsPage() {
  const { envelopes, totals } = useBudget();
  const groups = topLevelCategories().filter((c) => c.kind === "outflow");
  const max = Math.max(
    ...groups.map((g) => envelopes.filter((e) => e.group === g.id).reduce((s, e) => s + e.spent, 0)),
    1,
  );

  return (
    <AppShell title="Reports" subtitle="Where the money actually went.">
      <div className="ghost-border rounded-lg bg-surface-container-lowest p-md">
        <h3 className="mb-md text-label-sm uppercase text-on-surface">Spending by group</h3>
        <div className="space-y-sm">
          {groups.map((g) => {
            const spent = envelopes.filter((e) => e.group === g.id).reduce((s, e) => s + e.spent, 0);
            return (
              <div key={g.id}>
                <div className="mb-1 flex justify-between">
                  <span className="flex items-center gap-base text-body-md text-on-surface-variant">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: categoryColor(g.id) }}
                    />
                    {g.name}
                  </span>
                  <span className="text-numeric-data">{currency0(spent)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
                  <div
                    className="h-full rounded-full transition-[width] duration-300 ease-out"
                    style={{ width: `${(spent / max) * 100}%`, backgroundColor: categoryColor(g.id) }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-md text-label-sm text-on-surface-variant">
          Total spent {currency0(totals.spent)} of {currency0(totals.income)} income.
        </p>
      </div>

      <AssignSimulator />
    </AppShell>
  );
}
