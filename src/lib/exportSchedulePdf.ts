import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function downloadSchedulePdf(args: {
  title: string;
  subtitle: string;
  headers: string[];
  body: string[][];
  filename: string;
}): void {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "letter",
  });

  doc.setFontSize(16);
  doc.text(args.title, 40, 36);
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(args.subtitle, 40, 52);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    head: [args.headers],
    body: args.body.map((row) =>
      row.map((cell) => cell.replace(/\n/g, " / "))
    ),
    startY: 64,
    margin: { left: 28, right: 28 },
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [232, 240, 250],
      textColor: [26, 26, 26],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 72, fontStyle: "bold" },
    },
  });

  doc.save(args.filename);
}
