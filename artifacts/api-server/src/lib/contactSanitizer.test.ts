import { describe, expect, it } from "vitest";
import {
  containsContactPii,
  orderTextContainsContactPii,
  sanitizeFreeText,
} from "./contactSanitizer";

describe("contactSanitizer", () => {
  it("detects Egyptian mobiles in free text", () => {
    expect(containsContactPii("كلمني على 01012345678")).toBe(true);
    expect(containsContactPii("رقم: 011-234-5678")).toBe(true);
    expect(containsContactPii("التكييف لا يبرد")).toBe(false);
  });

  it("detects wa.me and email", () => {
    expect(containsContactPii("https://wa.me/201012345678")).toBe(true);
    expect(containsContactPii("mail me at a@b.com")).toBe(true);
  });

  it("sanitizes phones to redaction marker", () => {
    const out = sanitizeFreeText("اتصل 01012345678 حالاً");
    expect(String(out)).toContain("[بيانات اتصال محجوبة]");
    expect(String(out)).not.toMatch(/01012345678/);
  });

  it("flags order payload text fields", () => {
    expect(
      orderTextContainsContactPii({
        problemDescription: "whatsapp: wa.me/20100",
      }),
    ).toBe(true);
    expect(
      orderTextContainsContactPii({
        problemDescription: "المروحة بتقطع",
      }),
    ).toBe(false);
  });
});
