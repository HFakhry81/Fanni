/**
 * Integration tests for query-parameter handling on GET /technicians/available.
 *
 * These tests verify that non-string values (arrays, objects), missing params,
 * out-of-range floats, and invalid integers are handled gracefully — the server
 * must not crash and must apply sensible defaults / ignore bad values.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import { createServer } from "node:http";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  },
  usersTable: {
    role: "role",
    isAvailable: "is_available",
    governorate: "governorate",
    area: "area",
    profession: "profession",
    serviceCategories: "service_categories",
    id: "id",
    firstName: "first_name",
    lastName: "last_name",
    profileImageUrl: "profile_image_url",
    specialty: "specialty",
  },
  ordersTable: {},
  availabilityAuditLogsTable: {},
  pool: {
    connect: vi.fn().mockRejectedValue(new Error("no db in tests")),
  },
}));

vi.mock("../lib/orderBroadcaster", () => ({
  broadcastAvailabilityChangedToTechnician: vi.fn(),
  broadcastNewOrder: vi.fn(),
  broadcastOrderStatusToClient: vi.fn(),
  removeOrderFromPending: vi.fn(),
  broadcastOrderCancelledToTechnicians: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../middlewares/authMiddleware", () => ({
  authMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user: unknown }).user = { id: "tech-1", role: "technician" };
    next();
  },
}));

vi.mock("../lib/locationNormalizer", () => ({
  locationsMatch: vi.fn().mockResolvedValue(true),
  normalizeToSlug: vi.fn().mockResolvedValue(null),
  isSlug: vi.fn().mockReturnValue(true),
  invalidateLocationCache: vi.fn(),
}));

const techRouter = (await import("./technicians")).default;

const { pool } = await import("@workspace/db") as unknown as {
  pool: { connect: ReturnType<typeof vi.fn> };
};

async function get(qs: string): Promise<{ status: number; body: unknown }> {
  const app = express();
  app.use(techRouter);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  try {
    const response = await fetch(`http://localhost:${port}/technicians/available${qs}`);
    const body = await response.json();
    return { status: response.status, body };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("GET /technicians/available — query-parameter handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("lat / lon", () => {
    it("returns 200 when lat and lon are absent (falls back to text filter)", async () => {
      const { status, body } = await get("");
      expect(status).toBe(200);
      expect((body as { technicians: unknown[] }).technicians).toBeInstanceOf(Array);
    });

    it("returns 200 when lat is an array (invalid — treated as missing)", async () => {
      const { status, body } = await get("?lat[]=30.0&lat[]=31.0&lon=31.0");
      expect(status).toBe(200);
      expect((body as { spatialFilter: boolean }).spatialFilter).toBe(false);
    });

    it("returns 200 when lon is an array (invalid — treated as missing)", async () => {
      const { status, body } = await get("?lat=30.06&lon[]=31.2&lon[]=32.0");
      expect(status).toBe(200);
      expect((body as { spatialFilter: boolean }).spatialFilter).toBe(false);
    });

    it("returns 200 when lat is a non-numeric string (NaN — no spatial filter)", async () => {
      const { status, body } = await get("?lat=abc&lon=31.0");
      expect(status).toBe(200);
      expect((body as { spatialFilter: boolean }).spatialFilter).toBe(false);
    });

    it("returns 200 when lon is a non-numeric string (NaN — no spatial filter)", async () => {
      const { status, body } = await get("?lat=30.06&lon=xyz");
      expect(status).toBe(200);
      expect((body as { spatialFilter: boolean }).spatialFilter).toBe(false);
    });

    it("returns 200 when lat exceeds +90 (out of range — no spatial filter)", async () => {
      const { status, body } = await get("?lat=999&lon=31.0");
      expect(status).toBe(200);
      expect((body as { spatialFilter: boolean }).spatialFilter).toBe(false);
    });

    it("returns 200 when lat is below -90 (out of range — no spatial filter)", async () => {
      const { status, body } = await get("?lat=-91&lon=31.0");
      expect(status).toBe(200);
      expect((body as { spatialFilter: boolean }).spatialFilter).toBe(false);
    });

    it("returns 200 when lon exceeds +180 (out of range — no spatial filter)", async () => {
      const { status, body } = await get("?lat=30.06&lon=181.0");
      expect(status).toBe(200);
      expect((body as { spatialFilter: boolean }).spatialFilter).toBe(false);
    });
  });

  describe("radiusKm", () => {
    /**
     * radiusKm is only included in the JSON response when the spatial path
     * succeeds.  Since pool.connect() is mocked to reject in these tests, the
     * route always falls back to the text-filter path which omits radiusKm
     * from the response.  The parsing/clamping logic itself is verified by
     * the queryParams unit tests; here we only assert the server returns 200.
     */
    it("returns 200 when radiusKm is absent (falls back gracefully)", async () => {
      const { status } = await get("?lat=30.06&lon=31.2");
      expect(status).toBe(200);
    });

    it("returns 200 when radiusKm is zero (treated as invalid — server does not crash)", async () => {
      const { status } = await get("?lat=30.06&lon=31.2&radiusKm=0");
      expect(status).toBe(200);
    });

    it("returns 200 when radiusKm is negative (treated as invalid — server does not crash)", async () => {
      const { status } = await get("?lat=30.06&lon=31.2&radiusKm=-5");
      expect(status).toBe(200);
    });

    it("returns 200 when radiusKm exceeds the cap (server does not crash)", async () => {
      const { status } = await get("?lat=30.06&lon=31.2&radiusKm=500");
      expect(status).toBe(200);
    });

    it("returns 200 when radiusKm is a valid in-range value", async () => {
      const { status } = await get("?lat=30.06&lon=31.2&radiusKm=50");
      expect(status).toBe(200);
    });

    it("returns 200 when radiusKm is an array (treated as missing — server does not crash)", async () => {
      const { status } = await get("?lat=30.06&lon=31.2&radiusKm[]=10&radiusKm[]=20");
      expect(status).toBe(200);
    });

    it("returns 200 when radiusKm is a non-numeric string (treated as missing)", async () => {
      const { status } = await get("?lat=30.06&lon=31.2&radiusKm=far");
      expect(status).toBe(200);
    });
  });

  describe("governorate / area (text-filter path)", () => {
    it("returns 200 and includes governorateFilter when governorate is a plain string", async () => {
      const { status, body } = await get("?governorate=cairo");
      expect(status).toBe(200);
      expect((body as { governorateFilter: string }).governorateFilter).toBe("cairo");
    });

    it("ignores governorate when it is an array (falls back to null filter)", async () => {
      const { status, body } = await get("?governorate[]=cairo&governorate[]=giza");
      expect(status).toBe(200);
      expect((body as { governorateFilter: string | null }).governorateFilter).toBeNull();
    });

    it("ignores area when it is an array (falls back to null filter)", async () => {
      const { status, body } = await get("?area[]=maadi&area[]=zamalek");
      expect(status).toBe(200);
      expect((body as { areaFilter: string | null }).areaFilter).toBeNull();
    });

    it("returns 200 when both governorate and area are valid strings", async () => {
      const { status, body } = await get("?governorate=cairo&area=nasr_city");
      expect(status).toBe(200);
      expect((body as { governorateFilter: string }).governorateFilter).toBe("cairo");
      expect((body as { areaFilter: string }).areaFilter).toBe("nasr_city");
    });
  });

  describe("radiusKm — spatial path assertions (pool succeeds)", () => {
    const mockPgClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
      // Override pool.connect to succeed for these tests
      pool.connect.mockResolvedValue(mockPgClient);
      mockPgClient.query.mockResolvedValue({ rows: [] });
      mockPgClient.release.mockReturnValue(undefined);
    });

    it("returns spatialFilter=true and radiusKm=15 (default) when radiusKm is absent", async () => {
      const { status, body } = await get("?lat=30.06&lon=31.2");
      expect(status).toBe(200);
      expect((body as { spatialFilter: boolean }).spatialFilter).toBe(true);
      expect((body as { radiusKm: number }).radiusKm).toBe(15);
    });

    it("returns radiusKm=15 (default) when radiusKm is zero", async () => {
      const { status, body } = await get("?lat=30.06&lon=31.2&radiusKm=0");
      expect(status).toBe(200);
      expect((body as { radiusKm: number }).radiusKm).toBe(15);
    });

    it("returns radiusKm=15 (default) when radiusKm is negative", async () => {
      const { status, body } = await get("?lat=30.06&lon=31.2&radiusKm=-10");
      expect(status).toBe(200);
      expect((body as { radiusKm: number }).radiusKm).toBe(15);
    });

    it("returns radiusKm=200 (cap) when radiusKm exceeds the maximum", async () => {
      const { status, body } = await get("?lat=30.06&lon=31.2&radiusKm=500");
      expect(status).toBe(200);
      expect((body as { radiusKm: number }).radiusKm).toBe(200);
    });

    it("reflects the provided radiusKm when within valid range", async () => {
      const { status, body } = await get("?lat=30.06&lon=31.2&radiusKm=50");
      expect(status).toBe(200);
      expect((body as { radiusKm: number }).radiusKm).toBe(50);
    });

    it("returns radiusKm=15 (default) when radiusKm is an array", async () => {
      const { status, body } = await get("?lat=30.06&lon=31.2&radiusKm[]=10&radiusKm[]=20");
      expect(status).toBe(200);
      expect((body as { radiusKm: number }).radiusKm).toBe(15);
    });

    it("returns radiusKm=15 (default) when radiusKm is a non-numeric string", async () => {
      const { status, body } = await get("?lat=30.06&lon=31.2&radiusKm=far");
      expect(status).toBe(200);
      expect((body as { radiusKm: number }).radiusKm).toBe(15);
    });
  });
});
