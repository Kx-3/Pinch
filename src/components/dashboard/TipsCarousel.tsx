"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { TIPS } from "@/lib/mockData";

const ROLES = [
  { id: "all", label: "All" },
  { id: "beginner", label: "Beginner" },
  { id: "power-user", label: "Power user" },
  { id: "debt-payer", label: "Debt payer" },
] as const;

export function TipsCarousel() {
  const [role, setRole] = useState<(typeof ROLES)[number]["id"]>("all");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const tips = TIPS.filter((t) => role === "all" || t.role === role);
  const active = tips[index % tips.length];

  useEffect(() => setIndex(0), [role]);

  useEffect(() => {
    if (paused || tips.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % tips.length), 7000);
    return () => window.clearInterval(id);
  }, [paused, tips.length]);

  return (
    <div
      className="ghost-border rounded-lg bg-tertiary-fixed p-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mb-sm flex items-center justify-between gap-base">
        <div className="flex items-center gap-base text-on-tertiary-fixed-variant">
          <Lightbulb className="h-4 w-4" />
          <p className="text-label-sm uppercase">Budgeting tips</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setIndex((i) => (i - 1 + tips.length) % tips.length)}
            className="pressable rounded-md p-1 text-on-tertiary-fixed-variant hover:bg-tertiary-fixed-dim"
            aria-label="Previous tip"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIndex((i) => (i + 1) % tips.length)}
            className="pressable rounded-md p-1 text-on-tertiary-fixed-variant hover:bg-tertiary-fixed-dim"
            aria-label="Next tip"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-sm flex flex-wrap gap-1">
        {ROLES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRole(r.id)}
            aria-pressed={role === r.id}
            className={`pressable rounded-full px-2 py-0.5 text-label-sm uppercase transition-colors duration-150 ${
              role === r.id
                ? "bg-on-tertiary-fixed-variant text-tertiary-fixed"
                : "text-on-tertiary-fixed-variant hover:bg-tertiary-fixed-dim"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {active && (
        <div key={active.id} className="animate-in fade-in duration-200">
          <p className="text-label-sm uppercase text-on-tertiary-fixed-variant">{active.rule}</p>
          <p className="mt-1 text-label-bold font-normal leading-relaxed text-on-tertiary-fixed-variant">
            "{active.body}"
          </p>
          <p className="mt-sm text-label-sm text-on-tertiary-fixed-variant/80">— {active.author}</p>
        </div>
      )}

      <div className="mt-sm flex gap-1">
        {tips.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setIndex(i)}
            aria-label={`Show tip ${i + 1}`}
            className={`h-1 rounded-full transition-all duration-200 ease-out ${
              i === index % tips.length
                ? "w-6 bg-on-tertiary-fixed-variant"
                : "w-2 bg-on-tertiary-fixed-variant/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
