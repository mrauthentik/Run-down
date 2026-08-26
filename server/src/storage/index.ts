import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Paths are resolved relative to server/ root, not dist/
const SERVER_ROOT = path.join(__dirname, '..', '..');

export const UPLOADS_DIR =
  process.env.UPLOADS_DIR ?? path.join(SERVER_ROOT, 'uploads');

export const OUTPUTS_DIR =
  process.env.OUTPUTS_DIR ?? path.join(SERVER_ROOT, 'outputs');

// Ensure directories exist on startup
export function ensureStorageDirs(): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
}

export function getUploadPath(filename: string): string {
  return path.join(UPLOADS_DIR, filename);
}

export function getOutputPath(filename: string): string {
  return path.join(OUTPUTS_DIR, filename);
}

export function deleteFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[storage] Failed to delete ${filePath}:`, err);
  }
}
