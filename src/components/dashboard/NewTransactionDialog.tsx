"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAddTransaction,
  useAllTags,
  useCategoryLookup,
  usePaymentMethods,
} from "@/hooks/use-budget-data";
import { CategorySelect } from "@/components/dashboard/CategorySelect";
import { PaidFromSelect } from "@/components/dashboard/PaidFromSelect";
import { TagInput } from "@/components/dashboard/TagInput";

export function NewTransactionDialog({
  open,
  onOpenChange,
  defaultEnvelopeId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultEnvelopeId?: string;
}) {
  const addTransaction = useAddTransaction();
  const allTags = useAllTags();
  const lookup = useCategoryLookup();
  const paymentMethods = usePaymentMethods();
  const firstOutflow = lookup.budgetable()[0]?.id ?? "";
  const firstInflow = lookup.flat.find((c) => c.kind === "inflow")?.id ?? "";
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(defaultEnvelopeId ?? firstOutflow);
  const [paidFrom, setPaidFrom] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<"outflow" | "inflow">("outflow");
  const [errors, setErrors] = useState<{ payee?: string; amount?: string }>({});

  const [prevHasMethods, setPrevHasMethods] = useState(false);
  if (!prevHasMethods && !paidFrom && paymentMethods.length > 0) {
    setPrevHasMethods(true);
    setPaidFrom(paymentMethods[0].id);
  }

  const changeKind = (k: "outflow" | "inflow") => {
    setKind(k);
    const valid = k === "outflow" ? firstOutflow : firstInflow;
    const current = lookup.byId.get(categoryId);
    const currentIsValid = current && current.kind === k;
    if (!currentIsValid) setCategoryId(valid);
  };

  const reset = () => {
    setPayee("");
    setAmount("");
    setTags([]);
    setNotes("");
    setErrors({});
    setKind("outflow");
    setCategoryId(firstOutflow);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!payee.trim()) next.payee = "Who was this paid to?";
    const value = Number(amount);
    if (!amount.trim()) next.amount = "Enter an amount.";
    else if (Number.isNaN(value) || value <= 0) next.amount = "Amount must be a positive number.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const tx = {
      date: new Date().toISOString().slice(0, 10),
      payee: payee.trim(),
      categoryId: categoryId || null,
      amount: kind === "outflow" ? -value : value,
      type: kind === "outflow" ? "expense" as const : "income" as const,
      paidFrom,
      tags,
      notes,
    }
    console.log("Adding transaction", tx);
    addTransaction(tx);
    reset();
    onOpenChange(false);
  };

  const field =
    "w-full rounded-md border border-outline-variant bg-surface-container-low px-sm py-2 text-label-bold font-normal outline-none transition-colors duration-150 focus:border-primary";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[28rem]">
        <DialogHeader>
          <DialogTitle>New transaction</DialogTitle>
          <div className="text-label-bold font-normal text-on-surface-variant">Record money moving in or out, then give it a job.</div>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-md">
          <div className="grid grid-cols-2 gap-base rounded-md bg-surface-container-low p-1">
            {(["outflow", "inflow"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => changeKind(k)}
                className={`pressable rounded-md px-sm py-2 text-label-bold capitalize ${
                  kind === k ? "bg-surface-container-lowest text-primary" : "text-on-surface-variant"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="payee" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
              Payee
            </label>
            <input
              id="payee"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="Whole Foods"
              className={field}
            />
            {errors.payee && <p className="mt-1 text-label-sm text-error">{errors.payee}</p>}
          </div>

          <div>
            <label htmlFor="amount" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
              Amount
            </label>
            <input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="42.50"
              className={`${field} font-mono-numbers`}
            />
            {errors.amount && <p className="mt-1 text-label-sm text-error">{errors.amount}</p>}
          </div>

          <div>
            <label htmlFor="category" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
              Category
            </label>
            <CategorySelect id="category" value={categoryId} onChange={setCategoryId} kind={kind} />
            {kind === "inflow" && categoryId === "" && (
              <p className="mt-1 text-label-sm text-on-surface-variant">
                No income categories yet — add one in Settings → Categories.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="paid-from" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
              Paid from
            </label>
            <PaidFromSelect id="paid-from" value={paidFrom} onChange={setPaidFrom} />
          </div>

          <div>
            <label htmlFor="tags" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
              Tags
            </label>
            <TagInput id="tags" value={tags} onChange={setTags} suggestions={allTags} />
          </div>

          <div>
            <label htmlFor="notes" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
              Notes
            </label>
            <input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note"
              className={field}
            />
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="pressable rounded-md border border-outline-variant px-md py-2.5 font-label-bold text-on-surface-variant hover:bg-surface-container-low"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="pressable rounded-md bg-primary px-md py-2.5 font-label-bold text-on-primary hover:bg-primary-container"
            >
              Save transaction
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
