"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePaymentMethods } from "@/hooks/use-budget-data";
import { useCreateRecurring, useUpdateRecurring } from "@/hooks/use-budget-data";
import type { Recurring, RecurringFrequency } from "@/lib/mockData";
import { CategorySelect } from "@/components/dashboard/CategorySelect";
import { PaidFromSelect } from "@/components/dashboard/PaidFromSelect";
import { TagInput } from "@/components/dashboard/TagInput";

const field =
  "w-full rounded-md border border-outline-variant bg-surface-container-low px-sm py-2 text-label-bold font-normal outline-none transition-colors duration-150 focus:border-primary";

const FREQUENCIES: { id: RecurringFrequency; label: string }[] = [
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Monthly" },
  { id: "annual", label: "Yearly" },
];

type Form = {
  name: string;
  kind: "expense" | "income";
  amount: string;
  frequency: RecurringFrequency;
  startDate: string;
  categoryId: string;
  paidFrom: string;
  tags: string[];
  notes: string;
  active: boolean;
};

type Seed = { name?: string; amount?: number; frequency?: RecurringFrequency; categoryId?: string | null } | null;

function seedForm(initial: Recurring | null | undefined, suggestion: Seed): Form {
  if (initial) {
    return {
      name: initial.name,
      kind: initial.kind,
      amount: String(Math.abs(initial.amount)),
      frequency: initial.frequency,
      startDate: initial.startDate,
      categoryId: initial.categoryId ?? "",
      paidFrom: initial.paidFrom,
      tags: initial.tags,
      notes: initial.notes,
      active: initial.active,
    };
  }
  return {
    name: suggestion?.name ?? "",
    kind: "expense",
    amount: suggestion?.amount ? String(Math.abs(suggestion.amount)) : "",
    frequency: suggestion?.frequency ?? "monthly",
    startDate: new Date().toISOString().slice(0, 10),
    categoryId: suggestion?.categoryId ?? "",
    paidFrom: "",
    tags: [],
    notes: "",
    active: true,
  };
}

function RecurringForm({
  initial,
  suggestion,
  onClose,
}: {
  initial?: Recurring | null;
  suggestion?: Seed;
  onClose: () => void;
}) {
  const create = useCreateRecurring();
  const update = useUpdateRecurring();
  const paymentMethods = usePaymentMethods();

  const [form, setForm] = useState<Form>(() => seedForm(initial, suggestion ?? null));
  const [error, setError] = useState("");

  const [prevHasMethods, setPrevHasMethods] = useState(false);
  if (!prevHasMethods && !form.paidFrom && paymentMethods.length > 0) {
    setPrevHasMethods(true);
    setForm((f) => ({ ...f, paidFrom: paymentMethods[0].id }));
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const changeKind = (k: "expense" | "income") => {
    setForm((f) => (f.kind === k ? f : { ...f, kind: k, categoryId: "" }));
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    const value = Number(form.amount);
    if (!value || value <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      amount: form.kind === "expense" ? -value : value,
      kind: form.kind,
      frequency: form.frequency,
      startDate: form.startDate,
      categoryId: form.categoryId || null,
      tags: form.tags,
      paidFrom: form.paidFrom,
      active: form.active,
      notes: form.notes,
    };
    const ok = initial ? await update(initial.id, payload) : await create(payload);
    if (ok) onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{initial ? "Edit recurring item" : "Add recurring item"}</DialogTitle>
        <div className="text-label-bold font-normal text-on-surface-variant">
          Bills and subscriptions that repeat on a schedule.
        </div>
      </DialogHeader>

      <div className="space-y-md">
        <div>
          <label htmlFor="rec-name" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
            Name
          </label>
          <input
            id="rec-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Netflix"
            className={field}
          />
        </div>

        <div>
          <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">Type</label>
          <div className="grid grid-cols-2 gap-base rounded-md bg-surface-container-low p-1">
            {(["expense", "income"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => changeKind(k)}
                className={`pressable rounded-md px-sm py-2 text-label-bold capitalize ${
                  form.kind === k ? "bg-surface-container-lowest text-primary" : "text-on-surface-variant"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-base">
          <div>
            <label htmlFor="rec-amount" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
              Amount
            </label>
            <input
              id="rec-amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="19.99"
              className={`${field} font-mono-numbers`}
            />
          </div>
          <div>
            <label htmlFor="rec-freq" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
              Frequency
            </label>
            <select
              id="rec-freq"
              value={form.frequency}
              onChange={(e) => set("frequency", e.target.value as RecurringFrequency)}
              className={field}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="rec-start" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
            First occurrence
          </label>
          <input
            id="rec-start"
            type="date"
            value={form.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            className={field}
          />
        </div>

        <div>
          <label htmlFor="rec-category" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
            Category
          </label>
          <CategorySelect
            id="rec-category"
            value={form.categoryId}
            onChange={(id) => set("categoryId", id)}
            kind={form.kind === "income" ? "inflow" : "outflow"}
            placeholder="Uncategorized"
          />
        </div>

        <div>
          <label htmlFor="rec-paid-from" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
            Paid from
          </label>
          <PaidFromSelect id="rec-paid-from" value={form.paidFrom} onChange={(id) => set("paidFrom", id)} />
        </div>

        <div>
          <label htmlFor="rec-tags" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
            Tags
          </label>
          <TagInput id="rec-tags" value={form.tags} onChange={(tags) => set("tags", tags)} />
        </div>

        <div>
          <label htmlFor="rec-notes" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
            Notes
          </label>
          <input
            id="rec-notes"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Optional note"
            className={field}
          />
        </div>

        {initial && (
          <label className="flex cursor-pointer items-center gap-base text-label-bold">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Active
          </label>
        )}

        {error && <p className="text-label-sm text-error">{error}</p>}
      </div>

      <DialogFooter>
        <button
          type="button"
          onClick={onClose}
          className="pressable rounded-md border border-outline-variant px-md py-2.5 font-label-bold text-on-surface-variant hover:bg-surface-container-low"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          className="pressable rounded-md bg-primary px-md py-2.5 font-label-bold text-on-primary hover:bg-primary-container"
        >
          {initial ? "Save changes" : "Add recurring"}
        </button>
      </DialogFooter>
    </>
  );
}

export function RecurringDialog({
  open,
  onOpenChange,
  initial,
  suggestion,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Recurring | null;
  suggestion?: Seed;
}) {
  const formKey = `${initial?.id ?? "new"}:${suggestion?.name ?? ""}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[28rem]">
        {open && <RecurringForm key={formKey} initial={initial} suggestion={suggestion} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}