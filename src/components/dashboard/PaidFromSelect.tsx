"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBudget } from "@/lib/budget-store";
import { PAYMENT_METHOD_KINDS, type PaymentMethodKind } from "@/lib/mockData";

const fieldBase =
  "w-full rounded-md border border-outline-variant bg-surface-container-low px-sm py-2 text-label-bold font-normal outline-none transition-colors duration-150 focus:border-primary";

const ADD_VALUE = "__add__";

/** "Paid from" dropdown with an inline "add your own" escape hatch (Alipay, WeChat Pay…). */
export function PaidFromSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (id: string) => void;
  id?: string;
}) {
  const { paymentMethods } = useBudget();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          if (e.target.value === ADD_VALUE) setAddOpen(true);
          else onChange(e.target.value);
        }}
        className={fieldBase}
      >
        {paymentMethods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
        <option value={ADD_VALUE}>+ Add payment method…</option>
      </select>

      <AddPaymentMethodDialog open={addOpen} onOpenChange={setAddOpen} onAdded={onChange} />
    </>
  );
}

export function AddPaymentMethodDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded?: (id: string) => void;
}) {
  const { addPaymentMethod } = useBudget();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<PaymentMethodKind>("wallet");
  const [error, setError] = useState("");

  const save = () => {
    if (!label.trim()) {
      setError("Give it a name, e.g. Alipay.");
      return;
    }
    const id = addPaymentMethod(label, kind);
    if (!id) return;
    onAdded?.(id);
    setLabel("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[24rem]">
        <DialogHeader>
          <DialogTitle>Add payment method</DialogTitle>
          <div className="text-label-bold font-normal text-on-surface-variant">Wallets, cash stashes or anything else you pay from.</div>
        </DialogHeader>

        <div className="space-y-md">
          <div>
            <label htmlFor="pm-label" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
              Name
            </label>
            <input
              id="pm-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Alipay"
              className={fieldBase}
            />
            {error && <p className="mt-1 text-label-sm text-error">{error}</p>}
          </div>

          <div>
            <label htmlFor="pm-kind" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
              Type
            </label>
            <select
              id="pm-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as PaymentMethodKind)}
              className={fieldBase}
            >
              {PAYMENT_METHOD_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
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
            Add method
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
