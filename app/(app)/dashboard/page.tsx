"use client";

import { useMemo, useState } from "react";
import {
  Star,
  CircleAlert,
  ArrowRight,
  CheckCircle2,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useEnvelopes,
  useTransactions,
  useExpenses,
  useRecurring,
  useTotals,
  useCategoryLookup,
  useMarkOccurrencePaid,
} from "@/hooks/use-budget-data";
import { useQuickView } from "@/lib/quick-view";
import { currency, currency0 } from "@/lib/mockData";
import { Authenticated } from "convex/react";
import { useUser } from "@clerk/nextjs";

// Lift static formatters and helpers above the component
const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-US", { day: "numeric", month: "long" });

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function getPeriod(monthOffset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

  return {
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    range: `${fmtDay(start)} – ${fmtDay(end)}`,
    startISO: toISO(start),
    endISO: toISO(end),
    progress:
      monthOffset < 0
        ? 100
        : monthOffset > 0
          ? 0
          : Math.round((18 / end.getDate()) * 100),
  };
}

export default function Dashboard() {
  const lookup = useCategoryLookup();
  const markPaid = useMarkOccurrencePaid();
  const { setQuickViewId } = useQuickView();

  const autoAssign = () =>
    toast("Auto-assign is not implemented server-side yet", { description: "Use assign for single envelopes." });

  const [demoOpen, setDemoOpen] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const { user } = useUser();

  const firstName = (user?.firstName ?? "there").split(" ")[0];

  const period = useMemo(() => getPeriod(monthOffset), [monthOffset]);
  const month = useMemo(
    () => ({ start: period.startISO, end: period.endISO }),
    [period.startISO, period.endISO],
  );

  const envelopes = useEnvelopes();
  const transactions = useTransactions(month);
  const expenses = useExpenses(month);
  const scheduled = useRecurring();
  const totals = useTotals(month);

  const readyToAssign = totals.income - totals.assigned;

  /** Spending categories — expense transactions grouped by category, colored + grouped by color. */
  const expenseCategories = useMemo(() => {
    const spentByCategory = new Map<string, number>();
    for (const t of expenses) {
      if (t.amount >= 0 || !t.categoryId) continue;
      spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + Math.abs(t.amount));
    }
    return Array.from(spentByCategory, ([id, spent]) => ({
      id,
      name: lookup.nameOf(id),
      color: lookup.byId.get(id)?.color ?? 6,
      spent,
    })).sort((a, b) => a.color - b.color || b.spent - a.spent);
  }, [expenses, lookup]);

  const expenseTotal = expenseCategories.reduce((s, c) => s + c.spent, 0) || 1;
  const expenseBarTotal = totals.income > 0 ? totals.income : expenseTotal;

  /** Parent categories with their spend; children revealed via openGroups toggle. */
  const expenseGroups = useMemo(() => {
    const byParent = new Map<
      string,
      { id: string; name: string; color: number; spent: number; children: typeof expenseCategories }
    >();
    for (const c of expenseCategories) {
      const cat = lookup.byId.get(c.id);
      const parentId = cat?.parentId ?? c.id;
      const entry = byParent.get(parentId) ?? {
        id: parentId,
        name: lookup.nameOf(parentId),
        color: lookup.byId.get(parentId)?.color ?? 6,
        spent: 0,
        children: [] as typeof expenseCategories,
      };
      entry.spent += c.spent;
      if (c.id !== parentId) entry.children.push(c);
      byParent.set(parentId, entry);
    }
    return Array.from(byParent.values())
      .filter((g) => g.spent > 0)
      .sort((a, b) => b.spent - a.spent);
  }, [expenseCategories, lookup]);

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const incomeSources = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.amount <= 0) continue;
      map.set(t.payee, (map.get(t.payee) ?? 0) + t.amount);
    }
    const listed = Array.from(map.entries()).map(([name, amount]) => ({ name, amount }));
    const rest = totals.income - listed.reduce((s, i) => s + i.amount, 0);
    if (rest > 0.5) listed.push({ name: "Other inflows", amount: rest });
    return listed.sort((a, b) => b.amount - a.amount);
  }, [transactions, totals.income]);

  const spentPct = Math.min(100, Math.round((totals.spent / totals.income) * 100) || 0);
  const shortfall = totals.underfunded.reduce((s, e) => s + (e.target - e.assigned), 0);

  return (
    <>
      <Authenticated>
        <TooltipProvider delayDuration={200}>
          <AppShell title={`Hello, ${firstName}.`} subtitle="Here's how your money is moving.">
            {/* HERO: CASH FLOW FIRST */}
            <div className="grid grid-cols-1 gap-md md:grid-cols-12">
              <div
                className="ghost-border rounded-lg bg-surface-container-lowest p-lg enter-rise flex min-h-[240px] flex-col justify-between md:col-span-8"
                style={{ "--enter-delay": "0ms" } as React.CSSProperties}
              >
                {/* MONTH SELECTOR */}
                <div className="rounded-lg bg-surface-container-lowest py-md flex items-center justify-between gap-sm">
                  <button
                    onClick={() => setMonthOffset((m) => m - 1)}
                    aria-label="Previous month"
                    className="pressable rounded-full border border-outline-variant bg-surface-container-lowest p-2 text-on-surface-variant hover:text-primary"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="min-w-0 text-center">
                    <p className="truncate text-headline-sm uppercase text-on-surface-variant">{period.label}: {period.range}</p>
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
                <div>
                  <p className="mb-md text-label-sm uppercase text-on-surface-variant">{period.label}</p>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-md">
                    <div className="min-w-0">
                      <p className="text-label-sm uppercase text-on-surface-variant">Income</p>
                      <p className="text-numeric-2xl text-secondary">
                        <AnimatedNumber value={totals.income} format={currency0} duration={900} />
                      </p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-label-sm uppercase text-on-surface-variant">Expenses</p>
                      <p className="text-numeric-lg text-on-surface">
                        <AnimatedNumber value={totals.spent} format={currency0} duration={900} />
                      </p>
                    </div>
                  </div>

                  {/* Expense composition bar — each segment is a parent category's share of spend */}
                  <div className="mt-md">
                    <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-surface-container-highest">
                      {expenseGroups.map((g) => (
                        <Tooltip key={g.id}>
                          <TooltipTrigger asChild>
                            <div
                              className="h-full cursor-help transition-[width] duration-300 ease-out first:rounded-l-full last:rounded-r-full"
                              style={{
                                width: `${(g.spent / expenseBarTotal) * 100}%`,
                                backgroundColor: `var(--chart-${g.color})`,
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            {g.name} — {currency(g.spent)} ({Math.round((g.spent / expenseBarTotal) * 100)}%)
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                    <div className="mt-base flex justify-between text-numeric-data text-on-surface-variant">
                      <span>
                        <AnimatedNumber value={spentPct} format={(n) => `${Math.round(n)}%`} /> of income spent
                      </span>
                      <span>{expenseGroups.length} categories</span>
                    </div>
                  </div>
                </div>

                <div className="mt-md flex flex-wrap gap-x-md gap-y-base border-t border-outline-variant pt-sm">
                  {expenseGroups.slice(0, 6).map((g) => (
                    <span key={g.id} className="flex items-center gap-base text-label-sm uppercase text-on-surface-variant">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: `var(--chart-${g.color})` }}
                      />
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>

              <div
                className="enter-rise ghost-border flex flex-col justify-between rounded-lg bg-primary p-md text-on-primary md:col-span-4"
                style={{ "--enter-delay": "80ms" } as React.CSSProperties}
              >
                <div>
                  <div className="mb-sm flex items-center gap-2">
                    <Star className="h-4 w-4 fill-current" />
                    <span className="text-label-sm uppercase">Ready to Assign</span>
                  </div>
                  <h2 className="text-numeric-xl">
                    <AnimatedNumber value={readyToAssign} format={currency} duration={900} />
                  </h2>
                  <p className="mt-sm text-body-md opacity-80">Every dollar has a job to do.</p>
                </div>
                <div className="mt-md flex flex-wrap gap-base">
                  <button
                    onClick={autoAssign}
                    className="pressable rounded-md bg-on-primary px-sm py-2 font-label-bold text-primary hover:bg-primary-fixed"
                  >
                    Auto-Assign
                  </button>
                  <button
                    onClick={() => setDemoOpen(true)}
                    className="pressable flex items-center gap-base rounded-md border border-on-primary/30 px-sm py-2 font-label-bold text-on-primary hover:bg-on-primary/10"
                  >
                    <PlayCircle className="h-4 w-4" /> Demo
                  </button>
                </div>
              </div>
            </div>

            {/* TWO COLUMN AREA */}
            <div className="grid grid-cols-1 gap-md lg:grid-cols-12">
              <div className="space-y-md lg:col-span-8">
                {/* BREAKDOWN */}
                <div className="ghost-border rounded-lg bg-surface-container-lowest p-md">
                  <h3 className="mb-sm text-label-sm uppercase text-on-surface">Breakdown</h3>

                  <div className="grid grid-cols-1 gap-md md:grid-cols-2">
                    {/* Income */}
                    <div>
                      <div className="flex items-baseline justify-between border-b border-outline-variant pb-base">
                        <p className="text-label-sm uppercase text-on-surface-variant">Income</p>
                        <p className="text-numeric-data font-medium text-secondary">{currency(totals.income)}</p>
                      </div>
                      <ul className="mt-base space-y-base">
                        {incomeSources.map((s) => (
                          <li key={s.name} className="flex items-center justify-between gap-sm">
                            <span className="flex min-w-0 items-center gap-base">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: lookup.colorOf("income") }}
                              />
                              <span className="truncate text-body-md">{s.name}</span>
                            </span>
                            <span className="text-numeric-data text-on-surface-variant">{currency(s.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Expenses */}
                    <div>
                      <div className="flex items-baseline justify-between border-b border-outline-variant pb-base">
                        <p className="text-label-sm uppercase text-on-surface-variant">Expenses</p>
                        <p className="text-numeric-data font-medium">{currency(totals.spent)}</p>
                      </div>
                      <ul className="mt-base space-y-1">
                        {expenseGroups.map((g) => {
                          const open = openGroups.includes(g.id);
                          const hasChildren = g.children.length > 0;
                          const pct = Math.round((g.spent / expenseTotal) * 100);
                          return (
                            <li key={g.id}>
                              <button
                                onClick={() => (hasChildren ? toggleGroup(g.id) : setQuickViewId(g.id))}
                                className="pressable flex w-full items-center justify-between gap-sm rounded-md px-1 py-1.5 text-left hover:bg-surface-container-low"
                              >
                                <span className="flex min-w-0 items-center gap-base">
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: `var(--chart-${g.color})` }}
                                  />
                                  <span className="truncate text-body-md">{g.name}</span>
                                  {hasChildren && (
                                    <ChevronDown
                                      className={`h-3.5 w-3.5 shrink-0 text-on-surface-variant transition-transform duration-200 ${open ? "rotate-180" : ""
                                        }`}
                                    />
                                  )}
                                </span>
                                <span className="flex shrink-0 items-baseline gap-sm">
                                  <span className="text-label-sm text-on-surface-variant">{pct}%</span>
                                  <span className="text-numeric-data">{currency(g.spent)}</span>
                                </span>
                              </button>

                              {hasChildren && open && (
                                <ul className="mb-1 ml-[14px] animate-in space-y-1 border-l border-outline-variant pl-sm fade-in duration-150 ease-out">
                                  {g.children
                                    .slice()
                                    .sort((a, b) => b.spent - a.spent)
                                    .map((c) => (
                                      <li key={c.id}>
                                        <button
                                          onClick={() => setQuickViewId(c.id)}
                                          className="pressable flex w-full items-center justify-between gap-sm rounded-md px-1 py-1 text-left hover:bg-surface-container-low"
                                        >
                                          <span className="flex min-w-0 items-center gap-base">
                                            <span
                                              className="h-2 w-2 shrink-0 rounded-full"
                                              style={{ backgroundColor: `var(--chart-${c.color})` }}
                                            />
                                            <span className="truncate text-label-bold font-normal text-on-surface-variant">
                                              {c.name}
                                            </span>
                                          </span>
                                          <span className="text-numeric-data text-on-surface-variant">
                                            {currency(c.spent)}
                                          </span>
                                        </button>
                                      </li>
                                    ))}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="ghost-border rounded-lg bg-surface-container-lowest p-md">
                  <div className="mb-sm flex items-center justify-between">
                    <h3 className="text-label-sm uppercase text-on-surface">Upcoming Recurring</h3>
                    <a
                      href="/recurring"
                      className="pressable text-label-sm uppercase text-primary hover:underline"
                    >
                      View All
                    </a>
                  </div>
                  <div className="space-y-base">
                    {scheduled.slice(0, 6).map((s) => {
                      const env = envelopes.find((e) => e.id === s.categoryId);
                      const anchor = s.nextDue ?? s.startDate;
                      const [, , day] = anchor.split("-");
                      const monthName = new Date(`${anchor}T00:00:00`).toLocaleString("en-US", { month: "short" });
                      return (
                        <div
                          key={s.id}
                          className="ghost-border flex w-full items-center justify-between rounded-md bg-surface-container-low p-sm"
                        >
                          <div className="flex items-center gap-sm">
                            <div className="flex h-10 w-10 flex-col items-center justify-center rounded-md bg-surface-container">
                              <span className="text-label-sm uppercase text-on-surface-variant">{monthName}</span>
                              <span className="text-numeric-data font-medium leading-none">{day}</span>
                            </div>
                            <div>
                              <p className="text-body-md font-medium">{s.name}</p>
                              <p className="text-label-sm text-on-surface-variant">{env?.name ?? "Unassigned"}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-numeric-data font-medium">
                              {currency(Math.abs(s.amount))}
                              {s.frequency !== "monthly" && (
                                <span className="text-label-sm text-on-surface-variant">/{s.frequency}</span>
                              )}
                            </p>
                            {s.status === "paused" ? (
                              <span className="mt-1 inline-block text-label-sm uppercase text-on-surface-variant">
                                Paused
                              </span>
                            ) : s.nextDue ? (
                              <button
                                onClick={() => markPaid(s.id, s.nextDue ?? undefined)}
                                className="pressable mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-label-sm uppercase text-on-primary hover:bg-primary-container"
                              >
                                Mark paid
                              </button>
                            ) : (
                              <span className="mt-1 flex items-center justify-end gap-1 text-label-sm uppercase text-secondary">
                                <CheckCircle2 className="h-3 w-3" /> Paid ahead
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {scheduled.length === 0 && (
                      <p className="text-label-sm text-on-surface-variant">
                        No recurring bills yet — add some in Recurring.
                      </p>
                    )}
                  </div>
                </div>

              </div>

              {/* Right column */}
              <div className="space-y-md lg:col-span-4">
                <div className="ghost-border self-start rounded-lg bg-surface-container-lowest p-md lg:sticky lg:top-20">
                  <div className="mb-sm flex items-center gap-base">
                    <CircleAlert className="h-4 w-4 text-primary" />
                    <h3 className="text-label-sm uppercase text-on-surface">Needs attention</h3>
                  </div>

                  {totals.overspent.length === 0 && shortfall === 0 && totals.uncategorized.length === 0 ? (
                    <p className="text-body-sm text-on-surface-variant">
                      All caught up — every dollar is assigned and categorized.
                    </p>
                  ) : (
                    <ul className="space-y-base">
                      {totals.overspent.slice(0, 3).map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-sm">
                          <span className="truncate text-body-md">{e.name}</span>
                          <span className="shrink-0 text-numeric-data text-error">
                            {currency(Math.abs(e.spent - e.assigned))} over
                          </span>
                        </li>
                      ))}
                      {shortfall > 0 && (
                        <li className="flex items-center justify-between gap-sm">
                          <span className="truncate text-body-md">Underfunded</span>
                          <span className="shrink-0 text-numeric-data text-on-surface-variant">
                            {totals.underfunded.length} envelopes · {currency(shortfall)}
                          </span>
                        </li>
                      )}
                      {totals.uncategorized.length > 0 && (
                        <li className="flex items-center justify-between gap-sm">
                          <span className="truncate text-body-md">Uncategorized</span>
                          <span className="shrink-0 text-numeric-data text-on-surface-variant">
                            {totals.uncategorized.length} transactions
                          </span>
                        </li>
                      )}
                    </ul>
                  )}

                  <a
                    href="/envelopes"
                    className="pressable mt-md flex w-full items-center justify-center gap-base rounded-md bg-primary py-2.5 font-label-bold text-on-primary hover:bg-primary-container"
                  >
                    Review categories <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>

            <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
              <DialogContent className="sm:max-w-[32rem]">
                <DialogHeader>
                  <DialogTitle>How Pinch works</DialogTitle>
                  <DialogDescription>
                    A two-minute tour of assigning, envelopes and rolling with the punches.
                  </DialogDescription>
                </DialogHeader>
                <div className="ghost-border flex aspect-video items-center justify-center rounded-md bg-surface-container-low">
                  <PlayCircle className="h-12 w-12 text-primary" />
                </div>
                <p className="text-label-sm text-on-surface-variant">
                  Video placeholder — drop in your embed once media hosting is connected.
                </p>
              </DialogContent>
            </Dialog>
          </AppShell>
        </TooltipProvider>
      </Authenticated>
    </>
  );
}
