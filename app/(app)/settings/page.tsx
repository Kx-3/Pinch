"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Switch } from "@/components/ui/switch";
import { usePaymentMethods, useRemovePaymentMethod } from "@/hooks/use-budget-data";
import { Plus, Trash2 } from "lucide-react";
import { PAYMENT_METHOD_KINDS } from "@/lib/mockData";
import { AddPaymentMethodDialog } from "@/components/dashboard/PaidFromSelect";
import { useTheme, type Theme } from "@/lib/theme";
import { useUser } from "@clerk/nextjs";
import { CategoryManager } from "@/components/settings/CategoryManager";

export default function SettingsPage() {
  const { user } = useUser();
  const paymentMethods = usePaymentMethods();
  const removePaymentMethod = useRemovePaymentMethod();
  const [addOpen, setAddOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState({ overspendAlerts: true, weeklyDigest: true, rollover: false });

  const email = user?.emailAddresses?.[0]?.emailAddress ?? user?.primaryEmailAddress?.emailAddress ?? "";

  const rows = [
    { key: "overspendAlerts" as const, label: "Overspend alerts", hint: "Notify me the moment an envelope goes red." },
    { key: "weeklyDigest" as const, label: "Weekly digest", hint: "Monday email summarising the week." },
    { key: "rollover" as const, label: "Roll unspent money forward", hint: "Carry leftovers into next month." },
  ];

  const themeOptions: { id: Theme; label: string }[] = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "system", label: "System" },
  ];

  return (
    <AppShell title="Settings" subtitle={user ? `Preferences for ${email}` : "Preferences"}>
      <div className="ghost-border max-w-[36rem] rounded-lg bg-surface-container-lowest p-md">
        <p className="text-body-md font-medium">Appearance</p>
        <p className="text-label-sm text-on-surface-variant">
          System follows your device's light or dark setting.
        </p>
        <div
          role="radiogroup"
          aria-label="Theme"
          className="mt-sm inline-flex rounded-lg bg-surface-container p-1"
        >
          {themeOptions.map((o) => (
            <button
              key={o.id}
              role="radio"
              aria-checked={theme === o.id}
              onClick={() => setTheme(o.id)}
              className={`pressable rounded-md px-md py-1.5 text-label-bold ${
                theme === o.id
                  ? "bg-surface-container-lowest text-primary shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  : "text-on-surface-variant"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ghost-border max-w-[36rem] divide-y divide-outline-variant rounded-lg bg-surface-container-lowest">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-md p-md">
            <div>
              <p className="text-body-md font-medium">{r.label}</p>
              <p className="text-label-sm text-on-surface-variant">{r.hint}</p>
            </div>
            <Switch
              checked={prefs[r.key]}
              onCheckedChange={(v) => {
                setPrefs((p) => ({ ...p, [r.key]: v }));
                toast.success(`${r.label} ${v ? "enabled" : "disabled"}`);
              }}
            />
          </div>
        ))}
      </div>

      <div className="ghost-border max-w-[36rem] rounded-lg bg-surface-container-lowest">
        <div className="flex items-center justify-between gap-md border-b border-outline-variant p-md">
          <div>
            <p className="text-body-md font-medium">Payment methods</p>
            <p className="text-label-sm text-on-surface-variant">
              What shows up in the "Paid from" dropdown.
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="pressable flex items-center gap-base rounded-md bg-primary px-sm py-2 text-label-sm uppercase text-on-primary hover:bg-primary-container"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        <div className="divide-y divide-outline-variant">
          {paymentMethods.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-md p-md">
              <div>
                <p className="text-body-md font-medium">{p.label}</p>
                <p className="text-label-sm uppercase text-on-surface-variant">
                  {PAYMENT_METHOD_KINDS.find((k) => k.id === p.kind)?.label}
                  {p.builtIn ? " · Built in" : ""}
                </p>
              </div>
              {!p.builtIn && (
                <button
                  onClick={() => removePaymentMethod(p.id)}
                  aria-label={`Remove ${p.label}`}
                  className="pressable rounded-md p-1 text-on-surface-variant hover:text-error"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <CategoryManager />

      <AddPaymentMethodDialog open={addOpen} onOpenChange={setAddOpen} />
    </AppShell>
  );
}
