"use client";

import { useEffect, useRef, useState } from "react";
import type { Table } from "@tanstack/react-table";
import { formatCents, parseCents } from "@/lib/budget-utils";
import type { BudgetGridRow } from "@/components/budget/types";

const sharedClasses = "h-10 w-full border border-transparent px-2 font-mono text-sm leading-none text-right rounded transition-all box-border";

const dollarsOf = (cents: number) => {
  const d = cents / 100;
  return Number.isInteger(d) ? String(d) : d.toFixed(2);
};

interface EditableAssignedCellProps {
  value: number;
  categoryId: string;
  month: string;
  table: Table<BudgetGridRow>;
}

/**
 * Click-to-edit "Assigned" cell. Commits to `table.options.meta?.updateAssigned`
 * on Blur, Enter or Tab; Escape cancels; empty input reverts to the previous value.
 */
export function EditableAssignedCell({ value, categoryId, month, table }: EditableAssignedCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = () => {
    setDraft(dollarsOf(value));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const next = parseCents(draft);
    if (next === null) return; // invalid input -> revert (draft discarded)
    if (next !== value) {
      table.options.meta?.updateAssigned?.(categoryId, month, next);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={startEdit}
        className={`${sharedClasses} cursor-pointer hover:bg-surface-container active:bg-surface-container-high focus-visible:border-primary focus-visible:bg-surface-container-high`}
        aria-label={`Budget ${categoryId} for ${month}, currently ${formatCents(value)}`}
      >
        {formatCents(value)}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Tab") {
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setEditing(false);
        }
      }}
      className={`${sharedClasses} border-primary bg-surface-container-lowest outline-none focus:border-primary`}
      aria-label={`Budget ${categoryId} for ${month}`}
    />
  );
}