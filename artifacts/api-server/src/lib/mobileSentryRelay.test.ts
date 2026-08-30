import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);

vi.mock("./sentryConfig", () => ({
  getMobileSentryDsn: () => "https://publickey@o0.ingest.sentry.io/123",
  getApiSentryEnvironment: () => "test",
  SENTRY_ORG: "upnexa-hb",
  SENTRY_PROJECT_MOBILE: "fanni",
}));

describe("mobileSentryRelay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it("posts an envelope to the mobile Sentry project", async () => {
    const { captureMobileSentryException } = await import("./mobileSentryRelay");
    const err = new Error("mobile relay test");
    const eventId = await captureMobileSentryException(err, {
      tags: { source: "unit-test" },
      extra: { adminId: 1 },
    });

    expect(eventId).toMatch(/^[a-f0-9]{32}$/);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("https://o0.ingest.sentry.io/api/123/envelope/");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/x-sentry-envelope");
    expect(init.body).toContain("mobile relay test");
  });
});
