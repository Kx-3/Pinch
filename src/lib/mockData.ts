import { budgetableCategories, categoryById, categoryColor, rootIdOf, type Accent } from "@/lib/categories";

export type { Accent };

// Category system with parent/child relationships (subcategories)

export type CategoryKind = "outflow" | "inflow";
export type CategoryAccent = "primary" | "secondary" | "tertiary" | "error";

/** Top-level category (no parent) */
export interface Category {
  id: string;
  name: string;
  parentId: null;
  color: 1 | 2 | 3 | 4 | 5 | 6;
  icon: string;
  kind: CategoryKind;
  accent: CategoryAccent;
}

/** Subcategory (has a parent) */
export interface Subcategory {
  id: string;
  name: string;
  parentId: string;
  color: 1 | 2 | 3 | 4 | 5 | 6;
  icon: string;
  kind: CategoryKind;
  accent: CategoryAccent;
}

/** A category with its children (for tree display) */
export interface CategoryWithChildren extends Category {
  children: Subcategory[];
}

/** A category enriched with computed values */
export interface CategoryWithMetadata extends Category {
  path: string;
  parentName?: string;
}

/** Flatten all categories into a single array */
export type AllCategory = Category | Subcategory;

/** A funding line for one category. */
export interface BudgetLine {
  categoryId: string;
  target: number;
  assigned: number;
  spent: number;
  pinned: boolean;
  /** ISO date the line was created — used for "Recent" sorting */
  createdAt: string;
  note: string;
}

/** A budget line enriched with its category metadata (what the UI consumes). */
export interface Envelope extends BudgetLine {
  /** same as categoryId — kept so existing list keys/handlers stay stable */
  id: string;
  name: string;
  accent: Accent;
  /** resolved chart-palette CSS colour for this category */
  color: string;
  /** top-level category id, used for grouping */
  group: string;
  path: string;
}

export interface Transaction {
  id: string;
  date: string;
  payee: string;
  categoryId: string | null;
  /** negative = outflow, positive = inflow */
  amount: number;
  /** PaymentMethod id */
  paidFrom: string;
  tags: string[];
  type: "expense" | "income";
}

export interface ScheduledOutflow {
  id: string;
  date: string;
  name: string;
  categoryId: string;
  amount: number;
  funded: boolean;
}

export interface Account {
  id: string;
  name: string;
  kind: "Checking" | "Savings" | "Credit";
  balance: number;
}

export type PaymentMethodKind = "bank" | "card" | "cash" | "wallet" | "custom";

export interface PaymentMethod {
  id: string;
  label: string;
  kind: PaymentMethodKind;
  builtIn: boolean;
}

export interface Tip {
  id: string;
  rule: string;
  role: "beginner" | "power-user" | "debt-payer";
  body: string;
  author: string;
}

export const PAYMENT_METHOD_KINDS: { id: PaymentMethodKind; label: string }[] = [
  { id: "bank", label: "Bank account" },
  { id: "card", label: "Card" },
  { id: "cash", label: "Cash" },
  { id: "wallet", label: "Digital wallet" },
  { id: "custom", label: "Other" },
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "pm-checking", label: "Everyday Checking", kind: "bank", builtIn: true },
  { id: "pm-savings", label: "Vault Savings", kind: "bank", builtIn: true },
  { id: "pm-card", label: "Blue Card", kind: "card", builtIn: true },
  { id: "pm-cash", label: "Cash", kind: "cash", builtIn: true },
];

export const DEFAULT_PAYMENT_METHOD_ID = "pm-checking";

const line = (
  categoryId: string,
  target: number,
  assigned: number,
  spent: number,
  pinned: boolean,
  createdAt: string,
  note: string,
): BudgetLine => ({ categoryId, target, assigned, spent, pinned, createdAt, note });

export const BUDGET_LINES: BudgetLine[] = [
  line("home", 2100, 2100, 2100, true, "2025-01-04", "Rent, utilities and everything under the roof."),
  line("food-groceries", 600, 450, 312.4, true, "2025-01-04", "Weekly shop plus household staples."),
  line("food-restaurants", 320, 320, 218.75, false, "2025-02-11", "Sit-down meals and nights out."),
  line("food-coffee", 90, 60, 74.2, true, "2025-03-02", "Daily flat white habit."),
  line("food-delivery", 140, 90, 118.6, false, "2025-04-18", "Late-night delivery orders."),
  line("ridesharing", 220, 180, 196.1, false, "2025-05-06", "Uber, Lyft and airport runs."),
  line("shopping", 400, 300, 264.99, true, "2025-06-01", "Clothes, gadgets and household goods."),
  line("childcare", 850, 850, 850, false, "2025-06-14", "Daycare and the occasional sitter."),
  line("personal-care", 160, 120, 88.5, false, "2025-07-21", "Haircuts, pharmacy and gym."),
  line("pets", 130, 100, 112.4, false, "2025-08-09", "Food, litter and vet visits."),
  line("self-improvement", 200, 150, 96, false, "2025-09-02", "Courses, books and coaching."),
  line("transfer", 450, 250, 250, false, "2025-09-14", "Card paydown and money moved between accounts."),
];

/** Fallback lines for any budgetable category not explicitly listed above. */
export const ENVELOPES: BudgetLine[] = [
  ...BUDGET_LINES,
  ...budgetableCategories()
    .filter((c) => !BUDGET_LINES.some((l) => l.categoryId === c.id))
    .map((c) => line(c.id, 100, 0, 0, false, "2025-01-01", `Spending on ${c.name.toLowerCase()}.`)),
];

/** Enrich a budget line with its category metadata. */
export const enrichLine = (l: BudgetLine): Envelope => {
  const cat = categoryById(l.categoryId);
  const parent = cat?.parentId ? categoryById(cat.parentId) : undefined;
  return {
    ...l,
    id: l.categoryId,
    name: cat?.name ?? l.categoryId,
    accent: cat?.accent ?? "primary",
    color: categoryColor(l.categoryId),
    group: rootIdOf(l.categoryId),
    path: parent ? `${parent.name} › ${cat?.name}` : (cat?.name ?? l.categoryId),
  };
};

// export const TRANSACTIONS: Transaction[] = [
//   { id: "tx-1", date: "2025-10-18", payee: "Whole Foods", categoryId: "food-groceries", amount: -128.4, paidFrom: "pm-checking", tags: ["weekly-shop"] },
//   { id: "tx-2", date: "2025-10-17", payee: "Uber", categoryId: "ridesharing", amount: -48.1, paidFrom: "pm-card", tags: ["work-travel", "reimbursable"] },
//   { id: "tx-3", date: "2025-10-16", payee: "DoorDash", categoryId: "food-delivery", amount: -19.99, paidFrom: "pm-card", tags: ["late-night"] },
//   { id: "tx-4", date: "2025-10-15", payee: "Acme Payroll", categoryId: "income", amount: 4225, paidFrom: "pm-checking", tags: ["salary"] },
//   { id: "tx-5", date: "2025-10-14", payee: "Unknown ACH 8821", categoryId: null, amount: -64.0, paidFrom: "pm-checking", tags: [] },
//   { id: "tx-6", date: "2025-10-13", payee: "Blue Bottle", categoryId: "food-coffee", amount: -12.25, paidFrom: "pm-cash", tags: ["morning"] },
//   { id: "tx-7", date: "2025-10-12", payee: "City Power", categoryId: "home", amount: -104.2, paidFrom: "pm-checking", tags: ["utilities"] },
//   { id: "tx-8", date: "2025-10-10", payee: "Trattoria Nove", categoryId: "food-restaurants", amount: -86.5, paidFrom: "pm-card", tags: ["date-night"] },
//   { id: "tx-9", date: "2025-10-09", payee: "Petco", categoryId: "pets", amount: -54.3, paidFrom: "pm-checking", tags: ["vet"] },
// ];

export const SCHEDULED: ScheduledOutflow[] = [
  { id: "sch-1", date: "2025-10-24", name: "Streaming bundle", categoryId: "self-improvement", amount: 19.99, funded: true },
  { id: "sch-2", date: "2025-10-28", name: "Daycare invoice", categoryId: "childcare", amount: 425, funded: false },
  { id: "sch-3", date: "2025-11-01", name: "Rent — Maple St.", categoryId: "home", amount: 2100, funded: true },
  { id: "sch-4", date: "2025-11-03", name: "Card payment", categoryId: "transfer", amount: 118.4, funded: false },
];

export const ACCOUNTS: Account[] = [
  { id: "acc-1", name: "Everyday Checking", kind: "Checking", balance: 6421.55 },
  { id: "acc-2", name: "Vault Savings", kind: "Savings", balance: 12840.0 },
  { id: "acc-3", name: "Blue Card", kind: "Credit", balance: -1284.32 },
];

export const TIPS: Tip[] = [
  {
    id: "tip-1",
    rule: "Rule Two",
    role: "beginner",
    body: "Embrace your true expenses. Property taxes land in three months — fund a little each cycle instead of panicking later.",
    author: "Pinch Coaching",
  },
  {
    id: "tip-2",
    rule: "Rule Three",
    role: "power-user",
    body: "Roll with the punches. Overspending isn't failure — move money from a lower-priority category and keep going.",
    author: "Dana R., 4 years budgeting",
  },
  {
    id: "tip-3",
    rule: "Rule Four",
    role: "debt-payer",
    body: "Age your money. Once every dollar you spend is at least 30 days old, minimum payments stop dictating your month.",
    author: "Marcus T., debt-free 2024",
  },
  {
    id: "tip-4",
    rule: "Rule One",
    role: "beginner",
    body: "Give every dollar a job. Ready to Assign should read zero before you close the month.",
    author: "Pinch Coaching",
  },
];

export const SORT_OPTIONS = [
  { id: "recent", label: "Recently added" },
  { id: "funded-desc", label: "Funding: high to low" },
  { id: "funded-asc", label: "Funding: low to high" },
  { id: "remaining", label: "Most remaining" },
  { id: "name", label: "Name A–Z" },
] as const;

export type SortId = (typeof SORT_OPTIONS)[number]["id"];

export const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export const currency0 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
