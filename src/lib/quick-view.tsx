"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface QuickViewState {
  quickViewId: string | null;
  setQuickViewId: (id: string | null) => void;
}

const QuickViewContext = createContext<QuickViewState | null>(null);

export function QuickViewProvider({ children }: { children: ReactNode }) {
  const [quickViewId, setQuickViewId] = useState<string | null>(null);

  const value = useMemo(() => ({ quickViewId, setQuickViewId }), [quickViewId]);

  return <QuickViewContext.Provider value={value}>{children}</QuickViewContext.Provider>;
}

export function useQuickView() {
  const ctx = useContext(QuickViewContext);
  if (!ctx) throw new Error("useQuickView must be used inside <QuickViewProvider>");
  return ctx;
}
