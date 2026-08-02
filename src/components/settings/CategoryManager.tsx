"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useBudget } from "@/lib/budget-store";
import { Plus, Trash2, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, Subcategory, CategoryAccent, CategoryKind } from "@/lib/mockData";

const ICONS = [
  "ShoppingBag",
  "Car",
  "Utensils",
  "Coffee",
  "Bike",
  "ShoppingCart",
  "UtensilsCrossed",
  "Baby",
  "House",
  "ArrowLeftRight",
  "HeartPulse",
  "PawPrint",
  "GraduationCap",
  "TrendingUp",
  "Lemon",
  "Plane",
  "Train",
  "Briefcase",
  "Dumbbell",
  "Film",
  "Music",
  "BookOpen",
  "Wrench",
];

const COLORS = [1, 2, 3, 4, 5, 6] as const;
const ACCENTS: CategoryAccent[] = ["primary", "secondary", "tertiary", "error"];
const KINDS: CategoryKind[] = ["outflow", "inflow"];

export function CategoryManager() {
  const { categories, addCategory, updateCategory, deleteCategory, getCategoryChildren } =
    useBudget();
  const [editingCategory, setEditingCategory] = useState<Category | Subcategory | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set(["food"]));

  useEffect(() => {
    if (editingCategory) {
      setShowEditModal(true);
    } else {
      setShowEditModal(false);
    }
  }, [editingCategory]);

  const toggleExpand = (parentId: string) => {
    const newExpanded = new Set(expandedParents);
    if (newExpanded.has(parentId)) {
      newExpanded.delete(parentId);
    } else {
      newExpanded.add(parentId);
    }
    setExpandedParents(newExpanded);
  };

  const handleAddCategory = async (data: any) => {
    try {
      const id = await addCategory(data);
      if (id) {
        setShowAddModal(false);
        toast.success("Category created");
      }
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error("Failed to create category");
    }
  };

  const handleUpdateCategory = async (data: any) => {
    if (!editingCategory) return;
    try {
      await updateCategory(editingCategory.id, data);
      setEditingCategory(null);
      toast.success("Category updated");
    } catch (error) {
      console.error("Error updating category:", error);
      toast.error("Failed to update category");
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (window.confirm("Are you sure? This will delete the category and its subcategories.")) {
      try {
        await deleteCategory(categoryId);
        toast.success("Category deleted");
      } catch (error: any) {
        console.error("Error deleting category:", error);
        toast.error(error.message || "Failed to delete category");
      }
    }
  };

  const handleEdit = (category: Category | Subcategory) => {
    setEditingCategory(category);
  };

  return (
    <>
      <div className="ghost-border max-w-[36rem] rounded-lg bg-surface-container-lowest">
        <div className="flex items-center justify-between gap-md border-b border-outline-variant p-md">
          <div>
            <p className="text-body-md font-medium">Categories & Envelopes</p>
            <p className="text-label-sm text-on-surface-variant">
              Manage your budget categories and subcategories
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="uppercase">Add Category</span>
          </Button>
        </div>

        <div className="divide-y divide-outline-variant">
          {categories
            .filter((c) => c.parentId === null)
            .map((parent) => {
              const children = getCategoryChildren(parent.id);
              const isExpanded = expandedParents.has(parent.id);

              return (
                <div key={parent.id} className="group">
                  <div className="flex items-center justify-between gap-md p-md hover:bg-surface-container">
                    <div className="flex flex-1 items-center gap-md">
                      <button
                        onClick={() => toggleExpand(parent.id)}
                        className="pressable rounded-md p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: `var(--chart-${parent.color})` }}
                        />
                        <span className="text-body-md font-medium">{parent.name}</span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-label-xs uppercase text-primary">
                          {parent.kind}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-on-surface-variant hover:text-primary"
                        onClick={() => handleEdit(parent)}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-on-surface-variant hover:text-error"
                        onClick={() => handleDeleteCategory(parent.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && children.length > 0 && (
                    <div className="ml-4 border-l border-outline-variant">
                      {children.map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center justify-between gap-md p-md hover:bg-surface-container"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: `var(--chart-${child.color})` }}
                            />
                            <span className="text-body-md font-medium">{child.name}</span>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-label-xs uppercase text-primary">
                              {child.kind}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-on-surface-variant hover:text-primary"
                              onClick={() => handleEdit(child)}
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-on-surface-variant hover:text-error"
                              onClick={() => handleDeleteCategory(child.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Add Category Dialog */}
      <AddCategoryDialog
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSubmit={handleAddCategory}
        categories={categories}
      />

      {/* Edit Category Dialog */}
      <EditCategoryDialog
        open={showEditModal}
        onOpenChange={() => setEditingCategory(null)}
        category={editingCategory}
        onSubmit={handleUpdateCategory}
        categories={categories}
      />
    </>
  );
}

function AddCategoryDialog({
  open,
  onOpenChange,
  onSubmit,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  categories: Category[];
}) {
  const parentCategories = categories.filter((c) => c.parentId === null);
  const [formData, setFormData] = useState({
    name: "",
    parentId: "" as string | null,
    kind: "outflow" as CategoryKind,
    color: 1 as 1 | 2 | 3 | 4 | 5 | 6,
    accent: "primary" as CategoryAccent,
    icon: "ShoppingBag",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      name: "",
      parentId: null,
      kind: "outflow",
      color: 1,
      accent: "primary",
      icon: "ShoppingBag",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Category</DialogTitle>
          <DialogDescription>
            Create a new category or subcategory for your budget
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Food"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parentId">Parent Category</Label>
            <Select
              value={formData.parentId}
              onValueChange={(value) => setFormData({ ...formData, parentId: value || null })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Top-level category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Top-level category</SelectItem>
                {parentCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kind">Type</Label>
              <Select
                value={formData.kind}
                onValueChange={(value) =>
                  setFormData({ ...formData, kind: value as CategoryKind })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outflow">Outflow (Spending)</SelectItem>
                  <SelectItem value="inflow">Inflow (Income)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accent">Accent</Label>
              <Select
                value={formData.accent}
                onValueChange={(value) =>
                  setFormData({ ...formData, accent: value as CategoryAccent })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCENTS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Select
                value={String(formData.color)}
                onValueChange={(value) =>
                  setFormData({ ...formData, color: Number(value) as 1 | 2 | 3 | 4 | 5 | 6 })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      Color {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">Icon</Label>
              <Select
                value={formData.icon}
                onValueChange={(value) => setFormData({ ...formData, icon: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name}>
              Create Category
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryDialog({
  open,
  onOpenChange,
  category,
  onSubmit,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | Subcategory | null;
  onSubmit: (data: any) => void;
  categories: Category[];
}) {
  const parentCategories = categories.filter((c) => c.parentId === null);
  const [formData, setFormData] = useState<Partial<Category | Subcategory>>({});

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        parentId: category.parentId,
        kind: category.kind,
        color: category.color,
        accent: category.accent,
        icon: category.icon,
      });
    }
  }, [category]);

  if (!category) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
          <DialogDescription>Modify {category.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Food"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parentId">Parent Category</Label>
            <Select
              value={formData.parentId || ""}
              onValueChange={(value) => setFormData({ ...formData, parentId: value || null })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Top-level category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Top-level category</SelectItem>
                {parentCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kind">Type</Label>
              <Select
                value={formData.kind || "outflow"}
                onValueChange={(value) =>
                  setFormData({ ...formData, kind: value as CategoryKind })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outflow">Outflow (Spending)</SelectItem>
                  <SelectItem value="inflow">Inflow (Income)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accent">Accent</Label>
              <Select
                value={formData.accent || "primary"}
                onValueChange={(value) =>
                  setFormData({ ...formData, accent: value as CategoryAccent })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCENTS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Select
                value={String(formData.color || 1)}
                onValueChange={(value) =>
                  setFormData({ ...formData, color: Number(value) as 1 | 2 | 3 | 4 | 5 | 6 })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      Color {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">Icon</Label>
              <Select
                value={formData.icon || "ShoppingBag"}
                onValueChange={(value) => setFormData({ ...formData, icon: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
