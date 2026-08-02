"use client";

import { useMemo, useState } from "react";
import { Pin, Share2, MoreHorizontal, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBudget } from "@/lib/budget-store";
import { SORT_OPTIONS, currency, type SortId } from "@/lib/mockData";
import { categoryTree, pathFor } from "@/lib/categories";
import type { Category, Subcategory } from "@/lib/mockData";

const TABS = [{ id: "all", name: "All" }];

export function EnvelopeBoard() {
  const { envelopes, categories, setQuickViewId, togglePin, assign, getCategoryChildren } = useBudget();
  const [tab, setTab] = useState<string>("all");
  const [sort, setSort] = useState<SortId>("recent");

  console.log(categories);

  // Build envelope data with category metadata
  const rows = useMemo(() => {
    const envelopeMap = new Map(envelopes.map((e) => [e.categoryId, e]));
    const rows: any[] = [];
    
    // Get all top-level categories
    const topCategories = categories.filter((c) => c.parentId === null);
    
    topCategories.forEach((cat) => {
      // Add parent category with envelope data if exists
      const parentEnvelope = envelopeMap.get(cat.id);
      rows.push({
        ...cat,
        assigned: parentEnvelope?.assigned ?? 0,
        spent: parentEnvelope?.spent ?? 0,
        target: parentEnvelope?.target ?? 0,
        pinned: parentEnvelope?.pinned ?? false,
        createdAt: parentEnvelope?.createdAt ?? "",
        note: parentEnvelope?.note ?? "",
        children: getCategoryChildren(cat.id) as Subcategory[],
      });
      
      // Add children as separate rows with indentation
      const children = getCategoryChildren(cat.id);
      children.forEach((child) => {
        const childEnvelope = envelopeMap.get(child.id);
        rows.push({
          ...child,
          assigned: childEnvelope?.assigned ?? 0,
          spent: childEnvelope?.spent ?? 0,
          target: childEnvelope?.target ?? 0,
          pinned: childEnvelope?.pinned ?? false,
          createdAt: childEnvelope?.createdAt ?? "",
          note: childEnvelope?.note ?? "",
        });
      });
    });
    
    return rows;
  }, [envelopes, categories, getCategoryChildren]);

  return (
    <div className="ghost-border overflow-hidden rounded-lg bg-surface-container-lowest">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-sm border-b border-outline-variant px-md py-sm">
        <h3 className="text-label-sm uppercase text-on-surface">Categories</h3>

        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-base">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-container-low p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={`pressable shrink-0 rounded-full px-sm py-1.5 text-label-sm uppercase ${
                  tab === t.id
                    ? "bg-surface-container-lowest text-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="pressable flex items-center gap-base rounded-md border border-outline-variant px-sm py-1.5 text-label-sm uppercase text-on-surface-variant hover:text-primary">
              {SORT_OPTIONS.find((s) => s.id === sort)?.label}
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SORT_OPTIONS.map((s) => (
                <DropdownMenuItem key={s.id} onSelect={() => setSort(s.id)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-outline-variant text-label-sm uppercase text-on-surface-variant">
              <th className="px-md py-sm font-medium">Category</th>
              <th className="px-md py-sm font-medium">Funded</th>
              <th className="px-md py-sm font-medium">Progress</th>
              <th className="px-md py-sm text-right font-medium">Status</th>
              <th className="px-md py-sm text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="[&>tr:nth-child(even)]:bg-surface-container-low">
            {rows.length > 0 ? (
              rows.map((e: any) => {
                const pct = Math.min(100, Math.round((e.assigned / e.target) * 100));
                const overspent = e.spent > e.assigned;
                const full = e.assigned >= e.target;
                const isChild = e.parentId !== null;
                
                return (
                  <tr
                    key={e.id}
                    onClick={() => setQuickViewId(e.id)}
                    className={`cursor-pointer transition-colors duration-150 hover:bg-surface-container ${isChild ? "bg-surface-container-low" : ""}`}
                  >
                    <td className={`px-md py-sm ${isChild ? "pl-8" : ""}`}>
                      <div className="flex items-center gap-base">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: `var(--chart-${e.color})` }}
                        />
                        <span className={`text-body-md font-medium ${isChild ? "text-on-surface-variant" : ""}`}>
                          {isChild ? e.name : `${e.name} (Parent)`}
                        </span>
                        {e.pinned && <Pin className="h-3 w-3 text-primary" />}
                      </div>
                    </td>
                    <td className="px-md py-sm text-numeric-data">
                      {currency(e.assigned)} / {currency(e.target)}
                    </td>
                    <td className="w-40 px-md py-sm">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                        <div
                          className="h-full rounded-full transition-[width] duration-300 ease-out"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: overspent ? "var(--error)" : `var(--chart-${e.color})`,
                            opacity: full ? 1 : 0.85,
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-md py-sm text-right">
                      {overspent ? (
                        <span className="rounded-full bg-error-container px-2 py-0.5 text-label-sm uppercase text-on-error-container">
                          Overspent
                        </span>
                      ) : full ? (
                        <span className="rounded-full bg-secondary-container px-2 py-0.5 text-label-sm uppercase text-on-secondary-fixed">
                          Fully funded
                        </span>
                      ) : (
                        <span className="text-numeric-data text-on-surface-variant">
                          {currency(e.target - e.assigned)} left
                        </span>
                      )}
                    </td>
                    <td className="px-md py-sm text-right" onClick={(ev) => ev.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="pressable rounded-md p-1 text-on-surface-variant hover:text-primary">
                          <MoreHorizontal className="h-5 w-5" />
                          <span className="sr-only">Actions for {e.name}</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setQuickViewId(e.id)}>Quick view</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => assign(e.id, Math.max(0, e.target - e.assigned))}>
                            Fill to target
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => togglePin(e.id)}>
                            {e.pinned ? "Unpin" : "Pin to dashboard"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              toast.success("Link copied", { description: `Shared view of ${e.name}.` })
                            }
                          >
                            <Share2 className="mr-2 h-4 w-4" /> Share
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-md py-lg text-center text-label-bold font-normal text-on-surface-variant">
                  No categories found. Create categories in Settings to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
