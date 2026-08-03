"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import {
  Star,
  CalendarDays,
  CheckCircle2,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { TipsCarousel } from "@/components/dashboard/TipsCarousel";
import { AssignSimulator } from "@/components/dashboard/AssignSimulator";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBudget } from "@/lib/budget-store";
import { currency, currency0 } from "@/lib/mockData";
import { categoryById, categoryColor } from "@/lib/categories";
import { Authenticated } from "convex/react";
import { useUser } from "@clerk/nextjs";

// Lift static formatters and helpers above the component
const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-US", { day: "numeric", month: "long" });

function getPeriod(monthOffset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

  return {
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    range: `${fmtDay(start)} – ${fmtDay(end)}`,
    progress:
      monthOffset < 0
        ? 100
        : monthOffset > 0
          ? 0
          : Math.round((18 / end.getDate()) * 100),
  };
}

export default function Dashboard() {
  const {
    readyToAssign,
    autoAssign,
    totals,
    scheduled,
    envelopes,
    transactions,
    fundScheduled,
    setQuickViewId,
  } = useBudget();
  const [demoOpen, setDemoOpen] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const { user } = useUser();
  // const userId = useQuery(api.functions.users.getUserId);

  // const myTransactions = useQuery(api.functions.budget.getTransactions);

  const firstName = (user?.firstName ?? "there").split(" ")[0];

  const period = useMemo(() => getPeriod(monthOffset), [monthOffset]);

  /** Expenses grouped by top-level category, with children for collapsible groups. */
  const expenseGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; spent: number; children: typeof envelopes }>();
    for (const e of envelopes) {
      if (e.spent <= 0) continue;
      const groupId = e.group;
      const entry = map.get(groupId) ?? {
        id: groupId,
        name: categoryById(groupId)?.name ?? groupId,
        spent: 0,
        children: [] as typeof envelopes,
      };
      entry.spent += e.spent;
      if (e.id !== groupId) entry.children.push(e);
      map.set(groupId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent);
  }, [envelopes]);

  const expenseTotal = expenseGroups.reduce((s, g) => s + g.spent, 0) || 1;

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

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

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
                    <p className="truncate text-headline-sm uppercase text-on-surface-variant font-semibold">{period.label}: {period.range}</p>
                    <p className="mt-0.5 truncate text-label-sm">
                      
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
                <div>
                  <p className="mb-md text-label-sm uppercase text-on-surface-variant">This month</p>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-md">
                    <div className="min-w-0">
                      <p className="text-label-sm uppercase text-on-surface-variant">Income</p>
                      <p className="font-mono-numbers text-[44px] font-semibold leading-none tracking-[-0.02em] text-secondary">
                        <AnimatedNumber value={totals.income} format={currency0} duration={900} />
                      </p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-label-sm uppercase text-on-surface-variant">Expenses</p>
                      <p className="font-mono-numbers text-[32px] font-medium leading-none tracking-[-0.02em] text-on-surface">
                        <AnimatedNumber value={totals.spent} format={currency0} duration={900} />
                      </p>
                    </div>
                  </div>

                  {/* Expense composition bar — each segment is a category's share of spend */}
                  <div className="mt-md">
                    <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-surface-container-highest">
                      {expenseGroups.map((g) => (
                        <Tooltip key={g.id}>
                          <TooltipTrigger asChild>
                            <div
                              className="h-full cursor-help transition-[width] duration-300 ease-out first:rounded-l-full last:rounded-r-full"
                              style={{
                                width: `${(g.spent / expenseTotal) * 100}%`,
                                backgroundColor: categoryColor(g.id),
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            {g.name} — {currency(g.spent)} ({Math.round((g.spent / expenseTotal) * 100)}%)
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
                        style={{ backgroundColor: categoryColor(g.id) }}
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
                  <h2 className="font-mono-numbers text-[28px] font-semibold leading-none tracking-[-0.01em]">
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
                                style={{ backgroundColor: categoryColor("income") }}
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
                                    style={{ backgroundColor: categoryColor(g.id) }}
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
                                <ul className="mb-1 ml-[14px] space-y-1 border-l border-outline-variant pl-sm">
                                  {g.children
                                    .slice()
                                    .sort((a, b) => b.spent - a.spent)
                                    .map((c) => (
                                      <li key={c.id}>
                                        <button
                                          onClick={() => setQuickViewId(c.id)}
                                          className="pressable flex w-full items-center justify-between gap-sm rounded-md px-1 py-1 text-left hover:bg-surface-container-low"
                                        >
                                          <span className="truncate text-label-bold font-normal text-on-surface-variant">
                                            {c.name}
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
                    <h3 className="text-label-sm uppercase text-on-surface">Upcoming Scheduled Outflows</h3>
                    <a
                      href="/transactions"
                      className="pressable text-label-sm uppercase text-primary hover:underline"
                    >
                      View All
                    </a>
                  </div>
                  <div className="space-y-base">
                    {scheduled.map((s) => {
                      const env = envelopes.find((e) => e.id === s.categoryId);
                      const [, month, day] = s.date.split("-");
                      const monthName = new Date(`${s.date}T00:00:00`).toLocaleString("en-US", { month: "short" });
                      return (
                        <button
                          key={s.id}
                          onClick={() => env && setQuickViewId(env.id)}
                          className="pressable ghost-border flex w-full items-center justify-between rounded-md bg-surface-container-low p-sm text-left hover:bg-surface-container"
                        >
                          <div className="flex items-center gap-sm">
                            <div className="flex h-10 w-10 flex-col items-center justify-center rounded-md bg-surface-container">
                              <span className="text-label-sm uppercase text-on-surface-variant">{monthName}</span>
                              <span className="text-numeric-data font-medium leading-none">{day ?? month}</span>
                            </div>
                            <div>
                              <p className="text-body-md font-medium">{s.name}</p>
                              <p className="text-label-sm text-on-surface-variant">{env?.name ?? "Unassigned"}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-numeric-data font-medium">{currency(s.amount)}</p>
                            {s.funded ? (
                              <span className="flex items-center justify-end gap-1 text-label-sm uppercase text-secondary">
                                <CheckCircle2 className="h-3 w-3" /> Funded
                              </span>
                            ) : (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fundScheduled(s.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.stopPropagation();
                                    fundScheduled(s.id);
                                  }
                                }}
                                className="pressable mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-label-sm uppercase text-on-primary hover:bg-primary-container"
                              >
                                Fund now
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <AssignSimulator />
              </div>

              {/* Right column */}
              <div className="space-y-md lg:col-span-4">
                {/* <div className="ghost-border rounded-lg bg-surface-container-lowest p-md">
                <h3 className="mb-sm text-label-sm uppercase text-on-surface">Key metrics</h3>
                <div className="divide-y divide-outline-variant">
                  {metrics.map((m, i) => (
                    <Tooltip key={m.label}>
                      <TooltipTrigger asChild>
                        <div
                          className="enter-rise hover-lift grid cursor-help grid-cols-[minmax(0,1fr)_auto] items-baseline gap-sm py-sm"
                          style={{ "--enter-delay": `${160 + i * 60}ms` } as React.CSSProperties}
                        >
                          <p className="min-w-0 truncate text-label-sm uppercase text-on-surface-variant">
                            {m.label}
                          </p>
                          <p
                            className={`text-numeric-data font-medium ${
                              m.accent ? "text-secondary" : "text-on-surface"
                            }`}
                          >
                            <AnimatedNumber value={m.value} format={m.format} />
                          </p>
                          {m.note && (
                            <p className="col-span-2 text-label-sm text-on-surface-variant">{m.note}</p>
                          )}
                          {m.bar !== undefined && (
                            <div className="col-span-2 h-1 w-full overflow-hidden rounded-full bg-surface-container">
                              <div
                                className="h-full bg-primary transition-[width] duration-300 ease-out"
                                style={{ width: `${m.bar}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{m.hint}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div> */}

                <div className="ghost-border rounded-lg bg-primary-fixed p-md text-on-primary-fixed">
                  <div className="mb-sm flex items-center gap-base">
                    <CalendarDays className="h-4 w-4" />
                    <h3 className="text-label-sm uppercase">Next Month Reserve</h3>
                  </div>
                  <p className="font-mono-numbers text-display-lg leading-none">$1,200</p>
                  <p className="mt-sm text-body-md opacity-70">Assigned for November bills already.</p>
                  <button
                    onClick={() =>
                      toast("Reserve unchanged", {
                        description: "November reserve management arrives with the backend.",
                      })
                    }
                    className="pressable mt-md w-full rounded-md bg-primary py-2.5 font-label-bold text-on-primary hover:bg-primary-container"
                  >
                    Manage Reserve
                  </button>
                </div>

                <TipsCarousel />
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
