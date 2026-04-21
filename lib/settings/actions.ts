"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function getFinancialSettings(): Promise<
  ActionResult<{ hst_rate: number; ad_royalties_fee: number }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized." };

  const { data, error } = await supabase
    .from("financial_settings")
    .select("key, value")
    .in("key", ["hst_rate", "ad_royalties_fee"]);

  if (error) {
    return { data: null, error: "Failed to load financial settings." };
  }

  const settings: Record<string, string> = {};
  for (const row of data ?? []) settings[row.key] = row.value;

  return {
    data: {
      hst_rate: Number(settings.hst_rate ?? "13") / 100,
      ad_royalties_fee: Number(settings.ad_royalties_fee ?? "0"),
    },
    error: null,
  };
}
