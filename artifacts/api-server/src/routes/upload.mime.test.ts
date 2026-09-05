import { describe, expect, it } from "vitest";
import { normalizeImageMime } from "../routes/upload";

describe("normalizeImageMime", () => {
  it("normalizes Android jpg aliases", () => {
    expect(normalizeImageMime("image/jpg")).toBe("image/jpeg");
    expect(normalizeImageMime("image/pjpeg")).toBe("image/jpeg");
  });

  it("infers from filename when mime empty", () => {
    expect(normalizeImageMime("", "id-card.PNG")).toBe("image/png");
    expect(normalizeImageMime("application/octet-stream", "a.webp")).toBe("image/webp");
  });
});
