"use client";

import { useMemo, useState } from "react";
import { Search, Bell, Plus, ArrowRight, CircleAlert } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useEnvelopes, useTransactions, useTotals } from "@/hooks/use-budget-data";
import { useQuickView } from "@/lib/quick-view";
import { currency } from "@/lib/mockData";
import { NewTransactionDialog } from "@/components/dashboard/NewTransactionDialog";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

export function Header({ title, subtitle }: { title: string; subtitle: string }) {
  const envelopes = useEnvelopes();
  const transactions = useTransactions();
  const totals = useTotals();
  const { setQuickViewId } = useQuickView();
  const { isMobile } = useSidebar();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { envelopes: [], transactions: [] };
    return {
      envelopes: envelopes.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 5),
      transactions: transactions.filter((t) => t.payee.toLowerCase().includes(q)).slice(0, 4),
    };
  }, [query, envelopes, transactions]);

  const empty = query.trim() && !results.envelopes.length && !results.transactions.length;
  const alerts = [
    ...totals.overspent.map((e) => ({ id: e.id, text: `${e.name} is overspent`, tone: "error" as const })),
    ...totals.uncategorized
      .slice(0, 3)
      .map((t) => ({ id: t.id, text: `${t.payee} needs a category`, tone: "muted" as const })),
  ];

  return (
    <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-sm border-b border-outline-variant bg-surface-bright/85 px-md py-2 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-sm">
         <SidebarTrigger className="pressable shrink-0 text-on-surface-variant hover:bg-surface-container-low hover:text-primary" />
        <div className="flex min-w-0 items-baseline gap-sm">
          <h1 className="truncate text-headline-md font-semibold text-foreground">{title}</h1>
          <p className="hidden truncate text-label-sm text-muted-foreground lg:block">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-base">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            aria-label="Search categories and transactions"
            className="pressable rounded-full border border-outline-variant bg-surface-container-lowest p-2 text-on-surface-variant hover:text-primary"
          >
            <Search className="h-[18px] w-[18px]" />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-80 p-1"
          >
            <div className="mb-1 flex items-center gap-base rounded-full border border-outline-variant bg-surface-container-low px-sm py-2 focus-within:border-primary">
              <Search className="h-4 w-4 shrink-0 text-on-surface-variant" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories…"
                aria-label="Search categories and transactions"
                className="w-full bg-transparent text-label-bold font-normal outline-none placeholder:text-on-surface-variant"
              />
            </div>
            {empty ? (
              <p className="px-sm py-md text-label-bold font-normal text-on-surface-variant">
                No matches for &quot;{query}&quot;.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {results.envelopes.length > 0 && (
                  <p className="px-sm pt-2 pb-1 text-label-sm uppercase text-on-surface-variant">Categories</p>
                )}
                {results.envelopes.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      setQuickViewId(e.id);
                      setOpen(false);
                    }}
                    className="pressable flex w-full items-center justify-between rounded-md px-sm py-2 text-left hover:bg-surface-container-low"
                  >
                    <span className="text-label-bold">{e.name}</span>
                    <span className="text-numeric-data text-on-surface-variant">
                      {currency(e.assigned)}
                    </span>
                  </button>
                ))}
                {results.transactions.length > 0 && (
                  <p className="px-sm pt-2 pb-1 text-label-sm uppercase text-on-surface-variant">
                    Transactions
                  </p>
                )}
                {results.transactions.map((t) => (
                  <a
                    key={t.id}
                    href="/transactions"
                    onClick={() => setOpen(false)}
                    className="pressable flex w-full items-center justify-between rounded-md px-sm py-2 hover:bg-surface-container-low"
                  >
                    <span className="text-label-bold">{t.payee}</span>
                    <span className="text-numeric-data text-on-surface-variant">
                      {currency(t.amount)}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger className="pressable relative rounded-full border border-outline-variant bg-surface-container-lowest p-2 text-on-surface-variant hover:text-primary">
            <Bell className="h-[18px] w-[18px]" />
            {alerts.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 font-mono-numbers text-[10px] text-on-error">
                {alerts.length}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-sm">
            <p className="mb-sm text-label-sm uppercase text-on-surface-variant">Needs attention</p>
            {alerts.length === 0 ? (
              <p className="text-label-bold font-normal text-on-surface-variant">You&apos;re all caught up.</p>
            ) : (
              <ul className="space-y-base">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-start gap-base">
                    <CircleAlert
                      className={`mt-0.5 h-4 w-4 ${a.tone === "error" ? "text-error" : "text-on-surface-variant"}`}
                    />
                    <span className="text-label-bold font-normal">{a.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <a
              href="/transactions"
              className="pressable mt-sm flex items-center gap-1 text-label-sm uppercase text-primary hover:underline"
            >
              Review all <ArrowRight className="h-3 w-3" />
            </a>
          </PopoverContent>
        </Popover>

        <ThemeToggle />

        <button
          onClick={() => setTxOpen(true)}
          className="pressable hidden items-center gap-base rounded-full bg-primary px-md py-2 font-label-bold text-on-primary hover:bg-primary-container md:flex"
        >
          <Plus className="h-4 w-4" />
          New Transaction
        </button>
        <NewTransactionDialog open={txOpen} onOpenChange={setTxOpen} />

        <Show when="signed-in">
          <UserButton/>
        </Show>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="pressable rounded-full border border-outline-variant bg-surface-container-lowest px-md py-2 text-label-bold text-on-surface-variant hover:text-primary">
              Sign in
            </button>
          </SignInButton>
        </Show>
      </div>
    </header>
  );
}
