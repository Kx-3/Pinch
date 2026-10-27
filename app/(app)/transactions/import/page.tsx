"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  useCategoryLookup,
  useImportTransactions,
  useRules,
  useTransactions,
} from "@/hooks/use-budget-data";
import { PaidFromSelect } from "@/components/dashboard/PaidFromSelect";
import { ArrowLeft, ArrowRight, Check, FileText, Upload } from "lucide-react";
import type { ImportRow } from "@/hooks/use-budget-data";
import type { Rule } from "@/lib/mockData";

const stepBtn =
  "pressable flex items-center gap-1 rounded-md px-md py-2.5 font-label-bold transition-colors duration-150";
const field =
  "rounded-md border border-outline-variant bg-surface-container-low px-sm py-2 text-label-bold font-normal outline-none transition-colors duration-150 focus:border-primary";

type Mapping = {
  date: number;
  payee: number;
  amount: number;
  debit: number;
  credit: number;
  category: number;
  note: number;
};

const EMPTY_MAPPING: Mapping = {
  date: -1,
  payee: -1,
  amount: -1,
  debit: -1,
  credit: -1,
  category: -1,
  note: -1,
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let fieldVal = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          fieldVal += '"';
          i++;
        } else inQuotes = false;
      } else fieldVal += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(fieldVal);
      fieldVal = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(fieldVal);
      fieldVal = "";
      rows.push(row);
      row = [];
    } else fieldVal += ch;
  }
  if (fieldVal !== "" || row.length) {
    row.push(fieldVal);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const parseAmount = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const neg = t.startsWith("-") || (t.startsWith("(") && t.endsWith(")"));
  const cleaned = t.replace(/[$,\s()]/g, "");
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;
  return neg ? -Math.abs(n) : n;
};

const normalizeDate = (s: string): string => {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const [mm, dd] = a <= 12 && b <= 12 ? [a, b] : [b, a];
    return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  return t;
};

const hashRow = async (date: string, amount: number, payee: string): Promise<string> => {
  const data = new TextEncoder().encode(`${date}|${amount}|${payee.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

function previewRules(rules: Rule[], row: ImportRow): Pick<ImportRow, "payee" | "categoryId" | "tags"> {
  let payee = row.payee;
  let tags = [...(row.tags ?? [])];
  let categoryId = row.categoryId ?? null;
  for (const rule of rules) {
    const value =
      rule.conditionField === "amount"
        ? String(row.amount)
        : rule.conditionField === "rawPayee"
          ? (row.rawPayee ?? row.payee)
          : row.payee;
    const matches =
      rule.conditionOp === "contains"
        ? value.toLowerCase().includes(rule.conditionValue.toLowerCase())
        : rule.conditionOp === "equals"
          ? value.toLowerCase() === rule.conditionValue.toLowerCase()
          : rule.conditionOp === "starts_with"
            ? value.toLowerCase().startsWith(rule.conditionValue.toLowerCase())
            : Math.abs(row.amount) > Number(rule.conditionValue) || false;
    if (!matches) continue;
    if (rule.actionSetCategory) categoryId = rule.actionSetCategory;
    if (rule.actionRenamePayee) payee = rule.actionRenamePayee;
    if (rule.actionAddTags?.length) tags = Array.from(new Set([...tags, ...rule.actionAddTags]));
    break;
  }
  return { payee, categoryId, tags };
}

const mappingSignature = (headers: string[]) => headers.map((h) => h.trim().toLowerCase()).join("|");

export default function ImportPage() {
  const lookup = useCategoryLookup();
  const rules = useRules();
  const transactions = useTransactions();
  const importTx = useImportTransactions();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [parsed, setParsed] = useState<ImportRow[]>([]);
  const [skipIndexes, setSkipIndexes] = useState<Set<number>>(new Set());
  const [defaultPaidFrom, setDefaultPaidFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number[] } | null>(null);

  const categoryByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of lookup.flat) map.set(c.name.toLowerCase(), c.id);
    return map;
  }, [lookup]);

  const existingHashes = useMemo(() => {
    const set = new Set<string>();
    for (const t of transactions) if (t.rawPayee && t.hash) set.add(t.hash);
    return set;
  }, [transactions]);

  const onFile = useCallback(async (file: File) => {
    const text = await file.text();
    const parsedRows = parseCSV(text);
    if (!parsedRows.length) return;
    setFileName(file.name);
    setHeaders(parsedRows[0]);
    setRows(parsedRows.slice(1));
    const signature = mappingSignature(parsedRows[0]);
    const saved = localStorage.getItem(`pinch:import-mapping:${signature}`);
    const guess: Mapping = { ...EMPTY_MAPPING };
    parsedRows[0].forEach((h, i) => {
      const hl = h.toLowerCase();
      if (hl.includes("date") || hl === "day") guess.date = i;
      else if (hl.includes("payee") || hl.includes("desc") || hl.includes("merchant") || hl.includes("name") || hl === "details") guess.payee = i;
      else if (hl === "amount" || hl === "amt") guess.amount = i;
      else if (hl.includes("debit") || hl.includes("money out") || hl.includes("withdrawal")) guess.debit = i;
      else if (hl.includes("credit") || hl.includes("money in") || hl.includes("deposit")) guess.credit = i;
      else if (hl.includes("categor") || hl === "group") guess.category = i;
      else if (hl.includes("note") || hl.includes("memo")) guess.note = i;
    });
    setMapping(saved ? { ...EMPTY_MAPPING, ...(JSON.parse(saved) as Partial<Mapping>) } : guess);
    setStep(1);
  }, []);

  const buildRows = useCallback(
    async (m: Mapping): Promise<ImportRow[]> => {
      const out: ImportRow[] = [];
      for (const r of rows) {
        const date = normalizeDate(r[m.date] ?? "");
        const payee = (r[m.payee] ?? "").trim();
        if (!date || !payee) continue;
        let amount: number | null = null;
        if (m.amount >= 0) amount = parseAmount(r[m.amount] ?? "");
        else if (m.debit >= 0 || m.credit >= 0) {
          const debit = m.debit >= 0 ? parseAmount(r[m.debit] ?? "") : null;
          const credit = m.credit >= 0 ? parseAmount(r[m.credit] ?? "") : null;
          amount = debit ? -Math.abs(debit) : credit ? Math.abs(credit) : null;
        }
        if (amount === null) continue;
        const raw = payee;
        const categoryName = m.category >= 0 ? (r[m.category] ?? "").trim().toLowerCase() : "";
        out.push({
          date,
          payee: raw,
          rawPayee: raw,
          amount,
          categoryId: categoryName ? categoryByName.get(categoryName) ?? null : null,
          tags: [],
          notes: m.note >= 0 ? (r[m.note] ?? "").trim() : "",
          hash: await hashRow(date, amount, raw),
        });
      }
      return out;
    },
    [rows, categoryByName],
  );

  const onPreview = async () => {
    const built = await buildRows(mapping);
    const dupes = new Set<number>();
    built.forEach((r, i) => {
      if (r.hash && existingHashes.has(r.hash)) dupes.add(i);
    });
    setParsed(built);
    setSkipIndexes(dupes);
    setStep(2);
    localStorage.setItem(`pinch:import-mapping:${mappingSignature(headers)}`, JSON.stringify(mapping));
  };

  const onImport = async () => {
    setBusy(true);
    const toImport = parsed.filter((_, i) => !skipIndexes.has(i));
    const res = await importTx(toImport, defaultPaidFrom);
    setBusy(false);
    if (res) setResult(res);
  };

  const duplicateCount = parsed.filter((_, i) => skipIndexes.has(i)).length;
  const importCount = parsed.length - duplicateCount;

  const columnSelect = (label: string, value: number, onChange: (v: number) => void) => (
    <div className="flex items-center justify-between gap-base">
      <label className="text-label-bold text-on-surface-variant">{label}</label>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={`${field} w-56`}>
        <option value={-1}>— Not mapped —</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h || `Column ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <AppShell title="Import CSV" subtitle="Bring in a month of history, mapped and de-duplicated.">
      <div className="ghost-border mx-auto max-w-[42rem] rounded-lg bg-surface-container-lowest p-md">
        <div className="mb-md flex items-center gap-base text-label-sm uppercase text-on-surface-variant">
          <span className={step >= 1 ? "text-primary" : ""}>1 · File & mapping</span>
          <span>→</span>
          <span className={step >= 2 ? "text-primary" : ""}>2 · Preview & dedupe</span>
          <span>→</span>
          <span className={step >= 3 ? "text-primary" : ""}>3 · Import</span>
        </div>

        {step === 1 && (
          <div className="space-y-md">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-base rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-md py-xl text-center hover:border-primary">
              <Upload className="h-6 w-6 text-on-surface-variant" />
              <span className="text-body-md font-medium">{fileName || "Drop a .csv here, or click to browse"}</span>
              <span className="text-label-sm text-on-surface-variant">
                The first row is read as headers. Your mapping is remembered for this format.
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </label>

            {rows.length > 0 && (
              <>
                <div className="rounded-md border border-outline-variant bg-surface-container-low p-sm text-label-sm text-on-surface-variant">
                  <FileText className="mr-1 inline h-4 w-4" />
                  {fileName} · {rows.length} rows · {headers.length} columns
                </div>
                <div className="space-y-base">
                  {columnSelect("Date", mapping.date, (v) => setMapping((m) => ({ ...m, date: v })))}
                  {columnSelect("Payee / description", mapping.payee, (v) => setMapping((m) => ({ ...m, payee: v })))}
                  <div className="rounded-md border border-outline-variant bg-surface-container-low p-sm">
                    <div className="mb-base flex items-center justify-between">
                      <label className="text-label-bold text-on-surface-variant">Amount</label>
                      {mapping.amount >= 0 ? (
                        <button
                          type="button"
                          onClick={() => setMapping((m) => ({ ...m, amount: -1 }))}
                          className="pressable text-label-sm uppercase text-primary hover:underline"
                        >
                          Use debit / credit instead
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setMapping((m) => ({ ...m, debit: -1, credit: -1 }))}
                          className="pressable text-label-sm uppercase text-primary hover:underline"
                        >
                          Use a single amount column
                        </button>
                      )}
                    </div>
                    {mapping.amount >= 0 ? (
                      columnSelect("Single signed amount", mapping.amount, (v) =>
                        setMapping((m) => ({ ...m, amount: v, debit: -1, credit: -1 })),
                      )
                    ) : (
                      <div className="space-y-base">
                        {columnSelect("Debit / money out", mapping.debit, (v) => setMapping((m) => ({ ...m, debit: v })))}
                        {columnSelect("Credit / money in", mapping.credit, (v) => setMapping((m) => ({ ...m, credit: v })))}
                      </div>
                    )}
                  </div>
                  {columnSelect("Category (optional)", mapping.category, (v) =>
                    setMapping((m) => ({ ...m, category: v })),
                  )}
                  {columnSelect("Notes / memo (optional)", mapping.note, (v) =>
                    setMapping((m) => ({ ...m, note: v })),
                  )}
                </div>

                <div className="flex items-center justify-end gap-base">
                  <Link
                    href="/transactions"
                    className={`${stepBtn} border border-outline-variant text-on-surface-variant hover:bg-surface-container-low`}
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Link>
                  <button
                    type="button"
                    onClick={onPreview}
                    className={`${stepBtn} bg-primary text-on-primary hover:bg-primary-container`}
                  >
                    Preview <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-md">
            <div className="flex flex-wrap items-center justify-between gap-base text-label-sm text-on-surface-variant">
              <span>
                {parsed.length} rows · <span className="text-tertiary">{duplicateCount} already imported</span>
              </span>
              <label className="flex cursor-pointer items-center gap-1">
                <input
                  type="checkbox"
                  checked={skipIndexes.size === parsed.length && parsed.length > 0}
                  onChange={(e) =>
                    setSkipIndexes(e.target.checked ? new Set(parsed.map((_, i) => i)) : new Set())
                  }
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                Skip duplicates
              </label>
            </div>

            <div className="max-h-[24rem] overflow-auto rounded-md border border-outline-variant">
              <table className="w-full table-fixed text-left text-label-bold font-normal">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-28" />
                  <col />
                  <col className="w-40" />
                  <col />
                  <col className="w-28" />
                </colgroup>
                <thead className="sticky top-0 bg-surface-container">
                  <tr className="text-label-sm uppercase text-on-surface-variant">
                    <th className="h-10 px-3 align-middle"></th>
                    <th className="h-10 px-3 align-middle font-medium">Date</th>
                    <th className="h-10 px-3 align-middle font-medium">Payee</th>
                    <th className="h-10 px-3 align-middle font-medium">Notes</th>
                    <th className="h-10 px-3 align-middle font-medium">Category</th>
                    <th className="h-10 px-3 align-middle text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:nth-child(even)]:bg-surface-container-low">
                  {parsed.map((r, i) => {
                    const ruleApplied = previewRules(rules, r);
                    const isDup = skipIndexes.has(i);
                    return (
                      <tr key={i} className={isDup ? "opacity-50" : ""}>
                        <td className="p-0">
                          <div className="flex h-10 w-full items-center justify-center px-3">
                            <input
                              type="checkbox"
                              checked={isDup}
                              onChange={(e) => {
                                const next = new Set(skipIndexes);
                                if (e.target.checked) next.add(i);
                                else next.delete(i);
                                setSkipIndexes(next);
                              }}
                              aria-label={isDup ? `Skip row ${i + 1}` : `Keep row ${i + 1}`}
                              className="h-4 w-4 accent-[var(--primary)]"
                            />
                          </div>
                        </td>
                        <td className="p-0 text-numeric-data text-on-surface-variant">
                          <div className="flex h-10 w-full items-center px-3">{r.date}</div>
                        </td>
                        <td className="p-0">
                          <div className="flex h-10 w-full items-center px-3">
                            <span className="min-w-0 truncate">
                              {r.payee}
                              {ruleApplied.payee !== r.payee && (
                                <span className="ml-1 text-label-sm uppercase text-secondary">→ {ruleApplied.payee}</span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="p-0">
                          <div className="flex h-10 w-full items-center px-3">
                            {r.notes ? (
                              <span title={r.notes} className="block w-full truncate text-on-surface-variant">
                                {r.notes}
                              </span>
                            ) : (
                              <span className="text-on-surface-variant">—</span>
                            )}
                          </div>
                        </td>
                        <td className="p-0">
                          <div className="flex h-10 w-full items-center px-3">
                            <span className="min-w-0 truncate">
                              {lookup.nameOf(ruleApplied.categoryId ?? "")}
                              {ruleApplied.categoryId && !r.categoryId && (
                                <span className="ml-1 text-label-sm uppercase text-secondary">rule</span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="p-0 text-right font-mono-numbers">
                          <div className="flex h-10 w-full items-center justify-end px-3">{r.amount.toFixed(2)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-base">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`${stepBtn} border border-outline-variant text-on-surface-variant hover:bg-surface-container-low`}
              >
                <ArrowLeft className="h-4 w-4" /> Mapping
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={importCount === 0}
                className={`${stepBtn} bg-primary text-on-primary hover:bg-primary-container disabled:opacity-50`}
              >
                Import {importCount} rows <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-md">
            {result ? (
              <div className="rounded-md border border-outline-variant bg-surface-container-low p-md text-center">
                <Check className="mx-auto mb-sm h-6 w-6 text-secondary" />
                <p className="text-body-md font-medium">
                  Imported {result.imported} transaction{result.imported === 1 ? "" : "s"}.
                </p>
                {result.skipped.length > 0 && (
                  <p className="mt-1 text-label-sm text-on-surface-variant">
                    Skipped {result.skipped.length} already-imported row{result.skipped.length === 1 ? "" : "s"}.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-label-sm uppercase text-on-surface-variant">
                    Default &ldquo;paid from&rdquo;
                  </label>
                  <PaidFromSelect value={defaultPaidFrom} onChange={setDefaultPaidFrom} />
                  <p className="mt-1 text-label-sm text-on-surface-variant">
                    Imported rows don&apos;t carry a payment method, so they&apos;re all booked to this account.
                  </p>
                </div>
                <div className="rounded-md border border-outline-variant bg-surface-container-low p-sm text-label-sm text-on-surface-variant">
                  {importCount} rows ready · {duplicateCount} will be skipped as duplicates.
                </div>
                <div className="flex items-center justify-between gap-base">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className={`${stepBtn} border border-outline-variant text-on-surface-variant hover:bg-surface-container-low`}
                  >
                    <ArrowLeft className="h-4 w-4" /> Preview
                  </button>
                  <button
                    type="button"
                    onClick={onImport}
                    disabled={busy || !defaultPaidFrom}
                    className={`${stepBtn} bg-primary text-on-primary hover:bg-primary-container disabled:opacity-50`}
                  >
                    {busy ? "Importing…" : "Run import"}
                  </button>
                </div>
              </>
            )}

            {result && (
              <div className="flex items-center justify-end">
                <Link
                  href="/transactions"
                  className={`${stepBtn} bg-primary text-on-primary hover:bg-primary-container`}
                >
                  View transactions
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
