"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

export function TagInput({
  value,
  onChange,
  suggestions = [],
  id,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  id?: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const parts = raw
      .split(",")
      .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
      .filter(Boolean);
    if (!parts.length) return;
    onChange(Array.from(new Set([...value, ...parts])));
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const open = draft.trim().length > 0;
  const matches = suggestions
    .filter((s) => !value.includes(s) && s.includes(draft.trim().toLowerCase()))
    .slice(0, 5);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-base rounded-md border border-outline-variant bg-surface-container-low px-sm py-2 focus-within:border-primary">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-label-sm uppercase text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`Remove tag ${tag}`}
              className="pressable"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          placeholder={value.length ? "" : "work-travel, reimbursable…"}
          className="min-w-[8rem] flex-1 bg-transparent text-label-bold font-normal outline-none placeholder:text-on-surface-variant"
        />
      </div>

      {open && matches.length > 0 && (
        <div className="ghost-border absolute z-20 mt-1 w-full overflow-hidden rounded-md bg-surface-container-lowest">
          {matches.map((m) => (
            <button
              key={m}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                commit(m);
              }}
              className="block w-full px-sm py-2 text-left text-label-bold font-normal transition-colors duration-150 hover:bg-surface-container"
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
