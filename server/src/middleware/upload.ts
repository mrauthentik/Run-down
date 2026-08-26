import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UPLOADS_DIR } from '../storage';
import { ALLOWED_MIME_TYPES } from '@run-down/shared';
import type { Request } from 'express';

const MAX_FILE_SIZE_BYTES =
  parseInt(process.env.MAX_FILE_SIZE_MB ?? '2048', 10) * 1024 * 1024;

// ─── Multer storage: randomise filename on disk ───────────────────────────────
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${uuidv4()}${ext}`);
  },
});

// ─── Extension-level pre-filter (defence in depth — real MIME check is below) ─
function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  const allowedExts = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.mpeg', '.3gp', '.flv'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExts.includes(ext)) {
    cb(new Error(`File extension '${ext}' is not allowed.`));
    return;
  }
  cb(null, true);
}

export const upload = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter,
});

// ─── Content-based MIME validation (runs after multer saves file) ─────────────
// Uses file-type which reads magic bytes — not trusting the extension.
export async function validateMimeType(filePath: string): Promise<void> {
  // file-type v16 is CJS compatible
  const { fileTypeFromFile } = await import('file-type');
  const result = await fileTypeFromFile(filePath);

  if (!result) {
    throw new Error('Could not determine file type — file may be corrupt or empty.');
  }

  if (!ALLOWED_MIME_TYPES.includes(result.mime)) {
    throw new Error(
      `File content type '${result.mime}' is not allowed. Upload a valid video file.`,
    );
  }
}
