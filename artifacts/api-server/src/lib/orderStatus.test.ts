import { describe, expect, it } from "vitest";
import { mobileStatusToDbStatuses, toMobileStatus } from "./orderStatus";
import { isValidVisitDateYmd } from "./visitDate";

describe("toMobileStatus", () => {
  it("maps en_route/acknowledged/arrived to accepted", () => {
    expect(toMobileStatus("en_route")).toBe("accepted");
    expect(toMobileStatus("acknowledged")).toBe("accepted");
    expect(toMobileStatus("arrived")).toBe("accepted");
    expect(toMobileStatus("in_progress")).toBe("inProgress");
    expect(toMobileStatus("pending")).toBe("pending");
  });

  it("expands mobile filters for admin SQL", () => {
    expect(mobileStatusToDbStatuses("accepted")).toEqual(["acknowledged", "en_route", "arrived"]);
  });
});

describe("isValidVisitDateYmd", () => {
  it("rejects impossible calendar days like 2026-10-95", () => {
    expect(isValidVisitDateYmd("2026-10-95")).toBe(false);
    expect(isValidVisitDateYmd("2026-02-30")).toBe(false);
    const y = new Date().getFullYear();
    expect(isValidVisitDateYmd(`${y}-10-05`)).toBe(true);
  });
});
