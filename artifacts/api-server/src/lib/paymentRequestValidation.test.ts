import { describe, expect, it } from "vitest";
import {
  extractProofObjectKey,
  isValidPaymentReference,
  normalizePaymentReference,
  proofImageUrlFromKey,
} from "./paymentRequestValidation";

describe("paymentRequestValidation", () => {
  it("normalizes and validates references", () => {
    expect(normalizePaymentReference("  AB12 34  ")).toBe("AB12 34");
    expect(isValidPaymentReference("AB12")).toBe(true);
    expect(isValidPaymentReference("abc")).toBe(false);
    expect(isValidPaymentReference("test")).toBe(false);
    expect(isValidPaymentReference(null)).toBe(false);
  });

  it("extracts object keys from upload URLs", () => {
    const key = "uploads/user-1/abc.png";
    expect(extractProofObjectKey(key)).toBe(key);
    expect(extractProofObjectKey(proofImageUrlFromKey(key))).toBe(key);
    expect(extractProofObjectKey("/api/uploads/file?key=" + encodeURIComponent(key))).toBe(key);
    expect(extractProofObjectKey("../etc/passwd")).toBeNull();
  });
});
