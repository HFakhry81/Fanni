/**
 * Security / gap closure coverage:
 *  A) Contact PII in order description rejected
 *  B) Duplicate payment reference rejected
 *  C) Concurrent accept — at most one winner
 */
import { test, expect } from "@playwright/test";
import {
  ApiError,
  acceptOrder,
  cancelOrder,
  createOrder,
  ensureTechPoints,
  listPackages,
  loginCached,
  requestTopUp,
  requireAllRoles,
  requireWritableTarget,
  uploadReceiptImage,
  writesBlockedReason,
} from "../helpers/apiClient";
import { markLt } from "../helpers/ui";

test.describe.configure({ mode: "default" });

test.describe("Logic · security gaps", () => {
  test.beforeEach(() => {
    test.skip(!requireWritableTarget(), writesBlockedReason() ?? "Writes blocked");
    test.skip(!requireAllRoles(), "Need client + tech + admin");
  });

  test.afterEach(async ({ page }, info) => {
    await markLt(page, info);
  });

  test("A) رفض وصف يحتوي هاتف — PII in description", async () => {
    const client = await loginCached(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    let status = 0;
    let code = "";
    try {
      await createOrder(client.token, {
        problemDescription: "اتصل بي على 01012345678 فوراً",
      });
    } catch (err) {
      if (err instanceof ApiError) {
        status = err.status;
        const body = err.body as { code?: string } | undefined;
        code = body?.code ?? "";
      } else {
        throw err;
      }
    }
    expect(status).toBe(400);
    expect(code).toBe("CONTACT_PII_IN_DESCRIPTION");
  });

  test("B) مرجع تحويل مكرر — duplicate payment reference", async () => {
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const pkgs = await listPackages(tech.token);
    const pkg = pkgs.packages?.[0];
    test.skip(!pkg, "No packages");

    const ref = `DUP-REF-${Date.now()}`;
    const proof1 = await uploadReceiptImage(tech.token);
    await requestTopUp(tech.token, {
      packageId: pkg!.id,
      paymentMethod: "instapay",
      senderDetails: { instapayId: "dup@instapay" },
      referenceNumber: ref,
      proofImageUrl: proof1.url,
    });

    const proof2 = await uploadReceiptImage(tech.token);
    let status = 0;
    let code = "";
    try {
      await requestTopUp(tech.token, {
        packageId: pkg!.id,
        paymentMethod: "instapay",
        senderDetails: { instapayId: "dup2@instapay" },
        referenceNumber: ref,
        proofImageUrl: proof2.url,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        status = err.status;
        code = (err.body as { code?: string } | undefined)?.code ?? "";
      } else {
        throw err;
      }
    }
    expect(status).toBe(409);
    expect(code).toBe("REFERENCE_DUPLICATE");
  });

  test("C) قبول متزامن — concurrent accept race", async () => {
    const client = await loginCached(process.env.E2E_CLIENT_IDENTIFIER!, process.env.E2E_CLIENT_PASSWORD!);
    const tech = await loginCached(process.env.E2E_TECH_IDENTIFIER!, process.env.E2E_TECH_PASSWORD!);
    const admin = await loginCached(process.env.E2E_ADMIN_IDENTIFIER!, process.env.E2E_ADMIN_PASSWORD!);
    await ensureTechPoints(tech.token, admin.token, 30);

    const created = await createOrder(client.token, {
      problemDescription: "Logic security: concurrent accept race",
    });

    const results = await Promise.allSettled([
      acceptOrder(tech.token, created.orderId),
      acceptOrder(tech.token, created.orderId),
      acceptOrder(tech.token, created.orderId),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const conflicts = results.filter(
      (r) =>
        r.status === "rejected" &&
        r.reason instanceof ApiError &&
        (r.reason.status === 409 || r.reason.status === 400 || r.reason.status === 402),
    ).length;

    expect(ok).toBeLessThanOrEqual(1);
    expect(ok + conflicts).toBe(results.length);

    await cancelOrder(client.token, created.orderId).catch(() => undefined);
  });
});
