"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/constants/order-status";
import type { OrderStatus } from "@/lib/types";
import { Search, X } from "lucide-react";

const ALL_STATUSES: OrderStatus[] = [
  "submitted",
  "approved",
  "declined",
  "fulfilled",
];

interface OrderFiltersProps {
  role: "admin" | "commissary" | "store";
  stores: { id: string; name: string }[];
}

export function OrderFilters({ role, stores }: OrderFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentStatus = searchParams.get("status") ?? "";
  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";
  const currentQ = searchParams.get("q") ?? "";
  const currentStoreId = searchParams.get("store_id") ?? "";

  const [searchText, setSearchText] = useState(currentQ);
  const [fromDate, setFromDate] = useState(currentFrom);
  const [toDate, setToDate] = useState(currentTo);

  const hasFilters = !!(
    currentStatus ||
    currentFrom ||
    currentTo ||
    currentQ ||
    currentStoreId
  );

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/orders?${qs}` : "/orders");
    });
  }

  function clearAll() {
    setSearchText("");
    setFromDate("");
    setToDate("");
    startTransition(() => {
      router.push("/orders");
    });
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      updateParams({ q: searchText.trim() });
    }
  }

  const dateInputClass =
    "flex h-9 w-full rounded-xl border border-input bg-muted/50 px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary";

  return (
    <div
      className={`space-y-2 ${isPending ? "opacity-60" : ""}`}
    >
      {/* Row 1: Status + From + To (3 columns on mobile, flex-wrap on desktop) */}
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <div className="sm:min-w-[120px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Status
          </label>
          <Select
            value={currentStatus || "all"}
            onValueChange={(v) => updateParams({ status: v === "all" ? "" : v })}
          >
            <SelectTrigger className="rounded-xl h-9 sm:h-10">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:min-w-[140px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            From
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            onBlur={() => { if (fromDate !== currentFrom) updateParams({ from: fromDate }); }}
            className={`${dateInputClass} sm:h-10`}
          />
        </div>

        <div className="sm:min-w-[140px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            To
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            onBlur={() => { if (toDate !== currentTo) updateParams({ to: toDate }); }}
            className={`${dateInputClass} sm:h-10`}
          />
        </div>

        {role !== "store" && stores.length > 0 && (
          <div className="col-span-3 sm:col-span-1 sm:min-w-[140px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Store
            </label>
            <Select
              value={currentStoreId || "all"}
              onValueChange={(v) =>
                updateParams({ store_id: v === "all" ? "" : v })
              }
            >
              <SelectTrigger className="rounded-xl h-9 sm:h-10">
                <SelectValue placeholder="All stores" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All stores</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Row 2: Search + Clear */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            className="h-9 sm:h-10"
            placeholder="Order ID or store name..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => {
              if (searchText.trim() !== currentQ) {
                updateParams({ q: searchText.trim() });
              }
            }}
            leftIcon={<Search className="size-4" />}
          />
        </div>

        {hasFilters && (
          <Button variant="outline" size="sm" className="h-9 sm:h-10 shrink-0" onClick={clearAll}>
            <X className="size-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
