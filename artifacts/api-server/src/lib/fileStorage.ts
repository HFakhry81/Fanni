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

function localRoot(): string {
  return process.env["PRIVATE_OBJECT_DIR"] || "./uploads";
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
}): Promise<StoredFile> {
  const ext = extFor(opts.mimeType);
  const objectName = `uploads/${opts.uploadedBy}/${randomUUID()}.${ext}`;
  const driver = storageDriver();

  if (driver === "local") {
    const abs = path.resolve(localRoot(), objectName);
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
    metadata: { uploadedBy: opts.uploadedBy, visibility: "private" },
  });
  return {
    storage: "gcs",
    objectName,
    contentType: opts.mimeType,
    url: `/api/uploads/file?key=${encodeURIComponent(objectName)}`,
  };
}

export async function readPrivateImage(objectName: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (!objectName.startsWith("uploads/") || objectName.includes("..")) {
    throw new Error("Invalid object key");
  }
  const driver = storageDriver();
  if (driver === "local") {
    const abs = path.resolve(localRoot(), objectName);
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
