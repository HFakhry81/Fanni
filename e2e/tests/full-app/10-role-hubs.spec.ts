import { test, expect } from "@playwright/test";
import {
  requireClientCreds,
  requireTechCreds,
  requireAdminCreds,
} from "../helpers/apiClient";
import { film, markLt, softGoto, uiLogin } from "../helpers/ui";

test.describe("Full-app · role logins + hub screens (video)", () => {
  test.afterEach(async ({ page }, info) => {
    await markLt(page, info);
  });

  test("client hubs", async ({ page }, info) => {
    test.skip(!requireClientCreds(), "Set E2E_CLIENT_IDENTIFIER / E2E_CLIENT_PASSWORD");
    await uiLogin(
      page,
      process.env.E2E_CLIENT_IDENTIFIER!,
      process.env.E2E_CLIENT_PASSWORD!,
      /client|home|orders/,
    );
    await film(page, info, "10-client-home");
    for (const path of ["/orders", "/(client)/orders", "/(client)/profile", "/(client)/home"]) {
      if (await softGoto(page, path)) await film(page, info, `10-client-${path.replace(/\W+/g, "_")}`);
    }
  });

  test("technician hubs", async ({ page }, info) => {
    test.skip(!requireTechCreds(), "Set E2E_TECH_IDENTIFIER / E2E_TECH_PASSWORD");
    await uiLogin(
      page,
      process.env.E2E_TECH_IDENTIFIER!,
      process.env.E2E_TECH_PASSWORD!,
      /tech|map|available|wallet|profile/,
    );
    await film(page, info, "11-tech-entry");
    for (const path of [
      "/available-orders",
      "/(tech)/available-orders",
      "/(tech)/orders",
      "/(tech)/map",
      "/(tech)/wallet",
      "/(tech)/profile",
    ]) {
      if (await softGoto(page, path)) await film(page, info, `11-tech-${path.replace(/\W+/g, "_")}`);
    }
  });

  test("admin hubs", async ({ page }, info) => {
    test.skip(!requireAdminCreds(), "Set E2E_ADMIN_IDENTIFIER / E2E_ADMIN_PASSWORD");
    await uiLogin(
      page,
      process.env.E2E_ADMIN_IDENTIFIER!,
      process.env.E2E_ADMIN_PASSWORD!,
      /admin|dashboard/,
    );
    await film(page, info, "12-admin-entry");
    for (const path of [
      "/(admin)/(tabs)/dashboard",
      "/(admin)/(tabs)/orders",
      "/(admin)/(tabs)/payments",
      "/(admin)/(tabs)/disputes",
      "/(admin)/(tabs)/users",
      "/(admin)/(tabs)/pending",
      "/(admin)/(tabs)/stats",
      "/(admin)/(tabs)/profile",
      "/disputes",
      "/payments",
      "/pending",
    ]) {
      if (await softGoto(page, path)) await film(page, info, `12-admin-${path.replace(/\W+/g, "_")}`);
    }
  });
});
