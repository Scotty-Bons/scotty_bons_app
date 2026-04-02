"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";

const PRESETS = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "3m", value: "3m" },
  { label: "6m", value: "6m" },
  { label: "12m", value: "12m" },
  { label: "All", value: "all" },
] as const;

interface DashboardDateFilterProps {
  current: string;
}

export function DashboardDateFilter({ current }: DashboardDateFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";
  const isCustom = current === "custom";

  const [fromDate, setFromDate] = useState(currentFrom);
  const [toDate, setToDate] = useState(currentTo);

  function selectPreset(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    if (value === "12m") {
      params.delete("range");
    } else {
      params.set("range", value);
    }
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/dashboard?${qs}` : "/dashboard");
    });
  }

  function applyCustomRange() {
    if (!fromDate || !toDate) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", fromDate);
    params.set("to", toDate);
    params.delete("range");
    startTransition(() => {
      router.replace(`/dashboard?${params.toString()}`);
    });
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${isPending ? "opacity-60" : ""}`}
    >
      <Calendar className="size-4 text-muted-foreground" />
      {PRESETS.map((preset) => {
        const isActive = !isCustom && current === preset.value;
        return (
          <Button
            key={preset.value}
            variant={isActive ? "default" : "outline"}
            size="sm"
            className={`h-7 px-2.5 text-xs rounded-lg ${isActive ? "" : "text-muted-foreground"}`}
            onClick={() => selectPreset(preset.value)}
          >
            {preset.label}
          </Button>
        );
      })}
      <div className="h-4 w-px bg-border mx-0.5" />
      <Input
        type="date"
        value={fromDate}
        onChange={(e) => setFromDate(e.target.value)}
        className="h-7 w-[7.5rem] text-xs px-2"
      />
      <span className="text-xs text-muted-foreground">–</span>
      <Input
        type="date"
        value={toDate}
        onChange={(e) => setToDate(e.target.value)}
        className="h-7 w-[7.5rem] text-xs px-2"
      />
      <Button
        variant={isCustom ? "default" : "outline"}
        size="sm"
        className="h-7 px-2.5 text-xs rounded-lg"
        disabled={!fromDate || !toDate || fromDate > toDate}
        onClick={applyCustomRange}
      >
        Apply
      </Button>
    </div>
  );
}
