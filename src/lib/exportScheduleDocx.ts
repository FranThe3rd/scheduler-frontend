import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

function tableCell(text: string, bold = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold })],
      }),
    ],
  });
}

export async function buildScheduleDocxBlob(args: {
  title: string;
  subtitle: string;
  headers: string[];
  body: string[][];
}): Promise<Blob> {
  const headerRow = new TableRow({
    children: args.headers.map((h) => tableCell(h, true)),
  });
  const dataRows = args.body.map(
    (row) =>
      new TableRow({
        children: row.map((cell, i) =>
          tableCell(cell.replace(/\n/g, " / "), i === 0)
        ),
      })
  );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: args.title, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: args.subtitle }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
