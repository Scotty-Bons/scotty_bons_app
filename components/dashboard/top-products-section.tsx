"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/utils";
import { ExportTopProductsDialog } from "@/components/dashboard/export-top-products-dialog";

export interface ProductAggregate {
  name: string;
  modifier: string;
  quantity: number;
  value: number;
}

export interface CategoryAggregate {
  name: string;
  quantity: number;
  value: number;
}

export interface StoreAggregate {
  name: string;
  quantity: number;
  value: number;
}

export interface RawItem {
  product_name: string;
  modifier: string;
  unit_price: number;
  quantity: number;
  status: string;
  store_name: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "fulfilled", label: "Fulfilled" },
] as const;

const PAGE_SIZE = 5;

function usePagination<T>(items: T[]) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(page, totalPages - 1);
  const paged = items.slice(safeCurrentPage * PAGE_SIZE, (safeCurrentPage + 1) * PAGE_SIZE);
  return {
    page: safeCurrentPage,
    totalPages,
    paged,
    startIndex: safeCurrentPage * PAGE_SIZE,
    canPrev: safeCurrentPage > 0,
    canNext: safeCurrentPage < totalPages - 1,
    prev: () => setPage((p) => Math.max(0, p - 1)),
    next: () => setPage((p) => Math.min(totalPages - 1, p + 1)),
    reset: () => setPage(0),
  };
}

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  canPrev: boolean;
  canNext: boolean;
  prev: () => void;
  next: () => void;
  total: number;
}

function PaginationControls({ page, totalPages, canPrev, canNext, prev, next, total }: PaginationControlsProps) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between mt-3 pt-2 border-t">
      <span className="text-xs text-muted-foreground">
        {total} total
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-7" disabled={!canPrev} onClick={prev}>
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground px-1">
          {page + 1}/{totalPages}
        </span>
        <Button variant="ghost" size="icon" className="size-7" disabled={!canNext} onClick={next}>
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

interface TopProductsSectionProps {
  stores: { id: string; name: string }[];
  rawItems: RawItem[];
  categoryNames: string[];
  productNames: string[];
  productCategoryMap: Record<string, string>;
  currentRange: string;
  currentStoreFilter: string;
  currentDateFrom?: string;
  currentDateTo?: string;
}

export function TopProductsSection({
  stores,
  rawItems,
  categoryNames,
  productNames,
  productCategoryMap,
  currentRange,
  currentStoreFilter,
  currentDateFrom,
  currentDateTo,
}: TopProductsSectionProps) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");

  // Filter raw items by all active filters
  const filteredItems = useMemo(() => {
    let items = rawItems;
    if (statusFilter !== "all") {
      items = items.filter((i) => i.status === statusFilter);
    }
    if (categoryFilter !== "all") {
      items = items.filter((i) => {
        const cat = productCategoryMap[`${i.product_name}|${i.modifier}`] ?? "Uncategorized";
        return cat === categoryFilter;
      });
    }
    if (productFilter !== "all") {
      items = items.filter((i) => i.product_name === productFilter);
    }
    return items;
  }, [rawItems, statusFilter, categoryFilter, productFilter, productCategoryMap]);

  // Aggregate stores from filtered items
  const topStores = useMemo(() => {
    const agg: Record<string, StoreAggregate> = {};
    for (const item of filteredItems) {
      const entry = agg[item.store_name] ?? { name: item.store_name, quantity: 0, value: 0 };
      entry.quantity += item.quantity;
      entry.value += item.unit_price * item.quantity;
      agg[item.store_name] = entry;
    }
    return Object.values(agg).sort((a, b) => b.value - a.value);
  }, [filteredItems]);

  // Aggregate categories from filtered items
  const categories = useMemo(() => {
    const agg: Record<string, CategoryAggregate> = {};
    for (const item of filteredItems) {
      const catName = productCategoryMap[`${item.product_name}|${item.modifier}`] ?? "Uncategorized";
      const entry = agg[catName] ?? { name: catName, quantity: 0, value: 0 };
      entry.quantity += item.quantity;
      entry.value += item.unit_price * item.quantity;
      agg[catName] = entry;
    }
    return Object.values(agg).sort((a, b) => b.quantity - a.quantity);
  }, [filteredItems, productCategoryMap]);

  // Aggregate products from filtered items
  const products = useMemo(() => {
    const agg: Record<string, ProductAggregate> = {};
    for (const item of filteredItems) {
      const key = `${item.product_name}|${item.modifier}`;
      const entry = agg[key] ?? { name: item.product_name, modifier: item.modifier, quantity: 0, value: 0 };
      entry.quantity += item.quantity;
      entry.value += item.unit_price * item.quantity;
      agg[key] = entry;
    }
    return Object.values(agg).sort((a, b) => b.quantity - a.quantity);
  }, [filteredItems]);

  // Available product names based on category filter
  const availableProductNames = useMemo(() => {
    if (categoryFilter === "all") return productNames;
    return [...new Set(
      rawItems
        .filter((i) => {
          const cat = productCategoryMap[`${i.product_name}|${i.modifier}`] ?? "Uncategorized";
          return cat === categoryFilter;
        })
        .map((i) => i.product_name)
    )].sort();
  }, [rawItems, categoryFilter, productCategoryMap, productNames]);

  const catPag = usePagination(categories);
  const prodPag = usePagination(products);
  const storePag = usePagination(topStores);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    catPag.reset();
    prodPag.reset();
    storePag.reset();
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setProductFilter("all");
    catPag.reset();
    prodPag.reset();
    storePag.reset();
  };

  const handleProductChange = (value: string) => {
    setProductFilter(value);
    prodPag.reset();
    catPag.reset();
    storePag.reset();
  };

  const maxCategoryQty = Math.max(...catPag.paged.map((c) => c.quantity), 1);
  const maxProductQty = Math.max(...prodPag.paged.map((p) => p.quantity), 1);
  const maxStoreValue = Math.max(...storePag.paged.map((s) => s.value), 1);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="text-lg font-semibold">Top Stores, Categories & Products</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportTopProductsDialog
              stores={stores}
              categoryNames={categoryNames}
              productNames={productNames}
              productCategoryMap={productCategoryMap}
              currentStoreFilter={currentStoreFilter}
              currentRange={currentRange}
              currentCategoryFilter={categoryFilter}
              currentProductFilter={productFilter}
              currentDateFrom={currentDateFrom}
              currentDateTo={currentDateTo}
            />
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-40 truncate">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-40 truncate">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={productFilter} onValueChange={handleProductChange}>
              <SelectTrigger className="w-40 truncate">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {availableProductNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Top Stores */}
          <div className="min-h-[280px] flex flex-col">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Stores
            </h3>
            {topStores.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No data available.
              </p>
            ) : (
              <>
                <div className="space-y-2.5">
                  {storePag.paged.map((store, idx) => (
                    <div key={store.name} className="flex items-center gap-3">
                      <span className="flex items-center justify-center size-7 rounded-full text-xs font-bold shrink-0 bg-muted text-muted-foreground">
                        {storePag.startIndex + idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate mr-2">
                            {store.name}
                          </span>
                          <div className="flex items-center gap-2 sm:gap-3 text-sm shrink-0">
                            <span className="text-muted-foreground tabular-nums hidden sm:inline">
                              {store.quantity} units
                            </span>
                            <span className="font-semibold tabular-nums text-xs sm:text-sm">
                              {formatPrice(store.value)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500/70 transition-all"
                            style={{
                              width: `${(store.value / maxStoreValue) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <PaginationControls
                  page={storePag.page}
                  totalPages={storePag.totalPages}
                  canPrev={storePag.canPrev}
                  canNext={storePag.canNext}
                  prev={storePag.prev}
                  next={storePag.next}
                  total={topStores.length}
                />
              </>
            )}
          </div>

          {/* Top Categories */}
          <div className="min-h-[280px] flex flex-col">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Categories
            </h3>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No data available.
              </p>
            ) : (
              <>
                <div className="space-y-2.5">
                  {catPag.paged.map((cat, idx) => (
                    <div key={cat.name} className="flex items-center gap-3">
                      <span className="flex items-center justify-center size-7 rounded-full text-xs font-bold shrink-0 bg-muted text-muted-foreground">
                        {catPag.startIndex + idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate mr-2">
                            {cat.name}
                          </span>
                          <div className="flex items-center gap-2 sm:gap-3 text-sm shrink-0">
                            <span className="text-muted-foreground tabular-nums hidden sm:inline">
                              {cat.quantity} units
                            </span>
                            <span className="font-semibold tabular-nums text-xs sm:text-sm">
                              {formatPrice(cat.value)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-500/70 transition-all"
                            style={{
                              width: `${(cat.quantity / maxCategoryQty) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <PaginationControls
                  page={catPag.page}
                  totalPages={catPag.totalPages}
                  canPrev={catPag.canPrev}
                  canNext={catPag.canNext}
                  prev={catPag.prev}
                  next={catPag.next}
                  total={categories.length}
                />
              </>
            )}
          </div>

          {/* Top Products */}
          <div className="min-h-[280px] flex flex-col">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Products
            </h3>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No data available.
              </p>
            ) : (
              <>
                <div className="space-y-2.5">
                  {prodPag.paged.map((product, idx) => (
                    <div
                      key={`${product.name}|${product.modifier}`}
                      className="flex items-center gap-3"
                    >
                      <span className="flex items-center justify-center size-7 rounded-full text-xs font-bold shrink-0 bg-muted text-muted-foreground">
                        {prodPag.startIndex + idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate mr-2">
                            {product.name}
                            {product.modifier && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({product.modifier})
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2 sm:gap-3 text-sm shrink-0">
                            <span className="text-muted-foreground tabular-nums hidden sm:inline">
                              {product.quantity} units
                            </span>
                            <span className="font-semibold tabular-nums text-xs sm:text-sm">
                              {formatPrice(product.value)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500/70 transition-all"
                            style={{
                              width: `${(product.quantity / maxProductQty) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <PaginationControls
                  page={prodPag.page}
                  totalPages={prodPag.totalPages}
                  canPrev={prodPag.canPrev}
                  canNext={prodPag.canNext}
                  prev={prodPag.prev}
                  next={prodPag.next}
                  total={products.length}
                />
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
