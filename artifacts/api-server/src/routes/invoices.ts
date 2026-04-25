import { Router, type IRouter, type Request } from "express";
import { SQL, and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db, invoicesTable, ordersTable, usersTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function formatInvoiceNumber(serial: number): string {
  return `INV-${String(serial).padStart(6, "0")}`;
}

function formatOrderNumber(serial: number): string {
  return `ORD-${String(serial).padStart(6, "0")}`;
}

function mapInvoice(invoice: typeof invoicesTable.$inferSelect, clientFirstName?: string | null, clientLastName?: string | null, clientMobile?: string | null) {
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
  const { invoiceType } = req.query as { invoiceType?: string };
  try {
    const conditions: SQL<unknown>[] = [];

    if (user.role === "technician") {
      conditions.push(eq(invoicesTable.technicianId, user.id));
      conditions.push(or(eq(invoicesTable.invoiceType, "technician"), isNull(invoicesTable.invoiceType)));
    } else if (user.role === "admin") {
      if (invoiceType && ["technician", "client", "admin"].includes(invoiceType)) {
        conditions.push(eq(invoicesTable.invoiceType, invoiceType as "technician" | "client" | "admin"));
      }
    } else {
      conditions.push(eq(invoicesTable.clientId, user.id));
      conditions.push(or(eq(invoicesTable.invoiceType, "client"), isNull(invoicesTable.invoiceType)));
    }

    const rows = await db
      .select({
        invoice: invoicesTable,
        clientFirstName: usersTable.firstName,
        clientLastName: usersTable.lastName,
        clientMobile: usersTable.mobile,
      })
      .from(invoicesTable)
      .leftJoin(usersTable, eq(invoicesTable.clientId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : sql`true`)
      .orderBy(desc(invoicesTable.createdAt));

    const invoices = rows.map(({ invoice, clientFirstName, clientLastName, clientMobile }) =>
      mapInvoice(invoice, clientFirstName, clientLastName, clientMobile)
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

router.post("/invoices", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;

  if (user.role !== "technician" && user.role !== "admin") {
    res.status(403).json({ error: "Only technicians and admins can create invoices" });
    return;
  }

  const { orderId, clientId, subtotal, taxRate = 14, noteAr, noteEn, category } = req.body as {
    orderId?: string;
    clientId?: string;
    subtotal: number;
    taxRate?: number;
    noteAr?: string;
    noteEn?: string;
    category?: string;
  };

  if (!subtotal || subtotal <= 0) {
    res.status(400).json({ error: "subtotal must be a positive number" });
    return;
  }

  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  try {
    let orderNumber: string | null = null;
    let resolvedClientId = clientId ?? null;

    if (orderId) {
      const orderRows = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .limit(1);

      if (orderRows.length) {
        const ord = orderRows[0]!;
        orderNumber = ord.orderNumber ?? formatOrderNumber(ord.orderSerial);
        resolvedClientId = resolvedClientId ?? ord.clientId;

        await db
          .update(ordersTable)
          .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
          .where(eq(ordersTable.id, orderId));
      }
    }

    const [inserted] = await db
      .insert(invoicesTable)
      .values({
        orderId: orderId ?? null,
        orderNumber: orderNumber ?? null,
        clientId: resolvedClientId,
        technicianId: user.role === "technician" ? user.id : null,
        category: category ?? null,
        subtotal: String(subtotal.toFixed(2)),
        taxRate: String(taxRate.toFixed(2)),
        taxAmount: String(taxAmount.toFixed(2)),
        total: String(total.toFixed(2)),
        currency: "EGP",
        status: "issued",
        noteAr: noteAr ?? null,
        noteEn: noteEn ?? null,
        issuedAt: new Date(),
      })
      .returning();

    logger.info({ invoiceSerial: inserted!.invoiceSerial, orderId }, "Invoice created");

    res.status(201).json({
      success: true,
      invoice: {
        id: inserted!.id,
        invoiceNumber: formatInvoiceNumber(inserted!.invoiceSerial),
        invoiceSerial: inserted!.invoiceSerial,
        total,
        status: inserted!.status,
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to create invoice");
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

router.patch("/invoices/:id/pay", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
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
    if (user.role !== "admin" && inv.technicianId !== user.id) {
      res.status(403).json({ error: "Only the assigned technician or admin can mark invoice as paid" });
      return;
    }

    if (inv.status === "paid") {
      res.status(409).json({ error: "Invoice is already paid" });
      return;
    }

    await db
      .update(invoicesTable)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(invoicesTable.id, id));

    res.json({ success: true, status: "paid" });
  } catch (err) {
    logger.error({ err, id }, "Failed to mark invoice as paid");
    res.status(500).json({ error: "Failed to update invoice" });
  }
});

router.patch("/invoices/:id/cancel", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
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
    if (user.role !== "admin" && inv.technicianId !== user.id) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    await db
      .update(invoicesTable)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(invoicesTable.id, id));

    res.json({ success: true, status: "cancelled" });
  } catch (err) {
    logger.error({ err, id }, "Failed to cancel invoice");
    res.status(500).json({ error: "Failed to cancel invoice" });
  }
});

export default router;
