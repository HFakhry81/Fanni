import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const adminRow = vi.hoisted(() => ({
  id: "admin-1",
  isActive: true,
  isSuperAdmin: true,
  permissions: null as string[] | null,
  mustChangePassword: true,
}));

vi.mock("@workspace/db", () => {
  const db = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([adminRow]),
  };
  return { db, adminsTable: {} };
});

const { requireAdmin } = await import("./requireAdmin");

function mockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("requireAdmin mustChangePassword", () => {
  beforeEach(() => {
    adminRow.mustChangePassword = true;
    adminRow.isActive = true;
  });

  it("blocks financial admin routes until password changed", async () => {
    const req = {
      user: { id: "admin-1", role: "admin" },
      sessionSource: "admin",
      originalUrl: "/api/admin/payments",
      path: "/admin/payments",
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(403);
    expect((res.body as { code?: string }).code).toBe("MUST_CHANGE_PASSWORD");
    expect(next).not.toHaveBeenCalled();
  });

  it("allows my-permissions while flag is set", async () => {
    const req = {
      user: { id: "admin-1", role: "admin" },
      sessionSource: "admin",
      originalUrl: "/api/admin/my-permissions",
      path: "/admin/my-permissions",
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("allows all routes after password changed", async () => {
    adminRow.mustChangePassword = false;
    const req = {
      user: { id: "admin-1", role: "admin" },
      sessionSource: "admin",
      originalUrl: "/api/admin/payments",
      path: "/admin/payments",
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
