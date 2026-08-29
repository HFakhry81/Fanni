import { apiBaseToWsUrl, getApiBase } from "../api";

describe("getApiBase", () => {
  it("falls back to production API when no env overrides apply", () => {
    expect(getApiBase()).toBe("https://api.upnexa-eg.com");
  });
});

describe("apiBaseToWsUrl", () => {
  it("maps https API base to wss websocket URL", () => {
    expect(apiBaseToWsUrl("https://api.example.com")).toBe("wss://api.example.com/api/ws");
  });

  it("maps http API base to ws websocket URL", () => {
    expect(apiBaseToWsUrl("http://localhost:8080", "/events")).toBe("ws://localhost:8080/events");
  });

  it("returns empty string when API base is empty", () => {
    expect(apiBaseToWsUrl("")).toBe("");
  });
});
