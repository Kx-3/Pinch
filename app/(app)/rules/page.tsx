"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  useRules,
  useDeleteRule,
  useMoveRule,
  useAddRule,
  useUpdateRule,
  useCategoryLookup,
} from "@/hooks/use-budget-data";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategorySelect } from "@/components/dashboard/CategorySelect";
import { TagInput } from "@/components/dashboard/TagInput";
import { ArrowUp, ArrowDown, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import type { Rule, RuleConditionField, RuleConditionOp } from "@/lib/mockData";

const field =
  "w-full rounded-md border border-outline-variant bg-surface-container-low px-sm py-2 text-label-bold font-normal outline-none transition-colors duration-150 focus:border-primary";

const FIELDS: { id: RuleConditionField; label: string }[] = [
  { id: "payee", label: "Payee" },
  { id: "rawPayee", label: "Original payee (before cleanup)" },
  { id: "amount", label: "Amount" },
];

const OPS: { id: RuleConditionOp; label: string }[] = [
  { id: "contains", label: "contains" },
  { id: "equals", label: "equals" },
  { id: "starts_with", label: "starts with" },
  { id: "greater_than", label: "is more than" },
];

const describe = (r: Rule) => {
  const parts: string[] = [];
  if (r.actionSetCategory) parts.push(`categorize`);
  if (r.actionRenamePayee) parts.push(`rename to "${r.actionRenamePayee}"`);
  if (r.actionAddTags.length) parts.push(`tag ${r.actionAddTags.map((t) => `#${t}`).join(" ")}`);
  return parts.length ? parts.join(" · ") : "no action";
};

export default function RulesPage() {
  const rules = useRules();
  const deleteRule = useDeleteRule();
  const moveRule = useMoveRule();
  const addRule = useAddRule();
  const updateRule = useUpdateRule();
  const lookup = useCategoryLookup();

  const [editing, setEditing] = useState<Rule | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <AppShell title="Rules" subtitle="Let automation do the boring categorizing.">
      <div className="ghost-border mx-auto max-w-[40rem] rounded-lg bg-surface-container-lowest">
        <div className="flex items-center justify-between gap-md border-b border-outline-variant p-md">
          <div>
            <p className="text-body-md font-medium">Automation rules</p>
            <p className="text-label-sm text-on-surface-variant">
              Applied to new and imported transactions, highest priority first.
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="pressable flex items-center gap-1 rounded-md bg-primary px-sm py-2 text-label-sm uppercase text-on-primary hover:bg-primary-container"
          >
            <Plus className="h-4 w-4" /> New rule
          </button>
        </div>

        <div className="divide-y divide-outline-variant">
          {rules.length === 0 && (
            <p className="p-md text-center text-label-bold font-normal text-on-surface-variant">
              No rules yet. Open a transaction and pick &ldquo;always set category&rdquo; to create your first one.
            </p>
          )}
          {rules.map((r) => (
            <div key={r.id} className="flex items-start gap-base p-md">
              <div className="mt-0.5 flex flex-col">
                <button
                  onClick={() => moveRule(r.id, "up")}
                  disabled={r.priority === Math.min(...rules.map((x) => x.priority))}
                  aria-label="Move up"
                  className="pressable rounded p-0.5 text-on-surface-variant hover:text-primary disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => moveRule(r.id, "down")}
                  disabled={r.priority === Math.max(...rules.map((x) => x.priority))}
                  aria-label="Move down"
                  className="pressable rounded p-0.5 text-on-surface-variant hover:text-primary disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-body-md font-medium">
                  <Wand2 className="mr-1 inline h-4 w-4 text-primary" />
                  {r.conditionField === "amount" ? "Amount" : FIELDS.find((f) => f.id === r.conditionField)?.label}{" "}
                  <span className="text-on-surface-variant">{OPS.find((o) => o.id === r.conditionOp)?.label}</span>{" "}
                  <span className="text-primary">{r.conditionValue}</span>
                </p>
                <p className="mt-0.5 text-label-sm text-on-surface-variant">
                  {r.actionSetCategory && lookup.nameOf(r.actionSetCategory) !== r.actionSetCategory
                    ? `Categorize as ${lookup.nameOf(r.actionSetCategory)} · `
                    : ""}
                  {describe(r)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => {
                    setEditing(r);
                    setOpen(true);
                  }}
                  aria-label="Edit rule"
                  className="pressable rounded-md p-1 text-on-surface-variant hover:text-primary"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteRule(r.id)}
                  aria-label="Delete rule"
                  className="pressable rounded-md p-1 text-on-surface-variant hover:text-error"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <RuleDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSave={async (data) => {
          if (editing) {
            await updateRule(editing.id, data);
          } else {
            await addRule(data);
          }
          setOpen(false);
        }}
      />
    </AppShell>
  );
}

type RuleInput = {
  conditionField: RuleConditionField;
  conditionOp: RuleConditionOp;
  conditionValue: string;
  actionSetCategory?: string | null;
  actionRenamePayee?: string | null;
  actionAddTags?: string[];
};

function RuleDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Rule | null;
  onSave: (data: RuleInput) => void;
}) {
  const [conditionField, setConditionField] = useState<RuleConditionField>(initial?.conditionField ?? "payee");
  const [conditionOp, setConditionOp] = useState<RuleConditionOp>(initial?.conditionOp ?? "contains");
  const [conditionValue, setConditionValue] = useState(initial?.conditionValue ?? "");
  const [categoryId, setCategoryId] = useState(initial?.actionSetCategory ?? "");
  const [renamePayee, setRenamePayee] = useState(initial?.actionRenamePayee ?? "");
  const [tags, setTags] = useState<string[]>(initial?.actionAddTags ?? []);
  const [error, setError] = useState("");

  const reset = () => {
    setConditionField(initial?.conditionField ?? "payee");
    setConditionOp(initial?.conditionOp ?? "contains");
    setConditionValue(initial?.conditionValue ?? "");
    setCategoryId(initial?.actionSetCategory ?? "");
    setRenamePayee(initial?.actionRenamePayee ?? "");
    setTags(initial?.actionAddTags ?? []);
    setError("");
  };

  const save = () => {
    if (!conditionValue.trim()) {
      setError("The condition needs a value to match against.");
      return;
    }
    onSave({
      conditionField,
      conditionOp,
      conditionValue: conditionValue.trim(),
      actionSetCategory: categoryId || null,
      actionRenamePayee: renamePayee.trim() || null,
      actionAddTags: tags,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[26rem]">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit rule" : "New rule"}</DialogTitle>
          <div className="text-label-bold font-normal text-on-surface-variant">
            When the condition matches, apply the actions below.
          </div>
        </DialogHeader>

        <div className="space-y-md">
          <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-base">
            <select
              value={conditionField}
              onChange={(e) => setConditionField(e.target.value as RuleConditionField)}
              className={field}
            >
              {FIELDS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={conditionOp}
              onChange={(e) => setConditionOp(e.target.value as RuleConditionOp)}
              className={field}
            >
              {OPS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              inputMode={conditionField === "amount" ? "decimal" : "text"}
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              placeholder={conditionField === "amount" ? "50" : "Starbucks"}
              className={field}
            />
          </div>

          <div>
            <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">Set category</label>
            <CategorySelect value={categoryId} onChange={setCategoryId} placeholder="Leave unchanged" />
          </div>

          <div>
            <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">Rename payee to</label>
            <input value={renamePayee} onChange={(e) => setRenamePayee(e.target.value)} className={field} />
          </div>

          <div>
            <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">Add tags</label>
            <TagInput value={tags} onChange={setTags} />
          </div>

          {error && <p className="text-label-sm text-error">{error}</p>}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="pressable rounded-md border border-outline-variant px-md py-2.5 font-label-bold text-on-surface-variant hover:bg-surface-container-low"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="pressable rounded-md bg-primary px-md py-2.5 font-label-bold text-on-primary hover:bg-primary-container"
          >
            Save rule
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
