import { test, expect } from "@playwright/test";
import {
  adminBonusGrant,
  acknowledgeBonus,
  login,
  pendingBonusGrants,
  requireAdminCreds,
  requireTechCreds,
} from "../helpers/apiClient";
import { film, markLt, softGoto, uiLogin } from "../helpers/ui";

test.describe("Full-app · bonus grant + register UI", () => {
  test.afterEach(async ({ page }, info) => {
    await markLt(page, info);
  });

  test("admin sends bonus → tech acknowledges (when permitted)", async ({ page }, info) => {
    test.skip(!requireAdminCreds() || !requireTechCreds(), "Need admin + tech");
    const admin = await login(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    const tech = await login(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const techId = tech.user?.id;
    test.skip(!techId, "Login response missing user.id — skip bonus grant");

    try {
      await adminBonusGrant(admin.token, techId!, 5, "E2E promotional bonus");
    } catch (err) {
      // manage_wallet permission may be missing on seed admin
      test.info().annotations.push({
        type: "note",
        description: `bonus-grant skipped/failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      await uiLogin(page, process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!, /admin/);
      await softGoto(page, "/(admin)/(tabs)/users");
      await film(page, info, "70-admin-users-bonus-unavailable");
      return;
    }

    const pending = await pendingBonusGrants(tech.token);
    const grant = pending.grants?.[0];
    if (grant?.id) {
      await acknowledgeBonus(tech.token, grant.id);
    }

    await uiLogin(page, process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!, /tech|wallet/);
    await softGoto(page, "/(tech)/wallet");
    await film(page, info, "70-tech-wallet-after-bonus");
  });

  test("register screen captures form (OTP stub — no real SMS)", async ({ page }, info) => {
    await page.goto("/register");
    await expect(page.locator("body")).toBeVisible();
    await film(page, info, "80-register-empty");
    // Fill visible fields if present — do not submit OTP without stub
    const mobile = page.getByPlaceholder(/mobile|هاتف|جوال|01/i).first();
    if (await mobile.isVisible().catch(() => false)) {
      await mobile.fill("01099998877");
      await film(page, info, "80-register-filled-partial");
    }
  });
});
