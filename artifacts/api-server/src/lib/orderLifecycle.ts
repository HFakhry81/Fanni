import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, ordersTable, orderDeclinesTable, usersTable, availabilityAuditLogsTable } from "@workspace/db";
import { logger } from "./logger";
import { broadcastNewOrder, broadcastOrderStatusToClient } from "./orderBroadcaster";
import { getSetting, SETTING_KEYS } from "./settings";

async function setTechnicianAvailable(technicianId: string, isAvailable: boolean, changedById: string) {
  const [existing] = await db
    .select({ id: usersTable.id, isAvailable: usersTable.isAvailable })
    .from(usersTable)
    .where(and(eq(usersTable.id, technicianId), eq(usersTable.role, "technician")));
  if (!existing || existing.isAvailable === isAvailable) return;
  await db.update(usersTable).set({ isAvailable, updatedAt: new Date() }).where(eq(usersTable.id, technicianId));
  await db.insert(availabilityAuditLogsTable).values({
    technicianId,
    changedById,
    changedByRole: "system",
    oldValue: existing.isAvailable,
    newValue: isAvailable,
  });
}

export async function dropTechnicianAndRematch(orderId: string, reason: string): Promise<boolean> {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order || !order.technicianId) return false;
  if (["completed", "cancelled", "pending"].includes(order.status)) return false;

  const droppedTechId = order.technicianId;
  const data = (order.data ?? {}) as Record<string, unknown>;
  const dataPatch = {
    ...data,
    status: "pending",
    technicianId: null,
    technicianName: null,
    technicianMobile: null,
    dropReason: reason,
    droppedAt: new Date().toISOString(),
  };

  await db.transaction(async (tx) => {
    await tx.insert(orderDeclinesTable).values({
      technicianId: droppedTechId,
      orderId,
    }).onConflictDoNothing();

    await tx.update(ordersTable).set({
      status: "pending",
      technicianId: null,
      acknowledgedAt: null,
      arrivalDetectedAt: null,
      arrivalConfirmedAt: null,
      arrivalRejectionReason: reason,
      updatedAt: new Date(),
      data: dataPatch,
    }).where(eq(ordersTable.id, orderId));
  });

  await setTechnicianAvailable(droppedTechId, true, droppedTechId);

  const rematchPayload = {
    ...dataPatch,
    id: order.id,
    orderNumber: order.orderNumber,
    orderSerial: order.orderSerial,
    category: order.category,
    governorate: order.governorate,
    area: order.area,
    clientId: order.clientId,
  };
  void broadcastNewOrder(rematchPayload);

  if (order.clientId) {
    broadcastOrderStatusToClient(order.clientId, { id: orderId, status: "pending", technicianDropped: true });
  }

  logger.info({ orderId, droppedTechId, reason }, "Technician dropped — order returned to matching");
  return true;
}

export async function markTechnicianBusy(technicianId: string): Promise<void> {
  await setTechnicianAvailable(technicianId, false, technicianId);
}

export async function markTechnicianAvailable(technicianId: string): Promise<void> {
  await setTechnicianAvailable(technicianId, true, technicianId);
}

export async function processArrivalTimeouts(): Promise<number> {
  const timeoutMins = await getSetting(SETTING_KEYS.ARRIVAL_TIMEOUT_MINS, 30);
  const cutoff = new Date(Date.now() - Number(timeoutMins) * 60_000);

  const stale = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(and(
      inArray(ordersTable.status, ["en_route", "arrived", "acknowledged"]),
      isNotNull(ordersTable.arrivalRejectionReason),
      isNull(ordersTable.arrivalConfirmedAt),
      sql`${ordersTable.updatedAt} <= ${cutoff}`,
    ));

  let dropped = 0;
  for (const row of stale) {
    const ok = await dropTechnicianAndRematch(row.id, "ARRIVAL_TIMEOUT");
    if (ok) dropped += 1;
  }
  if (dropped > 0) {
    logger.info({ dropped, timeoutMins }, "Processed arrival confirmation timeouts");
  }
  return dropped;
}

export function startArrivalTimeoutWorker(): void {
  const tick = () => {
    processArrivalTimeouts().catch((err) => {
      logger.warn({ err }, "Arrival timeout worker failed");
    });
  };
  tick();
  setInterval(tick, 60_000);
}
