import { describe, expect, it } from "vitest";
import { canonicalCategory, professionMatchesOrder } from "./categoryMatch";

describe("canonicalCategory", () => {
  it("normalizes English and Arabic profession aliases", () => {
    expect(canonicalCategory("Electricity")).toBe("electricity");
    expect(canonicalCategory("كهرباء")).toBe("electricity");
    expect(canonicalCategory("air-conditioning")).toBe("ac");
  });
});

describe("professionMatchesOrder", () => {
  it("requires a profession", async () => {
    expect(await professionMatchesOrder("electricity", null)).toBe(false);
    expect(await professionMatchesOrder("electricity", "")).toBe(false);
  });

  it("matches profession nameEn to order category key", async () => {
    expect(await professionMatchesOrder("electricity", "Electricity")).toBe(true);
    expect(await professionMatchesOrder("plumbing", "Electricity")).toBe(false);
  });
});
