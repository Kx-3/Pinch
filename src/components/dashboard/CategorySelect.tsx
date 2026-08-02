import { categoryTree, childrenOf } from "@/lib/categories";

const fieldBase =
  "rounded-md border border-outline-variant bg-surface-container-low px-sm py-2 text-label-bold font-normal outline-none transition-colors duration-150 focus:border-primary";

/** Grouped category picker — parents with children render as optgroups. */
export function CategorySelect({
  value,
  onChange,
  id,
  className = "",
  placeholder,
  kind = "outflow",
}: {
  value: string;
  onChange: (id: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  kind?: "outflow" | "inflow";
}) {
  const tree = categoryTree().filter((c) => c.kind === kind);

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${fieldBase} w-full ${className}`}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {tree.map((parent) =>
        childrenOf(parent.id).length ? (
          <optgroup key={parent.id} label={parent.name}>
            {childrenOf(parent.id).map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </optgroup>
        ) : (
          <option key={parent.id} value={parent.id}>
            {parent.name}
          </option>
        ),
      )}
    </select>
  );
}
