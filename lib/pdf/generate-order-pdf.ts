import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function generateOrderPdf(
  order: { id: string; order_number: string; status: string; created_at: string },
  items: {
    product_name: string;
    modifier: string;
    quantity: number;
    unit_price: number;
  }[],
  storeName: string,
): Blob {
  const doc = new jsPDF();
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" });

  // Header
  doc.setFontSize(18);
  doc.text("Order Report", 14, 22);

  doc.setFontSize(11);
  doc.text(`Order: ${order.order_number}`, 14, 32);
  doc.text(`Store: ${storeName}`, 14, 39);
  doc.text(`Status: ${order.status}`, 14, 46);
  doc.text(
    `Date: ${dateFmt.format(new Date(order.created_at))}`,
    14,
    53,
  );

  // Items table
  const tableData = items.map((item) => [
    item.product_name,
    item.modifier,
    item.quantity.toString(),
    `$${Number(item.unit_price).toFixed(2)}`,
    `$${(Number(item.unit_price) * item.quantity).toFixed(2)}`,
  ]);

  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.unit_price) * i.quantity,
    0,
  );

  autoTable(doc, {
    startY: 60,
    head: [["Product", "Modifier", "Qty", "Unit Price", "Total"]],
    body: tableData,
    foot: [["", "", "", "Subtotal:", `$${subtotal.toFixed(2)}`]],
    theme: "striped",
    headStyles: { fillColor: [24, 24, 27] },
    footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold" },
  });

  return doc.output("blob");
}
