import { describe, it, expect, vi, beforeEach } from "vitest";
import { isSlug, validateAreaBelongsToGovernorate, invalidateLocationCache, setLocationCacheForTesting } from "./locationNormalizer";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    }),
  },
  locationsTable: {},
  locationAliasesTable: {},
}));

vi.mock("./logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const cairoGov = { id: "gov-cairo", slug: "cairo", nameEn: "Cairo", nameAr: "القاهرة", parentId: null, type: "governorate" as const };
const gizaGov = { id: "gov-giza", slug: "giza", nameEn: "Giza", nameAr: "الجيزة", parentId: null, type: "governorate" as const };
const nasrCityArea = { id: "area-nasr", slug: "cairo__nasr_city", nameEn: "Nasr City", nameAr: "مدينة نصر", parentId: "gov-cairo", type: "area" as const };
const sheikhZayedArea = { id: "area-sz", slug: "giza__sheikh_zayed", nameEn: "Sheikh Zayed", nameAr: "الشيخ زايد", parentId: "gov-giza", type: "area" as const };

describe("validateAreaBelongsToGovernorate", () => {
  beforeEach(() => {
    invalidateLocationCache();
  });

  it("returns true when area parentId matches the governorate id", async () => {
    setLocationCacheForTesting([cairoGov, gizaGov, nasrCityArea, sheikhZayedArea]);

    const result = await validateAreaBelongsToGovernorate("cairo__nasr_city", "cairo");

    expect(result).toBe(true);
  });

  it("returns false when area parentId does not match the governorate id (mismatched pair)", async () => {
    setLocationCacheForTesting([cairoGov, gizaGov, nasrCityArea, sheikhZayedArea]);

    const result = await validateAreaBelongsToGovernorate("giza__sheikh_zayed", "cairo");

    expect(result).toBe(false);
  });

  it("returns false when area slug is not found in the warm cache (fail-closed)", async () => {
    setLocationCacheForTesting([cairoGov, gizaGov, nasrCityArea]);

    const result = await validateAreaBelongsToGovernorate("giza__sheikh_zayed", "cairo");

    expect(result).toBe(false);
  });

  it("returns false when governorate slug is not found in the warm cache (fail-closed)", async () => {
    setLocationCacheForTesting([cairoGov, nasrCityArea, sheikhZayedArea]);

    const result = await validateAreaBelongsToGovernorate("cairo__nasr_city", "giza");

    expect(result).toBe(false);
  });

  it("returns true (allow-through) when the cache is cold and DB returns empty", async () => {
    const result = await validateAreaBelongsToGovernorate("cairo__nasr_city", "cairo");

    expect(result).toBe(true);
  });
});

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
