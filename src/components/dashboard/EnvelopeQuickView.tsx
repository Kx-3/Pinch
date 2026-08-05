"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Pin, PinOff, Share2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { useState } from "react";
import {
  useEnvelopes,
  useTransactions,
  useAssignToEnvelope,
  useTogglePin,
  useSetBudget,
  useCategoryLookup,
} from "@/hooks/use-budget-data";
import { useQuickView } from "@/lib/quick-view";
import { currency } from "@/lib/mockData";
import { NewTransactionDialog } from "@/components/dashboard/NewTransactionDialog";

export function EnvelopeQuickView() {
  const { quickViewId, setQuickViewId } = useQuickView();
  const envelopes = useEnvelopes();
  const transactions = useTransactions();
  const assign = useAssignToEnvelope();
  const togglePin = useTogglePin();
  const setBudget = useSetBudget();
  const lookup = useCategoryLookup();

  const category = quickViewId ? (lookup.byId.get(quickViewId) ?? null) : null;
  const envelope = quickViewId ? (envelopes.find((e) => e.id === quickViewId) ?? null) : null;

  // Virtual envelope so the sheet opens for any category, even without a budget yet.
  const cat = category;
  const data = {
    id: quickViewId ?? "",
    name: envelope?.name ?? cat?.name ?? "Category",
    note: envelope?.note ?? "",
    target: envelope?.target ?? 0,
    assigned: envelope?.assigned ?? 0,
    spent: envelope?.spent ?? 0,
    pinned: envelope?.pinned ?? false,
    kind: cat?.kind ?? "outflow",
  };

  const [budget, setBudgetDraft] = useState<string>("0");
  const [prevTarget, setPrevTarget] = useState<number | null>(null);
  if (prevTarget !== data.target) {
    setPrevTarget(data.target);
    setBudgetDraft(String(data.target));
  }

  const isParent = category !== null && lookup.childrenOf(category.id).length > 0;
  const recent = category
    ? transactions
        .filter(
          (t) =>
            (isParent ? lookup.rootIdOf(t.categoryId ?? "") === category.id : t.categoryId === category.id) &&
            t.amount < 0,
        )
        .slice(0, 5)
    : [];
  const pct = data.target > 0 ? Math.min(100, Math.round((data.assigned / data.target) * 100)) : 0;
  const [txOpen, setTxOpen] = useState(false);

  const saveBudget = () => {
    const value = Number(budget);
    if (Number.isNaN(value) || value < 0) {
      toast.error("Enter a valid budget amount");
      return;
    }
    setBudget(data.id, value);
  };

  return (
    <Sheet open={!!category} onOpenChange={(v) => !v && setQuickViewId(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[28rem]">
        {category && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-base">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: `var(--chart-${category.color})` }}
                />
                {data.name}
              </SheetTitle>
              <SheetDescription>{data.note || "Set a monthly budget and fund it as the month goes."}</SheetDescription>
            </SheetHeader>

            <div className="space-y-md p-md pt-0">
              <div className="ghost-border rounded-lg bg-surface-container-low p-md">
                <p className="text-label-sm uppercase text-on-surface-variant">Funded</p>
                <p className="font-mono-numbers text-[28px] font-medium leading-9">
                  {currency(data.assigned)}
                  <span className="text-body-md text-on-surface-variant"> / {currency(data.target)}</span>
                </p>
                <div className="mt-sm h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                  <div
                    className="h-full bg-primary transition-[width] duration-300 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-base flex justify-between text-numeric-data text-on-surface-variant">
                  <span>Spent {currency(data.spent)}</span>
                  <span>{pct}% funded</span>
                </div>
              </div>

              {data.kind === "outflow" && (
                <>
                  <div className="ghost-border rounded-lg bg-surface-container-low p-md">
                    <p className="mb-sm text-label-sm uppercase text-on-surface-variant">Monthly budget</p>
                    <div className="flex items-center gap-base">
                      <input
                        inputMode="decimal"
                        value={budget}
                        onChange={(e) => setBudgetDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveBudget()}
                        className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-sm py-2 font-mono-numbers outline-none transition-colors duration-150 focus:border-primary"
                        aria-label="Monthly budget amount"
                      />
                      <button
                        onClick={saveBudget}
                        className="pressable flex shrink-0 items-center gap-1 rounded-md bg-primary px-md py-2 font-label-bold text-on-primary hover:bg-primary-container"
                      >
                        <Save className="h-4 w-4" /> Save
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-base">
                    {[25, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => assign(data.id, amt)}
                        className="pressable rounded-md border border-outline-variant px-sm py-2 font-mono-numbers text-label-bold hover:border-primary hover:text-primary"
                      >
                        +{currency(amt)}
                      </button>
                    ))}
                    <button
                      onClick={() => assign(data.id, Math.max(0, data.target - data.assigned))}
                      className="pressable rounded-md bg-primary px-md py-2 font-label-bold text-on-primary hover:bg-primary-container"
                    >
                      Fill to target
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-base">
                    <button
                      onClick={() => togglePin(data.id)}
                      className="pressable flex items-center gap-base rounded-md border border-outline-variant px-sm py-2 text-label-bold text-on-surface-variant hover:text-primary"
                    >
                      {data.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      {data.pinned ? "Unpin" : "Pin to dashboard"}
                    </button>
                    <button
                      onClick={() =>
                        toast.success("Link copied", { description: `Shareable view of ${data.name}.` })
                      }
                      className="pressable flex items-center gap-base rounded-md border border-outline-variant px-sm py-2 text-label-bold text-on-surface-variant hover:text-primary"
                    >
                      <Share2 className="h-4 w-4" /> Share
                    </button>
                    <button
                      onClick={() => setTxOpen(true)}
                      className="pressable flex items-center gap-base rounded-md border border-outline-variant px-sm py-2 text-label-bold text-on-surface-variant hover:text-primary"
                    >
                      <Plus className="h-4 w-4" /> Add spend
                    </button>
                  </div>
                </>
              )}

              <div>
                <p className="mb-sm text-label-sm uppercase text-on-surface-variant">Recent activity</p>
                {recent.length === 0 ? (
                  <p className="text-label-bold font-normal text-on-surface-variant">
                    No transactions in this category yet.
                  </p>
                ) : (
                  <ul className="space-y-base">
                    {recent.map((t) => (
                      <li
                        key={t.id}
                        className="ghost-border flex items-center justify-between rounded-md bg-surface-container-low px-sm py-2"
                      >
                        <div>
                          <p className="text-label-bold">{t.payee}</p>
                          <p className="text-numeric-data text-on-surface-variant">{t.date}</p>
                        </div>
                        <span className="text-numeric-data">{currency(t.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <NewTransactionDialog open={txOpen} onOpenChange={setTxOpen} defaultEnvelopeId={data.id} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
