"use client";

import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Header } from "@/components/layout/Header";
import { EnvelopeQuickView } from "@/components/dashboard/EnvelopeQuickView";

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-x-hidden bg-background">
        <Sidebar />
        <SidebarInset className="flex min-h-screen min-w-0 flex-grow flex-col bg-background">
          <Header title={title} subtitle={subtitle} />
          <section className="mx-auto w-full min-w-0 max-w-[1440px] space-y-lg overflow-x-hidden p-md pb-[calc(env(safe-area-inset-bottom)+6rem)] sm:px-lg md:pb-md lg:p-xl">
            {children}
          </section>
        </SidebarInset>
        <EnvelopeQuickView />
      </div>
    </SidebarProvider>
  );
}
