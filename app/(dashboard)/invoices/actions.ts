"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function getInvoiceItemsForInvoices(
  invoiceIds: string[]
): Promise<ActionResult<{ invoice_id: string; product_name: string; modifier: string; unit_price: number; quantity: number; line_total: number }[]>> {
  if (!invoiceIds.length || invoiceIds.length > 50) {
    return { data: null, error: "Invalid selection." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized." };

  const { data, error } = await supabase
    .from("invoice_items")
    .select("invoice_id, product_name, modifier, unit_price, quantity, line_total")
    .in("invoice_id", invoiceIds);

  if (error) {
    return { data: null, error: "Failed to load invoice items." };
  }

  return { data: data ?? [], error: null };
}

export async function getInvoiceTotalsForInvoices(
  invoiceIds: string[]
): Promise<
  ActionResult<{
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    ad_royalties_fee: number;
    grand_total: number;
  }>
> {
  if (!invoiceIds.length || invoiceIds.length > 50) {
    return { data: null, error: "Invalid selection." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized." };

  const { data, error } = await supabase
    .from("invoices")
    .select("subtotal, tax_rate, tax_amount, ad_royalties_fee, grand_total")
    .in("id", invoiceIds);

  if (error) {
    return { data: null, error: "Failed to load invoice totals." };
  }

  const totals = (data ?? []).reduce(
    (acc, inv) => ({
      subtotal: acc.subtotal + Number(inv.subtotal),
      tax_rate: Number(inv.tax_rate), // same rate for all
      tax_amount: acc.tax_amount + Number(inv.tax_amount),
      ad_royalties_fee: acc.ad_royalties_fee + Number(inv.ad_royalties_fee),
      grand_total: acc.grand_total + Number(inv.grand_total),
    }),
    { subtotal: 0, tax_rate: 0, tax_amount: 0, ad_royalties_fee: 0, grand_total: 0 },
  );

  return { data: totals, error: null };
}
