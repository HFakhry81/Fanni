import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
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

router.get("/invoices", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
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
      .where(
        user.role === "technician"
          ? eq(invoicesTable.technicianId, user.id)
          : user.role === "admin"
            ? sql`true`
            : eq(invoicesTable.clientId, user.id)
      )
      .orderBy(desc(invoicesTable.createdAt));

    const invoices = rows.map(({ invoice, clientFirstName, clientLastName, clientMobile }) => ({
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
      subtotal: Number(invoice.subtotal),
      taxRate: Number(invoice.taxRate),
      taxAmount: Number(invoice.taxAmount),
      total: Number(invoice.total),
      currency: invoice.currency,
      status: invoice.status,
      noteAr: invoice.noteAr,
      noteEn: invoice.noteEn,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
      cancelledAt: invoice.cancelledAt,
      createdAt: invoice.createdAt,
    }));

    res.json({ invoices });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to fetch invoices");
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.get("/invoices/:id", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  const { id } = req.params;
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

    res.json({
      invoice: {
        ...inv,
        invoiceNumber: formatInvoiceNumber(inv.invoiceSerial),
        subtotal: Number(inv.subtotal),
        taxRate: Number(inv.taxRate),
        taxAmount: Number(inv.taxAmount),
        total: Number(inv.total),
      },
    });
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

router.patch("/invoices/:id/pay", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  const { id } = req.params;
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

router.patch("/invoices/:id/cancel", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  const { id } = req.params;
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
