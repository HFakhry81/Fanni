import { describe, it, expect, vi, beforeEach } from "vitest";
import { isSlug } from "./locationNormalizer";

describe("isSlug", () => {
  it("accepts simple lowercase slug", () => {
    expect(isSlug("cairo")).toBe(true);
  });

  it("accepts slug with underscores", () => {
    expect(isSlug("nasr_city")).toBe(true);
  });

  it("accepts area slug with double-underscore separator", () => {
    expect(isSlug("cairo__nasr_city")).toBe(true);
  });

  it("accepts slug starting with a digit", () => {
    expect(isSlug("6th_of_october__sheikh_zayed")).toBe(true);
  });

  it("rejects value with spaces", () => {
    expect(isSlug("nasr city")).toBe(false);
  });

  it("rejects value with uppercase letters", () => {
    expect(isSlug("Cairo")).toBe(false);
  });

  it("rejects value with hyphens", () => {
    expect(isSlug("nasr-city")).toBe(false);
  });

  it("rejects Arabic display name", () => {
    expect(isSlug("القاهرة")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isSlug("")).toBe(false);
  });

  it("rejects value with parentheses", () => {
    expect(isSlug("cairo (city)")).toBe(false);
  });
});
