"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme";
import { QuickViewProvider } from "@/lib/quick-view";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QuickViewProvider>{children}</QuickViewProvider>
    </ThemeProvider>
  );
}
