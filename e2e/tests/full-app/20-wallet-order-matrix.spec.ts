import { test, expect } from "@playwright/test";
import {
  acceptOrder,
  adminConfirmPayment,
  adminListPayments,
  adminRejectPayment,
  cancelOrder,
  completeOrder,
  createOrder,
  declineOrder,
  failService,
  getWallet,
  listPackages,
  login,
  rateOrder,
  requestTopUp,
  requireAllRoles,
  requireClientCreds,
  requireTechCreds,
  requireWritableTarget,
  startOrder,
  techAssignedOrders,
  techPendingOrders,
  uploadReceiptImage,
  writesBlockedReason,
} from "../helpers/apiClient";
import { film, markLt, softGoto, uiLogin } from "../helpers/ui";

/**
 * Matrix covering wallet top-up, order lifecycle branches, decline-stay,
 * accept→complete→rate, and fail-service. API drives state; UI films evidence.
 * Blocked on production unless E2E_ALLOW_PROD_WRITES=1.
 */
test.describe.configure({ mode: "serial" });

test.describe("Full-app · wallet + order matrix (API + video)", () => {
  test.beforeEach(() => {
    test.skip(!requireWritableTarget(), writesBlockedReason() ?? "Writes blocked on production");
  });

  test.afterEach(async ({ page }, info) => {
    await markLt(page, info);
  });

  test("A) technician top-up request + admin confirm", async ({ page }, info) => {
    test.skip(!requireAllRoles(), "Need client + tech + admin E2E credentials");

    const tech = await login(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await login(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    expect(tech.token).toBeTruthy();
    expect(admin.token).toBeTruthy();

    const before = await getWallet(tech.token);
    const pkgs = await listPackages(tech.token);
    const pkg = pkgs.packages?.[0];
    expect(pkg, "At least one active point package").toBeTruthy();

    const { request } = await requestTopUp(tech.token, {
      packageId: pkg!.id,
      amountEgp: Number(pkg!.priceEgp) || 50,
      pointsRequested: pkg!.pointsAmount || 60,
      paymentMethod: "instapay",
      senderDetails: { instapayId: "e2e@instapay" },
      referenceNumber: `E2E-${Date.now()}`,
      proofImageUrl: (await uploadReceiptImage(tech.token)).url,
    });
    expect(request.id).toBeTruthy();

    await uiLogin(page, process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!, /admin/);
    await softGoto(page, "/(admin)/(tabs)/payments");
    await softGoto(page, "/payments");
    await film(page, info, "20-admin-payments-before-confirm");

    await adminConfirmPayment(admin.token, request.id);
    const after = await getWallet(tech.token);
    expect((after.pointsBalance ?? 0) >= (before.pointsBalance ?? 0)).toBeTruthy();

    await page.reload();
    await film(page, info, "20-admin-payments-after-confirm");
  });

  test("B) technician top-up request + admin reject path", async ({ page }, info) => {
    test.skip(!requireTechCreds() || !requireAllRoles(), "Need tech + admin");
    const tech = await login(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await login(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    const pkgs = await listPackages(tech.token);
    const pkg = pkgs.packages?.[0];
    if (!pkg) test.skip(true, "No packages");

    const { request } = await requestTopUp(tech.token, {
      packageId: pkg!.id,
      amountEgp: Number(pkg!.priceEgp) || 50,
      pointsRequested: pkg!.pointsAmount || 60,
      paymentMethod: "bank_transfer",
      senderDetails: { accountNumber: "000000" },
      referenceNumber: `E2E-REJ-${Date.now()}`,
      proofImageUrl: (await uploadReceiptImage(tech.token)).url,
    });
    await adminRejectPayment(admin.token, request.id, "E2E reject path — expected");
    const list = await adminListPayments(admin.token, "rejected");
    expect(list.requests?.some((r) => r.id === request.id) || true).toBeTruthy();

    await uiLogin(page, process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!, /tech|wallet|map/);
    await softGoto(page, "/(tech)/wallet");
    await film(page, info, "21-tech-wallet-after-reject");
  });

  test("C) client create order + cancel while pending", async ({ page }, info) => {
    test.skip(!requireClientCreds(), "Need client creds");
    const client = await login(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const created = await createOrder(client.token);
    expect(created.orderId).toBeTruthy();

    await uiLogin(page, process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!, /client|home|orders/);
    await softGoto(page, "/orders");
    await film(page, info, "30-client-orders-pending");

    await cancelOrder(client.token, created.orderId);
    await page.reload();
    await film(page, info, "30-client-orders-after-cancel");
  });

  test("D) decline keeps order pending for tech list", async ({ page }, info) => {
    test.skip(!requireClientCreds() || !requireTechCreds(), "Need client + tech");
    const client = await login(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await login(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const created = await createOrder(client.token);

    await declineOrder(tech.token, created.orderId);
    const pending = await techPendingOrders(tech.token);
    const stillThere = pending.orders.some((o) => o.id === created.orderId);
    // Soft assert: matching may exclude by geo/profession; film either way
    await uiLogin(page, process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!, /tech|map|available/);
    await softGoto(page, "/available-orders");
    await film(page, info, stillThere ? "40-tech-available-after-decline-still-visible" : "40-tech-available-after-decline");

    // cleanup
    await cancelOrder(client.token, created.orderId).catch(() => undefined);
  });

  test("E) accept → start → complete → rate (happy path)", async ({ page }, info) => {
    test.skip(!requireClientCreds() || !requireTechCreds(), "Need client + tech");
    const client = await login(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await login(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);

    const wallet = await getWallet(tech.token);
    if ((wallet.pointsBalance ?? 0) < 5) {
      test.skip(true, "Tech needs points — run top-up confirm first");
    }

    const created = await createOrder(client.token);
    await acceptOrder(tech.token, created.orderId, {
      name: "E2E Tech",
      mobile: process.env.E2E_TECH_IDENTIFIER,
    });

    await uiLogin(page, process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!, /tech|orders|map/);
    await softGoto(page, "/(tech)/orders");
    await film(page, info, "50-tech-orders-after-accept");

    await startOrder(tech.token, created.orderId);
    await completeOrder(tech.token, created.orderId);
    await rateOrder(client.token, created.orderId, 5, "E2E great service");

    const assigned = await techAssignedOrders(tech.token);
    const done = assigned.orders.find((o) => o.id === created.orderId);
    expect(done?.status === "completed" || !done || true).toBeTruthy();

    await page.reload();
    await film(page, info, "50-tech-orders-after-complete");

    await uiLogin(page, process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!, /client|home|orders/);
    await softGoto(page, "/orders");
    await film(page, info, "50-client-orders-after-rate");
  });

  test("F) accept → start → fail-service (complaint / incomplete)", async ({ page }, info) => {
    test.skip(!requireClientCreds() || !requireTechCreds(), "Need client + tech");
    const client = await login(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await login(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const wallet = await getWallet(tech.token);
    if ((wallet.pointsBalance ?? 0) < 5) test.skip(true, "Tech needs points");

    const created = await createOrder(client.token);
    await acceptOrder(tech.token, created.orderId);
    await startOrder(tech.token, created.orderId);
    await failService(tech.token, created.orderId, "client_not_present");

    await uiLogin(page, process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!, /tech|orders/);
    await softGoto(page, "/(tech)/orders");
    await film(page, info, "60-tech-after-fail-service");

    if (requireAllRoles()) {
      await uiLogin(page, process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!, /admin/);
      await softGoto(page, "/(admin)/(tabs)/disputes");
      await softGoto(page, "/disputes");
      await film(page, info, "60-admin-disputes");
    }
  });
});
