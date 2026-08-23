import { describe, expect, it } from "vitest";
import {
  isAllowedObjectKey,
  kindFromObjectName,
  localRootForKind,
  parseUploadKind,
  resolveLocalAbsPath,
} from "./fileStorage";

describe("upload kinds", () => {
  it("maps registration fields to KYC folders", () => {
    expect(parseUploadKind("id")).toBe("id");
    expect(parseUploadKind("license")).toBe("carnehat");
    expect(parseUploadKind("carnehat")).toBe("carnehat");
    expect(parseUploadKind(undefined)).toBe("uploads");
  });

  it("rejects path traversal keys", () => {
    expect(isAllowedObjectKey("id/../secret")).toBe(false);
    expect(isAllowedObjectKey("id/user/a.jpg")).toBe(true);
    expect(isAllowedObjectKey("carnehat/user/a.jpg")).toBe(true);
    expect(isAllowedObjectKey("uploads/user/a.jpg")).toBe(true);
  });

  it("resolves VPS KYC directories from env", () => {
    const prev = {
      root: process.env["PRIVATE_OBJECT_DIR"],
      id: process.env["PRIVATE_OBJECT_DIR_ID"],
      carnehat: process.env["PRIVATE_OBJECT_DIR_CARNEHAT"],
    };
    process.env["PRIVATE_OBJECT_DIR"] = "/var/www/storage/fanni";
    process.env["PRIVATE_OBJECT_DIR_ID"] = "/var/www/storage/fanni/id";
    process.env["PRIVATE_OBJECT_DIR_CARNEHAT"] = "/var/www/storage/fanni/carnehat";

    expect(localRootForKind("id").replace(/\\/g, "/")).toBe("/var/www/storage/fanni/id");
    expect(localRootForKind("carnehat").replace(/\\/g, "/")).toBe("/var/www/storage/fanni/carnehat");
    expect(kindFromObjectName("id/u/a.jpg")).toBe("id");
    expect(resolveLocalAbsPath("id/u/a.jpg").replace(/\\/g, "/")).toContain("storage/fanni/id/u/a.jpg");

    if (prev.root === undefined) delete process.env["PRIVATE_OBJECT_DIR"];
    else process.env["PRIVATE_OBJECT_DIR"] = prev.root;
    if (prev.id === undefined) delete process.env["PRIVATE_OBJECT_DIR_ID"];
    else process.env["PRIVATE_OBJECT_DIR_ID"] = prev.id;
    if (prev.carnehat === undefined) delete process.env["PRIVATE_OBJECT_DIR_CARNEHAT"];
    else process.env["PRIVATE_OBJECT_DIR_CARNEHAT"] = prev.carnehat;
  });
});
