import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Package,
  Clock,
  CheckCircle,
  DollarSign,
  ClipboardCheck,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  ShoppingBasket,
  Store,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { STATUS_STYLES, STATUS_LABELS } from "@/lib/constants/order-status";
import { getScoreColor, getScoreLabel } from "@/lib/constants/audit-status";
import type { OrderStatus } from "@/lib/types";

const ALL_STATUSES: OrderStatus[] = [
  "submitted",
  "approved",
  "declined",
  "fulfilled",
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/orders");

  // Fetch all data in parallel
  const [
    ordersResult,
    itemsResult,
    storesResult,
    completedAuditsResult,
    inProgressAuditsResult,
    invoicesResult,
    auditTemplatesResult,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, store_id, status, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("order_items")
      .select("order_id, product_name, modifier, unit_price, quantity"),
    supabase.from("stores").select("id, name"),
    supabase
      .from("audits")
      .select("id, store_id, template_id, score, conducted_at, created_at")
      .not("conducted_at", "is", null)
      .order("conducted_at", { ascending: false }),
    supabase
      .from("audits")
      .select("id", { count: "exact", head: true })
      .is("conducted_at", null),
    supabase
      .from("invoices")
      .select("id, store_id, grand_total, created_at"),
    supabase
      .from("audit_templates")
      .select("id, name"),
  ]);

  const orders = ordersResult.data ?? [];
  const items = itemsResult.data ?? [];
  const stores = storesResult.data ?? [];
  const completedAudits = completedAuditsResult.data ?? [];
  const inProgressCount = inProgressAuditsResult.count ?? 0;
  const invoices = invoicesResult.data ?? [];
  const auditTemplates = auditTemplatesResult.data ?? [];

  // Build store name map
  const storeNameMap: Record<string, string> = {};
  for (const store of stores) {
    storeNameMap[store.id] = store.name;
  }

  // Build order totals map
  const orderTotals: Record<string, number> = {};
  for (const item of items) {
    orderTotals[item.order_id] =
      (orderTotals[item.order_id] ?? 0) +
      Number(item.unit_price) * item.quantity;
  }

  // ── Order summary aggregates ──
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(
    (o) => o.status === "submitted",
  ).length;
  const approvedOrders = orders.filter((o) => o.status === "approved").length;
  const totalRevenue = orders
    .filter((o) => o.status === "approved" || o.status === "fulfilled")
    .reduce((sum, o) => sum + (orderTotals[o.id] ?? 0), 0);

  // Orders by status
  const statusCounts: Record<OrderStatus, number> = {
    submitted: 0,
    approved: 0,
    declined: 0,
    fulfilled: 0,
  };
  for (const order of orders) {
    const s = order.status as OrderStatus;
    if (s in statusCounts) statusCounts[s]++;
  }

  // Orders by store
  const storeAgg: Record<string, { count: number; total: number }> = {};
  for (const order of orders) {
    const existing = storeAgg[order.store_id] ?? { count: 0, total: 0 };
    existing.count++;
    existing.total += orderTotals[order.id] ?? 0;
    storeAgg[order.store_id] = existing;
  }

  // Recent orders (first 5)
  const recentOrders = orders.slice(0, 5);

  // ── Compliance aggregates (Story 7-1) ──
  const totalCompletedAudits = completedAudits.length;
  const avgScore =
    totalCompletedAudits > 0
      ? completedAudits.reduce((sum, a) => sum + (a.score ?? 0), 0) /
        totalCompletedAudits
      : 0;

  // Per-store compliance
  const storeCompliance: Record<
    string,
    { count: number; totalScore: number; lastDate: string }
  > = {};
  for (const audit of completedAudits) {
    const existing = storeCompliance[audit.store_id] ?? {
      count: 0,
      totalScore: 0,
      lastDate: "",
    };
    existing.count++;
    existing.totalScore += audit.score ?? 0;
    if (audit.conducted_at && audit.conducted_at > existing.lastDate) {
      existing.lastDate = audit.conducted_at;
    }
    storeCompliance[audit.store_id] = existing;
  }

  const storesBelow70 = Object.values(storeCompliance).filter(
    (s) => s.count > 0 && s.totalScore / s.count < 70,
  ).length;

  // Sort stores by avg score ascending (worst first)
  const complianceSorted = Object.entries(storeCompliance)
    .map(([storeId, data]) => ({
      storeId,
      storeName: storeNameMap[storeId] ?? storeId.slice(0, 8),
      count: data.count,
      avgScore: data.totalScore / data.count,
      lastDate: data.lastDate,
    }))
    .sort((a, b) => a.avgScore - b.avgScore);

  // Build template name map from parallel fetch
  const templateNameMap: Record<string, string> = {};
  for (const t of auditTemplates) {
    templateNameMap[t.id] = t.name;
  }

  const recentAudits = completedAudits.slice(0, 5);

  // ── Analytics aggregates (Story 7-2) ──
  // Monthly summary (last 6 months)
  const monthlyData: Record<string, { count: number; total: number }> = {};
  for (const order of orders) {
    const date = new Date(order.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthlyData[key] ?? { count: 0, total: 0 };
    existing.count++;
    existing.total += orderTotals[order.id] ?? 0;
    monthlyData[key] = existing;
  }
  const monthlySorted = Object.entries(monthlyData)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 6);

  // Top stores by invoice revenue
  const storeRevenue: Record<string, { count: number; total: number }> = {};
  for (const invoice of invoices) {
    const existing = storeRevenue[invoice.store_id] ?? {
      count: 0,
      total: 0,
    };
    existing.count++;
    existing.total += Number(invoice.grand_total);
    storeRevenue[invoice.store_id] = existing;
  }
  const topStores = Object.entries(storeRevenue)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 5);

  // Popular products
  const productQty: Record<
    string,
    { name: string; modifier: string; total: number }
  > = {};
  for (const item of items) {
    const key = `${item.product_name}|${item.modifier}`;
    const existing = productQty[key] ?? {
      name: item.product_name,
      modifier: item.modifier,
      total: 0,
    };
    existing.total += item.quantity;
    productQty[key] = existing;
  }
  const topProducts = Object.values(productQty)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // ── Formatting helpers ──
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });
  const monthFmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* ── Order Summary Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Orders
            </CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Approved Orders
            </CardTitle>
            <CheckCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Revenue
            </CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(totalRevenue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Orders by Status ── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Orders by Status</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ALL_STATUSES.map((status) => (
            <Card key={status}>
              <CardContent className="p-4 flex items-center gap-3">
                <Badge variant="status" style={STATUS_STYLES[status]}>
                  {STATUS_LABELS[status]}
                </Badge>
                <span className="text-xl font-bold ml-auto">
                  {statusCounts[status]}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Orders by Store ── */}
      {Object.keys(storeAgg).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Orders by Store</h2>
          <Card>
            <div className="divide-y">
              {Object.entries(storeAgg)
                .sort(([, a], [, b]) => b.count - a.count)
                .map(([storeId, agg]) => (
                  <div
                    key={storeId}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <span className="text-sm font-medium">
                      {storeNameMap[storeId] ?? storeId.slice(0, 8)}
                    </span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {agg.count} {agg.count === 1 ? "order" : "orders"}
                      </span>
                      <span className="font-medium">
                        {formatPrice(agg.total)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Recent Orders ── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Orders</h2>
        {recentOrders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No orders yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="divide-y">
              {recentOrders.map((order) => {
                const status = order.status as OrderStatus;
                return (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        Order {order.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dateFmt.format(new Date(order.created_at))}
                        {storeNameMap[order.store_id]
                          ? ` · ${storeNameMap[order.store_id]}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-medium">
                        {formatPrice(orderTotals[order.id] ?? 0)}
                      </span>
                      <Badge variant="status" style={STATUS_STYLES[status]}>
                        {STATUS_LABELS[status]}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* ── Compliance Overview (Story 7-1) ── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Compliance Overview</h2>

        {totalCompletedAudits === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ClipboardCheck className="mx-auto size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No audits yet</h3>
              <p className="text-sm text-muted-foreground">
                No audits have been conducted yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Compliance summary cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Audits
                  </CardTitle>
                  <ClipboardCheck className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {totalCompletedAudits}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Average Score
                  </CardTitle>
                  <BarChart3 className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {avgScore.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    In Progress
                  </CardTitle>
                  <Clock className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{inProgressCount}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Stores Below 70%
                  </CardTitle>
                  <AlertTriangle className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{storesBelow70}</div>
                </CardContent>
              </Card>
            </div>

            {/* Compliance by Store */}
            {complianceSorted.length > 0 && (
              <div className="mb-6">
                <h3 className="text-md font-semibold mb-2">
                  Compliance by Store
                </h3>
                <Card>
                  <div className="divide-y">
                    {complianceSorted.map((row) => (
                      <div
                        key={row.storeId}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <span className="text-sm font-medium">
                          {row.storeName}
                        </span>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            {row.count}{" "}
                            {row.count === 1 ? "audit" : "audits"}
                          </span>
                          <span
                            className={`font-medium px-2 py-0.5 rounded border ${getScoreColor(row.avgScore)}`}
                          >
                            {row.avgScore.toFixed(1)}% —{" "}
                            {getScoreLabel(row.avgScore)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Last: {dateFmt.format(new Date(row.lastDate))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* Recent Completed Audits */}
            <div>
              <h3 className="text-md font-semibold mb-2">Recent Audits</h3>
              <Card>
                <div className="divide-y">
                  {recentAudits.map((audit) => (
                    <Link
                      key={audit.id}
                      href={`/audits/${audit.id}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {templateNameMap[audit.template_id] ?? "Audit"} —{" "}
                          {storeNameMap[audit.store_id] ?? "Unknown Store"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {audit.conducted_at
                            ? dateFmt.format(new Date(audit.conducted_at))
                            : ""}
                        </p>
                      </div>
                      {audit.score !== null && (
                        <span
                          className={`text-sm font-medium px-2 py-0.5 rounded border shrink-0 ${getScoreColor(audit.score)}`}
                        >
                          {audit.score}% — {getScoreLabel(audit.score)}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* ── Order Analytics (Story 7-2) ── */}
      {orders.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Order Analytics</h2>

          {/* Monthly Summary */}
          {monthlySorted.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-semibold mb-2">Monthly Summary</h3>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-4 py-3 font-medium">Month</th>
                        <th className="px-4 py-3 font-medium text-right">
                          Orders
                        </th>
                        <th className="px-4 py-3 font-medium text-right">
                          Revenue
                        </th>
                        <th className="px-4 py-3 font-medium text-right">
                          Avg Order Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {monthlySorted.map(([key, data]) => {
                        const [year, month] = key.split("-");
                        const monthDate = new Date(
                          Number(year),
                          Number(month) - 1,
                        );
                        const avg =
                          data.count > 0 ? data.total / data.count : 0;
                        return (
                          <tr key={key}>
                            <td className="px-4 py-3">
                              {monthFmt.format(monthDate)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {data.count}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatPrice(data.total)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatPrice(avg)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* Top Stores by Revenue */}
          {topStores.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-semibold mb-2">
                Top Stores by Revenue
              </h3>
              <Card>
                <div className="divide-y">
                  {topStores.map(([storeId, data], idx) => (
                    <div
                      key={storeId}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-5">
                          #{idx + 1}
                        </span>
                        <Store className="size-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {storeNameMap[storeId] ?? storeId.slice(0, 8)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {data.count}{" "}
                          {data.count === 1 ? "invoice" : "invoices"}
                        </span>
                        <span className="font-medium">
                          {formatPrice(data.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Popular Products */}
          {topProducts.length > 0 && (
            <div>
              <h3 className="text-md font-semibold mb-2">Popular Products</h3>
              <Card>
                <div className="divide-y">
                  {topProducts.map((product, idx) => (
                    <div
                      key={`${product.name}|${product.modifier}`}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-5">
                          #{idx + 1}
                        </span>
                        <ShoppingBasket className="size-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-medium">
                            {product.name}
                          </span>
                          {product.modifier && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({product.modifier})
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-medium">
                        {product.total} units
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
