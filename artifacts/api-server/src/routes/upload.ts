import { Router, type Request, type Response } from "express";
import multer from "multer";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { checkRateLimit, clientIp } from "../lib/rateLimit";
import { isAllowedObjectKey, parseUploadKind, readPrivateImage, storePrivateImage } from "../lib/fileStorage";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE_BYTES = 8 * 1024 * 1024;

/** Android/Expo often send image/jpg, image/pjpeg, or an empty type. */
export function normalizeImageMime(raw: string | undefined | null, originalName?: string): string {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "image/jpg" || value === "image/pjpeg" || value === "image/jpeg") return "image/jpeg";
  if (value === "image/png" || value === "image/x-png") return "image/png";
  if (value === "image/webp") return "image/webp";
  if (value === "image/heic" || value === "image/heif") return "image/heic";

  const name = String(originalName ?? "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".heic") || name.endsWith(".heif")) return "image/heic";

  // Empty / octet-stream: sniff from buffer later; default keep generic.
  if (!value || value === "application/octet-stream") return "application/octet-stream";
  return value;
}

function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter(_req, file, cb) {
    const normalized = normalizeImageMime(file.mimetype, file.originalname);
    file.mimetype = normalized === "application/octet-stream" ? "image/jpeg" : normalized;
    if (file.mimetype === "image/heic") {
      cb(new Error("HEIC images are not supported. Please use JPEG or PNG."));
      return;
    }
    if (ALLOWED_MIME_TYPES.has(file.mimetype) || normalized === "application/octet-stream") {
      // Allow octet-stream through; content is verified by magic-byte sniff after upload.
      if (normalized === "application/octet-stream") file.mimetype = "image/jpeg";
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});

const router = Router();

router.get("/uploads/file", authMiddleware, async (req: Request, res: Response) => {
  const key = typeof req.query.key === "string" ? req.query.key : "";
  if (!isAllowedObjectKey(key)) {
    res.status(400).json({ error: "Invalid file key" });
    return;
  }

  // Profile / general uploads are displayable in-app (technician avatar on orders, etc.).
  // National ID and license cards remain auth-only.
  const isPublicUpload = key.startsWith("uploads/");
  if (!isPublicUpload && !req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const file = await readPrivateImage(key);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Cache-Control", isPublicUpload ? "public, max-age=3600" : "private, max-age=300");
    res.send(file.buffer);
  } catch (err) {
    req.log.warn({ err }, "Private file read failed");
    res.status(404).json({ error: "File not found" });
  }
});

router.post(
  "/upload",
  authMiddleware,
  requireAuth,
  async (req: Request, res: Response, next) => {
    const ip = clientIp(req);
    const allowed =
      (await checkRateLimit(`upload:ip:${ip}`, 30, 60 * 60 * 1000)) &&
      (await checkRateLimit(`upload:user:${req.user!.id}`, 20, 60 * 60 * 1000));
    if (!allowed) {
      res.status(429).json({ error: "Too many uploads. Please wait." });
      return;
    }
    next();
  },
  (req: Request, res: Response, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: "File too large. Maximum size is 8 MB." });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      if (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    try {
      const sniffed = sniffImageMime(req.file.buffer);
      const mimeType = sniffed ?? normalizeImageMime(req.file.mimetype, req.file.originalname);
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        res.status(400).json({ error: "Only JPEG, PNG, and WebP images are allowed" });
        return;
      }
      const stored = await storePrivateImage({
        buffer: req.file.buffer,
        mimeType,
        uploadedBy: req.user!.id,
        kind: parseUploadKind((req.body as { purpose?: string } | undefined)?.purpose),
      });
      res.status(201).json({
        url: stored.url,
        storage: stored.storage,
        objectName: stored.objectName,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to store private upload");
      const message = err instanceof Error ? err.message : "Upload failed";
      const isStorageConfig =
        /PRIVATE_OBJECT_DIR|GCS|bucket|EACCES|ENOENT|permission/i.test(message);
      res.status(500).json({
        error: isStorageConfig
          ? "Upload storage is misconfigured on the server. Check STORAGE_DRIVER / PRIVATE_OBJECT_DIR."
          : "Upload failed. Please try again.",
      });
    }
  },
);

export default router;
