import { db, orderStatusEventsTable, usersTable, adminsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { createNotification } from "../routes/notifications";
import { sendExpoPushNotification } from "./pushNotifications";
import { toMobileStatus, ORDER_STATUS_LABELS_AR } from "./orderStatus";
import { logger } from "./logger";

export async function recordOrderStatusEvent(opts: {
  orderId: string;
  fromStatus?: string | null;
  toStatus: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  source?: string;
  note?: string;
}): Promise<void> {
  try {
    await db.insert(orderStatusEventsTable).values({
      orderId: opts.orderId,
      fromStatus: opts.fromStatus ?? null,
      toStatus: opts.toStatus,
      actorUserId: opts.actorUserId ?? null,
      actorRole: opts.actorRole ?? null,
      source: opts.source ?? "api",
      note: opts.note ?? null,
    });
  } catch (err) {
    logger.warn({ err, orderId: opts.orderId }, "Failed to record order_status_event");
  }
}

type NotifyMobileStatus = "pending" | "accepted" | "inProgress" | "completed" | "cancelled";

const CLIENT_PUSH: Record<NotifyMobileStatus, { title: string; body: (n: string) => string }> = {
  pending: {
    title: "تم إنشاء طلبك",
    body: (n) => `طلبك ${n} قيد الانتظار — هنبلغك لما فني يقبله.`,
  },
  accepted: {
    title: "فني قبل طلبك",
    body: (n) => `طلبك ${n} اتقبل والفني في الطريق.`,
  },
  inProgress: {
    title: "بدأ التنفيذ",
    body: (n) => `الفني بدأ الشغل على طلب ${n}.`,
  },
  completed: {
    title: "تم إنهاء الطلب",
    body: (n) => `طلبك ${n} اكتمل. قيّم الخدمة لو حابب.`,
  },
  cancelled: {
    title: "تم إلغاء الطلب",
    body: (n) => `طلبك ${n} اتلغى.`,
  },
};

const TECH_PUSH: Partial<Record<NotifyMobileStatus, { title: string; body: (n: string) => string }>> = {
  pending: {
    title: "طلب جديد في منطقتك",
    body: (n) => `طلب جديد ${n} متاح — افتح القائمة المتاحة.`,
  },
  cancelled: {
    title: "إلغاء طلب",
    body: (n) => `الطلب ${n} اتلغى.`,
  },
  completed: {
    title: "تم تسجيل الإكمال",
    body: (n) => `الطلب ${n} اتسجّل كمكتمل.`,
  },
};

/**
 * Persist status event + notify client / assigned tech / active admins (in-app + Expo when token exists).
 * Fire-and-forget safe — never throws to callers.
 */
export async function notifyOrderLifecycle(opts: {
  orderId: string;
  orderNumber?: string | null;
  fromStatus?: string | null;
  toStatus: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  source?: string;
  /** When pending created — also notify matching online techs via broadcaster separately */
  clientId?: string | null;
  technicianId?: string | null;
  notifyAdmins?: boolean;
}): Promise<void> {
  const mobile = toMobileStatus(opts.toStatus);
  const orderNumber = opts.orderNumber ?? opts.orderId;

  await recordOrderStatusEvent({
    orderId: opts.orderId,
    fromStatus: opts.fromStatus,
    toStatus: opts.toStatus,
    actorUserId: opts.actorUserId,
    actorRole: opts.actorRole,
    source: opts.source,
  });

  const label = ORDER_STATUS_LABELS_AR[mobile] ?? opts.toStatus;

  try {
    if (opts.clientId) {
      const clientCopy = CLIENT_PUSH[mobile];
      await createNotification({
        userId: opts.clientId,
        type: "order_status",
        titleAr: clientCopy.title,
        titleEn: clientCopy.title,
        bodyAr: clientCopy.body(orderNumber),
        bodyEn: clientCopy.body(orderNumber),
        payload: { orderId: opts.orderId, orderNumber, status: mobile },
      });
      const [client] = await db
        .select({ expoPushToken: usersTable.expoPushToken })
        .from(usersTable)
        .where(eq(usersTable.id, opts.clientId))
        .limit(1);
      if (client?.expoPushToken) {
        await sendExpoPushNotification([
          {
            to: client.expoPushToken,
            title: clientCopy.title,
            body: clientCopy.body(orderNumber),
            data: { orderId: opts.orderId, orderNumber, status: mobile, screen: "order-details" },
            sound: "default",
          },
        ]);
      }
    }

    if (opts.technicianId && TECH_PUSH[mobile]) {
      const techCopy = TECH_PUSH[mobile]!;
      await createNotification({
        userId: opts.technicianId,
        type: "order_status",
        titleAr: techCopy.title,
        titleEn: techCopy.title,
        bodyAr: techCopy.body(orderNumber),
        bodyEn: techCopy.body(orderNumber),
        payload: { orderId: opts.orderId, orderNumber, status: mobile },
      });
      const [tech] = await db
        .select({ expoPushToken: usersTable.expoPushToken })
        .from(usersTable)
        .where(eq(usersTable.id, opts.technicianId))
        .limit(1);
      if (tech?.expoPushToken) {
        await sendExpoPushNotification([
          {
            to: tech.expoPushToken,
            title: techCopy.title,
            body: techCopy.body(orderNumber),
            data: { orderId: opts.orderId, orderNumber, status: mobile, screen: "orders" },
            sound: "default",
          },
        ]);
      }
    }

    if (opts.notifyAdmins !== false) {
      const admins = await db
        .select({ id: adminsTable.id })
        .from(adminsTable)
        .where(eq(adminsTable.isActive, true))
        .limit(8);
      await Promise.all(
        admins.map((a) =>
          createNotification({
            userId: a.id,
            type: "order_status",
            titleAr: `تحديث طلب ${orderNumber}`,
            titleEn: `Order ${orderNumber} update`,
            bodyAr: `الحالة: ${label}`,
            bodyEn: `Status: ${mobile}`,
            payload: { orderId: opts.orderId, orderNumber, status: mobile },
          }),
        ),
      );
    }
  } catch (err) {
    logger.warn({ err, orderId: opts.orderId }, "notifyOrderLifecycle partial failure");
  }
}

/** Push new-order alerts to a list of technician user ids (capped). */
export async function notifyTechniciansNewOrder(opts: {
  technicianIds: string[];
  orderId: string;
  orderNumber: string;
  category?: string | null;
}): Promise<void> {
  const ids = [...new Set(opts.technicianIds)].slice(0, 40);
  if (ids.length === 0) return;
  try {
    const techs = await db
      .select({ id: usersTable.id, expoPushToken: usersTable.expoPushToken })
      .from(usersTable)
      .where(inArray(usersTable.id, ids));

    const pushes = techs
      .filter((t) => t.expoPushToken)
      .map((t) => ({
        to: t.expoPushToken!,
        title: "طلب جديد متاح",
        body: `طلب ${opts.orderNumber}${opts.category ? ` — ${opts.category}` : ""}`,
        data: { orderId: opts.orderId, orderNumber: opts.orderNumber, status: "pending", screen: "available-orders" },
        sound: "default" as const,
      }));

    await sendExpoPushNotification(pushes);

    await Promise.all(
      techs.map((t) =>
        createNotification({
          userId: t.id,
          type: "new_order",
          titleAr: "طلب جديد متاح",
          titleEn: "New order available",
          bodyAr: `طلب ${opts.orderNumber} يناسب تخصصك ومنطقتك`,
          bodyEn: `Order ${opts.orderNumber} matches your specialty and area`,
          payload: { orderId: opts.orderId, orderNumber: opts.orderNumber },
        }),
      ),
    );
  } catch (err) {
    logger.warn({ err, orderId: opts.orderId }, "notifyTechniciansNewOrder failed");
  }
}
