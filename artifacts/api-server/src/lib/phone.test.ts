import { describe, expect, it } from "vitest";
import { maskPhoneDisplay, toE164Egypt } from "./phone";

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
