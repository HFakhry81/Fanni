import { describe, it, expect } from "vitest";
import { queryString, queryInt, queryFloat } from "./queryParams";

describe("queryString", () => {
  it("returns the value when it is a plain string", () => {
    expect(queryString("cairo")).toBe("cairo");
  });

  it("returns an empty string unchanged (still a string)", () => {
    expect(queryString("")).toBe("");
  });

  it("returns undefined when value is an array (multi-value param)", () => {
    expect(queryString(["a", "b"])).toBeUndefined();
  });

  it("returns undefined when value is a ParsedQs object", () => {
    expect(queryString({ nested: "value" })).toBeUndefined();
  });

  it("returns undefined when value is undefined", () => {
    expect(queryString(undefined)).toBeUndefined();
  });

  it("returns undefined when value is null", () => {
    expect(queryString(null)).toBeUndefined();
  });

  it("returns undefined when value is a number", () => {
    expect(queryString(42)).toBeUndefined();
  });

  it("returns undefined when value is a boolean", () => {
    expect(queryString(true)).toBeUndefined();
  });
});

describe("queryInt", () => {
  it("parses a valid integer string", () => {
    expect(queryInt("5", 1)).toBe(5);
  });

  it("parses a zero string", () => {
    expect(queryInt("0", 10)).toBe(0);
  });

  it("parses a negative integer string", () => {
    expect(queryInt("-3", 1)).toBe(-3);
  });

  it("returns fallback when value is undefined (param missing)", () => {
    expect(queryInt(undefined, 20)).toBe(20);
  });

  it("returns fallback when value is an array (multi-value param)", () => {
    expect(queryInt(["1", "2"], 10)).toBe(10);
  });

  it("returns fallback when value is a ParsedQs object", () => {
    expect(queryInt({ page: "2" }, 10)).toBe(10);
  });

  it("returns fallback when value is a non-numeric string", () => {
    expect(queryInt("abc", 7)).toBe(7);
  });

  it("returns fallback when value is an empty string", () => {
    expect(queryInt("", 5)).toBe(5);
  });

  it("truncates a float string to its integer part", () => {
    expect(queryInt("3.9", 1)).toBe(3);
  });

  it("returns fallback when value is NaN-like (e.g. 'NaN')", () => {
    expect(queryInt("NaN", 1)).toBe(1);
  });

  it("uses correct fallback (0)", () => {
    expect(queryInt(undefined, 0)).toBe(0);
  });
});

describe("queryFloat", () => {
  it("parses a valid float string", () => {
    expect(queryFloat("30.05")).toBeCloseTo(30.05);
  });

  it("parses an integer string as a float", () => {
    expect(queryFloat("15")).toBe(15);
  });

  it("parses a negative float string", () => {
    expect(queryFloat("-31.233")).toBeCloseTo(-31.233);
  });

  it("returns NaN when value is undefined (param missing)", () => {
    expect(queryFloat(undefined)).toBeNaN();
  });

  it("returns NaN when value is an array (multi-value param)", () => {
    expect(queryFloat(["30.5", "31"])).toBeNaN();
  });

  it("returns NaN when value is a ParsedQs object", () => {
    expect(queryFloat({ lat: "30.5" })).toBeNaN();
  });

  it("returns NaN when value is a non-numeric string", () => {
    expect(queryFloat("abc")).toBeNaN();
  });

  it("returns NaN when value is an empty string", () => {
    expect(queryFloat("")).toBeNaN();
  });

  it("handles boundary float values (lat = -90, lon = 180)", () => {
    expect(queryFloat("-90")).toBe(-90);
    expect(queryFloat("180")).toBe(180);
  });

  it("handles out-of-range latitude values (callers must check)", () => {
    const result = queryFloat("999");
    expect(result).toBe(999);
    expect(isNaN(result)).toBe(false);
  });
});
