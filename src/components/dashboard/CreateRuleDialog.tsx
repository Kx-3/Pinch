"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateRuleFromTransaction } from "@/hooks/use-budget-data";
import { CategorySelect } from "@/components/dashboard/CategorySelect";
import { TagInput } from "@/components/dashboard/TagInput";

const field =
  "w-full rounded-md border border-outline-variant bg-surface-container-low px-sm py-2 text-label-bold font-normal outline-none transition-colors duration-150 focus:border-primary";

export function CreateRuleDialog({
  open,
  onOpenChange,
  sourcePayee,
  defaultCategoryId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sourcePayee: string;
  defaultCategoryId?: string | null;
}) {
  const create = useCreateRuleFromTransaction();
  const [prevOpen, setPrevOpen] = useState(open);
  const [categoryId, setCategoryId] = useState("");
  const [renamePayee, setRenamePayee] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [applyToExisting, setApplyToExisting] = useState(true);
  const [busy, setBusy] = useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setCategoryId(defaultCategoryId ?? "");
      setRenamePayee("");
      setTags([]);
      setApplyToExisting(true);
    }
  }

  const save = async () => {
    setBusy(true);
    const applied = await create({
      sourcePayee,
      categoryId: categoryId || undefined,
      renamePayee: renamePayee.trim() || undefined,
      addTags: tags,
      applyToExisting,
    });
    setBusy(false);
    if (applied !== null) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[26rem]">
        <DialogHeader>
          <DialogTitle>Create a rule</DialogTitle>
          <div className="text-label-bold font-normal text-on-surface-variant">
            Whenever the payee <span className="text-primary">{sourcePayee}</span> appears…
          </div>
        </DialogHeader>

        <div className="space-y-md">
          <div>
            <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">
              Set category to
            </label>
            <CategorySelect value={categoryId} onChange={setCategoryId} placeholder="Leave unchanged" />
          </div>

          <div>
            <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">
              Rename payee to
            </label>
            <input
              value={renamePayee}
              onChange={(e) => setRenamePayee(e.target.value)}
              placeholder="Cleaner name, e.g. Netflix"
              className={field}
            />
          </div>

          <div>
            <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">Add tags</label>
            <TagInput value={tags} onChange={setTags} />
          </div>

          <label className="flex cursor-pointer items-center gap-base text-label-bold">
            <input
              type="checkbox"
              checked={applyToExisting}
              onChange={(e) => setApplyToExisting(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Apply to past matching transactions
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="pressable rounded-md border border-outline-variant px-md py-2.5 font-label-bold text-on-surface-variant hover:bg-surface-container-low"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="pressable rounded-md bg-primary px-md py-2.5 font-label-bold text-on-primary hover:bg-primary-container disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create rule"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
