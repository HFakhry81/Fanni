import { describe, it, expect } from "vitest";
import { isQuietRequestPath } from "./logNoise";

describe("isQuietRequestPath", () => {
  it("treats bot and probe paths as quiet", () => {
    expect(isQuietRequestPath("/favicon.ico")).toBe(true);
    expect(isQuietRequestPath("/robots.txt")).toBe(true);
    expect(isQuietRequestPath("/.env")).toBe(true);
    expect(isQuietRequestPath("/.git/config")).toBe(true);
    expect(isQuietRequestPath("/wp-admin")).toBe(true);
  });

  it("keeps real API paths audible", () => {
    expect(isQuietRequestPath("/")).toBe(false);
    expect(isQuietRequestPath("/healthz")).toBe(false);
    expect(isQuietRequestPath("/api/orders")).toBe(false);
  });
});
