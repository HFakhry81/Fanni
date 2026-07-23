import { Router, type IRouter } from "express";
import { eq, desc, and, isNull } from "drizzle-orm";
import { db, notificationsTable, usersTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── GET /api/notifications — get user's unread notifications ──────────────────
router.get("/notifications", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, user.id),
          isNull(notificationsTable.readAt),
        ),
      )
      .orderBy(desc(notificationsTable.createdAt))
      .limit(30);
    res.json({ notifications: rows });
  } catch (err) {
    logger.error({ err }, "Failed to fetch notifications");
    res.status(500).json({ error: "Failed" });
  }
});

// ── GET /api/notifications/unread-count ───────────────────────────────────────
router.get("/notifications/unread-count", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  try {
    const rows = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, user.id),
          isNull(notificationsTable.readAt),
        ),
      );
    res.json({ count: rows.length });
  } catch (err) {
    logger.error({ err }, "Failed to fetch unread count");
    res.status(500).json({ error: "Failed" });
  }
});

// ── PATCH /api/notifications/read-all ────────────────────────────────────────
router.patch("/notifications/read-all", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  try {
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.userId, user.id),
          isNull(notificationsTable.readAt),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to mark notifications as read");
    res.status(500).json({ error: "Failed" });
  }
});

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────
router.patch("/notifications/:id/read", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  const { id } = req.params as { id: string };
  try {
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userId, user.id),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to mark notification as read");
    res.status(500).json({ error: "Failed" });
  }
});

// ─── Helper exported for use by other routes ─────────────────────────────────
export async function createNotification(opts: {
  userId: string;
  type: string;
  titleAr: string;
  titleEn: string;
  bodyAr?: string;
  bodyEn?: string;
  payload?: Record<string, unknown>;
}) {
  try {
    await db.insert(notificationsTable).values({
      userId: opts.userId,
      type: opts.type,
      titleAr: opts.titleAr,
      titleEn: opts.titleEn,
      bodyAr: opts.bodyAr ?? null,
      bodyEn: opts.bodyEn ?? null,
      payload: opts.payload ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to create notification (non-fatal)");
  }
}

export default router;
