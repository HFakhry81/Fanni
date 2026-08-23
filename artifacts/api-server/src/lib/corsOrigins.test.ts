import { describe, expect, it } from "vitest";
import { allowedCorsOrigins, isCorsOriginAllowed } from "./corsOrigins";

describe("cors origins", () => {
  it("allows missing Origin (native apps)", () => {
    expect(isCorsOriginAllowed(undefined)).toBe(true);
    expect(isCorsOriginAllowed("")).toBe(true);
  });

  it("defaults production to UpNexa HTTPS origins when CORS_ORIGINS is unset", () => {
    const prevEnv = process.env["NODE_ENV"];
    const prevCors = process.env["CORS_ORIGINS"];
    process.env["NODE_ENV"] = "production";
    delete process.env["CORS_ORIGINS"];
    expect(allowedCorsOrigins()).toContain("https://api.upnexa-eg.com");
    expect(isCorsOriginAllowed("https://evil.example")).toBe(false);
    if (prevEnv === undefined) delete process.env["NODE_ENV"];
    else process.env["NODE_ENV"] = prevEnv;
    if (prevCors === undefined) delete process.env["CORS_ORIGINS"];
    else process.env["CORS_ORIGINS"] = prevCors;
  });
});
