"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { OrderPdfData, OrderPdfItem } from "@/lib/pdf/generate-order-pdf";

interface ExportOrderPdfButtonProps {
  order: OrderPdfData;
  items: OrderPdfItem[];
}

export function ExportOrderPdfButton({
  order,
  items,
}: ExportOrderPdfButtonProps) {
  const [generating, setGenerating] = useState(false);

  async function handleExport() {
    setGenerating(true);
    try {
      const { generateOrderPdf } = await import("@/lib/pdf/generate-order-pdf");
      const { downloadPdf } = await import("@/lib/pdf/download-pdf");
      const blob = generateOrderPdf(order, items);
      const date = new Date().toISOString().slice(0, 10);
      downloadPdf(blob, `${order.order_number}-${date}.pdf`);
    } catch {
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={generating}
    >
      {generating ? (
        <>
          <Loader2 className="size-4 mr-1.5 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <FileDown className="size-4 mr-1.5" />
          Export PDF
        </>
      )}
    </Button>
  );
}
