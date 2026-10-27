import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { MobileDock } from "@/components/layout/MobileDock";

/**
 * Persistent shell for authenticated app routes. Keeping `<MobileDock />`
 * here (instead of per-page `<AppShell />`) means it survives client-side
 * navigation, so the active-tab pill can slide from the previous tab to the
 * clicked one instead of re-mounting from the left edge.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  return (
    <>
      {children}
      <MobileDock />
    </>
  );
}
