"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, Sparkles, RefreshCcw } from "lucide-react";
import {
  useRecurring,
  useDetectRecurring,
  useDeleteRecurring,
  useMarkOccurrencePaid,
  useCategoryLookup,
} from "@/hooks/use-budget-data";
import { AppShell } from "@/components/layout/AppShell";
import { RecurringDialog } from "@/components/dashboard/RecurringDialog";
import { currency } from "@/lib/mockData";
import type { Recurring, RecurringSuggestion } from "@/lib/mockData";

const freqLabel: Record<Recurring["frequency"], string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  annual: "Yearly",
};

const statusColor: Record<Recurring["status"], string> = {
  overdue: "bg-error",
  due: "bg-tertiary",
  upcoming: "bg-secondary",
  paused: "bg-on-surface-variant/40",
};

const fmtDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export default function RecurringPage() {
  const items = useRecurring();
  const suggestions = useDetectRecurring();
  const deleteItem = useDeleteRecurring();
  const markPaid = useMarkOccurrencePaid();
  const lookup = useCategoryLookup();

  const [addOpen, setAddOpen] = useState(false);
  const [addSuggestion, setAddSuggestion] = useState<{ name: string; amount: number; frequency: Recurring["frequency"]; categoryId?: string | null } | null>(null);
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null);

  const active = items.filter((i) => i.active);
  const projectedMonthly = active
    .filter((i) => i.kind === "expense")
    .reduce((s, i) => s + Math.abs(i.projectedMonthly), 0);
  const dueSoon = active.filter((i) => i.status === "due").length;
  const overdueCount = active.filter((i) => i.status === "overdue").length;

  const groups = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return {
      overdue: items.filter((i) => i.active && i.status === "overdue"),
      due: items.filter((i) => i.active && i.status === "due"),
      thisMonth: items.filter((i) => i.active && i.status === "upcoming" && (i.nextDue ?? "").startsWith(thisMonth)),
      later: items.filter((i) => i.active && i.status === "upcoming" && !(i.nextDue ?? "").startsWith(thisMonth)),
      paused: items.filter((i) => !i.active),
    };
  }, [items]);

  const openSuggestion = (s: RecurringSuggestion) => {
    setAddSuggestion({ name: s.payee, amount: Math.abs(s.avgAmount), frequency: s.frequency, categoryId: s.categoryId });
    setAddOpen(true);
  };

  const row = (s: Recurring) => {
    const envName = s.categoryId ? lookup.nameOf(s.categoryId) : "Unassigned";
    return (
      <div
        key={s.id}
        className={`grid grid-cols-[auto_1fr_auto] items-center gap-base rounded-md border border-outline-variant bg-surface-container-lowest p-sm transition-colors duration-150 hover:bg-surface-container-low sm:grid-cols-[auto_1fr_7rem_auto]`}
      >
        <span title={s.status} className={`h-2 w-2 shrink-0 rounded-full ${statusColor[s.status]}`} />
        <div className="min-w-0">
          <p className="truncate text-body-md font-medium">
            {s.name}
            {s.kind === "income" && <span className="ml-1 text-label-sm uppercase text-secondary">inflow</span>}
          </p>
          <p className="truncate text-label-sm text-on-surface-variant">
            {envName} · {freqLabel[s.frequency]}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-numeric-data font-medium ${s.kind === "income" ? "text-secondary" : ""}`}>
            {currency(s.amount)}
          </p>
          <p className="text-label-sm text-on-surface-variant">
            {s.nextDue ? fmtDate(s.nextDue) : "—"}
          </p>
          {s.status === "overdue" && (
            <p className="text-label-sm uppercase text-error">Overdue</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-1">
          {s.active && s.nextDue && s.status !== "paused" && (
            <button
              onClick={() => markPaid(s.id, s.nextDue ?? undefined)}
              aria-label={`Mark ${s.name} paid`}
              title="Mark this occurrence paid"
              className="pressable flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-label-sm uppercase text-on-primary hover:bg-primary-container"
            >
              <CheckCircle2 className="h-3 w-3" /> Paid
            </button>
          )}
          <button
            onClick={() => setEditing(s)}
            aria-label={`Edit ${s.name}`}
            className="pressable rounded-md p-1.5 text-on-surface-variant hover:text-primary"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (deleteArmed === s.id) {
                deleteItem(s.id);
                setDeleteArmed(null);
              } else {
                setDeleteArmed(s.id);
              }
            }}
            aria-label={`Delete ${s.name}`}
            className={`pressable rounded-md p-1.5 ${deleteArmed === s.id ? "bg-error text-on-primary" : "text-on-surface-variant hover:text-error"}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <AppShell title="Recurring" subtitle="Bills and subscriptions, on schedule.">
      <div className="grid grid-cols-1 gap-base sm:grid-cols-3">
        <div className="ghost-border rounded-lg bg-surface-container-lowest p-md">
          <p className="text-label-sm uppercase text-on-surface-variant">Active items</p>
          <p className="mt-1 text-display-md font-semibold">{active.length}</p>
        </div>
        <div className="ghost-border rounded-lg bg-surface-container-lowest p-md">
          <p className="text-label-sm uppercase text-on-surface-variant">Projected monthly outflow</p>
          <p className="mt-1 text-display-md font-semibold font-mono-numbers">{currency(projectedMonthly)}</p>
          <p className="text-label-sm text-on-surface-variant">across {active.filter((i) => i.kind === "expense").length} active bills</p>
        </div>
        <div className="ghost-border rounded-lg bg-surface-container-lowest p-md">
          <p className="text-label-sm uppercase text-on-surface-variant">Next 7 days</p>
          <p className="mt-1 text-display-md font-semibold">
            {dueSoon}
            {overdueCount > 0 && <span className="ml-1 text-label-sm uppercase text-error">+ {overdueCount} overdue</span>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-sm">
        <h2 className="text-headline-sm font-semibold">Upcoming</h2>
        <button
          onClick={() => {
            setAddSuggestion(null);
            setAddOpen(true);
          }}
          className="pressable flex items-center gap-1 rounded-md bg-primary px-md py-2 text-label-sm uppercase text-on-primary hover:bg-primary-container"
        >
          <Plus className="h-4 w-4" /> Add recurring
        </button>
      </div>

      <div className="space-y-base">
        {groups.overdue.length > 0 && (
          <section className="space-y-base">
            <h3 className="text-label-sm uppercase text-error">Overdue</h3>
            {groups.overdue.map(row)}
          </section>
        )}
        {groups.due.length > 0 && (
          <section className="space-y-base">
            <h3 className="text-label-sm uppercase text-on-surface-variant">Due soon</h3>
            {groups.due.map(row)}
          </section>
        )}
        {groups.thisMonth.length > 0 && (
          <section className="space-y-base">
            <h3 className="text-label-sm uppercase text-on-surface-variant">This month</h3>
            {groups.thisMonth.map(row)}
          </section>
        )}
        {groups.later.length > 0 && (
          <section className="space-y-base">
            <h3 className="text-label-sm uppercase text-on-surface-variant">Later</h3>
            {groups.later.map(row)}
          </section>
        )}
        {groups.paused.length > 0 && (
          <section className="space-y-base">
            <h3 className="text-label-sm uppercase text-on-surface-variant">Paused</h3>
            {groups.paused.map(row)}
          </section>
        )}

        {items.length === 0 && suggestions.length === 0 && (
          <div className="animate-in fade-in duration-200 ghost-border rounded-lg bg-surface-container-lowest p-lg text-center">
            <RefreshCcw className="mx-auto h-6 w-6 text-on-surface-variant" />
            <p className="mt-sm text-body-md font-medium">No recurring items yet.</p>
            <p className="text-label-sm text-on-surface-variant">
              Add your subscriptions and bills, or use the suggestions below.
            </p>
            <button
              onClick={() => {
                setAddSuggestion(null);
                setAddOpen(true);
              }}
              className="pressable mt-md inline-flex items-center gap-1 rounded-md bg-primary px-md py-2 text-label-sm uppercase text-on-primary hover:bg-primary-container"
            >
              <Plus className="h-4 w-4" /> Add your first recurring item
            </button>
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <section className="ghost-border rounded-lg bg-surface-container-lowest p-md">
          <div className="mb-sm flex items-center gap-base">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-headline-sm font-semibold">Detected from your transactions</h2>
          </div>
          <p className="mb-md text-label-sm text-on-surface-variant">
            We found patterns in your spending history. Add one and we&apos;ll track it going forward.
          </p>
          <div className="space-y-base">
            {suggestions.map((s) => (
              <div
                key={s.payee}
                className="flex flex-wrap items-center justify-between gap-base rounded-md border border-outline-variant bg-surface-container-low p-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-body-md font-medium">{s.payee}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {freqLabel[s.frequency]} · {s.count} occurrences · avg {currency(-Math.abs(s.avgAmount))}
                  </p>
                </div>
                <div className="flex items-center gap-base">
                  <span className="text-numeric-data font-medium">{currency(-Math.abs(s.avgAmount))}</span>
                  <button
                    onClick={() => openSuggestion(s)}
                    className="pressable rounded-md bg-primary px-sm py-2 text-label-sm uppercase text-on-primary hover:bg-primary-container"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <RecurringDialog
        open={addOpen}
        onOpenChange={(v) => {
          setAddOpen(v);
          if (!v) setAddSuggestion(null);
        }}
        suggestion={addSuggestion}
      />
      <RecurringDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        initial={editing}
      />
    </AppShell>
  );
}