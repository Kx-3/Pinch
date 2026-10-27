"use client";

import { useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { formatCents } from "@/lib/budget-utils";
import { monthKeyOf } from "@/lib/month";
import type { BudgetRow } from "@/hooks/use-budget-data";
import type { Transaction } from "@/lib/mockData";
import type { useCategoryLookup } from "@/hooks/use-budget-data";
import type { BudgetGridRow } from "@/components/budget/types";
import { EditableAssignedCell } from "@/components/budget/editable-assigned-cell";

type Lookup = ReturnType<typeof useCategoryLookup>;

interface BudgetTableProps {
  month: string;
  budgets: BudgetRow[];
  transactions: Transaction[];
  lookup: Lookup;
  overrides: Record<string, number>;
  onUpdateAssigned: (categoryId: string, month: string, cents: number) => void;
}

const keyOf = (categoryId: string, month: string) => `${categoryId}:${month}`;

function monthSequence(from: string, to: string): string[] {
  const [sy, sm] = from.split("-").map(Number);
  const [ey, em] = to.split("-").map(Number);
  const out: string[] = [];
  let y = sy;
  let m = sm;
  let guard = 0;
  while (y < ey || (y === ey && m <= em)) {
    if (guard++ > 600) break;
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out.length ? out : [to];
}

interface ScopeMetrics {
  assignedCents: number;
  activityCents: number;
  availableCents: number;
}

function computeScope(
  assignedIds: string[],
  activityIds: string[],
  month: string,
  earliest: string | undefined,
  assignedFor: (categoryId: string, month: string) => number,
  activityFor: (categoryId: string, month: string) => number,
): ScopeMetrics {
  const months = earliest && earliest <= month ? monthSequence(earliest, month) : [month];
  let total = 0;
  const metrics: ScopeMetrics = { assignedCents: 0, activityCents: 0, availableCents: 0 };
  for (const m of months) {
    const a = assignedIds.reduce((s, id) => s + assignedFor(id, m), 0);
    const act = activityIds.reduce((s, id) => s + activityFor(id, m), 0);
    total += a - act;
    if (m === month) {
      metrics.assignedCents = a;
      metrics.activityCents = act;
    }
  }
  metrics.availableCents = total;
  return metrics;
}

export function BudgetTable({ month, budgets, transactions, lookup, overrides, onUpdateAssigned }: BudgetTableProps) {
  const baseBudgets = useMemo(
    () => new Map(budgets.map((b) => [keyOf(b.categoryId, b.month), b.assignedCents])),
    [budgets],
  );

  const assignedFor = useMemo(
    () => (categoryId: string, m: string) =>
      overrides[keyOf(categoryId, m)] ?? baseBudgets.get(keyOf(categoryId, m)) ?? 0,
    [overrides, baseBudgets],
  );

  const activityFor = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.amount >= 0 || !t.categoryId) continue;
      const k = keyOf(t.categoryId, monthKeyOf(t.date));
      map.set(k, (map.get(k) ?? 0) + Math.round(Math.abs(t.amount) * 100));
    }
    return (categoryId: string, m: string) => map.get(keyOf(categoryId, m)) ?? 0;
  }, [transactions]);

  const scopes = useMemo(() => {
    const out: { group: Lookup["flat"][number] | null; leaves: Lookup["flat"][number][] }[] = [];
    for (const p of lookup.topLevel) {
      if (p.kind !== "outflow") continue;
      const children = lookup.childrenOf(p.id).filter((c) => c.kind === "outflow");
      if (children.length > 0) out.push({ group: p, leaves: children });
      else out.push({ group: null, leaves: [p] });
    }
    return out;
  }, [lookup]);

  const earliest = useMemo(() => {
    let min: string | undefined;
    for (const t of transactions) {
      const m = monthKeyOf(t.date);
      if (!min || m < min) min = m;
    }
    for (const b of budgets) {
      if (!min || b.month < min) min = b.month;
    }
    return min;
  }, [transactions, budgets]);

  const rows = useMemo<BudgetGridRow[]>(() => {
    const result: BudgetGridRow[] = [];
    for (const scope of scopes) {
      if (scope.group) {
        const leafIds = scope.leaves.map((l) => l.id);
        const group = computeScope(leafIds, [...leafIds, scope.group.id], month, earliest, assignedFor, activityFor);
        result.push({
          key: `group:${scope.group.id}`,
          categoryId: scope.group.id,
          name: scope.group.name,
          color: scope.group.color,
          isGroup: true,
          depth: 0,
          month,
          ...group,
        });
        for (const leaf of scope.leaves) {
          const m = computeScope([leaf.id], [leaf.id], month, earliest, assignedFor, activityFor);
          result.push({
            key: leaf.id,
            categoryId: leaf.id,
            name: leaf.name,
            color: leaf.color,
            isGroup: false,
            depth: 1,
            month,
            ...m,
          });
        }
      } else {
        const leaf = scope.leaves[0];
        const m = computeScope([leaf.id], [leaf.id], month, earliest, assignedFor, activityFor);
        result.push({
          key: leaf.id,
          categoryId: leaf.id,
          name: leaf.name,
          color: leaf.color,
          isGroup: false,
          depth: 0,
          month,
          ...m,
        });
      }
    }
    return result;
  }, [scopes, month, earliest, assignedFor, activityFor]);

  const totals = useMemo(() => {
    const leafs = rows.filter((r) => !r.isGroup);
    return {
      assigned: leafs.reduce((s, r) => s + r.assignedCents, 0),
      activity: leafs.reduce((s, r) => s + r.activityCents, 0),
      available: leafs.reduce((s, r) => s + r.availableCents, 0),
    };
  }, [rows]);

  const col = createColumnHelper<BudgetGridRow>();

  const columns = useMemo(
    () => [
      col.display({
        id: "category",
        header: () => <span className="flex items-center gap-base">Category</span>,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex items-center gap-base" style={{ paddingLeft: `${row.depth * 18 + 4}px` }}>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: `var(--chart-${row.color})` }}
              />
              <span className={row.isGroup ? "text-label-bold" : "truncate text-body-md"}>
                {row.name}
              </span>
            </span>
          );
        },
        footer: () => <span className="text-label-sm uppercase text-on-surface-variant">Total</span>,
      }),
      col.accessor("assignedCents", {
        id: "assigned",
        header: () => <div className="text-right">Budgeted</div>,
        cell: (info) =>
          info.row.original.isGroup ? (
            <div className="flex h-10 w-full items-center justify-end px-3 text-right font-mono-numbers tabular-nums text-on-surface-variant">
              {formatCents(info.getValue())}
            </div>
          ) : (
            <EditableAssignedCell
              value={info.getValue()}
              categoryId={info.row.original.categoryId!}
              month={info.row.original.month}
              table={info.table}
            />
          ),
        footer: () => <div className="text-right font-mono-numbers tabular-nums">{formatCents(totals.assigned)}</div>,
      }),
      col.accessor("activityCents", {
        id: "activity",
        header: () => <div className="text-right">Activity</div>,
        cell: (info) => (
          <div className="flex h-10 w-full items-center justify-end px-3 text-right font-mono-numbers tabular-nums text-on-surface-variant">
            {formatCents(info.getValue())}
          </div>
        ),
        footer: () => <div className="text-right font-mono-numbers tabular-nums">{formatCents(totals.activity)}</div>,
      }),
      col.accessor("availableCents", {
        id: "available",
        header: () => <div className="text-right">Available</div>,
        cell: (info) => {
          const v = info.getValue();
          return (
            <div
              className={`flex h-10 w-full items-center justify-end px-3 text-right font-mono-numbers tabular-nums ${
                v < 0 ? "text-error" : "text-on-surface"
              }`}
            >
              {formatCents(v)}
            </div>
          );
        },
        footer: () => {
          const v = totals.available;
          return (
            <div
              className={`text-right font-mono-numbers tabular-nums ${v < 0 ? "text-error" : "text-on-surface"}`}
            >
              {formatCents(v)}
            </div>
          );
        },
      }),
    ],
    [col, totals],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: { updateAssigned: onUpdateAssigned },
  });

  return (
    <div className="ghost-border overflow-hidden rounded-lg bg-surface-container-lowest">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left">
          <colgroup>
            <col />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-28" />
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-outline-variant text-label-sm uppercase text-on-surface-variant">
                {hg.headers.map((header) => (
                  <th key={header.id} className="h-10 px-3 align-middle font-medium">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="[&>tr:nth-child(even)]:bg-surface-container-low">
            {table.getRowModel().rows.length === 0 ? (
              <tr className="animate-in fade-in duration-200">
                <td colSpan={columns.length} className="p-lg text-center text-label-bold font-normal text-on-surface-variant">
                  No outflow categories yet. Create categories in Settings to get started.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`transition-colors duration-150 ${
                    row.original.isGroup ? "bg-surface-container-low font-medium" : "hover:bg-surface-container"
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-0">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            {table.getFooterGroups().map((fg) => (
              <tr key={fg.id} className="border-t border-outline-variant text-label-bold">
                {fg.headers.map((header) => (
                  <th key={header.id} className="h-10 px-3 align-middle text-right first:text-left">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.footer, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </div>
  );
}