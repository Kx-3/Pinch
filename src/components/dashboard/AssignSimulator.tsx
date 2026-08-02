"use client";

import { useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useBudget } from "@/lib/budget-store";
import { currency0 } from "@/lib/mockData";

/** Live "what-if" planner: adjust savings rate and see the month recalculate instantly. */
export function AssignSimulator() {
  const { readyToAssign, totals } = useBudget();
  const [rate, setRate] = useState(20);
  const [roundUp, setRoundUp] = useState(true);
  const [horizon, setHorizon] = useState(6);

  const toSavings = Math.round((readyToAssign * rate) / 100);
  const toSpending = readyToAssign - toSavings;
  const monthly = roundUp ? Math.ceil(toSavings / 50) * 50 : toSavings;
  const projected = monthly * horizon;
  const ageOfMoney = 32 + Math.round(rate / 4);

  const summary = `Pinch plan — ${rate}% to savings (${currency0(monthly)}/mo), ${currency0(toSpending)} to spending, ${currency0(projected)} banked in ${horizon} months.`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Plan copied", { description: "Paste it anywhere you like." });
    } catch {
      toast.error("Couldn't copy", { description: "Clipboard access was blocked." });
    }
  };

  return (
    <div className="ghost-border rounded-lg bg-surface-container-lowest p-md">
      <div className="mb-md flex items-center gap-base">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-label-sm uppercase text-on-surface">What-if planner</h3>
      </div>

      <div className="grid gap-md md:grid-cols-2">
        <div className="space-y-md">
          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-label-sm uppercase text-on-surface-variant">Savings rate</label>
              <span className="font-mono-numbers text-label-bold">{rate}%</span>
            </div>
            <Slider
              value={[rate]}
              onValueChange={([v]) => setRate(v)}
              min={0}
              max={100}
              step={5}
              className="mt-sm"
              aria-label="Savings rate"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-label-sm uppercase text-on-surface-variant">Horizon</label>
              <span className="font-mono-numbers text-label-bold">{horizon} months</span>
            </div>
            <Slider
              value={[horizon]}
              onValueChange={([v]) => setHorizon(v)}
              min={1}
              max={24}
              step={1}
              className="mt-sm"
              aria-label="Horizon in months"
            />
          </div>

          <div className="flex items-center justify-between">
            <label htmlFor="roundup" className="text-label-bold text-on-surface-variant">
              Round contributions to $50
            </label>
            <Switch id="roundup" checked={roundUp} onCheckedChange={setRoundUp} />
          </div>
        </div>

        <div className="ghost-border flex flex-col justify-between rounded-md bg-surface-container-low p-md">
          <div className="space-y-base">
            <div className="flex justify-between">
              <span className="text-body-md text-on-surface-variant">Monthly to savings</span>
              <span className="font-mono-numbers text-label-bold text-secondary">
                <AnimatedNumber value={monthly} format={currency0} duration={450} />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body-md text-on-surface-variant">Left to spend</span>
              <span className="font-mono-numbers text-label-bold">
                <AnimatedNumber value={toSpending} format={currency0} duration={450} />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body-md text-on-surface-variant">Banked in {horizon} mo</span>
              <span className="font-mono-numbers text-label-bold">
                <AnimatedNumber value={projected} format={currency0} duration={450} />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body-md text-on-surface-variant">Projected age of money</span>
              <span className="font-mono-numbers text-label-bold">
                <AnimatedNumber value={ageOfMoney} format={(n) => `${Math.round(n)} days`} duration={450} />
              </span>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className="h-full bg-secondary transition-[width] duration-200 ease-out"
                style={{ width: `${rate}%` }}
              />
            </div>
            <p className="text-label-sm text-on-surface-variant">
              Based on {currency0(readyToAssign)} ready to assign and {currency0(totals.assigned)} already
              assigned.
            </p>
          </div>

          <button
            onClick={copy}
            className="pressable mt-md flex items-center justify-center gap-base rounded-md bg-primary py-2.5 font-label-bold text-on-primary hover:bg-primary-container"
          >
            <Copy className="h-4 w-4" /> Copy plan
          </button>
        </div>
      </div>
    </div>
  );
}
