"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useAccounts } from "@/hooks/use-budget-data";
import { currency } from "@/lib/mockData";
import { toast } from "sonner";

export default function AccountsPage() {
  const accounts = useAccounts();
  const net = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <AppShell title="Accounts" subtitle="Balances feeding the budget.">
      <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <div key={a.id} className="ghost-border rounded-lg bg-surface-container-lowest p-md">
            <p className="text-label-sm uppercase text-on-surface-variant">{a.kind}</p>
            <p className="mt-1 text-body-md font-medium">{a.name}</p>
            <p
              className={`mt-sm font-mono-numbers text-[24px] font-medium ${
                a.balance < 0 ? "text-error" : "text-on-surface"
              }`}
            >
              {currency(a.balance)}
            </p>
            <button
              onClick={() => toast.success(`${a.name} refreshed`, { description: "Balances are up to date." })}
              className="pressable mt-md w-full rounded-md border border-outline-variant py-2 font-label-bold text-on-surface-variant hover:border-primary hover:text-primary"
            >
              Refresh balance
            </button>
          </div>
        ))}
      </div>
      <p className="text-label-sm uppercase text-on-surface-variant">
        Net worth <span className="font-mono-numbers text-on-surface">{currency(net)}</span>
      </p>
    </AppShell>
  );
}
