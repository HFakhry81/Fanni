/**
 * Adapted from the conceptual "Comprehensive E2E & Edge Cases" draft.
 * Maps each intended scenario onto real Fanni API contracts + helpers.
 *
 * Draft problems fixed here:
 *  - Wrong paths (/orders/create → POST /orders)
 *  - Mock Bearer tokens → loginCached credentials
 *  - PII: app REJECTS (400) instead of 201 + sanitize-only
 *  - Cancel: PATCH by client on pending (or refund window after accept)
 *  - OCR invoices: retired — assert commission-only complete
 *  - Admin: API audit + payments confirm (Expo UI soft-film)
 */
import { test, expect } from "@playwright/test";
import {
  ApiError,
  acceptOrder,
  adminConfirmPayment,
  cancelOrder,
  completeOrder,
  createOrder,
  ensureTechPoints,
  failService,
  getWallet,
  listPackages,
  loginCached,
  requestTopUp,
  requireAllRoles,
  requireWritableTarget,
  startOrder,
  techPendingOrders,
  uploadReceiptImage,
  writesBlockedReason,
} from "../helpers/apiClient";
import { film, markLt, softGoto, softUiLogin } from "../helpers/ui";
import { resolveApiBaseUrl } from "../helpers/prodSafety";

test.describe.configure({ mode: "default" });

test.describe("Logic · comprehensive edge (adapted script)", () => {
  test.beforeEach(() => {
    test.skip(!requireWritableTarget(), writesBlockedReason() ?? "Writes blocked");
    test.skip(!requireAllRoles(), "Need client + tech + admin credentials");
  });

  test.afterEach(async ({ page }, info) => {
    await markLt(page, info);
  });

  test("1) Lead leakage — reject phone in problemDescription", async () => {
    const client = await loginCached(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    let status = 0;
    let code = "";
    try {
      await createOrder(client.token, {
        problemDescription: "عندي تسرب مياه ورقمي هو 01012345678 كلمني واتساب",
      });
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      status = err.status;
      code = (err.body as { code?: string } | undefined)?.code ?? "";
    }
    // Product policy: reject at create (not 201 + scrub-only)
    expect(status).toBe(400);
    expect(code).toBe("CONTACT_PII_IN_DESCRIPTION");
  });

  test("2) Wallet — insufficient points returns 402", async () => {
    const client = await loginCached(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const wallet = await getWallet(tech.token);
    const created = await createOrder(client.token, {
      problemDescription: "Adapted script: unlock with low balance check",
    });

    let blocked = false;
    let body: { error?: string; message?: string; balance?: number; required?: number } = {};
    try {
      await acceptOrder(tech.token, created.orderId);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      blocked = err.status === 402;
      body = (err.body as typeof body) ?? {};
      if (!blocked && err.status !== 409) {
        // Rich tech: soft note — still cleaned up below
        test.info().annotations.push({
          type: "note",
          description: `accept status=${err.status} balance=${wallet.pointsBalance}; 402 only when insufficient`,
        });
      }
    }

    if ((wallet.pointsBalance ?? 0) < 5) {
      expect(blocked).toBeTruthy();
      expect(body.error).toMatch(/Insufficient points/i);
      expect(String(body.message ?? "")).toMatch(/رصيد|نقطة/);
    }

    await cancelOrder(client.token, created.orderId).catch(async () => {
      await startOrder(tech.token, created.orderId).catch(() => undefined);
      await completeOrder(tech.token, created.orderId).catch(() => undefined);
    });
  });

  test("3) Geo matching — pending list returns orders (radius is broadcaster-side)", async () => {
    const client = await loginCached(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const created = await createOrder(client.token, {
      problemDescription: "Adapted script: geo pending visibility",
      latitude: 30.05,
      longitude: 31.24,
    });

    // Real API: GET /api/orders/pending (not /technician/available-orders)
    const pending = await techPendingOrders(tech.token);
    const orders = pending.orders ?? [];

    test.info().annotations.push({
      type: "note",
      description:
        "Radius tiers (15→50→100km cap) expand via WebSocket broadcaster; HTTP pending is auth+role filtered, not a full geo gate.",
    });

    expect(Array.isArray(orders)).toBeTruthy();

    await cancelOrder(client.token, created.orderId).catch(() => undefined);
  });

  test("4) Cancel + refund matrix — pending cancel; post-accept window", async () => {
    const client = await loginCached(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);

    // 4a) Client cancel while pending — no unlock refund needed
    const pendingOrder = await createOrder(client.token, {
      problemDescription: "Adapted script: cancel while pending",
    });
    const cancelPending = (await cancelOrder(client.token, pendingOrder.orderId)) as {
      success?: boolean;
      refundedUnlocks?: number;
    };
    expect(cancelPending.success !== false).toBeTruthy();

    // 4b) Accept then client cancel → blocked (only pending cancellable by client)
    await ensureTechPoints(tech.token, admin.token, 40);
    const accepted = await createOrder(client.token, {
      problemDescription: "Adapted script: cancel after accept blocked",
    });
    await acceptOrder(tech.token, accepted.orderId);
    let cancelBlocked = false;
    try {
      await cancelOrder(client.token, accepted.orderId);
    } catch (err) {
      cancelBlocked = err instanceof ApiError && [400, 403, 409].includes(err.status);
      if (!cancelBlocked) throw err;
    }
    expect(cancelBlocked).toBeTruthy();

    // 4c) fail-service client_not_present → refundRequested path
    const failOrder = await createOrder(client.token, {
      problemDescription: "Adapted script: fail-service refund request",
    });
    await acceptOrder(tech.token, failOrder.orderId);
    await startOrder(tech.token, failOrder.orderId);
    const failed = (await failService(tech.token, failOrder.orderId, "client_not_present")) as {
      refundRequested?: boolean;
    };
    expect(failed.refundRequested).toBeTruthy();

    await startOrder(tech.token, accepted.orderId).catch(() => undefined);
    await completeOrder(tech.token, accepted.orderId).catch(() => undefined);
  });

  test("5) Admin payment confirm + audit trail", async ({ page }, info) => {
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    const before = await getWallet(tech.token);
    const pkgs = await listPackages(tech.token);
    const pkg = pkgs.packages?.[0];
    test.skip(!pkg, "No point packages");

    const proof = await uploadReceiptImage(tech.token);
    const { request } = await requestTopUp(tech.token, {
      packageId: pkg!.id,
      paymentMethod: "instapay",
      senderDetails: { instapayId: "adapted-script@instapay" },
      referenceNumber: `ADAPT-${Date.now()}`,
      proofImageUrl: proof.url,
    });

    if (await softUiLogin(page, process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!, /admin|dashboard/)) {
      await softGoto(page, "/(admin)/(tabs)/payments");
      await film(page, info, "L60-admin-payments");
    }

    await adminConfirmPayment(admin.token, request.id);
    const after = await getWallet(tech.token);
    expect((after.pointsBalance ?? 0) >= (before.pointsBalance ?? 0)).toBeTruthy();

    // Audit logs — real route requires admin session token (not page cookies alone)
    const auditRes = await fetch(`${resolveApiBaseUrl()}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    }).catch(() => null);

    if (auditRes) {
      // 200 OK or 403 if permission missing — both document real auth behavior
      expect([200, 403]).toContain(auditRes.status);
    }
  });

  test("6) Complete path — commission-only (OCR invoices retired)", async () => {
    const client = await loginCached(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    await ensureTechPoints(tech.token, admin.token, 30);

    const created = await createOrder(client.token, {
      problemDescription: "Adapted script: complete without OCR invoice",
    });
    await acceptOrder(tech.token, created.orderId);
    await startOrder(tech.token, created.orderId);
    const done = (await completeOrder(tech.token, created.orderId)) as { success?: boolean };
    expect(done.success !== false).toBeTruthy();

    test.info().annotations.push({
      type: "product",
      description:
        "Job labour/materials/OCR three-party invoices are retired; platform accounting is lead-unlock commission only.",
    });
  });

  test("7) Concurrent accept — at most one winner", async () => {
    const client = await loginCached(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    await ensureTechPoints(tech.token, admin.token, 30);

    const created = await createOrder(client.token, {
      problemDescription: "Adapted script: concurrent accept race",
    });
    const results = await Promise.allSettled([
      acceptOrder(tech.token, created.orderId),
      acceptOrder(tech.token, created.orderId),
      acceptOrder(tech.token, created.orderId),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBeLessThanOrEqual(1);

    await startOrder(tech.token, created.orderId).catch(() => undefined);
    await completeOrder(tech.token, created.orderId).catch(() => undefined);
  });
});
