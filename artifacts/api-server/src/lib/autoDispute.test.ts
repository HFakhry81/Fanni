import { describe, expect, it } from "vitest";
import { isAutoEligibleReason, normalizeDisputeReason } from "./autoDispute";

describe("auto dispute reasons", () => {
  it("accepts canonical codes", () => {
    expect(isAutoEligibleReason("wrong_number")).toBe(true);
    expect(isAutoEligibleReason("no_response")).toBe(true);
    expect(isAutoEligibleReason("client_not_present")).toBe(true);
  });

  it("accepts Egyptian phrasing", () => {
    expect(isAutoEligibleReason("الرقم خاطئ")).toBe(true);
    expect(isAutoEligibleReason("العميل مردش")).toBe(true);
  });

  it("rejects unrelated reasons", () => {
    expect(isAutoEligibleReason("want cheaper lead")).toBe(false);
    expect(normalizeDisputeReason("Wrong Number")).toBe("wrong_number");
  });
});
