import { Router, type IRouter, type Request } from "express";
import { sql, desc, eq, and, inArray, not } from "drizzle-orm";
import { broadcastNewOrder, broadcastOrderStatusToClient, removeOrderFromPending, broadcastOrderCancelledToTechnicians } from "../lib/orderBroadcaster";
import { logger } from "../lib/logger";
import { db, ordersTable, invoicesTable, pool, usersTable, walletsTable, leadUnlocksTable, unlockCostsTable, walletTransactionsTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { normalizeToSlug, isSlug, validateAreaBelongsToGovernorate } from "../lib/locationNormalizer";
import { queryString } from "../lib/queryParams";
import { sendOrderStatusPushNotification } from "../lib/pushNotifications";
import { sendInvoiceEmails } from "../lib/email";

const router: IRouter = Router();

function formatOrderNumber(serial: number): string {
  return `ORD-${String(serial).padStart(6, "0")}`;
}

type DbStatus = "pending" | "acknowledged" | "in_progress" | "completed" | "cancelled";
type MobileStatus = "pending" | "accepted" | "inProgress" | "completed" | "cancelled";

function toMobileStatus(dbStatus: DbStatus): MobileStatus {
  if (dbStatus === "acknowledged") return "accepted";
  if (dbStatus === "in_progress") return "inProgress";
  return dbStatus as MobileStatus;
}

router.get("/orders/pending", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;

  if (user.role !== "technician" && user.role !== "admin") {
    res.status(403).json({ error: "Only technicians can access pending orders" });
    return;
  }

  const governorate = queryString(req.query.governorate);
  const area = queryString(req.query.area);

  try {
    const conditions = [eq(ordersTable.status, "pending")];
    if (governorate) {
      conditions.push(eq(ordersTable.governorate, governorate));
    }
    if (area) {
      conditions.push(eq(ordersTable.area, area));
    }

    const rows = await db
      .select()
      .from(ordersTable)
      .where(and(...conditions))
      .orderBy(desc(ordersTable.createdAt));

    const orders = rows.map((row) => {
      const data = row.data as Record<string, unknown>;
      return {
        id: row.id,
        orderNumber: row.orderNumber,
        orderSerial: row.orderSerial,
        status: toMobileStatus(row.status as DbStatus),
        createdAt: row.createdAt,
        category: row.category ?? data.category,
        subCategory: data.subCategory,
        street: data.street,
        floor: data.floor,
        visitDate: data.visitDate,
        visitTime: data.visitTime,
        technicianId: row.technicianId ?? data.technicianId ?? null,
        technicianName: data.technicianName ?? null,
        technicianMobile: data.technicianMobile ?? null,
        technicianAvatar: data.technicianAvatar ?? null,
        technicianRating: data.technicianRating ?? null,
        problemDescription: data.problemDescription,
        deviceType: data.deviceType,
        building: data.building,
        apartment: data.apartment,
        landmark: data.landmark,
        governorate: row.governorate ?? data.governorate ?? null,
        area: row.area ?? data.area ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        clientId: row.clientId ?? data.clientId,
        clientName: data.clientName,
        clientMobile: data.clientMobile,
        photos: data.photos ?? [],
        materials: data.materials ?? null,
        solutionDescription: data.solutionDescription ?? null,
        invoice: data.invoice ?? null,
        clientRating: data.clientRating ?? null,
        clientComment: data.clientComment ?? null,
      };
    });

    res.json({ orders });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to fetch pending orders for technician");
    res.status(500).json({ error: "Failed to fetch pending orders" });
  }
});

router.get("/orders", authMiddleware, requireAuth, async (req, res) => {
  const userId = req.user!.id;

  try {
    const rows = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.clientId, userId))
      .orderBy(desc(ordersTable.createdAt));

    const orders = rows.map((row) => {
      const data = row.data as Record<string, unknown>;
      return {
        id: row.id,
        orderNumber: row.orderNumber,
        orderSerial: row.orderSerial,
        status: toMobileStatus(row.status as DbStatus),
        createdAt: row.createdAt,
        category: row.category ?? data.category,
        subCategory: data.subCategory,
        street: data.street,
        floor: data.floor,
        visitDate: data.visitDate,
        visitTime: data.visitTime,
        technicianId: row.technicianId ?? data.technicianId ?? null,
        technicianName: data.technicianName ?? null,
        technicianMobile: data.technicianMobile ?? null,
        technicianAvatar: data.technicianAvatar ?? null,
        technicianRating: data.technicianRating ?? null,
        problemDescription: data.problemDescription,
        deviceType: data.deviceType,
        building: data.building,
        apartment: data.apartment,
        landmark: data.landmark,
        governorate: row.governorate ?? data.governorate ?? null,
        area: row.area ?? data.area ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        clientId: row.clientId ?? data.clientId,
        clientName: data.clientName,
        clientMobile: data.clientMobile,
        photos: data.photos ?? [],
        materials: data.materials ?? null,
        solutionDescription: data.solutionDescription ?? null,
        invoice: data.invoice ?? null,
        clientRating: data.clientRating ?? null,
        clientComment: data.clientComment ?? null,
      };
    });

    res.json({ orders });
  } catch (err) {
    logger.error({ err, userId }, "Failed to fetch orders for client");
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.post("/orders", authMiddleware, requireAuth, async (req, res) => {
  const order = req.body;
  const user = req.user!;

  if (!order || !order.id || !order.category) {
    res.status(400).json({ error: "Invalid order payload: id and category are required" });
    return;
  }

  const rawGovernorate = (order.governorate as string | undefined) ?? null;
  const rawArea = (order.area as string | undefined) ?? null;

  const [normalizedGovernorate, normalizedArea] = await Promise.all([
    normalizeToSlug(rawGovernorate, "governorate"),
    normalizeToSlug(rawArea, "area"),
  ]);

  if (rawGovernorate && normalizedGovernorate !== rawGovernorate) {
    logger.info({ raw: rawGovernorate, normalized: normalizedGovernorate }, "Normalized order governorate to slug");
  }
  if (rawArea && normalizedArea !== rawArea) {
    logger.info({ raw: rawArea, normalized: normalizedArea }, "Normalized order area to slug");
  }

  if (rawGovernorate && normalizedGovernorate === null) {
    logger.warn({ raw: rawGovernorate }, "Order rejected: governorate could not be matched to any known location");
    res.status(400).json({
      error: `Invalid governorate: "${rawGovernorate}" could not be matched to a known location. Please use a valid governorate name.`,
    });
    return;
  }
  if (rawArea && normalizedArea === null) {
    logger.warn({ raw: rawArea }, "Order rejected: area could not be matched to any known location");
    res.status(400).json({
      error: `Invalid area: "${rawArea}" could not be matched to a known location. Please use a valid area name.`,
    });
    return;
  }
  if (normalizedGovernorate !== null && !isSlug(normalizedGovernorate)) {
    logger.warn({ raw: rawGovernorate, normalized: normalizedGovernorate }, "Order rejected: governorate did not normalize to a valid slug format");
    res.status(400).json({
      error: `Invalid governorate: "${rawGovernorate}" did not resolve to a recognized slug. Please use a valid governorate name.`,
    });
    return;
  }
  if (normalizedArea !== null && !isSlug(normalizedArea)) {
    logger.warn({ raw: rawArea, normalized: normalizedArea }, "Order rejected: area did not normalize to a valid slug format");
    res.status(400).json({
      error: `Invalid area: "${rawArea}" did not resolve to a recognized slug. Please use a valid area name.`,
    });
    return;
  }

  if (normalizedGovernorate !== null && normalizedArea !== null) {
    const areaMatchesGovernorate = await validateAreaBelongsToGovernorate(normalizedArea, normalizedGovernorate);
    if (!areaMatchesGovernorate) {
      logger.warn(
        { governorate: normalizedGovernorate, area: normalizedArea },
        "Order rejected: area does not belong to the submitted governorate",
      );
      res.status(400).json({
        error: `Invalid location: area "${normalizedArea}" does not belong to governorate "${normalizedGovernorate}". Please provide a matching area and governorate.`,
      });
      return;
    }
  }

  const routingMeta = {
    category: order.category as string,
    governorate: normalizedGovernorate,
    area: normalizedArea,
  };

  try {
    const [inserted] = await db
      .insert(ordersTable)
      .values({
        id: order.id,
        orderNumber: String(order.orderNumber ?? ""),
        status: "pending",
        clientId: user.id,
        technicianId: null,
        category: order.category as string,
        governorate: routingMeta.governorate,
        area: routingMeta.area,
        street: (order.street as string | undefined)?.trim() || null,
        buildingNo: (order.buildingNo as string | undefined)?.trim() || null,
        floorNo: (order.floorNo as string | undefined)?.trim() || null,
        aptNo: (order.aptNo as string | undefined)?.trim() || null,
        data: order,
      })
      .onConflictDoNothing()
      .returning({ orderSerial: ordersTable.orderSerial, id: ordersTable.id });

    if (inserted) {
      const dbOrderNumber = formatOrderNumber(inserted.orderSerial);
      await db
        .update(ordersTable)
        .set({ orderNumber: dbOrderNumber, updatedAt: new Date() })
        .where(eq(ordersTable.id, order.id));

      const lat = parseFloat(order.latitude ?? order.data?.latitude);
      const lon = parseFloat(order.longitude ?? order.data?.longitude);
      if (!isNaN(lat) && !isNaN(lon)) {
        try {
          const client = await pool.connect();
          try {
            await client.query(
              `UPDATE orders SET location = ST_SetSRID(ST_MakePoint($1,$2),4326)::geography WHERE id = $3`,
              [lon, lat, String(order.id)],
            );
          } finally {
            client.release();
          }
        } catch {
          logger.warn({ orderId: order.id }, "PostGIS location update skipped (extension may not be installed)");
        }
      }

      const fullOrder = { ...order, orderNumber: dbOrderNumber, orderSerial: inserted.orderSerial };
      void broadcastNewOrder(fullOrder);
      logger.info({ orderId: order.id, orderNumber: dbOrderNumber, orderSerial: inserted.orderSerial }, "Order saved to database");
      res.status(201).json({ success: true, orderId: order.id, orderNumber: dbOrderNumber });
    } else {
      void broadcastNewOrder(order);
      res.status(201).json({ success: true, orderId: order.id });
    }
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Failed to save order to database");
    res.status(500).json({ error: "Failed to persist order" });
  }
});

// ── Unlock order contact details (spend points) ──────────────────────────────
router.post("/orders/:id/unlock", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const orderId = req.params.id;

  if (user.role !== "technician") {
    res.status(403).json({ error: "Only technicians can unlock orders" });
    return;
  }

  try {
    // Check order exists and is still pending
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.status !== "pending") { res.status(409).json({ error: "Order is no longer available" }); return; }

    // Check if already unlocked
    const [existing] = await db.select().from(leadUnlocksTable)
      .where(and(eq(leadUnlocksTable.technicianId, user.id), eq(leadUnlocksTable.orderId, orderId)));
    if (existing) {
      const data = order.data as Record<string, unknown>;
      res.json({
        alreadyUnlocked: true,
        unlock: existing,
        contact: {
          clientName: data.clientName,
          clientMobile: data.clientMobile,
          street: data.street ?? null,
          building: data.building ?? null,
          floor: data.floor ?? null,
          apartment: data.apartment ?? null,
          landmark: data.landmark ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        },
      });
      return;
    }

    // Determine unlock cost
    let costPoints = 15;
    try {
      const [defCost] = await db.select().from(unlockCostsTable)
        .where(and(sql`specialty_slug IS NULL`, sql`category_slug IS NULL`));
      if (defCost) costPoints = defCost.pointsCost;
    } catch { /* fall back */ }

    // Get or create wallet
    const [walletRow] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
    let wallet = walletRow;
    if (!wallet) {
      const [created] = await db.insert(walletsTable).values({ userId: user.id }).returning();
      wallet = created!;
    }

    if (wallet.pointsBalance < costPoints) {
      res.status(402).json({ error: "Insufficient points", balance: wallet.pointsBalance, required: costPoints });
      return;
    }

    // Deduct points and record unlock atomically
    const newBalance = wallet.pointsBalance - costPoints;
    await db.update(walletsTable).set({ pointsBalance: newBalance, updatedAt: new Date() }).where(eq(walletsTable.id, wallet.id));
    const [unlock] = await db.insert(leadUnlocksTable).values({
      technicianId: user.id,
      orderId,
      pointsDeducted: costPoints,
    }).returning();
    await db.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      pointsAmount: -costPoints,
      type: "lead_unlock",
      description: `Unlock order ${orderId}`,
      orderId,
    });

    const data = order.data as Record<string, unknown>;
    logger.info({ techId: user.id, orderId, costPoints, newBalance }, "Order unlocked");
    res.json({
      alreadyUnlocked: false,
      unlock,
      newBalance,
      contact: {
        clientName: data.clientName,
        clientMobile: data.clientMobile,
        street: data.street ?? null,
        building: data.building ?? null,
        floor: data.floor ?? null,
        apartment: data.apartment ?? null,
        landmark: data.landmark ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, orderId }, "Failed to unlock order");
    res.status(500).json({ error: "Failed to unlock order" });
  }
});

// ── Track call/whatsapp click after unlock ────────────────────────────────────
router.patch("/orders/:id/unlock/track", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  if (user.role !== "technician") { res.status(403).json({ error: "Forbidden" }); return; }
  const { action } = req.body as { action?: "call" | "whatsapp" };
  if (action !== "call" && action !== "whatsapp") { res.status(400).json({ error: "action must be call or whatsapp" }); return; }
  try {
    const updates = action === "call" ? { clickedCall: true } : { clickedWhatsapp: true };
    await db.update(leadUnlocksTable).set(updates)
      .where(and(eq(leadUnlocksTable.technicianId, user.id), eq(leadUnlocksTable.orderId, req.params.id)));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to track unlock action");
    res.status(500).json({ error: "Failed to track" });
  }
});

router.patch("/orders/:id/acknowledge", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const id = req.params.id;

  if (user.role !== "technician" && user.role !== "admin") {
    res.status(403).json({ error: "Only technicians can acknowledge orders" });
    return;
  }

  const {
    technicianName,
    technicianMobile,
    technicianAvatar,
    technicianRating,
  } = req.body as {
    technicianName?: string;
    technicianMobile?: string;
    technicianAvatar?: string;
    technicianRating?: number;
  };

  const dataPatch: Record<string, unknown> = {
    status: "acknowledged",
    technicianId: user.id,
  };
  if (technicianName !== undefined) dataPatch.technicianName = technicianName;
  if (technicianMobile !== undefined) dataPatch.technicianMobile = technicianMobile;
  if (technicianAvatar !== undefined) dataPatch.technicianAvatar = technicianAvatar;
  if (technicianRating !== undefined) dataPatch.technicianRating = technicianRating;

  try {
    let updated: { clientId: string | null } | undefined;

    await db.transaction(async (tx) => {
      const locked = await tx.execute(
        sql`SELECT id FROM orders WHERE id = ${id} AND status = 'pending' FOR UPDATE SKIP LOCKED`,
      );
      if (locked.rows.length === 0) {
        return;
      }

      const rows = await tx
        .update(ordersTable)
        .set({
          status: "acknowledged",
          technicianId: user.id,
          acknowledgedAt: new Date(),
          updatedAt: new Date(),
          data: sql`${ordersTable.data} || ${JSON.stringify(dataPatch)}::jsonb`,
        })
        .where(and(eq(ordersTable.id, id), eq(ordersTable.status, "pending")))
        .returning({ clientId: ordersTable.clientId });

      updated = rows[0];
    });

    if (!updated) {
      res.status(409).json({ error: "Order already accepted by another technician" });
      return;
    }

    removeOrderFromPending(id);
    logger.info({ id, technicianId: user.id }, "Order acknowledged and data JSONB updated");

    if (updated?.clientId) {
      broadcastOrderStatusToClient(updated.clientId, {
        id,
        status: "accepted",
        technicianId: user.id,
        ...(technicianName !== undefined && { technicianName }),
        ...(technicianMobile !== undefined && { technicianMobile }),
        ...(technicianAvatar !== undefined && { technicianAvatar }),
        ...(technicianRating !== undefined && { technicianRating }),
      });

      void (async () => {
        try {
          const [orderRow] = await db
            .select({ orderNumber: ordersTable.orderNumber, clientId: ordersTable.clientId })
            .from(ordersTable)
            .where(eq(ordersTable.id, id))
            .limit(1);
          if (orderRow?.clientId) {
            const [clientRow] = await db
              .select({ expoPushToken: usersTable.expoPushToken })
              .from(usersTable)
              .where(eq(usersTable.id, orderRow.clientId))
              .limit(1);
            if (clientRow?.expoPushToken) {
              await sendOrderStatusPushNotification(clientRow.expoPushToken, id, orderRow.orderNumber ?? id, "accepted");
            }
          }
        } catch (pushErr) {
          logger.warn({ pushErr, orderId: id }, "Failed to send accepted push notification");
        }
      })();
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Failed to acknowledge order");
    res.status(500).json({ error: "Failed to acknowledge order" });
  }
});

router.patch("/orders/:id/confirm-arrival", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const id = req.params.id;

  if (user.role !== "client") {
    res.status(403).json({ error: "Only clients can confirm arrival" });
    return;
  }

  try {
    const [existing] = await db
      .select({ clientId: ordersTable.clientId, status: ordersTable.status })
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (existing.clientId !== user.id) {
      res.status(403).json({ error: "You are not the client for this order" });
      return;
    }

    if (existing.status !== "acknowledged") {
      res.status(409).json({ error: "Order is not in an acknowledged state" });
      return;
    }

    await db
      .update(ordersTable)
      .set({
        status: "in_progress",
        updatedAt: new Date(),
        data: sql`${ordersTable.data} || '{"status":"inProgress"}'::jsonb`,
      })
      .where(eq(ordersTable.id, id));

    logger.info({ id, clientId: user.id }, "Client confirmed technician arrival — order in_progress");

    broadcastOrderStatusToClient(user.id, { id, status: "inProgress" });

    void (async () => {
      try {
        const [orderRow] = await db
          .select({ orderNumber: ordersTable.orderNumber })
          .from(ordersTable)
          .where(eq(ordersTable.id, id))
          .limit(1);
        const [clientRow] = await db
          .select({ expoPushToken: usersTable.expoPushToken })
          .from(usersTable)
          .where(eq(usersTable.id, user.id))
          .limit(1);
        if (clientRow?.expoPushToken) {
          await sendOrderStatusPushNotification(clientRow.expoPushToken, id, orderRow?.orderNumber ?? id, "inProgress");
        }
      } catch (pushErr) {
        logger.warn({ pushErr, orderId: id }, "Failed to send inProgress push notification (confirm-arrival)");
      }
    })();

    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Failed to confirm arrival");
    res.status(500).json({ error: "Failed to confirm arrival" });
  }
});

router.patch("/orders/:id/start", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const id = req.params.id;

  if (user.role !== "technician" && user.role !== "admin") {
    res.status(403).json({ error: "Only technicians can start orders" });
    return;
  }

  try {
    const [updated] = await db
      .update(ordersTable)
      .set({
        status: "in_progress",
        updatedAt: new Date(),
        data: sql`${ordersTable.data} || '{"status":"inProgress"}'::jsonb`,
      })
      .where(eq(ordersTable.id, id))
      .returning({ clientId: ordersTable.clientId });

    logger.info({ id, technicianId: user.id }, "Order started (in_progress)");

    if (updated?.clientId) {
      broadcastOrderStatusToClient(updated.clientId, { id, status: "inProgress" });

      void (async () => {
        try {
          const [orderRow] = await db
            .select({ orderNumber: ordersTable.orderNumber })
            .from(ordersTable)
            .where(eq(ordersTable.id, id))
            .limit(1);
          const [clientRow] = await db
            .select({ expoPushToken: usersTable.expoPushToken })
            .from(usersTable)
            .where(eq(usersTable.id, updated.clientId!))
            .limit(1);
          if (clientRow?.expoPushToken) {
            await sendOrderStatusPushNotification(clientRow.expoPushToken, id, orderRow?.orderNumber ?? id, "inProgress");
          }
        } catch (pushErr) {
          logger.warn({ pushErr, orderId: id }, "Failed to send inProgress push notification (start)");
        }
      })();
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Failed to start order");
    res.status(500).json({ error: "Failed to start order" });
  }
});

router.patch("/orders/:id/complete", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const id = req.params.id;

  if (user.role !== "technician" && user.role !== "admin") {
    res.status(403).json({ error: "Only technicians can complete orders" });
    return;
  }

  const {
    solutionDescription,
    clientSatisfaction,
    materials,
    invoice,
    labourFee,
    transportFee,
    materialsTotal,
    materialPhotos,
    ocrLineItems,
  } = req.body as {
    solutionDescription?: string;
    clientSatisfaction?: string;
    materials?: unknown[];
    invoice?: unknown;
    labourFee?: number;
    transportFee?: number;
    materialsTotal?: number;
    materialPhotos?: string[];
    ocrLineItems?: Array<{
      supplier?: string | null;
      date?: string | null;
      items?: Array<{ description: string; qty: number; unit?: string | null; unitPrice: number; totalPrice: number }>;
      detectedTotal?: number;
    }>;
  };

  const dataPatch: Record<string, unknown> = { status: "completed" };
  if (solutionDescription !== undefined) dataPatch.solutionDescription = solutionDescription;
  if (clientSatisfaction !== undefined) dataPatch.clientSatisfaction = clientSatisfaction;
  if (materials !== undefined) dataPatch.materials = materials;
  if (invoice !== undefined) dataPatch.invoice = invoice;

  if (labourFee === undefined || Number(labourFee) <= 0) {
    res.status(400).json({ error: "labourFee is required and must be greater than 0" });
    return;
  }
  if (!materialPhotos || materialPhotos.length === 0) {
    res.status(400).json({ error: "At least one material receipt photo is required (materialPhotos)" });
    return;
  }

  try {
    const labour = Number(labourFee);
    const transport = Number(transportFee ?? 0);
    const matTotal = Number(materialsTotal ?? 0);
    const SERVICE_FEE_RATE = 15;
    const VAT_RATE = 14;

    const serviceFeeAmount = (labour * SERVICE_FEE_RATE) / 100;
    const vatAmount = (labour * VAT_RATE) / 100;
    const baseSubtotal = matTotal + transport + labour;
    const techNetTotal = baseSubtotal - serviceFeeAmount;
    const clientTotal = baseSubtotal + serviceFeeAmount + vatAmount;
    const adminTotal = serviceFeeAmount * 2 + vatAmount;

    let finalClientId: string | null = null;
    let finalTechnicianId: string | null = null;
    let finalOrderNumber: string | null = null;
    let finalCategory: string | null = null;

    await db.transaction(async (tx) => {
      const [orderRow] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, id))
        .limit(1);

      if (!orderRow) {
        throw new Error("ORDER_NOT_FOUND");
      }

      if (user.role === "technician" && orderRow.technicianId !== user.id) {
        throw new Error("ORDER_FORBIDDEN");
      }

      if (orderRow.status === "completed") {
        throw new Error("ORDER_ALREADY_COMPLETED");
      }

      finalClientId = orderRow.clientId;
      finalTechnicianId = user.role === "technician" ? user.id : orderRow.technicianId;
      finalOrderNumber = orderRow.orderNumber;
      finalCategory = orderRow.category;

      await tx
        .update(ordersTable)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
          data: sql`${ordersTable.data} || ${JSON.stringify(dataPatch)}::jsonb`,
        })
        .where(eq(ordersTable.id, id));

      const photosJson = materialPhotos;
      const ocrJson = ocrLineItems ?? [];

      await tx.insert(invoicesTable).values([
        {
          orderId: id,
          orderNumber: finalOrderNumber,
          clientId: finalClientId,
          technicianId: finalTechnicianId,
          category: finalCategory,
          invoiceType: "technician",
          subtotal: String(baseSubtotal.toFixed(2)),
          taxRate: "0",
          taxAmount: "0",
          total: String(techNetTotal.toFixed(2)),
          status: "issued",
          materialsPhotos: photosJson,
          ocrLineItems: ocrJson,
          ocrMaterialsTotal: String(matTotal.toFixed(2)),
          labourFee: String(labour.toFixed(2)),
          transportFee: String(transport.toFixed(2)),
          serviceFeeRate: String(SERVICE_FEE_RATE),
          serviceFeeAmount: String(serviceFeeAmount.toFixed(2)),
          vatRate: "0",
          vatAmount: "0",
          netTotal: String(techNetTotal.toFixed(2)),
          issuedAt: new Date(),
        },
        {
          orderId: id,
          orderNumber: finalOrderNumber,
          clientId: finalClientId,
          technicianId: finalTechnicianId,
          category: finalCategory,
          invoiceType: "client",
          subtotal: String(baseSubtotal.toFixed(2)),
          taxRate: String(VAT_RATE),
          taxAmount: String(vatAmount.toFixed(2)),
          total: String(clientTotal.toFixed(2)),
          status: "issued",
          materialsPhotos: photosJson,
          ocrLineItems: ocrJson,
          ocrMaterialsTotal: String(matTotal.toFixed(2)),
          labourFee: String(labour.toFixed(2)),
          transportFee: String(transport.toFixed(2)),
          serviceFeeRate: String(SERVICE_FEE_RATE),
          serviceFeeAmount: String(serviceFeeAmount.toFixed(2)),
          vatRate: String(VAT_RATE),
          vatAmount: String(vatAmount.toFixed(2)),
          netTotal: String(clientTotal.toFixed(2)),
          issuedAt: new Date(),
        },
        {
          orderId: id,
          orderNumber: finalOrderNumber,
          clientId: finalClientId,
          technicianId: finalTechnicianId,
          category: finalCategory,
          invoiceType: "admin",
          subtotal: String(labour.toFixed(2)),
          taxRate: String(VAT_RATE),
          taxAmount: String(vatAmount.toFixed(2)),
          total: String(adminTotal.toFixed(2)),
          status: "issued",
          materialsPhotos: photosJson,
          ocrLineItems: ocrJson,
          ocrMaterialsTotal: String(matTotal.toFixed(2)),
          labourFee: String(labour.toFixed(2)),
          transportFee: String(transport.toFixed(2)),
          serviceFeeRate: String(SERVICE_FEE_RATE),
          serviceFeeAmount: String((serviceFeeAmount * 2).toFixed(2)),
          vatRate: String(VAT_RATE),
          vatAmount: String(vatAmount.toFixed(2)),
          netTotal: String(adminTotal.toFixed(2)),
          issuedAt: new Date(),
        },
      ]);
    });

    logger.info({ orderId: id, technicianId: user.id }, "Order completed and three-party invoices created atomically");

    if (finalClientId) {
      broadcastOrderStatusToClient(finalClientId, {
        id,
        status: "completed",
        invoiceData: {
          labourFee: labour,
          transportFee: transport,
          materialsTotal: matTotal,
          serviceFeeAmount,
          vatAmount,
          techNetTotal,
          clientTotal,
        },
      });

      void (async () => {
        try {
          const [clientRow] = await db
            .select({ expoPushToken: usersTable.expoPushToken })
            .from(usersTable)
            .where(eq(usersTable.id, finalClientId!))
            .limit(1);
          if (clientRow?.expoPushToken) {
            await sendOrderStatusPushNotification(clientRow.expoPushToken, id, finalOrderNumber ?? id, "completed");
          }
        } catch (pushErr) {
          logger.warn({ pushErr, orderId: id }, "Failed to send completed push notification");
        }
      })();
    }

    void (async () => {
      try {
        const userIds: string[] = [];
        if (finalClientId) userIds.push(finalClientId);
        if (finalTechnicianId && finalTechnicianId !== finalClientId) userIds.push(finalTechnicianId);
        if (userIds.length === 0) return;
        const userRows = await db
          .select({ id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName, lastName: usersTable.lastName })
          .from(usersTable)
          .where(inArray(usersTable.id, userIds));

        const clientRow = userRows.find((r) => r.id === finalClientId);
        const techRow = userRows.find((r) => r.id === finalTechnicianId);

        const clientName = [clientRow?.firstName, clientRow?.lastName].filter(Boolean).join(" ") || "Client";
        const techName = [techRow?.firstName, techRow?.lastName].filter(Boolean).join(" ") || "Technician";

        await sendInvoiceEmails({
          invoiceData: {
            orderNumber: finalOrderNumber ?? id,
            issuedAt: new Date(),
            category: finalCategory ?? "Service",
            labourFee: labour,
            transportFee: transport,
            materialsTotal: matTotal,
            serviceFeeRate: SERVICE_FEE_RATE,
            serviceFeeAmount,
            vatRate: VAT_RATE,
            vatAmount,
            baseSubtotal,
            clientTotal,
            techNetTotal,
            clientName,
            technicianName: techName,
            clientEmail: clientRow?.email,
            technicianEmail: techRow?.email,
          },
          clientEmail: clientRow?.email,
          technicianEmail: techRow?.email,
        });
      } catch (emailErr) {
        logger.warn({ emailErr, orderId: id }, "Failed to send invoice emails");
      }
    })();

    res.json({
      success: true,
      invoices: {
        techNetTotal: Number(techNetTotal.toFixed(2)),
        clientTotal: Number(clientTotal.toFixed(2)),
        adminTotal: Number(adminTotal.toFixed(2)),
        serviceFeeAmount: Number(serviceFeeAmount.toFixed(2)),
        vatAmount: Number(vatAmount.toFixed(2)),
        labourFee: labour,
        transportFee: transport,
        materialsTotal: matTotal,
      },
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "ORDER_NOT_FOUND") { res.status(404).json({ error: "Order not found" }); return; }
      if (err.message === "ORDER_FORBIDDEN") { res.status(403).json({ error: "You are not assigned to this order" }); return; }
      if (err.message === "ORDER_ALREADY_COMPLETED") { res.status(409).json({ error: "Order is already completed" }); return; }
    }
    logger.error({ err, id }, "Failed to complete order atomically");
    res.status(500).json({ error: "Failed to complete order" });
  }
});

router.patch("/orders/:id/location", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const id = req.params.id;
  const user = req.user!;
  const { latitude, longitude } = req.body as { latitude?: unknown; longitude?: unknown };
  const lat = parseFloat(String(latitude));
  const lon = parseFloat(String(longitude));

  if (isNaN(lat) || isNaN(lon)) {
    res.status(400).json({ error: "latitude and longitude are required numbers" });
    return;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    res.status(400).json({ error: "Coordinates out of range" });
    return;
  }

  try {
    const [existing] = await db
      .select({ clientId: ordersTable.clientId, technicianId: ordersTable.technicianId })
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const isOwner = existing.clientId === user.id || existing.technicianId === user.id;
    if (user.role !== "admin" && !isOwner) {
      res.status(403).json({ error: "Forbidden: only the order owner or an admin can update this order's location" });
      return;
    }

    await db
      .update(ordersTable)
      .set({
        updatedAt: new Date(),
        data: sql`${ordersTable.data} || ${JSON.stringify({ latitude: lat, longitude: lon })}::jsonb`,
      })
      .where(eq(ordersTable.id, id));

    try {
      const client = await pool.connect();
      try {
        await client.query(
          `UPDATE orders SET location = ST_SetSRID(ST_MakePoint($1,$2),4326)::geography WHERE id = $3`,
          [lon, lat, id],
        );
      } finally {
        client.release();
      }
    } catch {
      logger.warn({ orderId: id }, "PostGIS location update skipped on order location patch");
    }

    logger.info({ id, lat, lon }, "Order location updated");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Failed to update order location");
    res.status(500).json({ error: "Failed to update order location" });
  }
});

router.post("/orders/:id/photos", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const id = req.params.id;
  const { phase, urls } = req.body as { phase?: string; urls?: unknown[] };

  const validPhases = ["problem", "before", "during", "after"];
  if (!phase || !validPhases.includes(phase)) {
    res.status(400).json({ error: "phase must be one of: problem, before, during, after" });
    return;
  }
  if (!Array.isArray(urls) || urls.length === 0) {
    res.status(400).json({ error: "urls must be a non-empty array of strings" });
    return;
  }
  if (!urls.every((u) => typeof u === "string")) {
    res.status(400).json({ error: "urls must be an array of strings" });
    return;
  }

  try {
    const [order] = await db
      .select({ clientId: ordersTable.clientId, technicianId: ordersTable.technicianId })
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (user.role === "client") {
      if (phase !== "problem") {
        res.status(403).json({ error: "Clients can only add problem phase photos" });
        return;
      }
      if (order.clientId !== user.id) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    } else if (user.role === "technician") {
      if (phase === "problem") {
        res.status(403).json({ error: "Technicians cannot add problem phase photos" });
        return;
      }
      if (order.technicianId !== user.id) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    const timestamp = new Date().toISOString();
    const newPhotos = (urls as string[]).map((url, i) => ({
      id: `photo_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
      uri: url,
      phase,
      timestamp,
    }));

    const [updated] = await db
      .update(ordersTable)
      .set({
        updatedAt: new Date(),
        data: sql`jsonb_set(
          ${ordersTable.data},
          '{photos}',
          coalesce(${ordersTable.data}->'photos', '[]'::jsonb) || ${JSON.stringify(newPhotos)}::jsonb
        )`,
      })
      .where(eq(ordersTable.id, id))
      .returning({ data: ordersTable.data });

    const updatedData = (updated?.data ?? {}) as Record<string, unknown>;
    logger.info({ id, phase, count: newPhotos.length }, "Photos appended to order");
    res.json({ photos: updatedData.photos ?? [] });
  } catch (err) {
    logger.error({ err, id }, "Failed to append photos to order");
    res.status(500).json({ error: "Failed to save photos" });
  }
});

router.patch("/orders/:id/cancel", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const id = req.params.id;
  const user = req.user!;
  try {
    if (user.role === "technician") {
      res.status(403).json({ error: "Technicians cannot cancel orders" });
      return;
    }

    // Pre-flight read for clear error messages (not relied upon for security).
    const [order] = await db
      .select({ clientId: ordersTable.clientId, status: ordersTable.status })
      .from(ordersTable)
      .where(eq(ordersTable.id, id));

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (user.role === "client") {
      if (order.clientId !== user.id) {
        res.status(403).json({ error: "You are not the client for this order" });
        return;
      }
      if (order.status !== "pending") {
        res.status(400).json({ error: "Only pending orders can be cancelled" });
        return;
      }
    } else if (user.role === "admin") {
      if (["completed", "cancelled"].includes(order.status)) {
        res.status(400).json({ error: "Order is already in a terminal state" });
        return;
      }
    }

    // Atomic update: conditions re-enforced in WHERE to close the TOCTOU window.
    const atomicWhere = user.role === "client"
      ? and(eq(ordersTable.id, id), eq(ordersTable.clientId, user.id), eq(ordersTable.status, "pending"))
      : and(eq(ordersTable.id, id), not(inArray(ordersTable.status, ["completed", "cancelled"])));

    const [updated] = await db
      .update(ordersTable)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(atomicWhere)
      .returning({ clientId: ordersTable.clientId });

    if (!updated) {
      // Order status changed between the pre-flight check and the update.
      res.status(409).json({ error: "Order could not be cancelled — its status may have changed" });
      return;
    }

    removeOrderFromPending(id);
    broadcastOrderCancelledToTechnicians(id);

    if (updated.clientId) {
      broadcastOrderStatusToClient(updated.clientId, { id, status: "cancelled" });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Failed to cancel order");
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

router.patch("/orders/:id", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const id = req.params.id;

  if (user.role !== "admin") {
    res.status(403).json({ error: "Only admins can update order location fields" });
    return;
  }

  const { governorate, area } = req.body as { governorate?: string; area?: string };

  if (governorate === undefined && area === undefined) {
    res.status(400).json({ error: "At least one of governorate or area must be provided" });
    return;
  }

  const rawGovernorate = typeof governorate === "string" && governorate.trim() ? governorate.trim() : null;
  const rawArea = typeof area === "string" && area.trim() ? area.trim() : null;

  if (rawGovernorate === null && rawArea === null) {
    res.status(400).json({ error: "At least one of governorate or area must be a non-empty string" });
    return;
  }

  const [normalizedGovernorate, normalizedArea] = await Promise.all([
    rawGovernorate !== null ? normalizeToSlug(rawGovernorate, "governorate") : Promise.resolve(undefined as undefined),
    rawArea !== null ? normalizeToSlug(rawArea, "area") : Promise.resolve(undefined as undefined),
  ]);

  if (rawGovernorate !== null) {
    if (normalizedGovernorate === null) {
      logger.warn({ raw: rawGovernorate }, "Order update rejected: governorate could not be matched to any known location");
      res.status(400).json({
        error: `Invalid governorate: "${rawGovernorate}" could not be matched to a known location. Please use a valid governorate name.`,
      });
      return;
    }
    if (!isSlug(normalizedGovernorate!)) {
      logger.warn({ raw: rawGovernorate, normalized: normalizedGovernorate }, "Order update rejected: governorate did not normalize to a valid slug format");
      res.status(400).json({
        error: `Invalid governorate: "${rawGovernorate}" did not resolve to a recognized slug. Please use a valid governorate name.`,
      });
      return;
    }
  }

  if (rawArea !== null) {
    if (normalizedArea === null) {
      logger.warn({ raw: rawArea }, "Order update rejected: area could not be matched to any known location");
      res.status(400).json({
        error: `Invalid area: "${rawArea}" could not be matched to a known location. Please use a valid area name.`,
      });
      return;
    }
    if (!isSlug(normalizedArea!)) {
      logger.warn({ raw: rawArea, normalized: normalizedArea }, "Order update rejected: area did not normalize to a valid slug format");
      res.status(400).json({
        error: `Invalid area: "${rawArea}" did not resolve to a recognized slug. Please use a valid area name.`,
      });
      return;
    }
  }

  if (normalizedGovernorate !== undefined && normalizedArea !== undefined) {
    const areaMatchesGovernorate = await validateAreaBelongsToGovernorate(normalizedArea!, normalizedGovernorate!);
    if (!areaMatchesGovernorate) {
      logger.warn(
        { governorate: normalizedGovernorate, area: normalizedArea },
        "Order update rejected: area does not belong to the submitted governorate",
      );
      res.status(400).json({
        error: `Invalid location: area "${normalizedArea}" does not belong to governorate "${normalizedGovernorate}". Please provide a matching area and governorate.`,
      });
      return;
    }
  }

  const patch: Partial<{ governorate: string; area: string; updatedAt: Date }> = { updatedAt: new Date() };
  if (normalizedGovernorate !== undefined) patch.governorate = normalizedGovernorate!;
  if (normalizedArea !== undefined) patch.area = normalizedArea!;

  try {
    const [updated] = await db
      .update(ordersTable)
      .set(patch)
      .where(eq(ordersTable.id, id))
      .returning({ id: ordersTable.id });

    if (!updated) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    logger.info({ id, governorate: patch.governorate, area: patch.area }, "Order location fields updated by admin");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Failed to update order location fields");
    res.status(500).json({ error: "Failed to update order" });
  }
});

// PROTECTED: Rate a completed order. Client rates the technician, technician rates the client.
// Updates order.client_rating / order.tech_rating and recalculates the user's running average.
router.post("/orders/:id/rate", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const id = req.params.id;
  const { rating } = req.body as { rating?: number };

  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
    return;
  }

  try {
    const [order] = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        clientId: ordersTable.clientId,
        technicianId: ordersTable.technicianId,
        clientRating: ordersTable.clientRating,
        techRating: ordersTable.techRating,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (order.status !== "completed") {
      res.status(400).json({ error: "Only completed orders can be rated" });
      return;
    }

    if (user.role === "client") {
      if (order.clientId !== user.id) {
        res.status(403).json({ error: "You are not the client of this order" });
        return;
      }
      if (order.clientRating !== null) {
        res.status(409).json({ error: "You have already rated this order" });
        return;
      }
      await db.transaction(async (tx) => {
        await tx.update(ordersTable).set({ clientRating: rating }).where(eq(ordersTable.id, id));
        if (order.technicianId) {
          await tx.execute(sql`
            UPDATE users
            SET rating = ROUND(((rating * rating_count) + ${rating}) / (rating_count + 1), 2),
                rating_count = rating_count + 1,
                updated_at = now()
            WHERE id = ${order.technicianId}
          `);
        }
      });
      logger.info({ orderId: id, by: user.id, rating }, "Client rated order");

    } else if (user.role === "technician") {
      if (order.technicianId !== user.id) {
        res.status(403).json({ error: "You are not the technician of this order" });
        return;
      }
      if (order.techRating !== null) {
        res.status(409).json({ error: "You have already rated this order" });
        return;
      }
      await db.transaction(async (tx) => {
        await tx.update(ordersTable).set({ techRating: rating }).where(eq(ordersTable.id, id));
        if (order.clientId) {
          await tx.execute(sql`
            UPDATE users
            SET rating = ROUND(((rating * rating_count) + ${rating}) / (rating_count + 1), 2),
                rating_count = rating_count + 1,
                updated_at = now()
            WHERE id = ${order.clientId}
          `);
        }
      });
      logger.info({ orderId: id, by: user.id, rating }, "Technician rated order");

    } else {
      res.status(403).json({ error: "Only clients and technicians can rate orders" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err, orderId: id }, "Failed to rate order");
    res.status(500).json({ error: "Failed to submit rating" });
  }
});

export default router;
