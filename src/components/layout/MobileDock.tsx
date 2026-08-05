"use client";

import { useEffect, useRef, useState } from "react";
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
 * circular add button dead centre and a sliding pill behind the active tab.
 * Hidden from `md:` up.
 *
 * The dock lives in the persistent `(app)` layout, so it stays mounted across
 * navigations. The pill only animates when the active tab *changes* in place;
 * on first mount it snaps straight to the active tab (no slide from the left).
 */
export function MobileDock() {
  const [txOpen, setTxOpen] = useState(false);
  const currentPath = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const prevIndexRef = useRef<number | null>(null);

  const isActive = (to: string) => {
    if (to === "/") return currentPath === "/";
    return currentPath === to || currentPath.startsWith(to + "/");
  };
  const activeIndex = tabs.findIndex((t) => isActive(t.to));

  useEffect(() => {
    const pill = pillRef.current;
    const nav = navRef.current;
    if (!pill || !nav) return;

    const tab = tabRefs.current[activeIndex];
    const isFirstRun = prevIndexRef.current === null;
    prevIndexRef.current = activeIndex;

    const updatePill = () => {
      if (!tab) {
        pill.style.opacity = "0";
        return;
      }
      pill.style.opacity = "1";
      const navRect = nav.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      const border = parseFloat(getComputedStyle(nav).borderLeftWidth) || 0;
      pill.style.transform = `translateX(${tabRect.left - navRect.left - border}px)`;
      pill.style.width = `${tabRect.width}px`;
    };

    if (isFirstRun) {
      // Place the pill at the active tab before the transition is live so it
      // doesn't visibly slide from the left edge on first mount.
      const prevTransition = pill.style.transition;
      pill.style.transition = "none";
      updatePill();
      void pill.offsetWidth;
      pill.style.transition = prevTransition;
    } else {
      updatePill();
    }

    const ro = new ResizeObserver(updatePill);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [activeIndex]);

  const renderTab = (item: (typeof tabs)[number], index: number) => {
    const active = isActive(item.to);
    const Icon = item.icon;
    return (
      <Link
        key={item.to}
        ref={(el) => {
          tabRefs.current[index] = el;
        }}
        href={item.to}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        className="pressable relative z-10 flex h-11 flex-1 items-center justify-center rounded-full"
      >
        <Icon
          className={`h-[22px] w-[22px] transition-colors duration-200 ease-out ${
            active ? "text-primary" : "text-on-surface-variant/70"
          }`}
          strokeWidth={active ? 2.2 : 1.7}
        />
      </Link>
    );
  };

  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);

  return (
    <>
      <nav
        ref={navRef}
        aria-label="Primary"
        className="dock-glass fixed inset-x-0 bottom-0 z-30 mx-auto mb-[calc(env(safe-area-inset-bottom)+1rem)] flex w-[min(22rem,calc(100%-2rem))] items-center gap-1 rounded-full px-2 py-1.5 md:hidden"
      >
        <span
          ref={pillRef}
          aria-hidden
          className="pointer-events-none absolute inset-y-1 left-0 z-0 rounded-full bg-surface-container-high opacity-0 transition-[transform,width] duration-300 ease-[var(--ease-out)]"
        />
        {left.map((item, i) => renderTab(item, i))}

        <button
          onClick={() => setTxOpen(true)}
          aria-label="New transaction"
          className="pressable relative z-10 mx-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-inverse-surface text-inverse-on-surface shadow-[0_6px_16px_-6px_rgba(8,12,24,0.55)]"
        >
          <Plus className="h-5 w-5" strokeWidth={2.4} />
        </button>

        {right.map((item, i) => renderTab(item, i + 2))}
      </nav>

      <NewTransactionDialog open={txOpen} onOpenChange={setTxOpen} />
    </>
  );
}
