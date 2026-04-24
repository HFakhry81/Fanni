import { Router, type Request, type Response } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { objectStorageClient } from "../lib/objectStorage";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

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

function getBucketName(): string {
  const dir = process.env["PRIVATE_OBJECT_DIR"] ?? "";
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR not set");
  const parts = dir.replace(/^\//, "").split("/");
  const name = parts[0];
  if (!name) throw new Error("Could not determine bucket name from PRIVATE_OBJECT_DIR");
  return name;
}

router.post(
  "/upload",
  authMiddleware,
  requireAuth,
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
      const bucketName = getBucketName();
      const ext = req.file.mimetype === "image/png" ? "png" : req.file.mimetype === "image/webp" ? "webp" : "jpg";
      const objectName = `uploads/${randomUUID()}.${ext}`;

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      await file.save(req.file.buffer, {
        contentType: req.file.mimetype,
        metadata: {
          uploadedBy: req.user!.id,
        },
      });

      await file.makePublic();

      const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectName}`;
      res.status(201).json({ url: publicUrl });
    } catch (err) {
      req.log.error({ err }, "Failed to upload file to object storage");
      res.status(500).json({ error: "Upload failed. Please try again." });
    }
  },
);

export default router;
