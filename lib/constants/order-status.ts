import type React from "react";
import type { OrderStatus } from "@/lib/types";

export const STATUS_STYLES: Record<OrderStatus, React.CSSProperties> = {
  submitted: { backgroundColor: "#fef3c7", color: "#92400e", borderColor: "#fbbf24" },
  approved: { backgroundColor: "#dcfce7", color: "#166534", borderColor: "#4ade80" },
  declined: { backgroundColor: "#fef2f2", color: "#991b1b", borderColor: "#fca5a5" },
  fulfilled: { backgroundColor: "#dbeafe", color: "#1e40af", borderColor: "#93c5fd" },
};

export const STATUS_BORDER_COLORS: Record<OrderStatus, string> = {
  submitted: "border-amber-400",
  approved: "border-green-400",
  declined: "border-red-300",
  fulfilled: "border-blue-300",
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  submitted: "Submitted",
  approved: "Approved",
  declined: "Declined",
  fulfilled: "Fulfilled",
};

export const TERMINAL_STATUSES: OrderStatus[] = ["approved", "declined", "fulfilled"];
