"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Wallet, ReceiptText, LineChart, Plus } from "lucide-react";
import { NewTransactionDialog } from "@/components/dashboard/NewTransactionDialog";

const tabs = [
  { icon: LayoutDashboard, label: "Home", to: "/dashboard" },
  { icon: Wallet, label: "Categories", to: "/envelopes" },
  { icon: ReceiptText, label: "Activity", to: "/transactions" },
  { icon: LineChart, label: "Reports", to: "/reports" },
] as const;

/**
 * Floating glass pill dock for small screens — icon-only, with a solid
 * circular add button dead centre. Hidden from `md:` up.
 */
export function MobileDock() {
  const [txOpen, setTxOpen] = useState(false);
  const currentPath = usePathname();

  const isActive = (to: string) => {
    if (to === "/") return currentPath === "/";
    return currentPath === to || currentPath.startsWith(to + "/");
  };
  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);

  const renderTab = (item: (typeof tabs)[number]) => {
    const active = isActive(item.to);
    const Icon = item.icon;
    return (
      <Link
        key={item.to}
        href={item.to}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        className="pressable relative flex h-11 flex-1 items-center justify-center rounded-full"
      >
        <Icon
          className={`h-[22px] w-[22px] transition-colors duration-200 ease-out ${
            active ? "text-on-surface" : "text-on-surface-variant/70"
          }`}
          strokeWidth={active ? 2.2 : 1.7}
        />
        <span
          className={`absolute bottom-1 h-1 w-1 rounded-full bg-primary transition-opacity duration-200 ease-out ${
            active ? "opacity-100" : "opacity-0"
          }`}
        />
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Primary"
        className="dock-glass fixed inset-x-0 bottom-0 z-30 mx-auto mb-[calc(env(safe-area-inset-bottom)+1rem)] flex w-[min(22rem,calc(100%-2rem))] items-center gap-1 rounded-full px-2 py-1.5 md:hidden"
      >
        {left.map(renderTab)}

        <button
          onClick={() => setTxOpen(true)}
          aria-label="New transaction"
          className="pressable mx-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-inverse-surface text-inverse-on-surface shadow-[0_6px_16px_-6px_rgba(8,12,24,0.55)]"
        >
          <Plus className="h-5 w-5" strokeWidth={2.4} />
        </button>

        {right.map(renderTab)}
      </nav>

      <NewTransactionDialog open={txOpen} onOpenChange={setTxOpen} />
    </>
  );
}
