import { specialtyColor } from "../adminMapColors";

describe("adminMapColors", () => {
  it("returns gray for empty specialty", () => {
    expect(specialtyColor(null)).toBe("#9CA3AF");
    expect(specialtyColor("")).toBe("#9CA3AF");
  });

  it("returns stable color for same key", () => {
    expect(specialtyColor("كهرباء")).toBe(specialtyColor("كهرباء"));
  });

  it("returns palette color for known specialty", () => {
    expect(specialtyColor("Plumbing")).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
