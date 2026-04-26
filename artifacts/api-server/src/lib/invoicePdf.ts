import PDFDocument from "pdfkit";

export interface InvoiceData {
  orderNumber: string;
  issuedAt: Date;
  category: string;
  labourFee: number;
  transportFee: number;
  materialsTotal: number;
  serviceFeeRate: number;
  serviceFeeAmount: number;
  vatRate: number;
  vatAmount: number;
  baseSubtotal: number;
  clientTotal: number;
  techNetTotal: number;
  clientName: string;
  technicianName: string;
  clientEmail?: string | null;
  technicianEmail?: string | null;
}

function formatEGP(amount: number): string {
  return `EGP ${amount.toFixed(2)}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function buildPdfBuffer(drawFn: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    drawFn(doc);
    doc.end();
  });
}

function drawHeader(doc: PDFKit.PDFDocument, title: string, inv: InvoiceData) {
  doc.fontSize(22).fillColor("#F5A623").text("Fanni", 50, 50, { align: "left" });
  doc.fontSize(11).fillColor("#666").text("Home Maintenance Services", 50, 78, { align: "left" });

  doc.fontSize(18).fillColor("#333").text(title, 50, 50, { align: "right" });
  doc.fontSize(10).fillColor("#666").text(`Order #${inv.orderNumber}`, 50, 78, { align: "right" });
  doc.text(`Issued: ${formatDate(inv.issuedAt)}`, 50, 92, { align: "right" });

  doc.moveTo(50, 120).lineTo(545, 120).strokeColor("#F5A623").lineWidth(2).stroke();
}

function drawParties(doc: PDFKit.PDFDocument, inv: InvoiceData) {
  doc.y = 135;
  doc.fontSize(10).fillColor("#999").text("CLIENT", 50, doc.y);
  doc.fontSize(11).fillColor("#333").text(inv.clientName, 50, doc.y + 14);
  if (inv.clientEmail) doc.fontSize(10).fillColor("#666").text(inv.clientEmail, 50, doc.y + 14);

  doc.fontSize(10).fillColor("#999").text("TECHNICIAN", 300, 135);
  doc.fontSize(11).fillColor("#333").text(inv.technicianName, 300, 149);
  if (inv.technicianEmail) doc.fontSize(10).fillColor("#666").text(inv.technicianEmail, 300, 163);

  doc.fontSize(10).fillColor("#999").text("CATEGORY", 50, 185);
  doc.fontSize(11).fillColor("#333").text(inv.category, 50, 199);

  doc.moveTo(50, 222).lineTo(545, 222).strokeColor("#eee").lineWidth(1).stroke();
}

function drawLineRow(doc: PDFKit.PDFDocument, label: string, amount: number, y: number, bold = false, color = "#333") {
  doc.fontSize(bold ? 11 : 10).fillColor(color).font(bold ? "Helvetica-Bold" : "Helvetica").text(label, 50, y);
  doc.fontSize(bold ? 11 : 10).fillColor(color).font(bold ? "Helvetica-Bold" : "Helvetica").text(formatEGP(amount), 50, y, { align: "right" });
}

function drawDivider(doc: PDFKit.PDFDocument, y: number, heavy = false) {
  doc.moveTo(50, y).lineTo(545, y).strokeColor(heavy ? "#F5A623" : "#eee").lineWidth(heavy ? 2 : 1).stroke();
}

export async function generateClientInvoicePdf(inv: InvoiceData): Promise<Buffer> {
  return buildPdfBuffer((doc) => {
    drawHeader(doc, "Tax Invoice", inv);
    drawParties(doc, inv);

    let y = 238;
    doc.fontSize(10).fillColor("#999").font("Helvetica").text("DESCRIPTION", 50, y);
    doc.fontSize(10).fillColor("#999").text("AMOUNT", 50, y, { align: "right" });
    y += 18;
    drawDivider(doc, y);
    y += 10;

    drawLineRow(doc, "Labour Fee", inv.labourFee, y);
    y += 20;

    if (inv.transportFee > 0) {
      drawLineRow(doc, "Transport Fee", inv.transportFee, y);
      y += 20;
    }

    if (inv.materialsTotal > 0) {
      drawLineRow(doc, "Materials", inv.materialsTotal, y);
      y += 20;
    }

    drawDivider(doc, y + 2);
    y += 14;
    drawLineRow(doc, "Subtotal", inv.baseSubtotal, y);
    y += 20;

    drawLineRow(doc, `Service Fee (${inv.serviceFeeRate}%)`, inv.serviceFeeAmount, y, false, "#888");
    y += 20;

    drawLineRow(doc, `VAT (${inv.vatRate}%)`, inv.vatAmount, y, false, "#888");
    y += 16;

    drawDivider(doc, y, true);
    y += 14;
    drawLineRow(doc, "TOTAL DUE", inv.clientTotal, y, true, "#F5A623");

    y += 50;
    doc.fontSize(9).fillColor("#aaa").font("Helvetica").text("Thank you for using Fanni. Please retain this invoice for your records.", 50, y, { align: "center" });
  });
}

export async function generateTechnicianPayoutPdf(inv: InvoiceData): Promise<Buffer> {
  return buildPdfBuffer((doc) => {
    drawHeader(doc, "Payout Statement", inv);
    drawParties(doc, inv);

    let y = 238;
    doc.fontSize(10).fillColor("#999").font("Helvetica").text("DESCRIPTION", 50, y);
    doc.fontSize(10).fillColor("#999").text("AMOUNT", 50, y, { align: "right" });
    y += 18;
    drawDivider(doc, y);
    y += 10;

    drawLineRow(doc, "Labour Fee", inv.labourFee, y);
    y += 20;

    if (inv.transportFee > 0) {
      drawLineRow(doc, "Transport Fee", inv.transportFee, y);
      y += 20;
    }

    if (inv.materialsTotal > 0) {
      drawLineRow(doc, "Materials", inv.materialsTotal, y);
      y += 20;
    }

    drawDivider(doc, y + 2);
    y += 14;
    drawLineRow(doc, "Gross Total", inv.baseSubtotal, y);
    y += 20;

    drawLineRow(doc, `Platform Fee (${inv.serviceFeeRate}%)`, -inv.serviceFeeAmount, y, false, "#e55");
    y += 16;

    drawDivider(doc, y, true);
    y += 14;
    drawLineRow(doc, "YOUR PAYOUT", inv.techNetTotal, y, true, "#F5A623");

    y += 50;
    doc.fontSize(9).fillColor("#aaa").font("Helvetica").text("This is your payout statement from Fanni. Keep it for your records.", 50, y, { align: "center" });
  });
}
