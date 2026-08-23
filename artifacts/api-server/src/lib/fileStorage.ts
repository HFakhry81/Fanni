import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { objectStorageClient } from "./objectStorage";

export type StoredFile = {
  storage: "local" | "gcs";
  objectName: string;
  contentType: string;
  url: string;
};

export type UploadKind = "id" | "carnehat" | "uploads";

export function parseUploadKind(raw: unknown): UploadKind {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "id" || value === "national_id" || value === "card") return "id";
  if (value === "carnehat" || value === "license" || value === "kyc_license") return "carnehat";
  return "uploads";
}

export function isAllowedObjectKey(objectName: string): boolean {
  if (!objectName || objectName.includes("..") || objectName.includes("\\")) return false;
  return /^(uploads|id|carnehat)\/[A-Za-z0-9._/-]+$/.test(objectName);
}

function localRoot(): string {
  return process.env["PRIVATE_OBJECT_DIR"] || "./uploads";
}

export function localRootForKind(kind: UploadKind): string {
  if (kind === "id") {
    return process.env["PRIVATE_OBJECT_DIR_ID"] || path.join(localRoot(), "id");
  }
  if (kind === "carnehat") {
    return process.env["PRIVATE_OBJECT_DIR_CARNEHAT"] || path.join(localRoot(), "carnehat");
  }
  return path.join(localRoot(), "uploads");
}

export function kindFromObjectName(objectName: string): UploadKind {
  if (objectName.startsWith("id/")) return "id";
  if (objectName.startsWith("carnehat/")) return "carnehat";
  return "uploads";
}

export function resolveLocalAbsPath(objectName: string): string {
  const kind = kindFromObjectName(objectName);
  const prefix = `${kind}/`;
  const rest = objectName.startsWith(prefix) ? objectName.slice(prefix.length) : objectName;
  return path.resolve(localRootForKind(kind), rest);
}

export function storageDriver(): "local" | "gcs" {
  const explicit = process.env["STORAGE_DRIVER"]?.trim().toLowerCase();
  if (explicit === "gcs") return "gcs";
  if (explicit === "local") return "local";
  const dir = process.env["PRIVATE_OBJECT_DIR"] ?? "";
  if (!dir || dir.startsWith(".") || dir.startsWith("/") || /^[A-Za-z]:[\\/]/.test(dir)) {
    return "local";
  }
  return "gcs";
}

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** Private write — never makePublic. Callers serve bytes only via authenticated GET. */
export async function storePrivateImage(opts: {
  buffer: Buffer;
  mimeType: string;
  uploadedBy: string;
  kind?: UploadKind;
}): Promise<StoredFile> {
  const ext = extFor(opts.mimeType);
  const kind = opts.kind ?? "uploads";
  const objectName = `${kind}/${opts.uploadedBy}/${randomUUID()}.${ext}`;
  const driver = storageDriver();

  if (driver === "local") {
    const abs = resolveLocalAbsPath(objectName);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, opts.buffer);
    return {
      storage: "local",
      objectName,
      contentType: opts.mimeType,
      url: `/api/uploads/file?key=${encodeURIComponent(objectName)}`,
    };
  }

  const dir = process.env["PRIVATE_OBJECT_DIR"] ?? "";
  const bucketName = dir.replace(/^\//, "").split("/")[0];
  if (!bucketName) throw new Error("PRIVATE_OBJECT_DIR is not a GCS bucket path");
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(opts.buffer, {
    contentType: opts.mimeType,
    metadata: { uploadedBy: opts.uploadedBy, visibility: "private", kind },
  });
  return {
    storage: "gcs",
    objectName,
    contentType: opts.mimeType,
    url: `/api/uploads/file?key=${encodeURIComponent(objectName)}`,
  };
}

export async function readPrivateImage(objectName: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (!isAllowedObjectKey(objectName)) {
    throw new Error("Invalid object key");
  }
  const driver = storageDriver();
  if (driver === "local") {
    const abs = resolveLocalAbsPath(objectName);
    const buffer = await readFile(abs);
    const ext = path.extname(objectName).slice(1);
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return { buffer, contentType };
  }
  const dir = process.env["PRIVATE_OBJECT_DIR"] ?? "";
  const bucketName = dir.replace(/^\//, "").split("/")[0];
  if (!bucketName) throw new Error("PRIVATE_OBJECT_DIR is not a GCS bucket path");
  const [buffer] = await objectStorageClient.bucket(bucketName).file(objectName).download();
  return { buffer, contentType: "application/octet-stream" };
}
