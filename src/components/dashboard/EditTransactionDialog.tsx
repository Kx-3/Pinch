"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSplits, useUpdateTransaction } from "@/hooks/use-budget-data";
import { CategorySelect } from "@/components/dashboard/CategorySelect";
import { PaidFromSelect } from "@/components/dashboard/PaidFromSelect";
import { TagInput } from "@/components/dashboard/TagInput";
import { Plus, X } from "lucide-react";
import type { Transaction } from "@/lib/mockData";

const field =
  "w-full rounded-md border border-outline-variant bg-surface-container-low px-sm py-2 text-label-bold font-normal outline-none transition-colors duration-150 focus:border-primary";

type SplitDraft = { categoryId: string; amount: string; note: string };

export function EditTransactionDialog({
  transaction,
  open,
  onOpenChange,
}: {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const update = useUpdateTransaction();
  const existingSplits = useSplits(transaction?.id ?? null);

  const [prevTx, setPrevTx] = useState(transaction);
  const [date, setDate] = useState(transaction?.date ?? "");
  const [payee, setPayee] = useState(transaction?.payee ?? "");
  const [amount, setAmount] = useState(transaction ? String(Math.abs(transaction.amount)) : "");
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [paidFrom, setPaidFrom] = useState(transaction?.paidFrom ?? "");
  const [tags, setTags] = useState<string[]>(transaction?.tags ?? []);
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [status, setStatus] = useState<"pending" | "cleared" | "reconciled">(transaction?.status ?? "cleared");
  const [splitOn, setSplitOn] = useState(transaction?.isSplit ?? false);
  const [splits, setSplits] = useState<SplitDraft[]>([]);
  const [error, setError] = useState("");

  if (transaction !== prevTx) {
    setPrevTx(transaction);
    if (transaction) {
      setDate(transaction.date);
      setPayee(transaction.payee);
      setAmount(String(Math.abs(transaction.amount)));
      setCategoryId(transaction.categoryId ?? "");
      setPaidFrom(transaction.paidFrom);
      setTags(transaction.tags);
      setNotes(transaction.notes ?? "");
      setStatus(transaction.status);
      setSplitOn(transaction.isSplit);
      setSplits(transaction.isSplit ? existingSplits.map((s) => ({ categoryId: s.categoryId, amount: String(Math.abs(s.amount)), note: s.note })) : []);
      setError("");
    }
  }

  const splitsKey = transaction?.isSplit ? existingSplits.map((s) => s.id).join("|") : "";
  const [prevSplitsKey, setPrevSplitsKey] = useState(splitsKey);
  if (splitsKey !== prevSplitsKey) {
    setPrevSplitsKey(splitsKey);
    if (transaction?.isSplit && existingSplits.length) {
      setSplits(existingSplits.map((s) => ({ categoryId: s.categoryId, amount: String(Math.abs(s.amount)), note: s.note })));
    }
  }

  if (!transaction) return null;

  const abs = Number(amount) || 0;
  const splitTotal = splits.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const splitValid = !splitOn || Math.abs(splitTotal - abs) < 0.005;

  const addSplit = () => setSplits((s) => [...s, { categoryId: "", amount: "", note: "" }]);
  const patchSplit = (i: number, part: Partial<SplitDraft>) =>
    setSplits((s) => s.map((x, idx) => (idx === i ? { ...x, ...part } : x)));

  const save = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
    if (!splitValid) {
      setError(`Split lines total ${splitTotal.toFixed(2)}, but the amount is ${abs.toFixed(2)}.`);
      return;
    }
    const signed = transaction.type === "expense" ? -value : value;
    const parsedSplits = splitOn
      ? splits
          .filter((s) => s.categoryId && Number(s.amount) > 0)
          .map((s) => ({ categoryId: s.categoryId, amount: Number(s.amount), note: s.note }))
      : [];
    const ok = await update(transaction.id, {
      date,
      payee: payee.trim(),
      amount: signed,
      paidFrom,
      tags,
      notes,
      status,
      categoryId: splitOn ? null : categoryId || null,
      splits: parsedSplits,
    });
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[30rem]">
        <DialogHeader>
          <DialogTitle>Edit transaction</DialogTitle>
          <div className="text-label-bold font-normal text-on-surface-variant">{transaction.payee}</div>
        </DialogHeader>

        <div className="space-y-md">
          <div className="grid grid-cols-2 gap-base">
            <div>
              <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
            </div>
            <div>
              <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">Amount</label>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${field} font-mono-numbers`}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">Payee</label>
            <input value={payee} onChange={(e) => setPayee(e.target.value)} className={field} />
          </div>

          <div>
            <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">Paid from</label>
            <PaidFromSelect value={paidFrom} onChange={setPaidFrom} />
          </div>

          <div>
            <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={field}>
              <option value="pending">Pending</option>
              <option value="cleared">Cleared</option>
              <option value="reconciled">Reconciled</option>
            </select>
          </div>

          <div className="flex items-center gap-base">
            <label className="flex cursor-pointer items-center gap-base text-label-bold">
              <input
                type="checkbox"
                checked={splitOn}
                onChange={(e) => setSplitOn(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Split across categories
            </label>
          </div>

          {splitOn ? (
            <div className="space-y-base">
              {splits.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_7rem_auto] items-center gap-base">
                  <CategorySelect value={s.categoryId} onChange={(id) => patchSplit(i, { categoryId: id })} kind={transaction.type === "income" ? "inflow" : "outflow"} />
                  <input
                    inputMode="decimal"
                    placeholder="0.00"
                    value={s.amount}
                    onChange={(e) => patchSplit(i, { amount: e.target.value })}
                    className={`${field} font-mono-numbers`}
                  />
                  <div className="flex items-center gap-1">
                    <input
                      aria-label={`Split ${i + 1} note`}
                      value={s.note}
                      onChange={(e) => patchSplit(i, { note: e.target.value })}
                      placeholder="Note"
                      className="hidden sm:block w-20 rounded-md border border-outline-variant bg-surface-container-low px-sm py-2 text-label-bold font-normal outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setSplits((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label="Remove split line"
                      className="pressable rounded-md p-1.5 text-on-surface-variant hover:text-error"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addSplit}
                className="pressable flex items-center gap-1 text-label-sm uppercase text-primary hover:underline"
              >
                <Plus className="h-4 w-4" /> Add line
              </button>
              {splitOn && (
                <p className={`text-label-sm ${splitValid ? "text-on-surface-variant" : "text-error"}`}>
                  Split total {splitTotal.toFixed(2)} of {abs.toFixed(2)}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">Category</label>
              <CategorySelect
                value={categoryId}
                onChange={setCategoryId}
                placeholder="Uncategorized"
                kind={transaction.type === "income" ? "inflow" : "outflow"}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} placeholder="Optional note" />
          </div>

          <div>
            <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">Tags</label>
            <TagInput value={tags} onChange={setTags} />
          </div>

          {error && <p className="text-label-sm text-error">{error}</p>}
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
            type="button"
            onClick={save}
            className="pressable rounded-md bg-primary px-md py-2.5 font-label-bold text-on-primary hover:bg-primary-container"
          >
            Save changes
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
