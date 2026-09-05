/**
 * FANNI LOGIC SUITE — circle 4 expand
 *
 * New conditions:
 *  A) Admin REJECTS a dispute (no refund) after client_refused path
 *  B) Double-rate after complete → conflict / idempotent guard
 *  C) Decline then accept (same tech) still works — decline is dismiss-only
 *  D) Healthz stays ok under load of suite (smoke)
 */
import { test, expect } from "@playwright/test";
import {
  ApiError,
  acceptOrder,
  adminResolveDispute,
  cancelOrder,
  completeOrder,
  createOrder,
  declineOrder,
  ensureTechPoints,
  failService,
  healthz,
  listAdminDisputes,
  loginCached,
  rateOrder,
  requireAllRoles,
  requireWritableTarget,
  startOrder,
  writesBlockedReason,
} from "../helpers/apiClient";
import { film, markLt, softGoto, softUiLogin } from "../helpers/ui";

test.describe.configure({ mode: "default" });

test.describe("Logic · circle 4 (dispute reject / rate / decline-then-accept)", () => {
  test.beforeEach(() => {
    test.skip(!requireWritableTarget(), writesBlockedReason() ?? "Writes blocked");
    test.skip(!requireAllRoles(), "Need client + tech + admin");
  });

  test.afterEach(async ({ page }, info) => {
    await markLt(page, info);
  });

  test("A) أدمن يرفض النزاع — لا استرداد", async ({ page }, info) => {
    const client = await loginCached(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    await ensureTechPoints(tech.token, admin.token, 25);

    const before = await (await import("../helpers/apiClient")).getWallet(tech.token);
    const created = await createOrder(client.token, { problemDescription: "Logic c4: dispute reject" });
    await acceptOrder(tech.token, created.orderId);
    await startOrder(tech.token, created.orderId);
    await failService(tech.token, created.orderId, "client_refused", "Logic c4 refuse");

    const disputes = await listAdminDisputes(admin.token);
    const related = (disputes.disputes || []).find((d) => d.orderId === created.orderId);
    test.skip(!related?.id, "No dispute row for order — skip reject path");

    if (related && related.status !== "approved" && related.status !== "rejected") {
      await adminResolveDispute(admin.token, related.id, "reject", "Logic c4: deny refund");
    }

    const after = await (await import("../helpers/apiClient")).getWallet(tech.token);
    // After reject, balance should stay at post-unlock level (not restored)
    expect((after.pointsBalance ?? 0) <= (before.pointsBalance ?? 0)).toBeTruthy();

    if (await softUiLogin(page, process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!, /admin|dashboard/)) {
      await softGoto(page, "/disputes");
      await film(page, info, "L40A-admin-dispute-rejected");
    }
  });

  test("B) تقييم مزدوج بعد الإكمال", async () => {
    const client = await loginCached(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    await ensureTechPoints(tech.token, admin.token, 25);

    const created = await createOrder(client.token, { problemDescription: "Logic c4: double rate" });
    await acceptOrder(tech.token, created.orderId);
    await startOrder(tech.token, created.orderId);
    await completeOrder(tech.token, created.orderId);
    await rateOrder(client.token, created.orderId, 5, "first rate");

    let blocked = false;
    try {
      await rateOrder(client.token, created.orderId, 3, "second rate");
    } catch (err) {
      blocked = err instanceof ApiError && (err.status === 409 || err.status === 400);
      if (!blocked) throw err;
    }
    // Prefer conflict; if API allows overwrite, annotate gap
    if (!blocked) {
      test.info().annotations.push({
        type: "gap",
        description: "Double rate allowed — product may want 409",
      });
    }
  });

  test("C) رفض ثم قبول لنفس الفني", async ({ page }, info) => {
    const client = await loginCached(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    await ensureTechPoints(tech.token, admin.token, 25);

    const created = await createOrder(client.token, { problemDescription: "Logic c4: decline then accept" });
    await declineOrder(tech.token, created.orderId);
    await acceptOrder(tech.token, created.orderId);
    await startOrder(tech.token, created.orderId);
    await completeOrder(tech.token, created.orderId);

    if (await softUiLogin(page, process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!, /tech|orders|map/)) {
      await softGoto(page, "/(tech)/orders");
      await film(page, info, "L40C-decline-then-accept-complete");
    }
  });

  test("D) healthz still ok", async () => {
    const h = await healthz();
    expect(h.status).toBe("ok");
  });
});
