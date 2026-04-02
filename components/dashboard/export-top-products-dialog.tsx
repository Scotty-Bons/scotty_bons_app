"use client";

import { useState, useTransition } from "react";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { exportTopProductsReport } from "@/app/(dashboard)/dashboard/actions";

interface ExportTopProductsDialogProps {
  stores: { id: string; name: string }[];
  categoryNames: string[];
  productNames: string[];
  /** Map product name → category name for filtering */
  productCategoryMap: Record<string, string>;
  /** Pre-selected store ID from the dashboard filter */
  currentStoreFilter: string;
  /** Dashboard date range key (e.g., "12m", "custom") */
  currentRange: string;
  /** Pre-selected category name from the dashboard filter */
  currentCategoryFilter?: string;
  /** Pre-selected product name from the dashboard filter */
  currentProductFilter?: string;
  /** Custom date range from URL (YYYY-MM-DD) */
  currentDateFrom?: string;
  /** Custom date range from URL (YYYY-MM-DD) */
  currentDateTo?: string;
}

function rangeKeyToDates(key: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const d = new Date(now);
  switch (key) {
    case "7d": d.setDate(d.getDate() - 7); break;
    case "30d": d.setDate(d.getDate() - 30); break;
    case "3m": d.setMonth(d.getMonth() - 3); break;
    case "6m": d.setMonth(d.getMonth() - 6); break;
    case "all": {
      const a = new Date();
      a.setFullYear(a.getFullYear() - 10);
      return { from: a.toISOString().slice(0, 10), to };
    }
    case "12m":
    default: d.setMonth(d.getMonth() - 12); break;
  }
  return { from: d.toISOString().slice(0, 10), to };
}

export function ExportTopProductsDialog({
  stores,
  categoryNames,
  productNames,
  productCategoryMap,
  currentStoreFilter,
  currentRange,
  currentCategoryFilter,
  currentProductFilter,
  currentDateFrom,
  currentDateTo,
}: ExportTopProductsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Use custom dates if provided, otherwise derive from range key
  const defaultDates = currentRange === "custom" && currentDateFrom && currentDateTo
    ? { from: currentDateFrom, to: currentDateTo }
    : rangeKeyToDates(currentRange);
  const [dateFrom, setDateFrom] = useState(defaultDates.from);
  const [dateTo, setDateTo] = useState(defaultDates.to);
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<string>>(
    currentStoreFilter !== "all" ? new Set([currentStoreFilter]) : new Set(),
  );
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    currentCategoryFilter && currentCategoryFilter !== "all" ? new Set([currentCategoryFilter]) : new Set(),
  );
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    currentProductFilter && currentProductFilter !== "all" ? new Set([currentProductFilter]) : new Set(),
  );

  const toggleSet = (set: Set<string>, value: string): Set<string> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const handleExport = (format: "xlsx" | "pdf") => {
    startTransition(async () => {
      const result = await exportTopProductsReport({
        dateFrom,
        dateTo,
        storeIds: Array.from(selectedStoreIds),
        categoryNames: Array.from(selectedCategories),
        productNames: Array.from(selectedProducts),
        format,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (!result.data) return;

      // Decode base64 and download
      const { base64, filename } = result.data;
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const mime = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Report exported!");
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (v) {
        // Sync dialog state with current filters on open
        const dates = currentRange === "custom" && currentDateFrom && currentDateTo
          ? { from: currentDateFrom, to: currentDateTo }
          : rangeKeyToDates(currentRange);
        setDateFrom(dates.from);
        setDateTo(dates.to);
        setSelectedStoreIds(
          currentStoreFilter !== "all"
            ? new Set([currentStoreFilter])
            : new Set(stores.map((s) => s.id)),
        );
        setSelectedCategories(
          currentCategoryFilter && currentCategoryFilter !== "all"
            ? new Set([currentCategoryFilter])
            : new Set(categoryNames),
        );
        setSelectedProducts(
          currentProductFilter && currentProductFilter !== "all"
            ? new Set([currentProductFilter])
            : new Set(productNames),
        );
      }
      setOpen(v);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="size-4 mr-1.5" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date range */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Date Range</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
            </div>
          </div>

          {/* Stores */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Stores</label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() =>
                  setSelectedStoreIds(
                    selectedStoreIds.size === stores.length
                      ? new Set()
                      : new Set(stores.map((s) => s.id)),
                  )
                }
              >
                {selectedStoreIds.size === stores.length ? "Clear" : "Select All"}
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1.5">
              {stores.map((store) => (
                <label
                  key={store.id}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selectedStoreIds.has(store.id)}
                    onCheckedChange={() =>
                      setSelectedStoreIds(toggleSet(selectedStoreIds, store.id))
                    }
                  />
                  {store.name}
                </label>
              ))}
              {stores.length === 0 && (
                <p className="text-xs text-muted-foreground">No stores available.</p>
              )}
            </div>
            {selectedStoreIds.size === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No selection = all stores</p>
            )}
          </div>

          {/* Categories */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Categories</label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() =>
                  setSelectedCategories(
                    selectedCategories.size === categoryNames.length
                      ? new Set()
                      : new Set(categoryNames),
                  )
                }
              >
                {selectedCategories.size === categoryNames.length ? "Clear" : "Select All"}
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1.5">
              {categoryNames.map((name) => (
                <label
                  key={name}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selectedCategories.has(name)}
                    onCheckedChange={() =>
                      setSelectedCategories(toggleSet(selectedCategories, name))
                    }
                  />
                  {name}
                </label>
              ))}
            </div>
            {selectedCategories.size === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No selection = all categories</p>
            )}
          </div>

          {/* Products */}
          {(() => {
            const visibleProducts = selectedCategories.size > 0
              ? productNames.filter((n) => {
                  // Find category for this product name (keys are "name|modifier")
                  const cat = Object.entries(productCategoryMap).find(([k]) => k.startsWith(n + "|"))?.[1];
                  return selectedCategories.has(cat ?? "");
                })
              : productNames;
            return (<div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Products</label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() =>
                  setSelectedProducts(
                    selectedProducts.size === visibleProducts.length
                      ? new Set()
                      : new Set(visibleProducts),
                  )
                }
              >
                {selectedProducts.size === visibleProducts.length && visibleProducts.length > 0 ? "Clear" : "Select All"}
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1.5">
              {visibleProducts.map((name) => (
                <label
                  key={name}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selectedProducts.has(name)}
                    onCheckedChange={() =>
                      setSelectedProducts(toggleSet(selectedProducts, name))
                    }
                  />
                  {name}
                </label>
              ))}
            </div>
            {selectedProducts.size === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No selection = all products</p>
            )}
          </div>);
          })()}

          {/* Export buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleExport("xlsx")}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4 mr-1.5" />
              )}
              Export XLSX
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleExport("pdf")}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <FileDown className="size-4 mr-1.5" />
              )}
              Export PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
