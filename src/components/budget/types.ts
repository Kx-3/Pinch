import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    updateAssigned?: (categoryId: string, month: string, cents: number) => void;
  }
}

export interface BudgetGridRow {
  key: string;
  /** Category id for row scoping (parent id for group rows, null unused). */
  categoryId: string | null;
  name: string;
  color: number;
  isGroup: boolean;
  depth: number;
  month: string;
  assignedCents: number;
  activityCents: number;
  availableCents: number;
}