import { Router, type IRouter, type Request } from "express";
import { sql, desc, eq, and, inArray, not } from "drizzle-orm";
import { broadcastNewOrder, broadcastOrderStatusToClient, removeOrderFromPending, broadcastOrderCancelledToTechnicians } from "../lib/orderBroadcaster";
import { logger } from "../lib/logger";
import { db, ordersTable, pool, usersTable, leadUnlocksTable, orderDeclinesTable, disputesTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { normalizeToSlug, isSlug, validateAreaBelongsToGovernorate } from "../lib/locationNormalizer";
import { queryString } from "../lib/queryParams";
import { sendOrderStatusPushNotification } from "../lib/pushNotifications";
import { sanitizeOrderForBroadcast } from "../lib/contactSanitizer";
import { InsufficientPointsError, maskSensitiveOrderFields, refundEligibleUnlocksForCancelledOrder, unlockLeadAtomically } from "../lib/leadUnlock";
import { maskPhoneDisplay } from "../lib/phone";
import { markTechnicianBusy, markTechnicianAvailable } from "../lib/orderLifecycle";
import { recordLastWorkLocation } from "../lib/serviceLocation";

const router: IRouter = Router();

function formatOrderNumber(serial: number): string {
  return `ORD-${String(serial).padStart(6, "0")}`;
}

type DbStatus = "pending" | "acknowledged" | "en_route" | "arrived" | "in_progress" | "completed" | "cancelled";
type MobileStatus = "pending" | "accepted" | "inProgress" | "completed" | "cancelled";

function toMobileStatus(dbStatus: DbStatus): MobileStatus {
  if (dbStatus === "acknowledged" || dbStatus === "en_route" || dbStatus === "arrived") return "accepted";
  if (dbStatus === "in_progress") return "inProgress";
  return dbStatus as MobileStatus;
}

function mapOrderRow(row: typeof ordersTable.$inferSelect, opts?: { maskClient?: boolean; revealPhones?: boolean }) {
  const data = row.data as Record<string, unknown>;
  const clientMobileRaw = (data.clientMobile as string | null) ?? null;
  const technicianMobileRaw = (data.technicianMobile as string | null) ?? null;
  const mapped = {
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
    technicianMobile: opts?.revealPhones ? technicianMobileRaw : maskPhoneDisplay(technicianMobileRaw),
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
    clientMobile: opts?.revealPhones ? clientMobileRaw : maskPhoneDisplay(clientMobileRaw),
    photos: data.photos ?? [],
    materials: data.materials ?? null,
    solutionDescription: data.solutionDescription ?? null,
    invoice: data.invoice ?? null,
    clientRating: data.clientRating ?? row.clientRating ?? null,
    clientComment: data.clientComment ?? null,
    arrivalDetectedAt: row.arrivalDetectedAt ?? null,
    arrivalDetected: !!row.arrivalDetectedAt,
    arrivalRejectionReason: row.arrivalRejectionReason ?? null,
    incompleteReason: data.incompleteReason ?? null,
    incompleteDetails: data.incompleteDetails ?? null,
  };
  if (opts?.maskClient) {
    return maskSensitiveOrderFields(mapped as Record<string, unknown>);
  }
  return mapped;
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

    const orders = rows.map((row) => mapOrderRow(row, {
      maskClient: user.role === "technician",
      revealPhones: user.role === "admin",
    }));

    res.json({ orders });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to fetch pending orders for technician");
    res.status(500).json({ error: "Failed to fetch pending orders" });
  }
});

router.get("/orders", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  const userId = user.id;

  try {
    const rows = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.clientId, userId))
      .orderBy(desc(ordersTable.createdAt));

    const orders = rows.map((row) => mapOrderRow(row));

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
    const safeOrder = sanitizeOrderForBroadcast(order as Record<string, unknown>);
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
        data: safeOrder,
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

      const fullOrder = {
        ...safeOrder,
        orderNumber: dbOrderNumber,
        orderSerial: inserted.orderSerial,
        category: order.category as string,
        governorate: routingMeta.governorate,
        area: routingMeta.area,
      };
      void broadcastNewOrder(fullOrder);
      logger.info({ orderId: order.id, orderNumber: dbOrderNumber, orderSerial: inserted.orderSerial }, "Order saved to database");
      res.status(201).json({ success: true, orderId: order.id, orderNumber: dbOrderNumber });
    } else {
      void broadcastNewOrder(sanitizeOrderForBroadcast(order as Record<string, unknown>));
      res.status(201).json({ success: true, orderId: order.id });
    }
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Failed to save order to database");
    res.status(500).json({ error: "Failed to persist order" });
  }
});

function leadErrorResponse(res: import("express").Response, err: unknown, orderId: string, fallback: string) {
  if (err instanceof InsufficientPointsError) {
    res.status(402).json({
      error: "Insufficient points",
      message: `رصيدك الحالي مش كافي لإظهار بيانات العميل. محتاج ${err.required} نقطة، ورصيدك الحالي ${err.balance} نقاط.`,
      balance: err.balance,
      required: err.required,
    });
    return true;
  }
  if (err instanceof Error && err.message === "ORDER_NOT_FOUND") {
    res.status(404).json({ error: "Order not found" });
    return true;
  }
  if (err instanceof Error && err.message === "ORDER_UNAVAILABLE") {
    res.status(409).json({ error: "Order is no longer available" });
    return true;
  }
  logger.error({ err, orderId }, fallback);
  return false;
}

function notifyClientAccepted(orderId: string, clientId: string, technician: {
  technicianId: string;
  technicianName?: string;
  technicianMobile?: string;
  technicianAvatar?: string;
  technicianRating?: number;
}) {
  broadcastOrderStatusToClient(clientId, {
    id: orderId,
    status: "accepted",
    technicianId: technician.technicianId,
    ...(technician.technicianName !== undefined && { technicianName: technician.technicianName }),
    ...(technician.technicianMobile !== undefined && { technicianMobile: maskPhoneDisplay(technician.technicianMobile) }),
    ...(technician.technicianAvatar !== undefined && { technicianAvatar: technician.technicianAvatar }),
    ...(technician.technicianRating !== undefined && { technicianRating: technician.technicianRating }),
  });

  void (async () => {
    try {
      const [orderRow] = await db
        .select({ orderNumber: ordersTable.orderNumber })
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .limit(1);
      const [clientRow] = await db
        .select({ expoPushToken: usersTable.expoPushToken })
        .from(usersTable)
        .where(eq(usersTable.id, clientId))
        .limit(1);
      if (clientRow?.expoPushToken) {
        await sendOrderStatusPushNotification(clientRow.expoPushToken, orderId, orderRow?.orderNumber ?? orderId, "accepted");
      }
    } catch (pushErr) {
      logger.warn({ pushErr, orderId }, "Failed to send accepted push notification");
    }
  })();
}

router.post("/orders/:id/unlock", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const orderId = req.params.id;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Only technicians can unlock orders" });
    return;
  }
  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    const data = order.data as Record<string, unknown>;
    const result = await unlockLeadAtomically({
      technicianId: user.id,
      orderId,
      category: order.category,
      specialty: (data.subCategory as string | undefined) ?? order.specialtyId,
    });
    logger.info({ techId: user.id, orderId, costPoints: result.costPoints, newBalance: result.newBalance }, "Order unlocked");
    res.json({
      ...result,
      contact: { ...result.contact, clientMobile: maskPhoneDisplay(result.contact.clientMobile as string | null) },
    });
  } catch (err) {
    if (!leadErrorResponse(res, err, orderId, "Failed to unlock order")) {
      res.status(500).json({ error: "Failed to unlock order" });
    }
  }
});

// Soft dismiss only: closes the tech's notification/modal. Order stays pending
// and remains visible to this technician and all other matching technicians.
router.post("/orders/:id/decline", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Only technicians can decline orders" });
    return;
  }
  const orderId = req.params.id;
  try {
    const [order] = await db
      .select({ id: ordersTable.id, status: ordersTable.status })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    // Optional audit row — never used to filter pending lists.
    await db.insert(orderDeclinesTable).values({
      technicianId: user.id,
      orderId,
    }).onConflictDoNothing();
    req.log.info({ techId: user.id, orderId, status: order.status }, "Technician dismissed order notification");
    res.json({ success: true, dismissed: true, orderStillPending: order.status === "pending" });
  } catch (err) {
    logger.error({ err }, "Failed to record order notification dismiss");
    res.status(500).json({ error: "Failed to dismiss order notification" });
  }
});

router.post("/orders/:id/accept", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const id = req.params.id;
  if (user.role !== "technician" && user.role !== "admin") {
    res.status(403).json({ error: "Only technicians can accept orders" });
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

  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.status !== "pending") {
      res.status(409).json({ error: "Order is no longer available" }); return;
    }
    const data = order.data as Record<string, unknown>;
    const result = await unlockLeadAtomically({
      technicianId: user.id,
      orderId: id,
      category: order.category,
      specialty: (data.subCategory as string | undefined) ?? order.specialtyId,
      assign: {
        technicianName,
        technicianMobile,
        technicianAvatar,
        technicianRating,
      },
    });
    if (!result.assigned) {
      res.status(409).json({ error: "Order already accepted by another technician" });
      return;
    }
    const [assigned] = await db
      .select({ clientId: ordersTable.clientId })
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);
    removeOrderFromPending(id);
    logger.info({ id, technicianId: user.id }, "Lead accepted after point confirmation");
    if (assigned?.clientId) {
      notifyClientAccepted(id, assigned.clientId, {
        technicianId: user.id,
        technicianName,
        technicianMobile,
        technicianAvatar,
        technicianRating,
      });
    }
    res.json({
      success: true,
      ...result,
      contact: { ...result.contact, clientMobile: maskPhoneDisplay(result.contact.clientMobile as string | null) },
    });
  } catch (err) {
    if (!leadErrorResponse(res, err, id, "Failed to accept order with lead")) {
      res.status(500).json({ error: "Failed to accept order" });
    }
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
    status: "en_route", // Transitioning to en_route upon acceptance
    technicianId: user.id,
  };
  if (technicianName !== undefined) dataPatch.technicianName = technicianName;
  if (technicianMobile !== undefined) dataPatch.technicianMobile = technicianMobile;
  if (technicianAvatar !== undefined) dataPatch.technicianAvatar = technicianAvatar;
  if (technicianRating !== undefined) dataPatch.technicianRating = technicianRating;

  try {
    if (user.role === "technician") {
      const [unlock] = await db.select({ id: leadUnlocksTable.id })
        .from(leadUnlocksTable)
        .where(and(eq(leadUnlocksTable.technicianId, user.id), eq(leadUnlocksTable.orderId, id)))
        .limit(1);
      if (!unlock) {
        res.status(409).json({ error: "Confirm points deduction before accepting this order" });
        return;
      }
    }

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
          status: "en_route",
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
    logger.info({ id, technicianId: user.id }, "Order acknowledged and status set to en_route");

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
  const { confirmed, rejectionReason } = req.body as { confirmed: boolean, rejectionReason?: string };

  if (user.role !== "client") {
    res.status(403).json({ error: "Only clients can confirm arrival" });
    return;
  }

  try {
    const [existing] = await db
      .select({ clientId: ordersTable.clientId, status: ordersTable.status, arrivalDetectedAt: ordersTable.arrivalDetectedAt })
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

    // Client can only confirm if tech is arrived or en_route
    if (!["en_route", "arrived", "acknowledged"].includes(existing.status)) {
      res.status(409).json({ error: "Order is not in a state where arrival can be confirmed" });
      return;
    }

    const now = new Date();
    if (confirmed) {
      await db
        .update(ordersTable)
        .set({
          status: "in_progress",
          arrivalConfirmedAt: now,
          updatedAt: now,
          data: sql`${ordersTable.data} || '{"status":"inProgress"}'::jsonb`,
        })
        .where(eq(ordersTable.id, id));

      logger.info({ id, clientId: user.id }, "Client confirmed technician arrival — order in_progress");
      broadcastOrderStatusToClient(user.id, { id, status: "inProgress" });
      const [assigned] = await db.select({ technicianId: ordersTable.technicianId }).from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
      if (assigned?.technicianId) {
        await markTechnicianBusy(assigned.technicianId);
      }
    } else {
      await db.update(ordersTable).set({
        arrivalRejectionReason: rejectionReason || "Client reported technician not arrived",
        updatedAt: now,
      }).where(eq(ordersTable.id, id));
      logger.info({ id, clientId: user.id }, "Client rejected technician arrival — 30 minute timeout started");
      broadcastOrderStatusToClient(user.id, {
        id,
        status: "accepted",
        arrivalDetected: true,
        arrivalRejectionReason: rejectionReason || "Client reported technician not arrived",
      });
    }

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

router.patch("/orders/:id/fail-service", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const id = req.params.id;
  const ALLOWED = [
    "client_not_present",
    "client_refused",
    "different_problem",
    "parts_unavailable",
    "extra_time",
    "cannot_repair",
    "other",
  ] as const;
  const { reason, details } = req.body as { reason?: string; details?: string };
  if (!reason || !ALLOWED.includes(reason as typeof ALLOWED[number])) {
    res.status(400).json({ error: "A valid incomplete reason is required" });
    return;
  }
  if (user.role !== "technician" && user.role !== "admin") {
    res.status(403).json({ error: "Only technicians can report a failed service" });
    return;
  }

  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (user.role === "technician" && order.technicianId !== user.id) {
      res.status(403).json({ error: "You are not assigned to this order" }); return;
    }
    if (order.status !== "in_progress") {
      res.status(409).json({ error: "Service result can only be recorded while the job is in progress" }); return;
    }

    const dataPatch = {
      status: "cancelled",
      serviceResult: "failed",
      incompleteReason: reason,
      incompleteDetails: typeof details === "string" ? details.trim().slice(0, 2000) : "",
    };

    await db.update(ordersTable).set({
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
      data: sql`${ordersTable.data} || ${JSON.stringify(dataPatch)}::jsonb`,
    }).where(eq(ordersTable.id, id));

    if (order.technicianId) {
      await markTechnicianAvailable(order.technicianId);
    }
    if (order.clientId) {
      broadcastOrderStatusToClient(order.clientId, { id, status: "cancelled", serviceResult: "failed", incompleteReason: reason });
    }

    const refundEligible = reason === "client_not_present" || reason === "client_refused";
    if (refundEligible && order.technicianId) {
      const [unlock] = await db.select().from(leadUnlocksTable).where(and(
        eq(leadUnlocksTable.technicianId, order.technicianId),
        eq(leadUnlocksTable.orderId, id),
        eq(leadUnlocksTable.refundStatus, "none"),
      )).limit(1);
      if (unlock) {
        await db.update(leadUnlocksTable).set({ refundStatus: "requested" }).where(eq(leadUnlocksTable.id, unlock.id));
        const [existingDispute] = await db.select({ id: disputesTable.id }).from(disputesTable).where(eq(disputesTable.leadUnlockId, unlock.id)).limit(1);
        if (!existingDispute) {
          await db.insert(disputesTable).values({
            leadUnlockId: unlock.id,
            technicianId: order.technicianId,
            orderId: id,
            reason: `Service incomplete: ${reason}${details ? ` — ${details}` : ""}`,
          });
        }
      }
    }

    logger.info({ id, reason }, "Service recorded as incomplete");
    res.json({ success: true, refundRequested: refundEligible });
  } catch (err) {
    logger.error({ err, id }, "Failed to record incomplete service");
    res.status(500).json({ error: "Failed to record incomplete service" });
  }
});

router.patch("/orders/:id/complete", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const id = req.params.id;

  if (user.role !== "technician" && user.role !== "admin") {
    res.status(403).json({ error: "Only technicians can complete orders" });
    return;
  }

  // Platform accounting is commission-only (lead unlock / points). Job labour,
  // materials, transport, OCR, and three-party purchase invoices are retired.
  const { solutionDescription, clientSatisfaction } = req.body as {
    solutionDescription?: string;
    clientSatisfaction?: string;
  };

  const dataPatch: Record<string, unknown> = { status: "completed" };
  if (solutionDescription !== undefined) dataPatch.solutionDescription = solutionDescription;
  if (clientSatisfaction !== undefined) dataPatch.clientSatisfaction = clientSatisfaction;

  try {
    let finalClientId: string | null = null;
    let finalTechnicianId: string | null = null;
    let finalOrderNumber: string | null = null;
    let completedOrderLat: number | null = null;
    let completedOrderLon: number | null = null;

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
      const orderData = orderRow.data as Record<string, unknown>;
      completedOrderLat = typeof orderData.latitude === "number" ? orderData.latitude : null;
      completedOrderLon = typeof orderData.longitude === "number" ? orderData.longitude : null;

      await tx
        .update(ordersTable)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
          data: sql`${ordersTable.data} || ${JSON.stringify(dataPatch)}::jsonb`,
        })
        .where(eq(ordersTable.id, id));
    });

    logger.info({ orderId: id, technicianId: user.id }, "Order completed (commission-only; no job invoices)");
    if (finalTechnicianId) {
      await markTechnicianAvailable(finalTechnicianId);
      if (completedOrderLat != null && completedOrderLon != null) {
        const locClient = await pool.connect();
        try {
          await recordLastWorkLocation(locClient, finalTechnicianId, completedOrderLat, completedOrderLon);
        } finally {
          locClient.release();
        }
      }
    }

    if (finalClientId) {
      broadcastOrderStatusToClient(finalClientId, {
        id,
        status: "completed",
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

    res.json({ success: true });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "ORDER_NOT_FOUND") { res.status(404).json({ error: "Order not found" }); return; }
      if (err.message === "ORDER_FORBIDDEN") { res.status(403).json({ error: "You are not assigned to this order" }); return; }
      if (err.message === "ORDER_ALREADY_COMPLETED") { res.status(409).json({ error: "Order is already completed" }); return; }
    }
    logger.error({ err, id }, "Failed to complete order");
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
    let refundedUnlocks = 0;
    if (user.role === "client") {
      try {
        refundedUnlocks = await refundEligibleUnlocksForCancelledOrder(id);
      } catch (refundErr) {
        logger.error({ refundErr, orderId: id }, "Order cancelled but automatic lead refund failed");
      }
    }

    if (updated.clientId) {
      broadcastOrderStatusToClient(updated.clientId, { id, status: "cancelled" });
    }

    res.json({ success: true, refundedUnlocks });
  } catch (err) {
    logger.error({ err, id }, "Failed to cancel order");
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

router.patch("/orders/:id", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  const id = req.params.id;

  if (user.role !== "admin" && user.role !== "client") {
    res.status(403).json({ error: "Only the order owner or an admin can update order location fields" });
    return;
  }

  if (user.role === "client") {
    const [ownedOrder] = await db
      .select({ clientId: ordersTable.clientId, status: ordersTable.status })
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);
    if (!ownedOrder || ownedOrder.clientId !== user.id) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (ownedOrder.status !== "pending") {
      res.status(409).json({ error: "Only pending orders can change location" });
      return;
    }
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

    // A pending order's routing fields changed. Remove the stale in-memory
    // broadcast entry and re-announce the current order so connected
    // technicians receive the new match immediately. The GET endpoint remains
    // the source of truth for the complete/masked order payload.
    const [currentOrder] = await db
      .select({
        id: ordersTable.id,
        category: ordersTable.category,
        governorate: ordersTable.governorate,
        area: ordersTable.area,
        status: ordersTable.status,
        data: ordersTable.data,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);
    if (currentOrder?.status === "pending") {
      removeOrderFromPending(id);
      void broadcastNewOrder({
        id: currentOrder.id,
        category: currentOrder.category,
        governorate: currentOrder.governorate,
        area: currentOrder.area,
        data: currentOrder.data,
      });
    }

    logger.info(
      { id, governorate: patch.governorate, area: patch.area, changedBy: user.id },
      "Pending order location fields updated and rematched",
    );
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
  const { rating, comment } = req.body as { rating?: number; comment?: string };

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
        await tx.update(ordersTable).set({
          clientRating: rating,
          updatedAt: new Date(),
          data: sql`${ordersTable.data} || ${JSON.stringify({
            clientRating: rating,
            ...(typeof comment === "string" ? { clientComment: comment.trim().slice(0, 1000) } : {}),
          })}::jsonb`,
        }).where(eq(ordersTable.id, id));
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
