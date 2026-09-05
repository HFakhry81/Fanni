import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, adminsTable } from "@workspace/db";

export interface AdminRecord {
  id: string;
  isActive: boolean;
  isSuperAdmin: boolean | null;
  permissions: string[] | null;
  mustChangePassword: boolean;
}

/** Read-only endpoints allowed while mustChangePassword is still true. */
const ALLOWED_WHILE_MUST_CHANGE_PASSWORD = new Set([
  "/admin/my-permissions",
  "/admin/dashboard/stats",
]);

declare global {
  namespace Express {
    interface Request {
      __adminRecord?: AdminRecord;
    }
  }
}

function adminRoutePath(req: Request): string {
  // Prefer originalUrl path without query; fall back to req.path
  const raw = (req.originalUrl || req.url || req.path || "").split("?")[0] ?? "";
  const withoutApi = raw.replace(/^\/api/, "");
  return withoutApi.startsWith("/") ? withoutApi : `/${withoutApi}`;
}

/** Admin session + live active row in `admins`. User-app sessions cannot pass. */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user || req.user.role !== "admin" || req.sessionSource !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const [adminRecord] = await db
    .select({
      id: adminsTable.id,
      isActive: adminsTable.isActive,
      isSuperAdmin: adminsTable.isSuperAdmin,
      permissions: adminsTable.permissions,
      mustChangePassword: adminsTable.mustChangePassword,
    })
    .from(adminsTable)
    .where(eq(adminsTable.id, req.user.id));
  if (!adminRecord || !adminRecord.isActive) {
    res.status(403).json({ error: "Admin account not found or suspended" });
    return;
  }
  req.__adminRecord = {
    ...adminRecord,
    mustChangePassword: adminRecord.mustChangePassword ?? false,
  };

  if (req.__adminRecord.mustChangePassword) {
    const path = adminRoutePath(req);
    if (!ALLOWED_WHILE_MUST_CHANGE_PASSWORD.has(path)) {
      res.status(403).json({
        error: "Password change required before using admin features",
        code: "MUST_CHANGE_PASSWORD",
      });
      return;
    }
  }

  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.__adminRecord?.isSuperAdmin) {
    res.status(403).json({ error: "Super-admin access required" });
    return;
  }
  next();
}

export function requirePermission(perm: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rec = req.__adminRecord;
    if (rec?.isSuperAdmin || (rec?.permissions && rec.permissions.includes(perm))) {
      next();
    } else {
      res.status(403).json({ error: `Permission '${perm}' required` });
    }
  };
}
