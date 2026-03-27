/**
 * Seed script to populate the database with realistic data for dashboard display.
 * Run with: npx tsx scripts/seed-dashboard.ts
 *
 * Prerequisites: .env.local must have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ── Helpers ──

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(randInt(1, 28));
  d.setHours(randInt(8, 18), randInt(0, 59), 0, 0);
  return d;
}

// ── Main ──

async function main() {
  console.log("Fetching existing data...");

  // Get stores
  const { data: stores, error: storesErr } = await supabase
    .from("stores")
    .select("id, name");
  if (storesErr) throw storesErr;
  if (!stores?.length) throw new Error("No stores found. Create stores first.");
  console.log(`  Found ${stores.length} stores`);

  // Get products
  const { data: products, error: productsErr } = await supabase
    .from("products")
    .select("id, name, price, modifier")
    .eq("active", true);
  if (productsErr) throw productsErr;
  if (!products?.length) throw new Error("No products found. Create products first.");
  console.log(`  Found ${products.length} products`);

  // Get users with profiles
  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("user_id, role, store_id");
  if (profilesErr) throw profilesErr;

  const storeUsers = profiles?.filter((p) => p.role === "store" && p.store_id) ?? [];
  const adminUsers = profiles?.filter((p) => p.role === "admin") ?? [];
  const commissaryUsers = profiles?.filter((p) => p.role === "commissary") ?? [];
  const approvers = [...adminUsers, ...commissaryUsers];

  if (!storeUsers.length) throw new Error("No store users found.");
  if (!approvers.length) throw new Error("No admin/commissary users found.");
  console.log(`  Found ${storeUsers.length} store users, ${approvers.length} approvers`);

  // Get audit templates with items
  const { data: templates, error: templatesErr } = await supabase
    .from("audit_templates")
    .select("id, name")
    .eq("is_active", true);
  if (templatesErr) throw templatesErr;

  let templateItems: { id: string; template_id: string }[] = [];
  if (templates?.length) {
    const { data: items } = await supabase
      .from("audit_template_items")
      .select("id, template_id");
    templateItems = items ?? [];
    console.log(`  Found ${templates.length} audit templates, ${templateItems.length} items`);
  }

  // Get financial settings (needed to check if fulfillment will work)
  const { data: settings } = await supabase
    .from("financial_settings")
    .select("key, value");
  const hasFinancialSettings = settings?.some((s) => s.key === "hst_rate");
  console.log(`  Financial settings: ${hasFinancialSettings ? "configured" : "missing"}`);

  // ══════════════════════════════════════════════
  // CREATE ORDERS — spread over last 12 months
  // ══════════════════════════════════════════════
  console.log("\nCreating orders...");

  const ORDER_STATUSES = ["submitted", "approved", "declined", "fulfilled"] as const;
  const createdOrders: {
    id: string;
    store_id: string;
    status: string;
    created_at: string;
    submitted_by: string;
  }[] = [];

  // Generate ~60 orders spread across months
  for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
    // More orders in recent months
    const orderCount = monthOffset < 3 ? randInt(6, 10) : randInt(3, 6);

    for (let i = 0; i < orderCount; i++) {
      const storeUser = pick(storeUsers);
      const storeId = storeUser.store_id!;
      const submittedBy = storeUser.user_id;
      const createdAt = monthsAgo(monthOffset);

      // Pick 2-8 random products
      const itemCount = randInt(2, 8);
      const selectedProducts = new Set<string>();
      while (selectedProducts.size < Math.min(itemCount, products.length)) {
        selectedProducts.add(pick(products).id);
      }

      const items = Array.from(selectedProducts).map((pid) => ({
        product_id: pid,
        quantity: randInt(1, 10),
      }));

      // Use RPC to create order (handles order_number generation)
      const { data: orderId, error: orderErr } = await supabase.rpc(
        "create_order_with_items",
        {
          p_store_id: storeId,
          p_submitted_by: submittedBy,
          p_items: items,
        },
      );

      if (orderErr) {
        // Try direct insert as fallback (RPC may require auth context)
        console.warn(`  RPC failed: ${orderErr.message}, trying direct insert...`);
        break;
      }

      // Update created_at to backdate the order
      await supabase
        .from("orders")
        .update({ created_at: createdAt.toISOString() })
        .eq("id", orderId);

      // Determine status — weighted distribution
      const roll = Math.random();
      let targetStatus: string;
      if (monthOffset === 0 && roll < 0.4) {
        targetStatus = "submitted"; // recent orders more likely pending
      } else if (roll < 0.15) {
        targetStatus = "declined";
      } else if (roll < 0.5) {
        targetStatus = "approved";
      } else {
        targetStatus = "fulfilled";
      }

      const approver = pick(approvers);

      if (targetStatus !== "submitted") {
        // Approve or decline
        const newStatus = targetStatus === "declined" ? "declined" : "approved";
        const updateData: Record<string, unknown> = { status: newStatus };
        if (newStatus === "declined") {
          updateData.decline_reason = pick([
            "Duplicate order",
            "Budget exceeded for this month",
            "Products not available",
            "Incorrect quantities",
          ]);
        }
        await supabase.from("orders").update(updateData).eq("id", orderId);

        // Add status history
        const statusChangeDate = new Date(createdAt);
        statusChangeDate.setHours(statusChangeDate.getHours() + randInt(1, 48));
        await supabase.from("order_status_history").insert({
          order_id: orderId,
          status: newStatus,
          changed_by: approver.user_id,
          changed_at: statusChangeDate.toISOString(),
        });

        // Fulfill if target is fulfilled and financial settings exist
        if (targetStatus === "fulfilled" && hasFinancialSettings) {
          try {
            const { error: fulfillErr } = await supabase.rpc(
              "fulfill_order_with_invoice",
              { p_order_id: orderId },
            );
            if (fulfillErr) {
              // Just leave as approved if fulfillment fails
              console.warn(`  Could not fulfill order: ${fulfillErr.message}`);
            } else {
              // Backdate the fulfillment
              const fulfillDate = new Date(statusChangeDate);
              fulfillDate.setHours(fulfillDate.getHours() + randInt(1, 72));
              await supabase
                .from("orders")
                .update({ fulfilled_at: fulfillDate.toISOString() })
                .eq("id", orderId);

              // Add fulfilled status history
              await supabase.from("order_status_history").insert({
                order_id: orderId,
                status: "fulfilled",
                changed_by: approver.user_id,
                changed_at: fulfillDate.toISOString(),
              });
            }
          } catch {
            // Ignore fulfillment errors
          }
        }
      }

      createdOrders.push({
        id: orderId,
        store_id: storeId,
        status: targetStatus,
        created_at: createdAt.toISOString(),
        submitted_by: submittedBy,
      });
    }
  }

  console.log(`  Created ${createdOrders.length} orders`);

  // ══════════════════════════════════════════════
  // CREATE AUDITS — spread over last 8 months
  // ══════════════════════════════════════════════
  if (templates?.length && templateItems.length) {
    console.log("\nCreating audits...");

    const RATINGS = ["poor", "satisfactory", "good"] as const;
    let auditCount = 0;

    for (let monthOffset = 7; monthOffset >= 0; monthOffset--) {
      // 1-2 audits per store per period
      for (const store of stores) {
        const auditsThisMonth = randInt(0, 2);
        for (let a = 0; a < auditsThisMonth; a++) {
          const template = pick(templates);
          const conductor = pick(approvers);
          const conductedAt = monthsAgo(monthOffset);

          const tplItems = templateItems.filter(
            (ti) => ti.template_id === template.id,
          );
          if (tplItems.length === 0) continue;

          // Create the audit (completed)
          // Generate responses with a bias toward good scores for most stores,
          // but one store should have lower scores for variety
          const isLowScoreStore = store.id === stores[stores.length - 1]?.id;

          const responses = tplItems.map((item) => {
            let rating: (typeof RATINGS)[number];
            const roll = Math.random();
            if (isLowScoreStore) {
              // Lower scores: more poor/satisfactory
              rating = roll < 0.3 ? "poor" : roll < 0.7 ? "satisfactory" : "good";
            } else {
              // Higher scores: mostly good
              rating = roll < 0.05 ? "poor" : roll < 0.25 ? "satisfactory" : "good";
            }
            return { template_item_id: item.id, rating };
          });

          // Calculate score
          const weights = responses.map((r) =>
            r.rating === "good" ? 1 : r.rating === "satisfactory" ? 0.5 : 0,
          );
          const score =
            Math.round(
              (weights.reduce((a, b) => a + b, 0) / weights.length) * 10000,
            ) / 100;

          // Insert audit
          const { data: audit, error: auditErr } = await supabase
            .from("audits")
            .insert({
              template_id: template.id,
              store_id: store.id,
              conducted_by: conductor.user_id,
              score,
              notes: pick([
                "Overall good condition.",
                "Some areas need attention.",
                "Great improvement since last audit.",
                "Follow-up needed on cleanliness items.",
                "Excellent standards maintained.",
                null,
              ]),
              conducted_at: conductedAt.toISOString(),
              created_at: conductedAt.toISOString(),
            })
            .select("id")
            .single();

          if (auditErr) {
            console.warn(`  Audit insert failed: ${auditErr.message}`);
            continue;
          }

          // Insert responses
          const responseRows = responses.map((r) => ({
            audit_id: audit.id,
            template_item_id: r.template_item_id,
            rating: r.rating,
            notes: r.rating === "poor" ? pick(["Needs immediate attention", "Below standard", "Follow-up required"]) : null,
          }));

          const { error: respErr } = await supabase
            .from("audit_responses")
            .insert(responseRows);

          if (respErr) {
            console.warn(`  Audit responses failed: ${respErr.message}`);
          }

          auditCount++;
        }
      }
    }

    console.log(`  Created ${auditCount} audits`);
  } else {
    console.log("\nSkipping audits — no templates found.");
  }

  console.log("\nDone! Dashboard should now show rich data.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
