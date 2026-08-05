import type { ReactNode } from "react";
import { MobileDock } from "@/components/layout/MobileDock";

/**
 * Persistent shell for authenticated app routes. Keeping `<MobileDock />`
 * here (instead of per-page `<AppShell />`) means it survives client-side
 * navigation, so the active-tab pill can slide from the previous tab to the
 * clicked one instead of re-mounting from the left edge.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <MobileDock />
    </>
  );
}
