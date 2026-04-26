import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { db, usersTable, adminsTable, loginLogsTable, serviceDomainsTable, serviceSpecializationsTable, invoicesTable, ordersTable, availabilityAuditLogsTable, sessionsTable, locationsTable, locationAliasesTable, locationMissLogTable } from "@workspace/db";
import { invalidateLocationCache } from "../lib/locationNormalizer";
import { eq, desc, sql, and, or, ilike, gte, lte, asc, ne } from "drizzle-orm";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { verifyOtpToken } from "../lib/otp";
import { queryInt, queryString } from "../lib/queryParams";
import { backfillTechnicianLocations } from "../lib/backfillLocations";

interface AdminRecord {
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
    .select({ id: adminsTable.id, isActive: adminsTable.isActive, isSuperAdmin: adminsTable.isSuperAdmin, permissions: adminsTable.permissions })
    .from(adminsTable)
    .where(eq(adminsTable.id, req.user.id));
  if (!adminRecord || !adminRecord.isActive) {
    res.status(403).json({ error: "Admin account not found or suspended" });
    return;
  }
  // Attach to request for downstream use
  req.__adminRecord = adminRecord;
  next();
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.__adminRecord?.isSuperAdmin) {
    res.status(403).json({ error: "Super-admin access required" });
    return;
  }
  next();
}

function requirePermission(perm: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rec = req.__adminRecord;
    if (rec?.isSuperAdmin || (rec?.permissions && rec.permissions.includes(perm))) {
      next();
    } else {
      res.status(403).json({ error: `Permission '${perm}' required` });
    }
  };
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
  if (process.env.ENABLE_OTP === "true") {
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

router.get("/admin/users/counts", authMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const role = queryString(req.query.role);
  const search = queryString(req.query.search)?.trim();

  if (role === "admin") {
    const baseConditions: ReturnType<typeof eq>[] = [];
    if (search) {
      const pattern = `%${search}%`;
      baseConditions.push(
        or(
          ilike(adminsTable.firstName, pattern),
          ilike(adminsTable.lastName, pattern),
          ilike(adminsTable.email, pattern),
          ilike(adminsTable.mobile, pattern),
          sql`concat(${adminsTable.firstName}, ' ', coalesce(${adminsTable.lastName}, '')) ilike ${pattern}`
        ) as ReturnType<typeof eq>
      );
    }

    const whereClause = baseConditions.length > 0 ? and(...baseConditions) : undefined;
    const [row] = await db
      .select({
        all: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${adminsTable.isActive} = true)::int`,
        suspended: sql<number>`count(*) filter (where ${adminsTable.isActive} = false)::int`,
      })
      .from(adminsTable)
      .where(whereClause);

    return res.json({ all: row?.all ?? 0, active: row?.active ?? 0, suspended: row?.suspended ?? 0 });
  }

  const baseConditions: ReturnType<typeof eq>[] = [];
  if (role && ["client", "technician"].includes(role)) {
    baseConditions.push(eq(usersTable.role, role as "client" | "technician"));
  }
  if (search) {
    const pattern = `%${search}%`;
    baseConditions.push(
      or(
        ilike(usersTable.firstName, pattern),
        ilike(usersTable.lastName, pattern),
        ilike(usersTable.email, pattern),
        ilike(usersTable.mobile, pattern),
        ilike(usersTable.area, pattern),
        ilike(usersTable.governorate, pattern),
        sql`concat(${usersTable.firstName}, ' ', coalesce(${usersTable.lastName}, '')) ilike ${pattern}`
      ) as ReturnType<typeof eq>
    );
  }

  const whereClause = baseConditions.length > 0 ? and(...baseConditions) : undefined;
  const [row] = await db
    .select({
      all: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${usersTable.isActive} = true)::int`,
      suspended: sql<number>`count(*) filter (where ${usersTable.isActive} = false)::int`,
    })
    .from(usersTable)
    .where(whereClause);

  return res.json({ all: row?.all ?? 0, active: row?.active ?? 0, suspended: row?.suspended ?? 0 });
});

router.get("/admin/users", authMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const page = Math.max(1, queryInt(req.query.page, 1));
  const limit = Math.min(100, Math.max(1, queryInt(req.query.limit, 20)));
  const role = queryString(req.query.role);
  const search = queryString(req.query.search)?.trim();
  const isActiveParam = queryString(req.query.isActive);
  const offset = (page - 1) * limit;

  // Admins are now in a separate table; only list clients and technicians here.
  // If caller explicitly requests role=admin, return admin list from admins table instead.
  if (role === "admin") {
    const adminConditions = [];
    if (isActiveParam === "true") {
      adminConditions.push(eq(adminsTable.isActive, true));
    } else if (isActiveParam === "false") {
      adminConditions.push(eq(adminsTable.isActive, false));
    }
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
          mustChangePassword: adminsTable.mustChangePassword,
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
  if (isActiveParam === "true") {
    conditions.push(eq(usersTable.isActive, true));
  } else if (isActiveParam === "false") {
    conditions.push(eq(usersTable.isActive, false));
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

router.patch("/admin/users/:id", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_users"), async (req: Request<{ id: string }>, res: Response) => {
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

  const [updated] = await db.transaction(async (tx) => {
    const result = await tx
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id, role: usersTable.role, isActive: usersTable.isActive });

    if (updates.isActive === false) {
      await tx.delete(sessionsTable).where(
        sql`${sessionsTable.sess}->'user'->>'id' = ${id}`,
      );
      req.log.info({ userId: id, adminId: req.user?.id }, "Deleted all sessions for suspended user");
    }

    return result;
  });

  req.log.info({ userId: id, updates, adminId: req.user?.id }, "Admin updated user");
  res.json({ success: true, user: updated });
});

// ADMIN ONLY: Reset another admin's password
router.post("/admin/admins/:id/reset-password", authMiddleware, requireAuth, requireAdmin, async (req: Request<{ id: string }>, res: Response) => {
  const targetId = req.params.id;
  const { password } = req.body as { password?: string };

  if (!targetId) {
    res.status(400).json({ error: "Admin ID is required" });
    return;
  }

  if (targetId === req.user?.id) {
    res.status(400).json({ error: "Use the profile screen to change your own password" });
    return;
  }

  if (!password) {
    res.status(400).json({ error: "New password is required" });
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

  const [target] = await db
    .select({ id: adminsTable.id, isActive: adminsTable.isActive })
    .from(adminsTable)
    .where(eq(adminsTable.id, targetId));

  if (!target) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }

  const salt = generateSalt();
  const hashedPassword = hashPassword(password, salt);
  const passwordHash = `${salt}:${hashedPassword}`;

  await db
    .update(adminsTable)
    .set({ passwordHash, mustChangePassword: true })
    .where(eq(adminsTable.id, targetId));

  req.log.info({ targetAdminId: targetId, resetBy: req.user?.id }, "Admin password reset by another admin");
  res.json({ success: true });
});

// ADMIN ONLY: Get login logs with optional filters
router.get("/admin/login-logs", authMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const page = Math.max(1, queryInt(req.query.page, 1));
  const limit = Math.min(100, Math.max(1, queryInt(req.query.limit, 50)));
  const offset = (page - 1) * limit;
  const role = queryString(req.query.role);
  const success = queryString(req.query.success);
  const from = queryString(req.query.from);
  const to = queryString(req.query.to);

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

// ─── PUBLIC: Service domains list (for registration/profile pickers) ──────────
router.get("/categories/domains", async (req: Request, res: Response) => {
  const domains = await db
    .select({
      id: serviceDomainsTable.id,
      nameEn: serviceDomainsTable.nameEn,
      nameAr: serviceDomainsTable.nameAr,
      icon: serviceDomainsTable.icon,
    })
    .from(serviceDomainsTable)
    .where(eq(serviceDomainsTable.isActive, true))
    .orderBy(serviceDomainsTable.sortOrder, serviceDomainsTable.nameAr);
  res.json({ domains });
});

// ─── PUBLIC: Service specializations list (for pickers) ────────────────────
router.get("/categories/specializations", async (req: Request, res: Response) => {
  const domainId = queryString(req.query.domainId);
  const conditions = [eq(serviceSpecializationsTable.isActive, true)];
  if (domainId) {
    conditions.push(eq(serviceSpecializationsTable.domainId, domainId));
  }
  const specializations = await db
    .select({
      id: serviceSpecializationsTable.id,
      domainId: serviceSpecializationsTable.domainId,
      nameEn: serviceSpecializationsTable.nameEn,
      nameAr: serviceSpecializationsTable.nameAr,
    })
    .from(serviceSpecializationsTable)
    .where(and(...conditions))
    .orderBy(serviceSpecializationsTable.sortOrder, serviceSpecializationsTable.nameAr);
  res.json({ specializations });
});

// ─── PUBLIC: Nested categories (domains + specializations) ────────────────
router.get("/categories", async (req: Request, res: Response) => {
  const domains = await db
    .select({
      id: serviceDomainsTable.id,
      nameEn: serviceDomainsTable.nameEn,
      nameAr: serviceDomainsTable.nameAr,
      icon: serviceDomainsTable.icon,
      sortOrder: serviceDomainsTable.sortOrder,
    })
    .from(serviceDomainsTable)
    .where(eq(serviceDomainsTable.isActive, true))
    .orderBy(serviceDomainsTable.sortOrder, serviceDomainsTable.nameAr);

  const specializations = await db
    .select({
      id: serviceSpecializationsTable.id,
      domainId: serviceSpecializationsTable.domainId,
      nameEn: serviceSpecializationsTable.nameEn,
      nameAr: serviceSpecializationsTable.nameAr,
      sortOrder: serviceSpecializationsTable.sortOrder,
    })
    .from(serviceSpecializationsTable)
    .where(eq(serviceSpecializationsTable.isActive, true))
    .orderBy(serviceSpecializationsTable.sortOrder, serviceSpecializationsTable.nameAr);

  const specsByDomain: Record<string, typeof specializations> = {};
  for (const spec of specializations) {
    if (!specsByDomain[spec.domainId]) specsByDomain[spec.domainId] = [];
    specsByDomain[spec.domainId].push(spec);
  }

  const categories = domains.map((d) => ({ ...d, specializations: specsByDomain[d.id] ?? [] }));
  res.json({ categories });
});

// ─── SUPER-ADMIN: List all admins (for permissions management) ────────────
router.get("/admin/admins-list", authMiddleware, requireAuth, requireAdmin, requireSuperAdmin, async (_req: Request, res: Response) => {
  const rows = await db
    .select({ id: adminsTable.id, firstName: adminsTable.firstName, lastName: adminsTable.lastName, email: adminsTable.email, isSuperAdmin: adminsTable.isSuperAdmin, isActive: adminsTable.isActive })
    .from(adminsTable)
    .orderBy(adminsTable.firstName);
  const admins = rows.map((r) => ({
    id: r.id,
    name: [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email || r.id,
    email: r.email,
    isSuperAdmin: r.isSuperAdmin,
    isActive: r.isActive,
  }));
  res.json({ admins });
});

// ─── ADMIN: Get own permissions & super-admin flag ─────────────────────────
router.get("/admin/my-permissions", authMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const rec = req.__adminRecord;
  res.json({ permissions: rec?.permissions ?? [], isSuperAdmin: rec?.isSuperAdmin ?? false });
});

// ─── SUPER-ADMIN: Get any admin's permissions ──────────────────────────────
router.get("/admin/:adminId/permissions", authMiddleware, requireAuth, requireAdmin, requireSuperAdmin, async (req: Request<{ adminId: string }>, res: Response) => {
  const [admin] = await db
    .select({ id: adminsTable.id, firstName: adminsTable.firstName, lastName: adminsTable.lastName, permissions: adminsTable.permissions, isSuperAdmin: adminsTable.isSuperAdmin })
    .from(adminsTable)
    .where(eq(adminsTable.id, req.params.adminId));
  if (!admin) { res.status(404).json({ error: "Admin not found" }); return; }
  const adminName = [admin.firstName, admin.lastName].filter(Boolean).join(" ") || req.params.adminId;
  res.json({ permissions: admin.permissions ?? [], isSuperAdmin: admin.isSuperAdmin, adminId: admin.id, adminName });
});

// ─── SUPER-ADMIN: Set any admin's permissions ─────────────────────────────
router.put("/admin/:adminId/permissions", authMiddleware, requireAuth, requireAdmin, requireSuperAdmin, async (req: Request<{ adminId: string }>, res: Response) => {
  const { permissions } = req.body as { permissions?: string[] };
  if (!Array.isArray(permissions)) {
    res.status(400).json({ error: "permissions must be an array of strings" });
    return;
  }
  const [target] = await db.select({ id: adminsTable.id, isSuperAdmin: adminsTable.isSuperAdmin }).from(adminsTable).where(eq(adminsTable.id, req.params.adminId));
  if (!target) { res.status(404).json({ error: "Admin not found" }); return; }
  if (target.isSuperAdmin) { res.status(400).json({ error: "Cannot modify super-admin permissions" }); return; }
  await db.update(adminsTable).set({ permissions }).where(eq(adminsTable.id, req.params.adminId));
  req.log.info({ byAdmin: req.user?.id, targetAdmin: req.params.adminId, permCount: permissions.length }, "Admin permissions updated by super-admin");
  res.json({ success: true, permissions });
});

// ─── PATCH alias: PATCH /admin/users/:id/permissions (task spec contract) ─────
router.patch("/admin/users/:id/permissions", authMiddleware, requireAuth, requireAdmin, requireSuperAdmin, async (req: Request<{ id: string }>, res: Response) => {
  const { permissions } = req.body as { permissions?: string[] };
  if (!Array.isArray(permissions)) {
    res.status(400).json({ error: "permissions must be an array of strings" });
    return;
  }
  const [target] = await db.select({ id: adminsTable.id, isSuperAdmin: adminsTable.isSuperAdmin }).from(adminsTable).where(eq(adminsTable.id, req.params.id));
  if (!target) { res.status(404).json({ error: "Admin not found" }); return; }
  if (target.isSuperAdmin) { res.status(400).json({ error: "Cannot modify super-admin permissions" }); return; }
  await db.update(adminsTable).set({ permissions }).where(eq(adminsTable.id, req.params.id));
  req.log.info({ byAdmin: req.user?.id, targetAdmin: req.params.id, permCount: permissions.length }, "Admin permissions updated via PATCH alias");
  res.json({ success: true, permissions });
});

// ─── Admin order force-status override (requires override_orders permission) ──
const ALLOWED_FORCE_STATUSES = ["pending", "acknowledged", "in_progress", "completed", "cancelled"] as const;
type ForceStatus = typeof ALLOWED_FORCE_STATUSES[number];

router.patch("/admin/orders/:id/force-status", authMiddleware, requireAuth, requireAdmin, requirePermission("override_orders"), async (req: Request<{ id: string }>, res: Response) => {
  const { status, reason } = req.body as { status?: string; reason?: string };
  if (!status || !(ALLOWED_FORCE_STATUSES as readonly string[]).includes(status)) {
    res.status(400).json({ error: `status must be one of: ${ALLOWED_FORCE_STATUSES.join(", ")}` });
    return;
  }
  const [order] = await db.select({ id: ordersTable.id, status: ordersTable.status }).from(ordersTable).where(eq(ordersTable.id, req.params.id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const [updated] = await db
    .update(ordersTable)
    .set({ status: status as ForceStatus, updatedAt: new Date() })
    .where(eq(ordersTable.id, req.params.id))
    .returning({ id: ordersTable.id, status: ordersTable.status });
  req.log.info({ byAdmin: req.user?.id, orderId: req.params.id, from: order.status, to: status, reason }, "Admin force-overrode order status");
  res.json({ success: true, order: updated });
});

// ─── PUBLIC: Nested categories via admin path (active domains + specializations only) ─
router.get("/admin/categories", async (req: Request, res: Response) => {
  const domains = await db
    .select()
    .from(serviceDomainsTable)
    .where(eq(serviceDomainsTable.isActive, true))
    .orderBy(serviceDomainsTable.sortOrder, serviceDomainsTable.nameAr);

  const specializations = await db
    .select()
    .from(serviceSpecializationsTable)
    .where(eq(serviceSpecializationsTable.isActive, true))
    .orderBy(serviceSpecializationsTable.sortOrder, serviceSpecializationsTable.nameAr);

  const specsByDomain: Record<string, typeof specializations> = {};
  for (const spec of specializations) {
    if (!specsByDomain[spec.domainId]) specsByDomain[spec.domainId] = [];
    specsByDomain[spec.domainId].push(spec);
  }

  const categories = domains.map((d) => ({
    ...d,
    specializations: specsByDomain[d.id] ?? [],
  }));

  res.json({ categories });
});

// ─── ADMIN: List all service domains ──────────────────────────────────────
router.get("/admin/categories/domains", authMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const domains = await db
    .select()
    .from(serviceDomainsTable)
    .orderBy(serviceDomainsTable.sortOrder, serviceDomainsTable.nameAr);

  const specCounts = await db
    .select({
      domainId: serviceSpecializationsTable.domainId,
      count: sql<number>`count(*)::int`,
    })
    .from(serviceSpecializationsTable)
    .groupBy(serviceSpecializationsTable.domainId);

  const countMap: Record<string, number> = {};
  for (const row of specCounts) countMap[row.domainId] = row.count;

  const result = domains.map((d) => ({ ...d, specializationCount: countMap[d.id] ?? 0 }));
  res.json({ domains: result });
});

// ─── ADMIN: Create service domain ─────────────────────────────────────────
router.post("/admin/categories/domains", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_categories"), async (req: Request, res: Response) => {
  const { nameEn, nameAr, icon, sortOrder } = req.body as { nameEn?: string; nameAr?: string; icon?: string; sortOrder?: number };
  if (!nameAr?.trim()) { res.status(400).json({ error: "nameAr is required" }); return; }
  const [domain] = await db
    .insert(serviceDomainsTable)
    .values({ nameEn: nameEn?.trim() ?? "", nameAr: nameAr.trim(), icon: icon?.trim() || null, sortOrder: sortOrder ?? 0 })
    .returning();
  res.status(201).json({ domain });
});

// ─── ADMIN: Update service domain ─────────────────────────────────────────
router.patch("/admin/categories/domains/:id", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_categories"), async (req: Request<{ id: string }>, res: Response) => {
  const { nameEn, nameAr, icon, isActive, sortOrder } = req.body as { nameEn?: string; nameAr?: string; icon?: string; isActive?: boolean; sortOrder?: number };
  const updates: Record<string, unknown> = {};
  if (nameEn !== undefined) updates.nameEn = nameEn.trim();
  if (nameAr !== undefined) updates.nameAr = nameAr.trim();
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (icon !== undefined) updates.icon = icon.trim() || null;
  if (isActive !== undefined) updates.isActive = isActive;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
  const [domain] = await db
    .update(serviceDomainsTable)
    .set(updates)
    .where(eq(serviceDomainsTable.id, req.params.id))
    .returning();
  if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }
  res.json({ domain });
});

// ─── ADMIN: Delete service domain ─────────────────────────────────────────
router.delete("/admin/categories/domains/:id", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_categories"), async (req: Request<{ id: string }>, res: Response) => {
  const [deleted] = await db
    .delete(serviceDomainsTable)
    .where(eq(serviceDomainsTable.id, req.params.id))
    .returning({ id: serviceDomainsTable.id });
  if (!deleted) { res.status(404).json({ error: "Domain not found" }); return; }
  res.json({ success: true });
});

// ─── ADMIN: List specializations (optionally filtered by domain) ──────────
router.get("/admin/categories/specializations", authMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const domainId = queryString(req.query.domainId);
  const conditions = domainId ? [eq(serviceSpecializationsTable.domainId, domainId)] : undefined;
  const specializations = await db
    .select()
    .from(serviceSpecializationsTable)
    .where(conditions ? and(...conditions) : undefined)
    .orderBy(serviceSpecializationsTable.sortOrder, serviceSpecializationsTable.nameAr);
  res.json({ specializations });
});

// ─── ADMIN: Create specialization ─────────────────────────────────────────
router.post("/admin/categories/specializations", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_categories"), async (req: Request, res: Response) => {
  const { domainId, nameEn, nameAr, sortOrder } = req.body as { domainId?: string; nameEn?: string; nameAr?: string; sortOrder?: number };
  if (!domainId?.trim()) { res.status(400).json({ error: "domainId is required" }); return; }
  if (!nameAr?.trim()) { res.status(400).json({ error: "nameAr is required" }); return; }
  const [domain] = await db.select({ id: serviceDomainsTable.id }).from(serviceDomainsTable).where(eq(serviceDomainsTable.id, domainId.trim()));
  if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }
  const [spec] = await db
    .insert(serviceSpecializationsTable)
    .values({ domainId: domainId.trim(), nameEn: nameEn?.trim() ?? "", nameAr: nameAr.trim(), sortOrder: sortOrder ?? 0 })
    .returning();
  res.status(201).json({ specialization: spec });
});

// ─── ADMIN: Update specialization ─────────────────────────────────────────
router.patch("/admin/categories/specializations/:id", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_categories"), async (req: Request<{ id: string }>, res: Response) => {
  const { nameEn, nameAr, isActive, sortOrder } = req.body as { nameEn?: string; nameAr?: string; isActive?: boolean; sortOrder?: number };
  const updates: Record<string, unknown> = {};
  if (nameEn !== undefined) updates.nameEn = nameEn.trim();
  if (nameAr !== undefined) updates.nameAr = nameAr.trim();
  if (isActive !== undefined) updates.isActive = isActive;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
  const [spec] = await db
    .update(serviceSpecializationsTable)
    .set(updates)
    .where(eq(serviceSpecializationsTable.id, req.params.id))
    .returning();
  if (!spec) { res.status(404).json({ error: "Specialization not found" }); return; }
  res.json({ specialization: spec });
});

// ─── ADMIN: Delete specialization ─────────────────────────────────────────
router.delete("/admin/categories/specializations/:id", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_categories"), async (req: Request<{ id: string }>, res: Response) => {
  const [deleted] = await db
    .delete(serviceSpecializationsTable)
    .where(eq(serviceSpecializationsTable.id, req.params.id))
    .returning({ id: serviceSpecializationsTable.id });
  if (!deleted) { res.status(404).json({ error: "Specialization not found" }); return; }
  res.json({ success: true });
});

// ─── ADMIN: P&L Report ────────────────────────────────────────────────────
router.get("/admin/reports/pnl", authMiddleware, requireAuth, requireAdmin, requirePermission("view_reports"), async (req: Request, res: Response) => {
  const { from, to, period } = req.query as { from?: string; to?: string; period?: string };

  // Determine date range
  let fromDate: Date;
  let toDate: Date = new Date();

  if (from && to) {
    fromDate = new Date(from);
    toDate = new Date(to);
  } else {
    fromDate = new Date();
    if (period === "week") {
      fromDate.setDate(fromDate.getDate() - 7);
    } else if (period === "year") {
      fromDate.setFullYear(fromDate.getFullYear() - 1);
    } else {
      // default: month
      fromDate.setMonth(fromDate.getMonth() - 1);
    }
  }

  // Compute prior period: same duration, immediately before fromDate
  const durationMs = toDate.getTime() - fromDate.getTime();
  const priorToDate = new Date(fromDate.getTime() - 1); // 1 ms before current period starts
  const priorFromDate = new Date(priorToDate.getTime() - durationMs + 1);

  const conditions = [
    eq(invoicesTable.invoiceType, "admin"),
    gte(invoicesTable.createdAt, fromDate),
    lte(invoicesTable.createdAt, toDate),
  ];

  const priorConditions = [
    eq(invoicesTable.invoiceType, "admin"),
    gte(invoicesTable.createdAt, priorFromDate),
    lte(invoicesTable.createdAt, priorToDate),
  ];

  const [[totals], [priorTotals]] = await Promise.all([
    db
      .select({
        orderCount: sql<number>`count(*)::int`,
        totalLabour: sql<string>`coalesce(sum(${invoicesTable.labourFee}::numeric), 0)`,
        totalServiceFee: sql<string>`coalesce(sum(${invoicesTable.serviceFeeAmount}::numeric), 0)`,
        totalVat: sql<string>`coalesce(sum(${invoicesTable.vatAmount}::numeric), 0)`,
        totalRevenue: sql<string>`coalesce(sum(${invoicesTable.total}::numeric), 0)`,
      })
      .from(invoicesTable)
      .where(and(...conditions)),
    db
      .select({
        orderCount: sql<number>`count(*)::int`,
        totalServiceFee: sql<string>`coalesce(sum(${invoicesTable.serviceFeeAmount}::numeric), 0)`,
        totalRevenue: sql<string>`coalesce(sum(${invoicesTable.total}::numeric), 0)`,
      })
      .from(invoicesTable)
      .where(and(...priorConditions)),
  ]);

  // Category breakdown
  const catRows = await db
    .select({
      category: invoicesTable.category,
      orderCount: sql<number>`count(*)::int`,
      revenue: sql<string>`coalesce(sum(${invoicesTable.total}::numeric), 0)`,
    })
    .from(invoicesTable)
    .where(and(...conditions))
    .groupBy(invoicesTable.category)
    .orderBy(desc(sql`sum(${invoicesTable.total}::numeric)`));

  const totalLabour = parseFloat(totals?.totalLabour ?? "0");
  const combinedServiceFee = parseFloat(totals?.totalServiceFee ?? "0");
  const vatCollected = parseFloat(totals?.totalVat ?? "0");
  const totalPlatformRevenue = parseFloat(totals?.totalRevenue ?? "0");

  // Platform charges 15% from technician and 15% from client; serviceFeeAmount is the combined amount
  const technicianServiceFee = combinedServiceFee / 2;
  const clientServiceFee = combinedServiceFee / 2;
  // Net platform profit = service fees (excluding VAT which is a pass-through to tax authority)
  const netPlatformProfit = combinedServiceFee;

  // Prior period totals
  const priorCombinedServiceFee = parseFloat(priorTotals?.totalServiceFee ?? "0");
  const priorTotalPlatformRevenue = parseFloat(priorTotals?.totalRevenue ?? "0");
  const priorNetPlatformProfit = priorCombinedServiceFee;

  res.json({
    period: { from: fromDate.toISOString(), to: toDate.toISOString() },
    orderCount: totals?.orderCount ?? 0,
    totalLabour,
    technicianServiceFee,
    clientServiceFee,
    vatCollected,
    totalPlatformRevenue,
    netPlatformProfit,
    prior: {
      period: { from: priorFromDate.toISOString(), to: priorToDate.toISOString() },
      orderCount: priorTotals?.orderCount ?? 0,
      totalPlatformRevenue: priorTotalPlatformRevenue,
      netPlatformProfit: priorNetPlatformProfit,
    },
    categoryBreakdown: catRows.map((r) => ({
      category: r.category ?? "unknown",
      orderCount: r.orderCount,
      revenue: parseFloat(r.revenue),
    })),
  });
});

// ─── ADMIN: Balance Sheet Report ──────────────────────────────────────────
router.get("/admin/reports/balance-sheet", authMiddleware, requireAuth, requireAdmin, requirePermission("view_reports"), async (req: Request, res: Response) => {
  const { year } = req.query as { year?: string };
  const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();

  const fromDate = new Date(`${targetYear}-01-01T00:00:00Z`);
  const toDate = new Date(`${targetYear}-12-31T23:59:59Z`);

  const monthlyRows = await db
    .select({
      month: sql<number>`extract(month from ${invoicesTable.createdAt})::int`,
      orderCount: sql<number>`count(*)::int`,
      revenue: sql<string>`coalesce(sum(${invoicesTable.total}::numeric), 0)`,
      serviceFees: sql<string>`coalesce(sum(${invoicesTable.serviceFeeAmount}::numeric), 0)`,
      vat: sql<string>`coalesce(sum(${invoicesTable.vatAmount}::numeric), 0)`,
    })
    .from(invoicesTable)
    .where(and(
      eq(invoicesTable.invoiceType, "admin"),
      gte(invoicesTable.createdAt, fromDate),
      lte(invoicesTable.createdAt, toDate),
    ))
    .groupBy(sql`extract(month from ${invoicesTable.createdAt})`)
    .orderBy(sql`extract(month from ${invoicesTable.createdAt})`);

  const catRows = await db
    .select({
      category: invoicesTable.category,
      revenue: sql<string>`coalesce(sum(${invoicesTable.total}::numeric), 0)`,
    })
    .from(invoicesTable)
    .where(and(
      eq(invoicesTable.invoiceType, "admin"),
      gte(invoicesTable.createdAt, fromDate),
      lte(invoicesTable.createdAt, toDate),
    ))
    .groupBy(invoicesTable.category)
    .orderBy(desc(sql`sum(${invoicesTable.total}::numeric)`));

  // Build 12-month grid with running totals
  let runningTotal = 0;
  const months = Array.from({ length: 12 }, (_, i) => {
    const row = monthlyRows.find((r) => r.month === i + 1);
    const revenue = parseFloat(row?.revenue ?? "0");
    runningTotal += revenue;
    return {
      month: i + 1,
      orderCount: row?.orderCount ?? 0,
      revenue,
      serviceFees: parseFloat(row?.serviceFees ?? "0"),
      vat: parseFloat(row?.vat ?? "0"),
      runningTotal,
    };
  });

  res.json({
    year: targetYear,
    months,
    totalRevenue: runningTotal,
    categoryBreakdown: catRows.map((r) => ({
      category: r.category ?? "unknown",
      revenue: parseFloat(r.revenue),
    })),
  });
});

// ─── ADMIN: Annual Report ─────────────────────────────────────────────────
router.get("/admin/reports/annual", authMiddleware, requireAuth, requireAdmin, requirePermission("view_reports"), async (req: Request, res: Response) => {
  const { year, from, to } = req.query as { year?: string; from?: string; to?: string };

  const conditions: ReturnType<typeof eq>[] = [eq(invoicesTable.invoiceType, "admin") as ReturnType<typeof eq>];
  if (year) {
    const y = parseInt(year, 10);
    conditions.push(gte(invoicesTable.createdAt, new Date(`${y}-01-01T00:00:00Z`)) as ReturnType<typeof eq>);
    conditions.push(lte(invoicesTable.createdAt, new Date(`${y}-12-31T23:59:59Z`)) as ReturnType<typeof eq>);
  } else {
    if (from) conditions.push(gte(invoicesTable.createdAt, new Date(from)) as ReturnType<typeof eq>);
    if (to) conditions.push(lte(invoicesTable.createdAt, new Date(to)) as ReturnType<typeof eq>);
  }

  const yearlyRows = await db
    .select({
      year: sql<number>`extract(year from ${invoicesTable.createdAt})::int`,
      orderCount: sql<number>`count(*)::int`,
      totalRevenue: sql<string>`coalesce(sum(${invoicesTable.total}::numeric), 0)`,
    })
    .from(invoicesTable)
    .where(and(...conditions))
    .groupBy(sql`extract(year from ${invoicesTable.createdAt})`)
    .orderBy(sql`extract(year from ${invoicesTable.createdAt})`);

  const years = yearlyRows.map((r) => ({
    year: r.year,
    orderCount: r.orderCount,
    totalRevenue: parseFloat(r.totalRevenue),
    avgRevenuePerOrder: r.orderCount > 0 ? parseFloat(r.totalRevenue) / r.orderCount : 0,
  }));

  res.json({ years });
});

router.get(
  "/admin/technicians/:id/availability-log",
  authMiddleware,
  requireAuth,
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const limitRaw = queryInt(req.query.limit, 200);
    const limit = Math.min(Math.max(1, limitRaw), 500);

    const fromRaw = queryString(req.query.from);
    const toRaw = queryString(req.query.to);

    const [tech] = await db
      .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable)
      .where(and(eq(usersTable.id, id), eq(usersTable.role, "technician")));

    if (!tech) {
      res.status(404).json({ error: "Technician not found" });
      return;
    }

    const DATE_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

    function parseDateParam(raw: string, endOfDay: boolean): Date | null {
      if (!DATE_RE.test(raw)) return null;
      const [y, mo, d] = raw.split("-").map(Number);
      const ms = Date.UTC(y, mo - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
      const dt = new Date(ms);
      if (isNaN(dt.getTime())) return null;
      // Reject normalised dates (e.g. Feb 31 → Mar 3)
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
      return dt;
    }

    const fromDate = fromRaw != null ? parseDateParam(fromRaw, false) : null;
    const toDate = toRaw != null ? parseDateParam(toRaw, true) : null;

    if ((fromRaw && !fromDate) || (toRaw && !toDate)) {
      res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD (e.g. 2026-04-01)" });
      return;
    }
    if (fromDate && toDate && fromDate > toDate) {
      res.status(400).json({ error: "'from' must not be later than 'to'" });
      return;
    }

    const conditions = [eq(availabilityAuditLogsTable.technicianId, id)];
    if (fromDate) conditions.push(gte(availabilityAuditLogsTable.createdAt, fromDate));
    if (toDate) conditions.push(lte(availabilityAuditLogsTable.createdAt, toDate));

    const logs = await db
      .select({
        id: availabilityAuditLogsTable.id,
        changedById: availabilityAuditLogsTable.changedById,
        changedByRole: availabilityAuditLogsTable.changedByRole,
        oldValue: availabilityAuditLogsTable.oldValue,
        newValue: availabilityAuditLogsTable.newValue,
        createdAt: availabilityAuditLogsTable.createdAt,
      })
      .from(availabilityAuditLogsTable)
      .where(and(...conditions))
      .orderBy(desc(availabilityAuditLogsTable.createdAt))
      .limit(limit);

    const changerIds = [...new Set(logs.map((l) => l.changedById))];

    const userNames: Record<string, string> = {};
    if (changerIds.length > 0) {
      const techChangers = await db
        .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName })
        .from(usersTable)
        .where(sql`${usersTable.id} = ANY(${changerIds})`);
      for (const u of techChangers) {
        userNames[u.id] = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.id;
      }

      const adminChangers = await db
        .select({ id: adminsTable.id, firstName: adminsTable.firstName, lastName: adminsTable.lastName })
        .from(adminsTable)
        .where(sql`${adminsTable.id} = ANY(${changerIds})`);
      for (const a of adminChangers) {
        userNames[a.id] = [a.firstName, a.lastName].filter(Boolean).join(" ") || a.id;
      }
    }

    const enriched = logs.map((l) => ({
      id: l.id,
      changedById: l.changedById,
      changedByName: userNames[l.changedById] ?? l.changedById,
      changedByRole: l.changedByRole,
      oldValue: l.oldValue,
      newValue: l.newValue,
      createdAt: l.createdAt,
    }));

    res.json({ technicianId: id, logs: enriched });
  },
);

// ─── ADMIN: Re-geocode technicians with no map location ──────────────────────
router.post(
  "/admin/technicians/backfill-locations",
  authMiddleware,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    req.log.info({ adminId: req.user?.id }, "Admin triggered backfill-locations");

    const result = await backfillTechnicianLocations((msg) =>
      req.log.info({ adminId: req.user?.id }, `backfill-locations: ${msg}`),
    );

    req.log.info(
      { ...result, adminId: req.user?.id },
      "backfill-locations complete",
    );

    res.json({ success: true, ...result });
  },
);

// ─── ADMIN: Location Aliases ──────────────────────────────────────────────────

// List aliases (optionally filtered by locationId)
router.get(
  "/admin/location-aliases",
  authMiddleware,
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const locationId = queryString(req.query.locationId);

    const rows = await db
      .select({
        id: locationAliasesTable.id,
        locationId: locationAliasesTable.locationId,
        alias: locationAliasesTable.alias,
        note: locationAliasesTable.note,
        createdAt: locationAliasesTable.createdAt,
        locationSlug: locationsTable.slug,
        locationNameEn: locationsTable.nameEn,
      })
      .from(locationAliasesTable)
      .innerJoin(locationsTable, eq(locationAliasesTable.locationId, locationsTable.id))
      .where(locationId ? eq(locationAliasesTable.locationId, locationId) : undefined)
      .orderBy(asc(locationsTable.slug), asc(locationAliasesTable.alias));

    res.json({ aliases: rows });
  },
);

// Create a new alias
router.post(
  "/admin/location-aliases",
  authMiddleware,
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { locationId, alias, note } = req.body as {
      locationId?: string;
      alias?: string;
      note?: string;
    };

    if (!locationId?.trim() || !alias?.trim()) {
      res.status(400).json({ error: "locationId and alias are required" });
      return;
    }

    const [location] = await db
      .select({ id: locationsTable.id })
      .from(locationsTable)
      .where(eq(locationsTable.id, locationId.trim()));
    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    const normalizedAlias = alias.trim().toLowerCase();

    // Check whether this alias text already exists for a *different* location.
    // The unique constraint only prevents same-location duplicates; cross-location
    // collisions are allowed but result in non-deterministic alias resolution.
    const [collision] = await db
      .select({ locationId: locationAliasesTable.locationId, locationSlug: locationsTable.slug })
      .from(locationAliasesTable)
      .innerJoin(locationsTable, eq(locationAliasesTable.locationId, locationsTable.id))
      .where(and(eq(locationAliasesTable.alias, normalizedAlias), ne(locationAliasesTable.locationId, locationId.trim())));

    let created: (typeof locationAliasesTable.$inferSelect) | undefined;
    try {
      [created] = await db
        .insert(locationAliasesTable)
        .values({ locationId: locationId.trim(), alias: normalizedAlias, note: note?.trim() ?? null })
        .returning();
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "23505") {
        res.status(409).json({ error: "This alias already exists for the specified location" });
        return;
      }
      throw err;
    }

    req.log.info({ adminId: req.user?.id, aliasId: created!.id, locationId, alias: normalizedAlias }, "Location alias created");
    invalidateLocationCache();

    const responseBody: Record<string, unknown> = { alias: created };
    if (collision) {
      responseBody.warning = `Alias "${normalizedAlias}" already exists for location "${collision.locationSlug}". Resolution is non-deterministic when the same alias is mapped to multiple locations.`;
      req.log.warn({ adminId: req.user?.id, alias: normalizedAlias, conflictingLocationId: collision.locationId }, "Cross-location alias collision created");
    }
    res.status(201).json(responseBody);
  },
);

// Update an existing alias
router.patch(
  "/admin/location-aliases/:id",
  authMiddleware,
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const { alias, note } = req.body as { alias?: string; note?: string };

    if (!alias?.trim() && note === undefined) {
      res.status(400).json({ error: "Provide at least one of alias or note to update" });
      return;
    }

    const updates: Partial<{ alias: string; note: string | null }> = {};
    if (alias?.trim()) updates.alias = alias.trim().toLowerCase();
    if (note !== undefined) updates.note = note?.trim() || null;

    let updated: (typeof locationAliasesTable.$inferSelect) | undefined;
    try {
      [updated] = await db
        .update(locationAliasesTable)
        .set(updates)
        .where(eq(locationAliasesTable.id, id))
        .returning();
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "23505") {
        res.status(409).json({ error: "This alias already exists for the specified location" });
        return;
      }
      throw err;
    }

    if (!updated) {
      res.status(404).json({ error: "Alias not found" });
      return;
    }

    req.log.info({ adminId: req.user?.id, aliasId: id, updates }, "Location alias updated");
    invalidateLocationCache();

    res.json({ alias: updated });
  },
);

// Delete an alias
router.delete(
  "/admin/location-aliases/:id",
  authMiddleware,
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);

    const [deleted] = await db
      .delete(locationAliasesTable)
      .where(eq(locationAliasesTable.id, id))
      .returning({ id: locationAliasesTable.id });

    if (!deleted) {
      res.status(404).json({ error: "Alias not found" });
      return;
    }

    req.log.info({ adminId: req.user?.id, aliasId: id }, "Location alias deleted");
    invalidateLocationCache();

    res.json({ success: true, deleted: id });
  },
);

/**
 * GET /admin/location-misses
 *
 * Returns the most-common pin drops that could not be matched to any governorate
 * or area. Sorted by seen_count DESC so the team can prioritise which aliases or
 * new areas to add.
 *
 * Query params:
 *   limit  – max rows to return (default 50, max 200)
 *   offset – pagination offset (default 0)
 */
router.get(
  "/admin/location-misses",
  authMiddleware,
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const rawLimit  = parseInt(String(req.query.limit  ?? ""), 10);
    const rawOffset = parseInt(String(req.query.offset ?? ""), 10);
    const limit  = Math.min(Number.isFinite(rawLimit)  && rawLimit  > 0 ? rawLimit  : 50, 200);
    const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;

    const rows = await db
      .select()
      .from(locationMissLogTable)
      .orderBy(desc(locationMissLogTable.seenCount), desc(locationMissLogTable.lastSeenAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(locationMissLogTable);

    res.json({ total, limit, offset, misses: rows });
  },
);

/**
 * DELETE /admin/location-misses/:id
 *
 * Remove a single miss row once it has been resolved (alias added, area created, etc.).
 */
router.delete(
  "/admin/location-misses/:id",
  authMiddleware,
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const id = String(req.params.id);

    await db.delete(locationMissLogTable).where(eq(locationMissLogTable.id, id));

    req.log.info({ adminId: req.user?.id, missId: id }, "Location miss log row deleted");
    res.json({ success: true, deleted: id });
  },
);

export default router;
