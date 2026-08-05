"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useEnvelopes, useAssignToEnvelope } from "@/hooks/use-budget-data";
import { useQuickView } from "@/lib/quick-view";
import { currency } from "@/lib/mockData";

export default function TargetsPage() {
  const envelopes = useEnvelopes();
  const assign = useAssignToEnvelope();
  const { setQuickViewId } = useQuickView();

  return (
    <AppShell title="Targets" subtitle="Close the gap, one category at a time.">
      <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-3">
        {envelopes.map((e) => {
          const pct = Math.min(100, Math.round((e.assigned / e.target) * 100));
          const gap = Math.max(0, e.target - e.assigned);
          return (
            <div key={e.id} className="ghost-border rounded-lg bg-surface-container-lowest p-md">
              <button
                onClick={() => setQuickViewId(e.id)}
                className="pressable text-left text-body-md font-medium hover:text-primary"
              >
                {e.name}
              </button>
              <p className="mt-1 font-mono-numbers text-[20px] font-medium">
                {currency(e.assigned)}
                <span className="text-label-sm text-on-surface-variant"> / {currency(e.target)}</span>
              </p>
              <div className="mt-sm h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                <div
                  className={`h-full transition-[width] duration-300 ease-out ${gap ? "bg-primary" : "bg-secondary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-sm flex items-center justify-between">
                <span className="text-label-sm uppercase text-on-surface-variant">
                  {gap ? `${currency(gap)} to go` : "Target met"}
                </span>
                {gap > 0 && (
                  <button
                    onClick={() => assign(e.id, gap)}
                    className="pressable rounded-md bg-primary px-sm py-1.5 text-label-sm uppercase text-on-primary hover:bg-primary-container"
                  >
                    Fund
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
