"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
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

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "12m") {
      params.delete("range");
    } else {
      params.set("range", value);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/dashboard?${qs}` : "/dashboard");
    });
  }

  return (
    <div
      className={`flex items-center gap-1.5 ${isPending ? "opacity-60" : ""}`}
    >
      <Calendar className="size-4 text-muted-foreground" />
      {PRESETS.map((preset) => {
        const isActive = current === preset.value;
        return (
          <Button
            key={preset.value}
            variant={isActive ? "default" : "outline"}
            size="sm"
            className={`h-7 px-2.5 text-xs rounded-lg ${isActive ? "" : "text-muted-foreground"}`}
            onClick={() => select(preset.value)}
          >
            {preset.label}
          </Button>
        );
      })}
    </div>
  );
}
