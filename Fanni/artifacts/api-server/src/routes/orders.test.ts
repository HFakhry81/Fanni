import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import { createServer } from "node:http";

const mockUser = vi.hoisted(() => ({ role: "client" as "client" | "admin" }));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ orderSerial: 1, id: "test-id" }]),
    set: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: "test-id" }]),
  },
  ordersTable: {},
  invoicesTable: {},
  pool: { connect: vi.fn() },
}));

vi.mock("../lib/orderBroadcaster", () => ({
  broadcastNewOrder: vi.fn(),
  broadcastOrderStatusToClient: vi.fn(),
  removeOrderFromPending: vi.fn(),
  broadcastOrderCancelledToTechnicians: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../middlewares/authMiddleware", () => ({
  authMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  },
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user: unknown }).user = { id: "user-1", role: mockUser.role };
    next();
  },
}));

vi.mock("../lib/locationNormalizer", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/locationNormalizer")>();
  return {
    ...original,
    normalizeToSlug: vi.fn(),
    isSlug: original.isSlug,
    validateAreaBelongsToGovernorate: vi.fn().mockResolvedValue(true),
  };
});

const { normalizeToSlug, validateAreaBelongsToGovernorate } = await import("../lib/locationNormalizer");
const normalizeToSlugMock = normalizeToSlug as ReturnType<typeof vi.fn>;
const validateAreaBelongsToGovernorateMock = validateAreaBelongsToGovernorate as ReturnType<typeof vi.fn>;

const ordersRouterModule = await import("./orders");
const ordersRouter = ordersRouterModule.default;

async function makeRequest(
  method: "POST" | "PATCH",
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const app = express();
  app.use(express.json());
  app.use(ordersRouter);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  try {
    const response = await fetch(`http://localhost:${port}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const responseBody = await response.json();
    return { status: response.status, body: responseBody };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("POST /orders — slug safeguard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.role = "client";
    validateAreaBelongsToGovernorateMock.mockResolvedValue(true);
  });

  it("rejects with 400 when governorate normalizes to null (unmatched against cache)", async () => {
    normalizeToSlugMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const { status, body } = await makeRequest("POST", "/orders", { id: "ord-1", category: "plumbing", governorate: "totally unknown region" });

    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/governorate/i);
    expect((body as { error: string }).error).toMatch(/could not be matched/i);
  });

  it("rejects with 400 when a slug-shaped but unmatched governorate returns null (false-positive guard)", async () => {
    normalizeToSlugMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const { status, body } = await makeRequest("POST", "/orders", { id: "ord-2", category: "plumbing", governorate: "foobar" });

    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/governorate/i);
    expect((body as { error: string }).error).toMatch(/could not be matched/i);
  });

  it("rejects with 400 when area normalizes to null (unmatched against cache)", async () => {
    normalizeToSlugMock
      .mockResolvedValueOnce("cairo")
      .mockResolvedValueOnce(null);

    const { status, body } = await makeRequest("POST", "/orders", { id: "ord-3", category: "plumbing", governorate: "cairo", area: "totally unknown area" });

    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/area/i);
    expect((body as { error: string }).error).toMatch(/could not be matched/i);
  });

  it("rejects with 400 when normalized value is not a valid slug format (cold-cache fallback)", async () => {
    normalizeToSlugMock
      .mockResolvedValueOnce("القاهرة")
      .mockResolvedValueOnce(null);

    const { status, body } = await makeRequest("POST", "/orders", { id: "ord-4", category: "plumbing", governorate: "القاهرة" });

    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/governorate/i);
  });

  it("accepts order when area and governorate normalize to valid slugs", async () => {
    const { db } = await import("@workspace/db");
    const dbMock = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
    dbMock.returning.mockResolvedValue([{ orderSerial: 1, id: "ord-5" }]);

    normalizeToSlugMock
      .mockResolvedValueOnce("cairo")
      .mockResolvedValueOnce("cairo__nasr_city");

    const { status } = await makeRequest("POST", "/orders", { id: "ord-5", category: "plumbing", governorate: "cairo", area: "nasr city" });

    expect(status).toBe(201);
  });

  it("accepts order when neither area nor governorate is provided (both null)", async () => {
    const { db } = await import("@workspace/db");
    const dbMock = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
    dbMock.returning.mockResolvedValue([{ orderSerial: 2, id: "ord-6" }]);

    normalizeToSlugMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const { status } = await makeRequest("POST", "/orders", { id: "ord-6", category: "plumbing" });

    expect(status).toBe(201);
  });

  it("rejects with 400 when area slug does not belong to the submitted governorate", async () => {
    normalizeToSlugMock
      .mockResolvedValueOnce("cairo")
      .mockResolvedValueOnce("giza__sheikh_zayed");

    validateAreaBelongsToGovernorateMock.mockResolvedValue(false);

    const { status, body } = await makeRequest("POST", "/orders", { id: "ord-7", category: "plumbing", governorate: "cairo", area: "sheikh zayed" });

    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/does not belong to governorate/i);
  });

  it("accepts order when area slug correctly belongs to the submitted governorate", async () => {
    const { db } = await import("@workspace/db");
    const dbMock = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
    dbMock.returning.mockResolvedValue([{ orderSerial: 3, id: "ord-8" }]);

    normalizeToSlugMock
      .mockResolvedValueOnce("cairo")
      .mockResolvedValueOnce("cairo__nasr_city");

    validateAreaBelongsToGovernorateMock.mockResolvedValue(true);

    const { status } = await makeRequest("POST", "/orders", { id: "ord-8", category: "plumbing", governorate: "cairo", area: "nasr city" });

    expect(status).toBe(201);
  });
});

describe("PATCH /orders/:id — slug safeguard on update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.role = "admin";
    validateAreaBelongsToGovernorateMock.mockResolvedValue(true);
  });

  it("rejects with 400 when updated governorate normalizes to null (unmatched)", async () => {
    normalizeToSlugMock.mockResolvedValueOnce(null);

    const { status, body } = await makeRequest("PATCH", "/orders/ord-1", { governorate: "completely unknown place" });

    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/governorate/i);
    expect((body as { error: string }).error).toMatch(/could not be matched/i);
  });

  it("rejects with 400 when slug-shaped but unmatched governorate returns null on update (false-positive guard)", async () => {
    normalizeToSlugMock.mockResolvedValueOnce(null);

    const { status, body } = await makeRequest("PATCH", "/orders/ord-2", { governorate: "foobar" });

    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/governorate/i);
    expect((body as { error: string }).error).toMatch(/could not be matched/i);
  });

  it("rejects with 400 when updated area normalizes to null (unmatched)", async () => {
    normalizeToSlugMock.mockResolvedValueOnce(null);

    const { status, body } = await makeRequest("PATCH", "/orders/ord-3", { area: "nowhere land" });

    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/area/i);
    expect((body as { error: string }).error).toMatch(/could not be matched/i);
  });

  it("rejects with 400 when normalized area is not a valid slug format on update (cold-cache fallback)", async () => {
    normalizeToSlugMock.mockResolvedValueOnce("منطقة مجهولة");

    const { status, body } = await makeRequest("PATCH", "/orders/ord-4", { area: "منطقة مجهولة" });

    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/area/i);
  });

  it("accepts update when both area and governorate normalize to valid slugs", async () => {
    const { db } = await import("@workspace/db");
    const dbMock = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
    dbMock.returning.mockResolvedValue([{ id: "ord-5" }]);

    normalizeToSlugMock
      .mockResolvedValueOnce("giza")
      .mockResolvedValueOnce("giza__sheikh_zayed");

    const { status } = await makeRequest("PATCH", "/orders/ord-5", { governorate: "giza", area: "sheikh zayed" });

    expect(status).toBe(200);
  });

  it("forbids non-admin users from updating order location fields", async () => {
    mockUser.role = "client";

    const { status, body } = await makeRequest("PATCH", "/orders/ord-6", { governorate: "cairo" });

    expect(status).toBe(403);
    expect((body as { error: string }).error).toMatch(/admin/i);
  });

  it("rejects with 400 when updated area slug does not belong to the updated governorate", async () => {
    normalizeToSlugMock
      .mockResolvedValueOnce("cairo")
      .mockResolvedValueOnce("giza__sheikh_zayed");

    validateAreaBelongsToGovernorateMock.mockResolvedValue(false);

    const { status, body } = await makeRequest("PATCH", "/orders/ord-7", { governorate: "cairo", area: "sheikh zayed" });

    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/does not belong to governorate/i);
  });

  it("accepts update when area slug correctly belongs to the updated governorate", async () => {
    const { db } = await import("@workspace/db");
    const dbMock = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
    dbMock.returning.mockResolvedValue([{ id: "ord-8" }]);

    normalizeToSlugMock
      .mockResolvedValueOnce("giza")
      .mockResolvedValueOnce("giza__sheikh_zayed");

    validateAreaBelongsToGovernorateMock.mockResolvedValue(true);

    const { status } = await makeRequest("PATCH", "/orders/ord-8", { governorate: "giza", area: "sheikh zayed" });

    expect(status).toBe(200);
  });
});
