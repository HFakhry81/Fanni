import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, adminsTable } from "@workspace/db";

export interface AdminRecord {
  id: string;
  isActive: boolean;
  isSuperAdmin: boolean | null;
  permissions: string[] | null;
}

declare global {
  namespace Express {
    interface Request {
      __adminRecord?: AdminRecord;
    }
  }
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
    })
    .from(adminsTable)
    .where(eq(adminsTable.id, req.user.id));
  if (!adminRecord || !adminRecord.isActive) {
    res.status(403).json({ error: "Admin account not found or suspended" });
    return;
  }
  req.__adminRecord = adminRecord;
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
