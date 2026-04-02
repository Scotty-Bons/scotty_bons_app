"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardStoreFilterProps {
  stores: { id: string; name: string }[];
  current: string;
}

export function DashboardStoreFilter({ stores, current }: DashboardStoreFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("store");
    } else {
      params.set("store", value);
    }
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/dashboard?${qs}` : "/dashboard");
    });
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className={`w-44 h-8 text-xs rounded-lg ${isPending ? "opacity-60" : ""}`}>
        <SelectValue placeholder="All Stores" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Stores</SelectItem>
        {stores.map((store) => (
          <SelectItem key={store.id} value={store.id}>
            {store.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
