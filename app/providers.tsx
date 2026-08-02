"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme";
import { BudgetProvider } from "@/lib/budget-store";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <BudgetProvider>{children}</BudgetProvider>
    </ThemeProvider>
  );
}