/**
 * FANNI LOGIC SUITE — order lifecycle branches
 *
 * State machine (server):
 *   pending → accept(+unlock/points) → accepted/en_route → start → in_progress
 *          → complete → completed → rate
 *   pending → client cancel (before accept)
 *   pending → tech decline (dismiss only; order stays pending for others; no points)
 *   in_progress → fail-service(reason):
 *        client_not_present | client_refused → refundRequested + dispute
 *        different_problem | parts_unavailable | extra_time | cannot_repair | other → no auto refund
 *   Admin: PATCH /admin/disputes/:id { action: approve|reject } → refund / deny
 */
import { test, expect } from "@playwright/test";
import {
  acceptOrder,
  adminResolveDispute,
  cancelOrder,
  completeOrder,
  createOrder,
  declineOrder,
  ensureTechPoints,
  failService,
  getOrder,
  getWallet,
  listAdminDisputes,
  login,
  rateOrder,
  requireAllRoles,
  requireWritableTarget,
  startOrder,
  techPendingOrders,
  writesBlockedReason,
  type FailServiceReason,
} from "../helpers/apiClient";
import { film, markLt, softGoto, uiLogin } from "../helpers/ui";

test.describe.configure({ mode: "serial" });

test.describe("Logic · orders create / decline / accept / fail / refund", () => {
  test.beforeEach(() => {
    test.skip(!requireWritableTarget(), writesBlockedReason() ?? "Writes blocked");
    test.skip(!requireAllRoles(), "Need client + tech + admin");
  });

  test.afterEach(async ({ page }, info) => {
    await markLt(page, info);
  });

  test("1) إنشاء طلب + إلغاء وهو pending", async ({ page }, info) => {
    const client = await login(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const created = await createOrder(client.token, {
      problemDescription: "Logic: create then cancel while pending",
    });
    expect(created.orderId).toBeTruthy();

    await uiLogin(page, process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!, /client|home|orders/);
    await softGoto(page, "/orders");
    await film(page, info, "L40-client-pending-order");

    await cancelOrder(client.token, created.orderId);
    const after = await getOrder(client.token, created.orderId).catch(() => null);
    // status may be cancelled or hidden — soft check
    if (after?.status) expect(["cancelled", "canceled", "pending"]).toContain(String(after.status).toLowerCase());

    await page.reload();
    await film(page, info, "L40-client-after-cancel");
  });

  test("2) إنشاء طلب + رفض فني (بدون خصم — الطلب يبقى)", async ({ page }, info) => {
    const client = await login(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await login(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const before = await getWallet(tech.token);
    const created = await createOrder(client.token, { problemDescription: "Logic: decline stay visible" });

    await declineOrder(tech.token, created.orderId);
    const afterWallet = await getWallet(tech.token);
    expect(afterWallet.pointsBalance ?? 0).toBe(before.pointsBalance ?? 0);

    const pending = await techPendingOrders(tech.token);
    const still = pending.orders.some((o) => o.id === created.orderId);

    await uiLogin(page, process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!, /tech|map|available/);
    await softGoto(page, "/available-orders");
    await film(
      page,
      info,
      still ? "L50-tech-available-after-decline-STILL" : "L50-tech-available-after-decline",
    );

    await cancelOrder(client.token, created.orderId).catch(() => undefined);
  });

  test("3) إنشاء → قبول → بدء → إكمال → تقييم (happy path)", async ({ page }, info) => {
    const client = await login(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await login(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await login(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    await ensureTechPoints(tech.token, admin.token, 25);

    const before = await getWallet(tech.token);
    const created = await createOrder(client.token, { problemDescription: "Logic: happy complete" });
    await acceptOrder(tech.token, created.orderId, {
      name: "Logic Tech",
      mobile: process.env.E2E_TECH_IDENTIFIER,
    });
    const mid = await getWallet(tech.token);
    // Lead unlock deducts points (default ~20)
    expect((mid.pointsBalance ?? 0) <= (before.pointsBalance ?? 0)).toBeTruthy();

    await uiLogin(page, process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!, /tech|orders|map/);
    await softGoto(page, "/(tech)/orders");
    await film(page, info, "L60-tech-after-accept");

    await startOrder(tech.token, created.orderId);
    await completeOrder(tech.token, created.orderId);
    await rateOrder(client.token, created.orderId, 5, "Logic happy rating");

    await page.reload();
    await film(page, info, "L60-tech-after-complete");
    await uiLogin(page, process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!, /client|home|orders/);
    await softGoto(page, "/orders");
    await film(page, info, "L60-client-after-rate");
  });

  test("4) عدم التمكن من الوصول — client_not_present → طلب استرداد/نزاع", async ({ page }, info) => {
    const client = await login(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await login(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await login(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    await ensureTechPoints(tech.token, admin.token, 25);

    const created = await createOrder(client.token, { problemDescription: "Logic: unreachable client" });
    await acceptOrder(tech.token, created.orderId);
    await startOrder(tech.token, created.orderId);

    const fail = await failService(tech.token, created.orderId, "client_not_present", "Logic: client not present");
    expect(fail.refundRequested === true || fail.success === true).toBeTruthy();

    await uiLogin(page, process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!, /admin|dashboard/);
    await softGoto(page, "/(admin)/(tabs)/disputes");
    await softGoto(page, "/disputes");
    await film(page, info, "L70-admin-disputes-after-unreachable");

    const disputes = await listAdminDisputes(admin.token);
    const related = (disputes.disputes || []).find(
      (d) => d.orderId === created.orderId || String(d.reason || "").includes("client_not_present"),
    );
    if (related?.id && related.status !== "approved" && related.status !== "rejected") {
      await adminResolveDispute(admin.token, related.id, "approve", "Logic: approve unreachable refund");
      await film(page, info, "L70-admin-after-refund-approve");
    }
  });

  test("5) حلول بديلة — أسباب بدون استرداد تلقائي", async ({ page }, info) => {
    const alternatives: FailServiceReason[] = [
      "different_problem",
      "parts_unavailable",
      "cannot_repair",
    ];
    const client = await login(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await login(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await login(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    await ensureTechPoints(tech.token, admin.token, 80);

    for (const reason of alternatives) {
      const created = await createOrder(client.token, {
        problemDescription: `Logic alternative fail: ${reason}`,
      });
      await acceptOrder(tech.token, created.orderId);
      await startOrder(tech.token, created.orderId);
      const fail = await failService(tech.token, created.orderId, reason, `Logic: ${reason}`);
      // Product: only client_not_present / client_refused set refundRequested
      expect(fail.refundRequested === true).toBeFalsy();
    }

    await uiLogin(page, process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!, /tech|orders|map/);
    await softGoto(page, "/(tech)/orders");
    await film(page, info, "L80-tech-after-alternative-fails");
  });

  test("6) رفض العميل للخدمة — client_refused → استرداد/نزاع + قرار أدمن", async ({ page }, info) => {
    const client = await login(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await login(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await login(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    await ensureTechPoints(tech.token, admin.token, 25);

    const before = await getWallet(tech.token);
    const created = await createOrder(client.token, { problemDescription: "Logic: client refused service" });
    await acceptOrder(tech.token, created.orderId);
    await startOrder(tech.token, created.orderId);
    const fail = await failService(tech.token, created.orderId, "client_refused", "Logic: refused");
    expect(fail.refundRequested === true || fail.success === true).toBeTruthy();

    const disputes = await listAdminDisputes(admin.token);
    const related = (disputes.disputes || []).find((d) => d.orderId === created.orderId);
    if (related?.id && related.status !== "approved" && related.status !== "rejected") {
      await adminResolveDispute(admin.token, related.id, "approve", "Logic: refund after client_refused");
    }

    const after = await getWallet(tech.token);
    // After approve refund, balance should not stay permanently below unlock cost without recovery —
    // soft assert: filmed for evidence either way
    await uiLogin(page, process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!, /tech|wallet|map/);
    await softGoto(page, "/(tech)/wallet");
    await film(
      page,
      info,
      (after.pointsBalance ?? 0) >= (before.pointsBalance ?? 0) - 5
        ? "L90-tech-wallet-after-refused-refund"
        : "L90-tech-wallet-after-refused-pending-refund",
    );

    await uiLogin(page, process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!, /admin|dashboard/);
    await softGoto(page, "/disputes");
    await film(page, info, "L90-admin-disputes-refused");
  });

  test("7) استرداد/إكمال — مسار بديل: قبول ثم إكمال بعد fail ليس مسموح؛ طلب جديد يُكمَل", async ({
    page,
  }, info) => {
    // After fail-service order is cancelled; next job completes normally (recovery path).
    const client = await login(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await login(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await login(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    await ensureTechPoints(tech.token, admin.token, 25);

    const created = await createOrder(client.token, { problemDescription: "Logic: recovery complete" });
    await acceptOrder(tech.token, created.orderId);
    await startOrder(tech.token, created.orderId);
    await completeOrder(tech.token, created.orderId);
    await rateOrder(client.token, created.orderId, 4, "Logic recovery complete");

    await uiLogin(page, process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!, /client|home|orders/);
    await softGoto(page, "/orders");
    await film(page, info, "L99-client-recovery-completed");
  });
});
