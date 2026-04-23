import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const EGYPT_MOBILE_RE = /^(\+?20|0)(1[0125][0-9]{8})$/;

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

router.post("/admin/create-admin", authMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { name, email, mobile, password } = req.body as {
    name?: string;
    email?: string;
    mobile?: string;
    password?: string;
  };

  if (!name || !name.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  if (!email || !email.trim()) {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }
  if (!mobile || !mobile.trim()) {
    res.status(400).json({ error: "Mobile number is required" });
    return;
  }
  if (!EGYPT_MOBILE_RE.test(mobile.trim().replace(/\s|-/g, ""))) {
    res.status(400).json({ error: "Invalid Egyptian mobile number" });
    return;
  }
  if (!password) {
    res.status(400).json({ error: "Password is required" });
    return;
  }
  if (
    password.length < 8 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    res.status(400).json({ error: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character" });
    return;
  }

  const mobileDigits = mobile.trim().replace(/\s|-/g, "");
  const mobileMatch = mobileDigits.match(EGYPT_MOBILE_RE);
  const normalizedMobile = mobileMatch ? `0${mobileMatch[2]}` : mobileDigits;

  const [existingMobile] = await db.select().from(usersTable).where(eq(usersTable.mobile, normalizedMobile));
  if (existingMobile) {
    res.status(409).json({ error: "Mobile number is already registered" });
    return;
  }

  if (email && email.trim()) {
    const [existingEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email.trim().toLowerCase()));
    if (existingEmail) {
      res.status(409).json({ error: "Email address is already registered" });
      return;
    }
  }

  const salt = generateSalt();
  const hashedPassword = hashPassword(password, salt);
  const passwordHash = `${salt}:${hashedPassword}`;

  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? name.trim();
  const lastName = nameParts.slice(1).join(" ") || null;

  const [newAdmin] = await db
    .insert(usersTable)
    .values({
      email: email ? email.trim().toLowerCase() : null,
      firstName,
      lastName,
      mobile: normalizedMobile,
      role: "admin",
      passwordHash,
    })
    .returning();

  if (!newAdmin) {
    res.status(500).json({ error: "Failed to create admin" });
    return;
  }

  req.log.info({ adminId: newAdmin.id, createdBy: req.user?.id }, "New admin created");
  res.status(201).json({ success: true, userId: newAdmin.id });
});

router.get("/admin/users", authMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const role = req.query.role as string | undefined;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (role && ["client", "technician", "admin"].includes(role)) {
    conditions.push(eq(usersTable.role, role as "client" | "technician" | "admin"));
  }

  const baseQuery = db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      mobile: usersTable.mobile,
      role: usersTable.role,
      isActive: usersTable.isActive,
      area: usersTable.area,
      governorate: usersTable.governorate,
      specialty: usersTable.specialty,
      profession: usersTable.profession,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable);

  const [rows, countResult] = await Promise.all([
    conditions.length > 0
      ? baseQuery.where(conditions[0]).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset)
      : baseQuery.orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset),
    conditions.length > 0
      ? db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(conditions[0])
      : db.select({ count: sql<number>`count(*)::int` }).from(usersTable),
  ]);

  const total = countResult[0]?.count ?? 0;

  res.json({
    users: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

router.patch("/admin/users/:id", authMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role, isActive } = req.body as { role?: string; isActive?: boolean };

  if (!id) {
    res.status(400).json({ error: "User ID is required" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (existing.id === req.user?.id) {
    res.status(400).json({ error: "Cannot modify your own account" });
    return;
  }

  const updates: Partial<{ role: "client" | "technician" | "admin"; isActive: boolean }> = {};

  if (role !== undefined) {
    if (!["client", "technician", "admin"].includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    updates.role = role as "client" | "technician" | "admin";
  }

  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") {
      res.status(400).json({ error: "isActive must be a boolean" });
      return;
    }
    updates.isActive = isActive;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, role: usersTable.role, isActive: usersTable.isActive });

  req.log.info({ userId: id, updates, adminId: req.user?.id }, "Admin updated user");
  res.json({ success: true, user: updated });
});

export default router;
