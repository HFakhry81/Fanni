import { Router, type Request, type Response } from "express";
import multer from "multer";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { checkRateLimit, clientIp } from "../lib/rateLimit";
import { isAllowedObjectKey, parseUploadKind, readPrivateImage, storePrivateImage } from "../lib/fileStorage";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE_BYTES = 8 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});

const router = Router();

router.get("/uploads/file", authMiddleware, requireAuth, async (req: Request, res: Response) => {
  const key = typeof req.query.key === "string" ? req.query.key : "";
  if (!isAllowedObjectKey(key)) {
    res.status(400).json({ error: "Invalid file key" });
    return;
  }
  try {
    const file = await readPrivateImage(key);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
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
      const stored = await storePrivateImage({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
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
      res.status(500).json({ error: "Upload failed. Please try again." });
    }
  },
);

export default router;
