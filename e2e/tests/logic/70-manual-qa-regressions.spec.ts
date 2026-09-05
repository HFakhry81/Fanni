/**
 * Regression tests for bugs found in manual local QA (false-green E2E gaps):
 *  A) Admin list maps en_route → accepted (not pending)
 *  B) Invalid visitDate rejected
 *  C) Client order list includes technician after accept
 */
import { test, expect } from "@playwright/test";
import {
  acceptOrder,
  createOrder,
  ensureTechPoints,
  loginCached,
  requireAllRoles,
  requireWritableTarget,
  writesBlockedReason,
} from "../helpers/apiClient";
import { resolveApiBaseUrl } from "../helpers/prodSafety";
import { markLt } from "../helpers/ui";

test.describe.configure({ mode: "default" });

test.describe("Logic · manual-QA regressions", () => {
  test.beforeEach(() => {
    test.skip(!requireWritableTarget(), writesBlockedReason() ?? "Writes blocked");
    test.skip(!requireAllRoles(), "Need client + tech + admin");
  });

  test.afterEach(async ({ page }, info) => {
    await markLt(page, info);
  });

  test("A) Admin sees accepted — not pending — after tech accept", async () => {
    const client = await loginCached(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    await ensureTechPoints(tech.token, admin.token, 30);

    const created = await createOrder(client.token, {
      problemDescription: "QA regression: admin status sync after accept",
    });
    await acceptOrder(tech.token, created.orderId);

    const res = await fetch(`${resolveApiBaseUrl()}/api/admin/orders?limit=100`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      orders: Array<{ id: string; status: string; dbStatus?: string; technicianName?: string | null }>;
    };
    const row = json.orders.find((o) => o.id === created.orderId);
    expect(row, "order must appear in admin list").toBeTruthy();
    expect(row!.status).toBe("accepted");
    expect(row!.status).not.toBe("pending");
  });

  test("B) Invalid visitDate rejected with clear code", async () => {
    const client = await loginCached(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    let status = 0;
    let code = "";
    try {
      await createOrder(client.token, {
        problemDescription: "QA regression: bad visit date",
        // @ts-expect-error intentional invalid date for API validation
        visitDate: "2026-10-95",
      } as { problemDescription: string });
      // createOrder helper always sends a valid default — hit API raw
    } catch {
      /* ignore */
    }

    const id = `e2e-baddate-${Date.now()}`;
    const res = await fetch(`${resolveApiBaseUrl()}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${client.token}`,
      },
      body: JSON.stringify({
        id,
        orderNumber: id,
        category: process.env.E2E_ORDER_CATEGORY ?? "ac",
        subCategory: "maintenance",
        governorate: process.env.E2E_ORDER_GOVERNORATE ?? "alexandria",
        area: process.env.E2E_ORDER_AREA ?? "alexandria__al_mandara",
        street: "QA Street",
        problemDescription: "QA regression invalid visit date only",
        visitDate: "2026-10-95",
        visitTime: "12:00",
        latitude: 31.21,
        longitude: 29.95,
      }),
    });
    status = res.status;
    const body = (await res.json().catch(() => ({}))) as { code?: string };
    code = body.code ?? "";
    expect(status).toBe(400);
    expect(code).toBe("INVALID_VISIT_DATE");
  });

  test("C) Client order payload includes technician after accept", async () => {
    const client = await loginCached(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    await ensureTechPoints(tech.token, admin.token, 30);

    const created = await createOrder(client.token, {
      problemDescription: "QA regression: client sees technician",
    });
    await acceptOrder(tech.token, created.orderId, {
      name: "E2E Tech Visible",
      mobile: process.env.E2E_TECH_IDENTIFIER ?? "01000000000",
    });

    const res = await fetch(`${resolveApiBaseUrl()}/api/orders`, {
      headers: { Authorization: `Bearer ${client.token}` },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      orders: Array<{ id: string; status: string; technicianId?: string | null; technicianName?: string | null }>;
    };
    const row = json.orders.find((o) => o.id === created.orderId);
    expect(row).toBeTruthy();
    expect(row!.status).toBe("accepted");
    expect(Boolean(row!.technicianId || row!.technicianName)).toBeTruthy();
  });
});
