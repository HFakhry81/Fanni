import { describe, expect, it } from "vitest";
import { autoDisputeDailyCap, isAutoEligibleReason, normalizeDisputeReason } from "./autoDispute";

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

  it("defaults the daily auto-refund cap to 2", () => {
    const prev = process.env["DISPUTE_AUTO_DAILY_CAP"];
    delete process.env["DISPUTE_AUTO_DAILY_CAP"];
    expect(autoDisputeDailyCap()).toBe(2);
    process.env["DISPUTE_AUTO_DAILY_CAP"] = "4";
    expect(autoDisputeDailyCap()).toBe(4);
    if (prev === undefined) delete process.env["DISPUTE_AUTO_DAILY_CAP"];
    else process.env["DISPUTE_AUTO_DAILY_CAP"] = prev;
  });
});
