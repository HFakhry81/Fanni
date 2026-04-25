import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { db, usersTable, adminsTable, loginLogsTable } from "@workspace/db";
import { eq, desc, sql, and, or, ilike, gte, lte } from "drizzle-orm";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { verifyOtpToken, OTP_ENABLED } from "../lib/otp";

const router: IRouter = Router();

const EGYPT_MOBILE_RE = /^(\+?20|0)(1[0125][0-9]{8})$/;

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user || req.user.role !== "admin" || req.sessionSource !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  // Live check: verify admin still exists and is active in the admins table
  const [adminRecord] = await db
    .select({ id: adminsTable.id, isActive: adminsTable.isActive })
    .from(adminsTable)
    .where(eq(adminsTable.id, req.user.id));
  if (!adminRecord || !adminRecord.isActive) {
    res.status(403).json({ error: "Admin account not found or suspended" });
    return;
  }
  next();
}

router.post("/admin/create-admin", authMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { name, email, mobile, password, verificationToken } = req.body as {
    name?: string;
    email?: string;
    mobile?: string;
    password?: string;
    verificationToken?: string;
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

  // Gate on OTP verification when enabled
  if (OTP_ENABLED) {
    if (!verificationToken) {
      res.status(400).json({ error: "Phone verification is required" });
      return;
    }
    const verifiedMobile = verifyOtpToken(verificationToken);
    if (verifiedMobile !== normalizedMobile) {
      res.status(400).json({ error: "Phone verification token is invalid or expired" });
      return;
    }
  }

  // Check uniqueness in both admins and users tables
  const [existingAdminMobile] = await db.select().from(adminsTable).where(eq(adminsTable.mobile, normalizedMobile));
  const [existingUserMobile] = await db.select().from(usersTable).where(eq(usersTable.mobile, normalizedMobile));
  if (existingAdminMobile || existingUserMobile) {
    res.status(409).json({ error: "Mobile number is already registered" });
    return;
  }

  const normalizedEmail = email ? email.trim().toLowerCase() : null;
  if (normalizedEmail) {
    const [existingAdminEmail] = await db.select().from(adminsTable).where(eq(adminsTable.email, normalizedEmail));
    const [existingUserEmail] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
    if (existingAdminEmail || existingUserEmail) {
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
    .insert(adminsTable)
    .values({
      email: normalizedEmail,
      firstName,
      lastName,
      mobile: normalizedMobile,
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
  const search = req.query.search ? String(req.query.search).trim() : undefined;
  const offset = (page - 1) * limit;

  // Admins are now in a separate table; only list clients and technicians here.
  // If caller explicitly requests role=admin, return admin list from admins table instead.
  if (role === "admin") {
    const adminConditions = [];
    if (search) {
      const pattern = `%${search}%`;
      adminConditions.push(
        or(
          ilike(adminsTable.firstName, pattern),
          ilike(adminsTable.lastName, pattern),
          ilike(adminsTable.email, pattern),
          ilike(adminsTable.mobile, pattern),
          sql`concat(${adminsTable.firstName}, ' ', coalesce(${adminsTable.lastName}, '')) ilike ${pattern}`
        )
      );
    }

    const adminWhere = adminConditions.length > 0 ? and(...adminConditions) : undefined;

    const [admins, [countResult]] = await Promise.all([
      db
        .select({
          id: adminsTable.id,
          firstName: adminsTable.firstName,
          lastName: adminsTable.lastName,
          email: adminsTable.email,
          mobile: adminsTable.mobile,
          role: sql<string>`'admin'`,
          isActive: adminsTable.isActive,
          area: sql<null>`null`,
          governorate: sql<null>`null`,
          specialty: sql<null>`null`,
          profession: sql<null>`null`,
          createdAt: adminsTable.createdAt,
        })
        .from(adminsTable)
        .where(adminWhere)
        .orderBy(desc(adminsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(adminsTable).where(adminWhere),
    ]);

    const total = countResult?.count ?? 0;

    return res.json({
      users: admins,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }

  const conditions = [];
  if (role && ["client", "technician"].includes(role)) {
    conditions.push(eq(usersTable.role, role as "client" | "technician"));
  }
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(usersTable.firstName, pattern),
        ilike(usersTable.lastName, pattern),
        ilike(usersTable.email, pattern),
        ilike(usersTable.mobile, pattern),
        ilike(usersTable.area, pattern),
        ilike(usersTable.governorate, pattern),
        sql`concat(${usersTable.firstName}, ' ', coalesce(${usersTable.lastName}, '')) ilike ${pattern}`
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const baseQuery = db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      mobile: usersTable.mobile,
      role: usersTable.role,
      isActive: usersTable.isActive,
      isAvailable: usersTable.isAvailable,
      area: usersTable.area,
      governorate: usersTable.governorate,
      specialty: usersTable.specialty,
      profession: usersTable.profession,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable);

  const [rows, countResult] = await Promise.all([
    baseQuery.where(whereClause).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(whereClause),
  ]);

  const total = countResult[0]?.count ?? 0;

  return res.json({
    users: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

router.patch("/admin/users/:id", authMiddleware, requireAuth, requireAdmin, async (req: Request<{ id: string }>, res: Response) => {
  const id = req.params.id;
  const { role, isActive } = req.body as { role?: string; isActive?: boolean };

  if (!id) {
    res.status(400).json({ error: "User ID is required" });
    return;
  }

  // Prevent modifying other admins through this endpoint (admins have their own table)
  const [existingAdmin] = await db.select({ id: adminsTable.id }).from(adminsTable).where(eq(adminsTable.id, id));
  if (existingAdmin) {
    res.status(400).json({ error: "Admin accounts cannot be modified through this endpoint" });
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

  const updates: Partial<{ role: "client" | "technician"; isActive: boolean }> = {};

  if (role !== undefined) {
    if (!["client", "technician"].includes(role)) {
      res.status(400).json({ error: "Invalid role. Only client and technician are allowed." });
      return;
    }
    updates.role = role as "client" | "technician";
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

// ADMIN ONLY: Get login logs with optional filters
router.get("/admin/login-logs", authMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
  const offset = (page - 1) * limit;
  const role = req.query.role as string | undefined;
  const success = req.query.success as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const conditions = [];
  if (role && ["client", "technician", "admin"].includes(role)) {
    conditions.push(eq(loginLogsTable.role, role));
  }
  if (success === "true") conditions.push(eq(loginLogsTable.success, true));
  if (success === "false") conditions.push(eq(loginLogsTable.success, false));
  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate.getTime())) conditions.push(gte(loginLogsTable.createdAt, fromDate));
  }
  if (to) {
    const toDate = new Date(to);
    if (!isNaN(toDate.getTime())) conditions.push(lte(loginLogsTable.createdAt, toDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, [countRow]] = await Promise.all([
    db
      .select()
      .from(loginLogsTable)
      .where(whereClause)
      .orderBy(desc(loginLogsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(loginLogsTable)
      .where(whereClause),
  ]);

  const total = countRow?.count ?? 0;
  res.json({
    logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export default router;
