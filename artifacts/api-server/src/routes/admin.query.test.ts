/**
 * Integration tests for query-parameter handling on:
 *   GET /admin/users         (page / limit / role / search)
 *   GET /admin/login-logs    (page / limit / role / success / from / to)
 *
 * These tests verify that non-string values (arrays, objects), missing params,
 * and invalid integers are handled gracefully — the server must not crash,
 * must apply sensible defaults, and must ignore malformed inputs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import { createServer } from "node:http";

const ADMIN_RECORD = {
  id: "admin-1",
  isActive: true,
  isSuperAdmin: true,
  permissions: null,
};

/**
 * The db mock is designed so that:
 *  - All chain methods (select / from / where / orderBy / limit / groupBy)
 *    return the same `db` object for further chaining.
 *  - `db` itself is thenable, so `await db.select().from().where()` resolves to
 *    [ADMIN_RECORD].  This satisfies the requireAdmin middleware check without any
 *    per-test wiring.
 *  - `offset()` resolves to [] so paginated queries yield an empty result set.
 *
 * net result: requireAdmin passes (admin record found), actual list queries
 * return empty arrays, and count queries report total = 0 — all 200 OK.
 */
vi.mock("@workspace/db", () => {
  const db: Record<string, unknown> = {
    then(resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) {
      return Promise.resolve([ADMIN_RECORD]).then(resolve, reject);
    },
    catch(reject: (e: unknown) => unknown) {
      return Promise.resolve([ADMIN_RECORD]).catch(reject);
    },
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    groupBy: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    returning: vi.fn(),
    values: vi.fn(),
    transaction: vi.fn(),
  };

  // All chain methods return `db` itself (fluent interface)
  for (const method of ["select", "from", "where", "orderBy", "limit", "groupBy", "insert", "update", "set", "values", "returning"]) {
    (db[method] as ReturnType<typeof vi.fn>).mockReturnValue(db);
  }

  // offset is the terminal call for paginated queries — resolves to empty list
  (db["offset"] as ReturnType<typeof vi.fn>).mockResolvedValue([]);

  // transaction is not used by the tested routes but must exist
  (db["transaction"] as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

  return {
    db,
    usersTable: {},
    adminsTable: {},
    loginLogsTable: {},
    ordersTable: {},
    invoicesTable: {},
    sessionsTable: {},
    serviceDomainsTable: {},
    serviceSpecializationsTable: {},
    availabilityAuditLogsTable: {},
    locationsTable: {},
    locationAliasesTable: {},
    locationMissLogTable: {},
    pool: { connect: vi.fn().mockRejectedValue(new Error("no db in tests")) },
  };
});

vi.mock("../lib/locationNormalizer", () => ({
  normalizeToSlug: vi.fn().mockResolvedValue(null),
  isSlug: vi.fn().mockReturnValue(true),
  locationsMatch: vi.fn().mockResolvedValue(true),
  invalidateLocationCache: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../lib/backfillLocations", () => ({
  backfillTechnicianLocations: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/otp", () => ({
  verifyOtpToken: vi.fn().mockReturnValue(null),
}));

vi.mock("../lib/orderBroadcaster", () => ({
  broadcastNewOrder: vi.fn(),
  broadcastOrderStatusToClient: vi.fn(),
  removeOrderFromPending: vi.fn(),
  broadcastOrderCancelledToTechnicians: vi.fn(),
  broadcastAvailabilityChangedToTechnician: vi.fn(),
}));

vi.mock("../middlewares/authMiddleware", () => ({
  authMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user: unknown; sessionSource: string }).user = {
      id: "admin-1",
      role: "admin",
    };
    (req as express.Request & { sessionSource: string }).sessionSource = "admin";
    next();
  },
}));

const adminRouter = (await import("./admin")).default;
const { db: dbMock } = await import("@workspace/db") as unknown as {
  db: Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
  };
};

function restoreDbMock() {
  for (const m of ["select", "from", "where", "orderBy", "limit", "groupBy", "insert", "update", "set", "values", "returning"]) {
    dbMock[m].mockReturnValue(dbMock);
  }
  dbMock["offset"].mockResolvedValue([]);
  dbMock["transaction"].mockResolvedValue(undefined);
}

async function get(path: string, qs: string): Promise<{ status: number; body: unknown }> {
  const app = express();
  app.use(express.json());
  app.use(adminRouter);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  try {
    const response = await fetch(`http://localhost:${port}${path}${qs}`);
    const body = await response.json();
    return { status: response.status, body };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("GET /admin/users — query-parameter handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreDbMock();
  });

  describe("page", () => {
    it("returns page=1 in pagination when page is absent", async () => {
      const { status, body } = await get("/admin/users", "");
      expect(status).toBe(200);
      expect((body as { pagination: { page: number } }).pagination.page).toBe(1);
    });

    it("returns page=1 in pagination when page is a non-numeric string", async () => {
      const { status, body } = await get("/admin/users", "?page=abc");
      expect(status).toBe(200);
      expect((body as { pagination: { page: number } }).pagination.page).toBe(1);
    });

    it("returns page=1 in pagination when page is an array (multi-value ignored)", async () => {
      const { status, body } = await get("/admin/users", "?page[]=1&page[]=2");
      expect(status).toBe(200);
      expect((body as { pagination: { page: number } }).pagination.page).toBe(1);
    });

    it("returns page=1 in pagination when page is negative (clamped to 1)", async () => {
      const { status, body } = await get("/admin/users", "?page=-5");
      expect(status).toBe(200);
      expect((body as { pagination: { page: number } }).pagination.page).toBe(1);
    });

    it("returns page=1 in pagination when page is 0 (clamped to 1)", async () => {
      const { status, body } = await get("/admin/users", "?page=0");
      expect(status).toBe(200);
      expect((body as { pagination: { page: number } }).pagination.page).toBe(1);
    });

    it("reflects the parsed page number when a valid integer is provided", async () => {
      const { status, body } = await get("/admin/users", "?page=3");
      expect(status).toBe(200);
      expect((body as { pagination: { page: number } }).pagination.page).toBe(3);
    });
  });

  describe("limit", () => {
    it("returns limit=20 (default) in pagination when limit is absent", async () => {
      const { status, body } = await get("/admin/users", "");
      expect(status).toBe(200);
      expect((body as { pagination: { limit: number } }).pagination.limit).toBe(20);
    });

    it("returns limit=20 (default) in pagination when limit is an array (multi-value ignored)", async () => {
      const { status, body } = await get("/admin/users", "?limit[]=10&limit[]=20");
      expect(status).toBe(200);
      expect((body as { pagination: { limit: number } }).pagination.limit).toBe(20);
    });

    it("returns limit=20 (default) in pagination when limit is a non-numeric string", async () => {
      const { status, body } = await get("/admin/users", "?limit=many");
      expect(status).toBe(200);
      expect((body as { pagination: { limit: number } }).pagination.limit).toBe(20);
    });

    it("returns limit=1 in pagination when limit is 0 (clamped to minimum)", async () => {
      const { status, body } = await get("/admin/users", "?limit=0");
      expect(status).toBe(200);
      expect((body as { pagination: { limit: number } }).pagination.limit).toBe(1);
    });

    it("returns limit=100 in pagination when limit exceeds max (capped at 100)", async () => {
      const { status, body } = await get("/admin/users", "?limit=999");
      expect(status).toBe(200);
      expect((body as { pagination: { limit: number } }).pagination.limit).toBe(100);
    });
  });

  describe("role", () => {
    it("returns 200 when role is a valid plain string (technician)", async () => {
      const { status } = await get("/admin/users", "?role=technician");
      expect(status).toBe(200);
    });

    it("returns 200 when role is an array (ignored — returns all users)", async () => {
      const { status } = await get("/admin/users", "?role[]=client&role[]=technician");
      expect(status).toBe(200);
    });

    it("returns 200 when role is an unknown value (ignored)", async () => {
      const { status } = await get("/admin/users", "?role=superuser");
      expect(status).toBe(200);
    });
  });

  describe("search", () => {
    it("returns 200 when search is a plain string", async () => {
      const { status } = await get("/admin/users", "?search=ahmed");
      expect(status).toBe(200);
    });

    it("returns 200 when search is an array (ignored — no filter applied)", async () => {
      const { status } = await get("/admin/users", "?search[]=ahmed&search[]=ali");
      expect(status).toBe(200);
    });
  });
});

describe("GET /admin/login-logs — query-parameter handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreDbMock();
  });

  describe("page / limit", () => {
    it("returns page=1 and limit=50 (defaults) in pagination when absent", async () => {
      const { status, body } = await get("/admin/login-logs", "");
      expect(status).toBe(200);
      const { pagination } = body as { pagination: { page: number; limit: number } };
      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(50);
    });

    it("returns page=1 in pagination when page is an array (multi-value ignored)", async () => {
      const { status, body } = await get("/admin/login-logs", "?page[]=2&page[]=3");
      expect(status).toBe(200);
      expect((body as { pagination: { page: number } }).pagination.page).toBe(1);
    });

    it("returns limit=50 (default) in pagination when limit is an array (multi-value ignored)", async () => {
      const { status, body } = await get("/admin/login-logs", "?limit[]=25&limit[]=50");
      expect(status).toBe(200);
      expect((body as { pagination: { limit: number } }).pagination.limit).toBe(50);
    });

    it("returns page=1 in pagination when page is a non-numeric string", async () => {
      const { status, body } = await get("/admin/login-logs", "?page=first");
      expect(status).toBe(200);
      expect((body as { pagination: { page: number } }).pagination.page).toBe(1);
    });

    it("returns limit=50 (default) in pagination when limit is a non-numeric string", async () => {
      const { status, body } = await get("/admin/login-logs", "?limit=all");
      expect(status).toBe(200);
      expect((body as { pagination: { limit: number } }).pagination.limit).toBe(50);
    });

    it("returns limit=100 in pagination when limit exceeds max (capped at 100)", async () => {
      const { status, body } = await get("/admin/login-logs", "?limit=500");
      expect(status).toBe(200);
      expect((body as { pagination: { limit: number } }).pagination.limit).toBe(100);
    });

    it("returns page=1 in pagination when page is negative (clamped to 1)", async () => {
      const { status, body } = await get("/admin/login-logs", "?page=-1");
      expect(status).toBe(200);
      expect((body as { pagination: { page: number } }).pagination.page).toBe(1);
    });
  });

  describe("role", () => {
    it("returns 200 when role is a valid plain string (admin)", async () => {
      const { status } = await get("/admin/login-logs", "?role=admin");
      expect(status).toBe(200);
    });

    it("returns 200 when role is an array (ignored — no filter applied)", async () => {
      const { status } = await get("/admin/login-logs", "?role[]=admin&role[]=client");
      expect(status).toBe(200);
    });

    it("returns 200 when role is an unknown value (ignored)", async () => {
      const { status } = await get("/admin/login-logs", "?role=hacker");
      expect(status).toBe(200);
    });
  });

  describe("success", () => {
    it("returns 200 when success=true (string — filter applied)", async () => {
      const { status } = await get("/admin/login-logs", "?success=true");
      expect(status).toBe(200);
    });

    it("returns 200 when success=false (string — filter applied)", async () => {
      const { status } = await get("/admin/login-logs", "?success=false");
      expect(status).toBe(200);
    });

    it("returns 200 when success is an array (ignored — no filter)", async () => {
      const { status } = await get("/admin/login-logs", "?success[]=true&success[]=false");
      expect(status).toBe(200);
    });

    it("returns 200 when success is absent (no filter applied)", async () => {
      const { status } = await get("/admin/login-logs", "");
      expect(status).toBe(200);
    });

    it("returns 200 when success is an unrecognised string (ignored)", async () => {
      const { status } = await get("/admin/login-logs", "?success=yes");
      expect(status).toBe(200);
    });
  });

  describe("from / to (date range)", () => {
    it("returns 200 when from is a valid ISO date string", async () => {
      const { status } = await get("/admin/login-logs", "?from=2024-01-01T00:00:00.000Z");
      expect(status).toBe(200);
    });

    it("returns 200 when to is a valid ISO date string", async () => {
      const { status } = await get("/admin/login-logs", "?to=2024-12-31T23:59:59.999Z");
      expect(status).toBe(200);
    });

    it("returns 200 when from is an invalid date string (ignored — no crash)", async () => {
      const { status } = await get("/admin/login-logs", "?from=not-a-date");
      expect(status).toBe(200);
    });

    it("returns 200 when to is an invalid date string (ignored — no crash)", async () => {
      const { status } = await get("/admin/login-logs", "?to=yesterday");
      expect(status).toBe(200);
    });

    it("returns 200 when from is an array (ignored — no filter)", async () => {
      const { status } = await get("/admin/login-logs", "?from[]=2024-01-01&from[]=2024-06-01");
      expect(status).toBe(200);
    });

    it("returns 200 when to is an array (ignored — no filter)", async () => {
      const { status } = await get("/admin/login-logs", "?to[]=2024-12-31&to[]=2025-01-01");
      expect(status).toBe(200);
    });

    it("returns 200 when both from and to are valid (range filter applied)", async () => {
      const { status } = await get("/admin/login-logs", "?from=2024-01-01T00:00:00Z&to=2024-12-31T23:59:59Z");
      expect(status).toBe(200);
    });
  });
});
