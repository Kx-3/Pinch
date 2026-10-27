"use client";

import { Star } from "lucide-react";
import { formatCentsExact } from "@/lib/budget-utils";

interface IncomeBannerProps {
  label: string;
  range: string;
  incomeCents: number;
  assignedCents: number;
}

export function IncomeBanner({ label, range, incomeCents, assignedCents }: IncomeBannerProps) {
  const ready = incomeCents - assignedCents;
  const share = incomeCents > 0 ? Math.max(0, Math.min(1, assignedCents / incomeCents)) : 0;

  return (
    <div className="ghost-border flex flex-col justify-between gap-md rounded-lg bg-primary p-md text-on-primary md:flex-row md:items-center">
      <div>
        <div className="mb-sm flex items-center gap-base">
          <Star className="h-4 w-4 fill-current" />
          <span className="text-label-sm uppercase">Left to budget</span>
        </div>
        <p className="text-numeric-xl">{formatCentsExact(ready)}</p>
        <p className="mt-sm text-body-md opacity-80">
          {label} income minus what you&apos;ve budgeted. Leftover rolls into next month.
        </p>
      </div>

      <div className="min-w-0 md:w-72">
        <div className="flex items-end justify-between gap-sm text-label-sm uppercase opacity-90">
          <span>Income {formatCentsExact(incomeCents)}</span>
          <span className="text-right">Budgeted {formatCentsExact(assignedCents)}</span>
        </div>
        <div className="mt-base h-2 w-full overflow-hidden rounded-full bg-on-primary/15">
          <div className="h-full bg-on-primary transition-[width] duration-300" style={{ width: `${share * 100}%` }} />
        </div>
        <p className="mt-sm text-[11px] uppercase tracking-wide opacity-70">{range}</p>
      </div>
    </div>
  );
}