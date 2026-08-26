import { Router, type IRouter, type Request } from "express";
import { SQL, and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, invoicesTable, usersTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const technicianUsersTable = alias(usersTable, "technician_user");

const router: IRouter = Router();

function formatInvoiceNumber(serial: number): string {
  return `INV-${String(serial).padStart(6, "0")}`;
}

function mapInvoice(
  invoice: typeof invoicesTable.$inferSelect,
  clientFirstName?: string | null,
  clientLastName?: string | null,
  clientMobile?: string | null,
  technicianFirstName?: string | null,
  technicianLastName?: string | null,
) {
  return {
    id: invoice.id,
    invoiceNumber: formatInvoiceNumber(invoice.invoiceSerial),
    invoiceSerial: invoice.invoiceSerial,
    orderId: invoice.orderId,
    orderNumber: invoice.orderNumber,
    clientId: invoice.clientId,
    clientName: clientFirstName && clientLastName ? `${clientFirstName} ${clientLastName}` : null,
    clientMobile: clientMobile ?? null,
    technicianId: invoice.technicianId,
    technicianName: technicianFirstName && technicianLastName ? `${technicianFirstName} ${technicianLastName}` : null,
    category: invoice.category,
    invoiceType: invoice.invoiceType ?? null,
    subtotal: Number(invoice.subtotal),
    taxRate: Number(invoice.taxRate),
    taxAmount: Number(invoice.taxAmount),
    total: Number(invoice.total),
    currency: invoice.currency,
    status: invoice.status,
    noteAr: invoice.noteAr,
    noteEn: invoice.noteEn,
    materialsPhotos: invoice.materialsPhotos ?? null,
    ocrLineItems: invoice.ocrLineItems ?? null,
    ocrMaterialsTotal: invoice.ocrMaterialsTotal !== null ? Number(invoice.ocrMaterialsTotal) : null,
    labourFee: invoice.labourFee !== null ? Number(invoice.labourFee) : null,
    transportFee: invoice.transportFee !== null ? Number(invoice.transportFee) : null,
    serviceFeeRate: invoice.serviceFeeRate !== null ? Number(invoice.serviceFeeRate) : null,
    serviceFeeAmount: invoice.serviceFeeAmount !== null ? Number(invoice.serviceFeeAmount) : null,
    vatRate: invoice.vatRate !== null ? Number(invoice.vatRate) : null,
    vatAmount: invoice.vatAmount !== null ? Number(invoice.vatAmount) : null,
    netTotal: invoice.netTotal !== null ? Number(invoice.netTotal) : null,
    issuedAt: invoice.issuedAt,
    paidAt: invoice.paidAt,
    cancelledAt: invoice.cancelledAt,
    createdAt: invoice.createdAt,
  };
}

router.get("/invoices", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  const { invoiceType, from, to } = req.query as { invoiceType?: string; from?: string; to?: string };
  try {
    const conditions: SQL<unknown>[] = [];

    if (user.role === "technician") {
      conditions.push(eq(invoicesTable.technicianId, user.id));
      conditions.push(or(eq(invoicesTable.invoiceType, "technician"), isNull(invoicesTable.invoiceType))!);
    } else if (user.role === "admin") {
      if (invoiceType && ["technician", "client", "admin"].includes(invoiceType)) {
        conditions.push(eq(invoicesTable.invoiceType, invoiceType as "technician" | "client" | "admin"));
      }
      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) conditions.push(gte(invoicesTable.createdAt, fromDate));
      }
      if (to) {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          conditions.push(lte(invoicesTable.createdAt, toDate));
        }
      }
    } else {
      conditions.push(eq(invoicesTable.clientId, user.id));
      conditions.push(or(eq(invoicesTable.invoiceType, "client"), isNull(invoicesTable.invoiceType))!);
    }

    const rows = await db
      .select({
        invoice: invoicesTable,
        clientFirstName: usersTable.firstName,
        clientLastName: usersTable.lastName,
        clientMobile: usersTable.mobile,
        technicianFirstName: technicianUsersTable.firstName,
        technicianLastName: technicianUsersTable.lastName,
      })
      .from(invoicesTable)
      .leftJoin(usersTable, eq(invoicesTable.clientId, usersTable.id))
      .leftJoin(technicianUsersTable, eq(invoicesTable.technicianId, technicianUsersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : sql`true`)
      .orderBy(desc(invoicesTable.createdAt));

    const invoices = rows.map(({ invoice, clientFirstName, clientLastName, clientMobile, technicianFirstName, technicianLastName }) =>
      mapInvoice(invoice, clientFirstName, clientLastName, clientMobile, technicianFirstName, technicianLastName)
    );

    res.json({ invoices });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to fetch invoices");
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.get("/invoices/order/:orderId", authMiddleware, requireAuth, async (req: Request<{ orderId: string }>, res) => {
  const user = req.user!;
  const orderId = req.params.orderId;
  try {
    const rows = await db
      .select({
        invoice: invoicesTable,
        clientFirstName: usersTable.firstName,
        clientLastName: usersTable.lastName,
        clientMobile: usersTable.mobile,
      })
      .from(invoicesTable)
      .leftJoin(usersTable, eq(invoicesTable.clientId, usersTable.id))
      .where(eq(invoicesTable.orderId, orderId))
      .orderBy(invoicesTable.invoiceSerial);

    const allInvoices = rows.map(({ invoice, clientFirstName, clientLastName, clientMobile }) =>
      mapInvoice(invoice, clientFirstName, clientLastName, clientMobile)
    );

    if (user.role === "admin") {
      const technicianInvoice = allInvoices.find((i) => i.invoiceType === "technician") ?? null;
      const clientInvoice = allInvoices.find((i) => i.invoiceType === "client") ?? null;
      const adminLedger = allInvoices.find((i) => i.invoiceType === "admin") ?? null;
      res.json({ invoices: allInvoices, technicianInvoice, clientInvoice, adminLedger });
      return;
    }

    if (user.role === "technician") {
      const technicianInvoice = allInvoices.find(
        (i) => (i.invoiceType === "technician" || i.invoiceType == null) && i.technicianId === user.id
      ) ?? null;
      if (!technicianInvoice) {
        res.json({ invoices: [], technicianInvoice: null });
        return;
      }
      res.json({ invoices: [technicianInvoice], technicianInvoice });
      return;
    }

    const clientInvoice = allInvoices.find(
      (i) => (i.invoiceType === "client" || i.invoiceType == null) && i.clientId === user.id
    ) ?? null;
    if (!clientInvoice) {
      res.json({ invoices: [], clientInvoice: null });
      return;
    }
    res.json({ invoices: [clientInvoice], clientInvoice });
  } catch (err) {
    logger.error({ err, orderId }, "Failed to fetch invoices for order");
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.get("/invoices/:id", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const id = req.params.id;
  try {
    const rows = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, id))
      .limit(1);

    if (!rows.length) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const inv = rows[0]!;
    if (
      user.role !== "admin" &&
      inv.clientId !== user.id &&
      inv.technicianId !== user.id
    ) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    res.json({ invoice: mapInvoice(inv) });
  } catch (err) {
    logger.error({ err, id }, "Failed to fetch invoice");
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
});

router.post("/invoices", authMiddleware, requireAuth, async (_req, res) => {
  // Job/purchase invoices retired — platform revenue is lead-unlock commission only.
  res.status(410).json({
    error: "Job invoices are disabled. Platform accounting is commission-only (lead unlock / points).",
    code: "JOB_INVOICES_RETIRED",
  });
});

router.patch("/invoices/:id/pay", authMiddleware, requireAuth, async (_req, res) => {
  res.status(410).json({
    error: "Job invoices are disabled. Platform accounting is commission-only (lead unlock / points).",
    code: "JOB_INVOICES_RETIRED",
  });
});

router.patch("/invoices/:id/cancel", authMiddleware, requireAuth, async (_req, res) => {
  res.status(410).json({
    error: "Job invoices are disabled. Platform accounting is commission-only (lead unlock / points).",
    code: "JOB_INVOICES_RETIRED",
  });
});

export default router;
