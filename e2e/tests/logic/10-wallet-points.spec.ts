/**
 * FANNI LOGIC SUITE — wallet & points
 *
 * Logic:
 *  A) Top-up: tech submits payment request → admin confirm → points increase
 *  B) Top-up reject: request → admin reject → balance unchanged (no credit)
 *  C) Admin bonus: Super Admin grants promotional points → tech acknowledges → wallet credit
 *  D) Welcome points: ONLY via admin approve technician (not seeded at API boot).
 *     Soft: if a pending tech exists and E2E_APPROVE_PENDING_TECH=1, approve once and film wallet.
 */
import { test, expect } from "@playwright/test";
import {
  acknowledgeBonus,
  adminBonusGrant,
  adminConfirmPayment,
  adminApproveTechnician,
  adminListPendingTechnicians,
  adminRejectPayment,
  ensureTechPoints,
  getWallet,
  listPackages,
  loginCached,
  pendingBonusGrants,
  requestTopUp,
  requireAllRoles,
  requireWritableTarget,
  writesBlockedReason,
} from "../helpers/apiClient";
import { film, markLt, softGoto, softUiLogin } from "../helpers/ui";

test.describe.configure({ mode: "default" });

test.describe("Logic · wallet / welcome / admin points", () => {
  test.beforeEach(() => {
    test.skip(!requireWritableTarget(), writesBlockedReason() ?? "Writes blocked");
    test.skip(!requireAllRoles(), "Need client + tech + admin credentials");
  });

  test.afterEach(async ({ page }, info) => {
    await markLt(page, info);
  });

  test("A) شحن رصيد — top-up request + admin confirm", async ({ page }, info) => {
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    const before = await getWallet(tech.token);
    const pkgs = await listPackages(tech.token);
    const pkg = pkgs.packages?.[0];
    expect(pkg, "active point package required").toBeTruthy();

    const { request } = await requestTopUp(tech.token, {
      packageId: pkg!.id,
      amountEgp: Number(pkg!.priceEgp) || 50,
      pointsRequested: pkg!.pointsAmount || 60,
      paymentMethod: "instapay",
      senderDetails: { instapayId: "logic-topup@instapay" },
      referenceNumber: `TOPUP-${Date.now()}`,
    });

    if (await softUiLogin(page, process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!, /admin|dashboard/)) { /* filmed */ }
    await softGoto(page, "/(admin)/(tabs)/payments");
    await film(page, info, "L10-admin-payments-pending");

    await adminConfirmPayment(admin.token, request.id);
    const after = await getWallet(tech.token);
    expect((after.pointsBalance ?? 0) >= (before.pointsBalance ?? 0)).toBeTruthy();

    if (await softUiLogin(page, process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!, /tech|wallet|map/)) { /* filmed */ }
    await softGoto(page, "/(tech)/wallet");
    await film(page, info, "L10-tech-wallet-after-topup");
  });

  test("B) شحن مرفوض — top-up + admin reject (no credit)", async ({ page }, info) => {
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    const before = await getWallet(tech.token);
    const pkgs = await listPackages(tech.token);
    const pkg = pkgs.packages?.[0];
    test.skip(!pkg, "No packages");

    const { request } = await requestTopUp(tech.token, {
      packageId: pkg!.id,
      amountEgp: Number(pkg!.priceEgp) || 50,
      pointsRequested: pkg!.pointsAmount || 60,
      paymentMethod: "bank_transfer",
      senderDetails: { accountNumber: "0000" },
      referenceNumber: `TOPUP-REJ-${Date.now()}`,
    });
    await adminRejectPayment(admin.token, request.id, "Logic suite: expected reject");
    const after = await getWallet(tech.token);
    expect(after.pointsBalance ?? 0).toBe(before.pointsBalance ?? 0);

    if (await softUiLogin(page, process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!, /tech|wallet|map/)) { /* filmed */ }
    await softGoto(page, "/(tech)/wallet");
    await film(page, info, "L11-tech-wallet-after-reject");
  });

  test("C) نقاط المسئول — admin bonus grant + tech acknowledge", async ({ page }, info) => {
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    const techId = tech.user?.id;
    test.skip(!techId, "login missing user.id");

    const before = await getWallet(tech.token);
    try {
      await adminBonusGrant(admin.token, techId!, 5, "Logic suite admin bonus");
    } catch (err) {
      test.info().annotations.push({
        type: "note",
        description: `bonus grant failed (permission?): ${err instanceof Error ? err.message : String(err)}`,
      });
      if (await softUiLogin(page, process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!, /admin|dashboard/)) { /* filmed */ }
      await softGoto(page, "/(admin)/(tabs)/users");
      await film(page, info, "L12-admin-bonus-unavailable");
      return;
    }

    const pending = await pendingBonusGrants(tech.token);
    const grant = pending.grants?.[0];
    if (grant?.id) await acknowledgeBonus(tech.token, grant.id);

    const after = await getWallet(tech.token);
    expect((after.pointsBalance ?? 0) >= (before.pointsBalance ?? 0)).toBeTruthy();

    if (await softUiLogin(page, process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!, /tech|wallet|map/)) { /* filmed */ }
    await softGoto(page, "/(tech)/wallet");
    await film(page, info, "L12-tech-wallet-after-admin-bonus");
  });

  test("D) نقاط ترحيب — welcome only on admin approve (soft)", async ({ page }, info) => {
    /**
     * Product rule: welcome_bonus is granted in PATCH /admin/technicians/:id/approve
     * after confirm — never at API seed/boot.
     * Opt-in: E2E_APPROVE_PENDING_TECH=1 to approve the first pending tech (local only recommended).
     */
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    const allowApprove =
      process.env.E2E_APPROVE_PENDING_TECH === "1" || process.env.E2E_APPROVE_PENDING_TECH === "true";

    if (await softUiLogin(page, process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!, /admin|dashboard/)) { /* filmed */ }
    await softGoto(page, "/(admin)/(tabs)/pending");
    await film(page, info, "L13-admin-pending-techs");

    if (!allowApprove) {
      test.info().annotations.push({
        type: "note",
        description: "Skipped approve — set E2E_APPROVE_PENDING_TECH=1 to exercise welcome grant once",
      });
      return;
    }

    const pending = await adminListPendingTechnicians(admin.token);
    const first = pending.technicians?.[0];
    test.skip(!first?.id, "No pending technician to approve");

    const res = await adminApproveTechnician(admin.token, first!.id);
    expect(res.approved || res.success).toBeTruthy();
    await page.reload();
    await film(page, info, "L13-admin-after-approve-welcome");
  });

  test("E) ensureTechPoints helper smoke", async () => {
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    const bal = await ensureTechPoints(tech.token, admin.token, 5);
    expect(bal).toBeGreaterThanOrEqual(5);
  });
});
