export type Accent = "primary" | "secondary" | "tertiary" | "error";

export interface Category {
  id: string;
  name: string;
  /** null for a top-level category */
  parentId: string | null;
  accent: Accent;
  /** lucide icon name, resolved in the UI */
  icon: string;
  /** chart palette slot (1-6) — drives dots, bars and chart segments */
  color: 1 | 2 | 3 | 4 | 5 | 6;
  kind: "outflow" | "inflow";
}

export const CATEGORIES: Category[] = [
  { id: "shopping", color: 4, name: "Shopping", parentId: null, accent: "primary", icon: "ShoppingBag", kind: "outflow" },
  { id: "ridesharing", color: 3, name: "Ridesharing", parentId: null, accent: "tertiary", icon: "Car", kind: "outflow" },
  { id: "food", color: 1, name: "Food", parentId: null, accent: "secondary", icon: "Utensils", kind: "outflow" },
  { id: "food-coffee", color: 1, name: "Coffee Shops", parentId: "food", accent: "tertiary", icon: "Coffee", kind: "outflow" },
  { id: "food-delivery", color: 1, name: "Food Delivery", parentId: "food", accent: "primary", icon: "Bike", kind: "outflow" },
  {
    id: "food-groceries", color: 1,
    name: "Groceries",
    parentId: "food",
    accent: "secondary",
    icon: "ShoppingCart",
    kind: "outflow",
  },
  {
    id: "food-restaurants", color: 1,
    name: "Restaurants",
    parentId: "food",
    accent: "error",
    icon: "UtensilsCrossed",
    kind: "outflow",
  },
  { id: "childcare", color: 2, name: "Childcare", parentId: null, accent: "secondary", icon: "Baby", kind: "outflow" },
  { id: "home", color: 5, name: "Home", parentId: null, accent: "tertiary", icon: "House", kind: "outflow" },
  {
    id: "transfer", color: 6,
    name: "Payment/Transfer",
    parentId: null,
    accent: "primary",
    icon: "ArrowLeftRight",
    kind: "outflow",
  },
  {
    id: "personal-care", color: 2,
    name: "Personal Care",
    parentId: null,
    accent: "error",
    icon: "HeartPulse",
    kind: "outflow",
  },
  { id: "pets", color: 3, name: "Pets", parentId: null, accent: "tertiary", icon: "PawPrint", kind: "outflow" },
  {
    id: "self-improvement", color: 5,
    name: "Self-improvement",
    parentId: null,
    accent: "primary",
    icon: "GraduationCap",
    kind: "outflow",
  },
  { id: "income", color: 2, name: "Income", parentId: null, accent: "secondary", icon: "TrendingUp", kind: "inflow" },
];

export const categoryById = (id: string | null | undefined) =>
  id ? CATEGORIES.find((c) => c.id === id) : undefined;

export const topLevelCategories = () => CATEGORIES.filter((c) => c.parentId === null);

export const childrenOf = (id: string) => CATEGORIES.filter((c) => c.parentId === id);

/** Categories that can hold a budget line: leaves plus childless top-levels, outflow only. */
export const budgetableCategories = () =>
  CATEGORIES.filter((c) => c.kind === "outflow" && childrenOf(c.id).length === 0);

/** Top-level ancestor id — used for grouping and roll-ups. */
export const rootIdOf = (id: string) => categoryById(id)?.parentId ?? id;

export const pathFor = (id: string) => {
  const cat = categoryById(id);
  if (!cat) return "";
  const parent = cat.parentId ? categoryById(cat.parentId) : undefined;
  return parent ? `${parent.name} › ${cat.name}` : cat.name;
};

/** Nested view of the tree, handy for grouped selects and collapsible tables. */
export const categoryTree = () =>
  topLevelCategories().map((parent) => ({ ...parent, children: childrenOf(parent.id) }));

/** CSS colour for a category, resolved from the chart palette. */
export const categoryColor = (id: string | null | undefined) => {
  const cat = categoryById(id);
  const root = cat?.parentId ? categoryById(cat.parentId) : cat;
  return `var(--chart-${root?.color ?? cat?.color ?? 6})`;
};

// Helper functions for working with categories
export const getParentCategories = () => CATEGORIES.filter((c) => c.parentId === null);

export const getSubcategories = (parentId: string) => CATEGORIES.filter((c) => c.parentId === parentId);

export const getCategoryPath = (id: string): string => {
  const cat = categoryById(id);
  if (!cat) return "";
  const parent = cat.parentId ? categoryById(cat.parentId) : undefined;
  return parent ? `${parent.name} › ${cat.name}` : cat.name;
};

export const getCategoryTree = () => {
  return topLevelCategories().map((parent) => ({
    ...parent,
    children: childrenOf(parent.id),
  }));
};
