import type { OrderStatus } from "@/lib/types";

export const STATUS_COLORS: Record<OrderStatus, string> = {
  submitted: "bg-gray-500 text-white",
  under_review: "bg-amber-500 text-white",
  approved: "bg-green-600 text-white",
  declined: "bg-red-600 text-white",
  fulfilled: "bg-blue-600 text-white",
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  declined: "Declined",
  fulfilled: "Fulfilled",
};

export const TERMINAL_STATUSES: OrderStatus[] = ["approved", "declined", "fulfilled"];
