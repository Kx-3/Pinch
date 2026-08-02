"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Wallet,
  ReceiptText,
  Flag,
  LineChart,
  CreditCard,
  PiggyBank,
  ChevronsUpDown,
  User,
  Settings,
  LogOut,
  LogIn,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useBudget } from "@/lib/budget-store";

const nav = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/" },
  { icon: Wallet, label: "Categories", to: "/envelopes" },
  { icon: ReceiptText, label: "Transactions", to: "/transactions" },
  { icon: Flag, label: "Targets", to: "/targets" },
  { icon: LineChart, label: "Reports", to: "/reports" },
  { icon: CreditCard, label: "Accounts", to: "/accounts" },
] as const;

export function SidebarComponent() {
  const router = useRouter();
  const currentPath = usePathname();
  const { user, logout, setAuthOpen } = useBudget();
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  const isActive = (to: string) => (to === "/" ? currentPath === "/" : currentPath.startsWith(to));

  return (
    <SidebarRoot>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex h-14 items-center gap-sm px-sm py-md">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
            <PiggyBank className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-headline-md font-semibold leading-none tracking-tight">Pinch</p>
              <p className="mt-1 truncate text-label-sm text-on-surface-variant">Pinch your pennies</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="hidden">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild isActive={active} className="text-label-bold">
                      <Link href={item.to} className="flex items-center gap-sm">
                        <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.4 : 1.8} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </SidebarRoot>
  );
}

export function Sidebar() {
  return <SidebarComponent />;
}
