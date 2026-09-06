import multer from "multer";
import { ApiError } from "../utils/apiError.js";

// Keep files in memory as Buffers for instant SHA-256 hash generation and Cloudinary stream piping
const storage = multer.memoryStorage();

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  // Videos
  "video/mp4",
  "video/quicktime",
  "video/webm",
  // Documents
  "application/pdf",
]);

// Maximum file size (50MB for videos, images/PDFs well within this limit)
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    return cb(
      new ApiError(
        400,
        `Unsupported file type: ${file.mimetype}. Allowed formats: JPEG, PNG, WEBP, HEIC, MP4, MOV, WEBM, PDF.`
      ),
      false
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter,
});

/**
 * Single file upload middleware accepting either 'file' or 'media' field names
 */
export const uploadEvidenceFile = (req, res, next) => {
  const uploadSingle = upload.single("file");

  uploadSingle(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new ApiError(400, "File size exceeds the 50MB maximum upload limit"));
        }
        return next(new ApiError(400, `Upload error: ${err.message}`));
      }
      return next(err);
    }
    next();
  });
};
