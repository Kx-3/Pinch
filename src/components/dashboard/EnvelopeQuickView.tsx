"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Pin, PinOff, Share2, Plus } from "lucide-react";
import { toast } from "sonner";

import { useState } from "react";
import { useBudget } from "@/lib/budget-store";
import { currency } from "@/lib/mockData";
import { NewTransactionDialog } from "@/components/dashboard/NewTransactionDialog";

export function EnvelopeQuickView() {
  const { quickViewId, setQuickViewId, envelopes, transactions, assign, togglePin } = useBudget();
  const envelope = envelopes.find((e) => e.id === quickViewId) ?? null;
  const [txOpen, setTxOpen] = useState(false);

  const recent = envelope ? transactions.filter((t) => t.categoryId === envelope.id).slice(0, 5) : [];
  const pct = envelope ? Math.min(100, Math.round((envelope.assigned / envelope.target) * 100)) : 0;

  return (
    <Sheet open={!!envelope} onOpenChange={(v) => !v && setQuickViewId(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[28rem]">
        {envelope && (
          <>
            <SheetHeader>
              <SheetTitle>{envelope.name}</SheetTitle>
              <SheetDescription>{envelope.note}</SheetDescription>
            </SheetHeader>

            <div className="space-y-md p-md pt-0">
              <div className="ghost-border rounded-lg bg-surface-container-low p-md">
                <p className="text-label-sm uppercase text-on-surface-variant">Funded</p>
                <p className="font-mono-numbers text-[28px] font-medium leading-9">
                  {currency(envelope.assigned)}
                  <span className="text-body-md text-on-surface-variant"> / {currency(envelope.target)}</span>
                </p>
                <div className="mt-sm h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                  <div
                    className="h-full bg-primary transition-[width] duration-300 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-base flex justify-between text-numeric-data text-on-surface-variant">
                  <span>Spent {currency(envelope.spent)}</span>
                  <span>{pct}% funded</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-base">
                {[25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => assign(envelope.id, amt)}
                    className="pressable rounded-md border border-outline-variant px-sm py-2 font-mono-numbers text-label-bold hover:border-primary hover:text-primary"
                  >
                    +{currency(amt)}
                  </button>
                ))}
                <button
                  onClick={() => assign(envelope.id, Math.max(0, envelope.target - envelope.assigned))}
                  className="pressable rounded-md bg-primary px-md py-2 font-label-bold text-on-primary hover:bg-primary-container"
                >
                  Fill to target
                </button>
              </div>

              <div className="flex flex-wrap gap-base">
                <button
                  onClick={() => togglePin(envelope.id)}
                  className="pressable flex items-center gap-base rounded-md border border-outline-variant px-sm py-2 text-label-bold text-on-surface-variant hover:text-primary"
                >
                  {envelope.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  {envelope.pinned ? "Unpin" : "Pin to dashboard"}
                </button>
                <button
                  onClick={() =>
                    toast.success("Link copied", { description: `Shareable view of ${envelope.name}.` })
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

              <div>
                <p className="mb-sm text-label-sm uppercase text-on-surface-variant">Recent activity</p>
                {recent.length === 0 ? (
                  <p className="text-label-bold font-normal text-on-surface-variant">
                    No transactions in this envelope yet.
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

            <NewTransactionDialog open={txOpen} onOpenChange={setTxOpen} defaultEnvelopeId={envelope.id} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
