import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

  // Header
  doc.setFontSize(18);
  doc.text("Audit Report", 14, 22);

  doc.setFontSize(11);
  doc.text(`Store: ${storeName}`, 14, 32);
  doc.text(`Template: ${templateName}`, 14, 39);
  doc.text(`Conducted by: ${conductorName}`, 14, 46);
  if (audit.conducted_at) {
    doc.text(`Date: ${dateFmt.format(new Date(audit.conducted_at))}`, 14, 53);
  }
  if (audit.score !== null) {
    doc.text(`Score: ${audit.score}%`, 14, 60);
  }

  let startY = audit.score !== null ? 68 : 60;

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
