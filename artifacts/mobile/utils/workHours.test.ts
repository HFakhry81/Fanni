import { describe, expect, it } from "@jest/globals";
import {
  addMinutes,
  clampTime,
  isEndAfterStart,
  isValidHhMm,
  setHour,
  setMinute,
} from "./workHours";

describe("workHours", () => {
  it("validates HH:mm", () => {
    expect(isValidHhMm("08:00")).toBe(true);
    expect(isValidHhMm("24:00")).toBe(false);
    expect(isValidHhMm("8:00")).toBe(false);
  });

  it("clamps and adjusts time", () => {
    expect(clampTime("25:99")).toBe("23:59");
    expect(addMinutes("23:45", 30)).toBe("00:15");
    expect(setHour("08:30", 10)).toBe("10:30");
    expect(setMinute("08:30", 0)).toBe("08:00");
  });

  it("compares start/end", () => {
    expect(isEndAfterStart("08:00", "22:00")).toBe(true);
    expect(isEndAfterStart("22:00", "08:00")).toBe(false);
    expect(isEndAfterStart("10:00", "10:00")).toBe(false);
  });
});
