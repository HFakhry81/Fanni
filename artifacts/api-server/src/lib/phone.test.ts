import { describe, expect, it } from "vitest";
import { maskPhoneDisplay, normalizeEmailForStorage, normalizeEgyptMobileForStorage, normalizeLoginIdentifier, normalizeLoginIdentifierValue, toE164Egypt } from "./phone";

describe("normalizeEmailForStorage", () => {
  it("trims and lowercases email", () => {
    expect(normalizeEmailForStorage("  Tech@Example.COM ")).toBe("tech@example.com");
  });
});

describe("normalizeEgyptMobileForStorage", () => {
  it("normalizes +20 and spaced local numbers to 0-prefixed storage", () => {
    expect(normalizeEgyptMobileForStorage("+201012345678")).toBe("01012345678");
    expect(normalizeEgyptMobileForStorage("010 1234 5678")).toBe("01012345678");
    expect(normalizeEgyptMobileForStorage("201012345678")).toBe("01012345678");
  });
});

describe("normalizeLoginIdentifierValue", () => {
  it("returns normalized value for email or mobile", () => {
    expect(normalizeLoginIdentifierValue("Tech@Example.COM")).toBe("tech@example.com");
    expect(normalizeLoginIdentifierValue("+20 101 234 5678")).toBe("01012345678");
  });
});

describe("normalizeLoginIdentifier", () => {
  it("lowercases email identifiers", () => {
    expect(normalizeLoginIdentifier("  Tech@Example.COM ")).toEqual({
      kind: "email",
      value: "tech@example.com",
    });
  });

  it("normalizes mobile identifiers for lookup", () => {
    expect(normalizeLoginIdentifier("+20 101 234 5678")).toEqual({
      kind: "mobile",
      value: "01012345678",
    });
  });
});

describe("toE164Egypt", () => {
  it("converts local 01 numbers", () => {
    expect(toE164Egypt("01012345678")).toBe("+201012345678");
  });
  it("accepts already international numbers", () => {
    expect(toE164Egypt("+201012345678")).toBe("+201012345678");
  });
});

describe("maskPhoneDisplay", () => {
  it("keeps first two and last two digits", () => {
    expect(maskPhoneDisplay("01012345678")).toBe("01••••78");
  });
});
