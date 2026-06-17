/**
 * Integration tests for query-parameter handling on GET /orders/pending.
 *
 * These tests verify that non-string values (arrays, objects) passed for
 * `governorate` and `area` are silently ignored (not forwarded to the DB
 * query), while valid plain strings are accepted and applied as filters.
 *
 * The drizzle-orm `and()` function is spied on so the tests can assert
 * exactly how many conditions are forwarded to the WHERE clause — proving
 * that malformed params are truly dropped, not just silently ignored.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import { createServer } from "node:http";

vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...real,
    and: vi.fn((...args: Parameters<typeof real.and>) => real.and(...args)),
  };
});

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  },
  ordersTable: {
    status: "status",
    governorate: "governorate",
    area: "area",
    createdAt: "created_at",
  },
  invoicesTable: {},
  usersTable: {},
  pool: { connect: vi.fn().mockRejectedValue(new Error("no db in tests")) },
}));

vi.mock("../lib/orderBroadcaster", () => ({
  broadcastNewOrder: vi.fn(),
  broadcastOrderStatusToClient: vi.fn(),
  removeOrderFromPending: vi.fn(),
  broadcastOrderCancelledToTechnicians: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../lib/pushNotifications", () => ({
  sendOrderStatusPushNotification: vi.fn(),
}));

vi.mock("../lib/email", () => ({
  sendInvoiceEmails: vi.fn(),
}));

vi.mock("../middlewares/authMiddleware", () => ({
  authMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const mockUserRole = vi.hoisted(() => ({ role: "technician" as "technician" | "admin" | "client" }));

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user: unknown }).user = { id: "user-1", role: mockUserRole.role };
    next();
  },
}));

vi.mock("../lib/locationNormalizer", () => ({
  normalizeToSlug: vi.fn().mockResolvedValue(null),
  isSlug: vi.fn().mockReturnValue(true),
  locationsMatch: vi.fn().mockResolvedValue(true),
  invalidateLocationCache: vi.fn(),
}));

const ordersRouter = (await import("./orders")).default;

const { db } = await import("@workspace/db") as unknown as {
  db: Record<string, ReturnType<typeof vi.fn>>;
};

const { and: andSpy } = await import("drizzle-orm") as unknown as {
  and: ReturnType<typeof vi.fn>;
};

async function get(qs: string): Promise<{ status: number; body: unknown }> {
  const app = express();
  app.use(express.json());
  app.use(ordersRouter);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  try {
    const response = await fetch(`http://localhost:${port}/orders/pending${qs}`);
    const body = await response.json();
    return { status: response.status, body };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("GET /orders/pending — query-parameter handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRole.role = "technician";
    db.select.mockReturnThis();
    db.from.mockReturnThis();
    db.where.mockReturnThis();
    db.orderBy.mockResolvedValue([]);
  });

  it("returns 403 when user is a client (not technician/admin)", async () => {
    mockUserRole.role = "client";
    const { status } = await get("");
    expect(status).toBe(403);
  });

  it("returns 200 with an orders array when no query params are given", async () => {
    const { status, body } = await get("");
    expect(status).toBe(200);
    expect((body as { orders: unknown[] }).orders).toBeInstanceOf(Array);
  });

  describe("governorate — condition forwarding", () => {
    it("forwards exactly 1 WHERE condition when governorate is absent (status only)", async () => {
      await get("");
      // and() should have been called with exactly 1 condition (status = pending)
      expect(andSpy).toHaveBeenCalled();
      expect(andSpy.mock.calls[0].length).toBe(1);
    });

    it("forwards exactly 1 WHERE condition when governorate is an array (array ignored)", async () => {
      await get("?governorate[]=cairo&governorate[]=giza");
      expect(andSpy).toHaveBeenCalled();
      expect(andSpy.mock.calls[0].length).toBe(1);
    });

    it("forwards 2 WHERE conditions when governorate is a plain string (filter applied)", async () => {
      await get("?governorate=cairo");
      expect(andSpy).toHaveBeenCalled();
      expect(andSpy.mock.calls[0].length).toBe(2);
    });

    it("returns 200 with an orders array when governorate is a valid string", async () => {
      const { status, body } = await get("?governorate=cairo");
      expect(status).toBe(200);
      expect((body as { orders: unknown[] }).orders).toBeInstanceOf(Array);
    });

    it("returns 200 with an orders array when governorate is an empty string (no filter)", async () => {
      const { status, body } = await get("?governorate=");
      expect(status).toBe(200);
      expect((body as { orders: unknown[] }).orders).toBeInstanceOf(Array);
    });
  });

  describe("area — condition forwarding", () => {
    it("forwards exactly 1 WHERE condition when area is absent (status only)", async () => {
      await get("");
      expect(andSpy.mock.calls[0].length).toBe(1);
    });

    it("forwards exactly 1 WHERE condition when area is an array (array ignored)", async () => {
      await get("?area[]=maadi&area[]=zamalek");
      expect(andSpy.mock.calls[0].length).toBe(1);
    });

    it("forwards 2 WHERE conditions when area is a plain string (filter applied)", async () => {
      await get("?area=nasr_city");
      expect(andSpy.mock.calls[0].length).toBe(2);
    });
  });

  describe("governorate + area combined — condition forwarding", () => {
    it("forwards 3 conditions when both governorate and area are valid strings", async () => {
      await get("?governorate=cairo&area=nasr_city");
      expect(andSpy.mock.calls[0].length).toBe(3);
    });

    it("forwards 2 conditions when governorate is valid but area is an array (area ignored)", async () => {
      await get("?governorate=cairo&area[]=maadi&area[]=zamalek");
      expect(andSpy.mock.calls[0].length).toBe(2);
    });

    it("forwards 1 condition when both are arrays (both ignored)", async () => {
      await get("?governorate[]=cairo&area[]=maadi");
      expect(andSpy.mock.calls[0].length).toBe(1);
    });
  });

  it("returns 200 when user is admin (admin also has access)", async () => {
    mockUserRole.role = "admin";
    const { status, body } = await get("");
    expect(status).toBe(200);
    expect((body as { orders: unknown[] }).orders).toBeInstanceOf(Array);
  });
});
