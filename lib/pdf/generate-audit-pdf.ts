import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { INVOICE_LOGO_BASE64 } from "./invoice-logo";

interface AuditPdfCategory {
  name: string;
  items: {
    label: string;
    rating: string | null;
    notes: string | null;
  }[];
}

export function generateAuditPdf(
  audit: { id: string; score: number | null; conducted_at: string | null; notes: string | null },
  categories: AuditPdfCategory[],
  storeName: string,
  templateName: string,
  conductorName: string,
): Blob {
  const doc = new jsPDF();
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" });
  const rightX = 196;

  // ── Header: Logo + brand name (left) / Title + date (right) ──
  doc.addImage(INVOICE_LOGO_BASE64, "PNG", 14, 11, 16, 16);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Scotty Bons", 32, 18);
  doc.text("Caribbean Grill", 32, 24);

  doc.setFontSize(13);
  doc.text("Audit Report", rightX, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  if (audit.conducted_at) {
    doc.text(dateFmt.format(new Date(audit.conducted_at)), rightX, 23, {
      align: "right",
    });
  }

  // ── Score badge ──
  if (audit.score !== null) {
    const score = audit.score;
    const sColor = score >= 80
      ? { bg: [209, 250, 229] as [number, number, number], text: [6, 95, 70] as [number, number, number] }
      : score >= 50
        ? { bg: [255, 237, 213] as [number, number, number], text: [154, 52, 18] as [number, number, number] }
        : { bg: [254, 226, 226] as [number, number, number], text: [153, 27, 27] as [number, number, number] };
    const sLabel = `${score}%`;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const badgeW = doc.getTextWidth(sLabel) + 8;
    const badgeH = 6;
    const badgeX = rightX - badgeW;
    const badgeY = 26;
    doc.setFillColor(...sColor.bg);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, "F");
    doc.setTextColor(...sColor.text);
    doc.text(sLabel, badgeX + badgeW / 2, badgeY + 4.2, { align: "center" });
  }

  // ── Audit details ──
  let y = 40;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Store: ${storeName}`, 14, y); y += 6;
  doc.text(`Template: ${templateName}`, 14, y); y += 6;
  doc.text(`Conducted by: ${conductorName}`, 14, y); y += 6;

  let startY = y + 2;

  // Notes
  if (audit.notes) {
    doc.setFontSize(10);
    const wrappedNotes = doc.splitTextToSize(`Notes: ${audit.notes}`, 180);
    doc.text(wrappedNotes, 14, startY);
    startY += wrappedNotes.length * 5 + 5;
  }

  // Categories with items
  for (const category of categories) {
    if (category.items.length === 0) continue;

    const ratingLabels: Record<string, string> = {
      good: "Good",
      satisfactory: "Satisfactory",
      poor: "Poor",
    };

    const tableData = category.items.map((item) => [
      item.label,
      item.rating ? ratingLabels[item.rating] ?? item.rating : "—",
      item.notes ?? "",
    ]);

    autoTable(doc, {
      startY,
      head: [[category.name, "Rating", "Notes"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [24, 24, 27] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30 },
        2: { cellWidth: "auto" },
      },
      didParseCell: (data) => {
        // Color-code ratings
        if (data.section === "body" && data.column.index === 1) {
          const val = data.cell.text[0];
          if (val === "Good") data.cell.styles.textColor = [22, 101, 52];
          else if (val === "Satisfactory") data.cell.styles.textColor = [133, 77, 14];
          else if (val === "Poor") data.cell.styles.textColor = [153, 27, 27];
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    startY = (doc as any).lastAutoTable.finalY + 8;
  }

  return doc.output("blob");
}
