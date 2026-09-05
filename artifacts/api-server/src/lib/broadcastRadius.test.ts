import { describe, expect, it } from "vitest";
import {
  DEFAULT_BROADCAST_MAX_RADIUS_KM,
  parseBroadcastRadiusTiersKm,
  resolveBroadcastMaxRadiusKm,
} from "./broadcastRadius";
import { haversineKm, isImplausibleGeoJump } from "./geoJump";

describe("broadcastRadius", () => {
  it("defaults and caps tiers", () => {
    expect(parseBroadcastRadiusTiersKm(undefined)).toEqual([15, 50, 100]);
    expect(parseBroadcastRadiusTiersKm("5,15,500", 100)).toEqual([5, 15]);
    expect(parseBroadcastRadiusTiersKm("999", 100)).toEqual([15, 50, 100]);
  });

  it("resolves max from env with absolute ceiling", () => {
    expect(resolveBroadcastMaxRadiusKm(undefined)).toBe(DEFAULT_BROADCAST_MAX_RADIUS_KM);
    expect(resolveBroadcastMaxRadiusKm("80")).toBe(80);
    expect(resolveBroadcastMaxRadiusKm("9999")).toBe(250);
  });
});

describe("geoJump", () => {
  it("computes haversine roughly", () => {
    // ~111 km per degree latitude
    const d = haversineKm(30, 31, 31, 31);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });

  it("flags teleport within short window", () => {
    expect(
      isImplausibleGeoJump({
        fromLat: 30.0,
        fromLon: 31.0,
        toLat: 31.2,
        toLon: 31.0,
        elapsedMs: 5_000,
      }),
    ).toBe(true);

    expect(
      isImplausibleGeoJump({
        fromLat: 30.0,
        fromLon: 31.0,
        toLat: 30.001,
        toLon: 31.001,
        elapsedMs: 5_000,
      }),
    ).toBe(false);
  });
});
