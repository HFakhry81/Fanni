import type { Request } from "express";
import { desc, eq } from "drizzle-orm";
import { db, adminAuditLogsTable } from "@workspace/db";
import { getSessionId } from "./auth";
import { logger } from "./logger";

type InsertExecutor = {
  insert: typeof db.insert;
};

export function clientIp(req: Request): string {
  return String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown").split(",")[0]!.trim();
}

export async function logAdminAudit(
  req: Request,
  input: {
    action: string;
    targetType: string;
    targetId: string;
    previousStatus?: string | null;
    newStatus?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
  executor: InsertExecutor = db,
): Promise<void> {
  const adminId = req.user?.id;
  if (!adminId) return;
  try {
    await executor.insert(adminAuditLogsTable).values({
      adminId,
      action: input.action.slice(0, 100),
      targetType: input.targetType.slice(0, 50),
      targetId: String(input.targetId),
      previousStatus: input.previousStatus?.slice(0, 50) ?? null,
      newStatus: input.newStatus?.slice(0, 50) ?? null,
      reason: input.reason?.trim() || null,
      metadata: {
        ...(input.metadata ?? {}),
        sessionId: getSessionId(req) ?? null,
        sessionSource: req.sessionSource ?? null,
      },
      ipAddress: clientIp(req).slice(0, 50),
    });
  } catch (err) {
    logger.error({ err, action: input.action, targetId: input.targetId }, "Failed to write admin audit log");
  }
}

export async function listAdminAuditLogs(opts: { targetType?: string; limit?: number }) {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);
  if (opts.targetType) {
    return db
      .select()
      .from(adminAuditLogsTable)
      .where(eq(adminAuditLogsTable.targetType, opts.targetType))
      .orderBy(desc(adminAuditLogsTable.createdAt))
      .limit(limit);
  }
  return db
    .select()
    .from(adminAuditLogsTable)
    .orderBy(desc(adminAuditLogsTable.createdAt))
    .limit(limit);
}
