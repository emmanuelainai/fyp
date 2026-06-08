import fs from "fs";
import path from "path";
import multer from "multer";
import { env } from "../config/env";
import { sanitizeFileName } from "../utils/fileNames";
import { ApiError } from "../utils/apiError";

const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR, "evidence");
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => cb(null, sanitizeFileName(file.originalname))
});

export const evidenceUpload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new ApiError(400, "Evidence uploads must be PNG, JPEG, WebP, or PDF files"));
    }
    return cb(null, true);
  }
});
