import { v4 as uuidv4 } from 'uuid';
import { getDb } from './schema';
import type {
  JobRow,
  JobStatus,
  ConversionOptions,
  JobStatusResponse,
} from '@run-down/shared';

const RETENTION_HOURS = parseInt(process.env.RETENTION_HOURS || '1', 10);

// ─── Create ──────────────────────────────────────────────────────────────────

export function createJob(
  originalFilename: string,
  options: ConversionOptions,
): JobRow {
  const db = getDb();
  const id = uuidv4();
  const expiresAt = new Date(
    Date.now() + RETENTION_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const stmt = db.prepare(`
    INSERT INTO jobs (id, original_filename, options_json, expires_at)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(id, originalFilename, JSON.stringify(options), expiresAt);

  return getJobById(id)!;
}

// ─── Read ────────────────────────────────────────────────────────────────────

export function getJobById(id: string): JobRow | null {
  const db = getDb();
  return db
    .prepare('SELECT * FROM jobs WHERE id = ?')
    .get(id) as JobRow | null;
}

export function getExpiredJobs(): JobRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM jobs WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%SZ','now')`,
    )
    .all() as JobRow[];
}

export function getStalledJobs(): JobRow[] {
  // Jobs stuck in 'processing' for more than 2x the ffmpeg timeout — mark as failed
  const db = getDb();
  const timeoutSec = parseInt(process.env.FFMPEG_TIMEOUT_SECONDS || '1800', 10);
  const cutoff = new Date(Date.now() - timeoutSec * 2 * 1000).toISOString();
  return db
    .prepare(
      `SELECT * FROM jobs WHERE status = 'processing' AND created_at < ?`,
    )
    .all(cutoff) as JobRow[];
}

// ─── Update ──────────────────────────────────────────────────────────────────

export function updateJobStatus(
  id: string,
  status: JobStatus,
  extra: { progress?: number; outputPath?: string; outputSize?: number; error?: string } = {},
): void {
  const db = getDb();
  const { progress, outputPath, outputSize, error } = extra;

  db.prepare(`
    UPDATE jobs
    SET status = ?,
        progress = COALESCE(?, progress),
        output_path = COALESCE(?, output_path),
        output_size = COALESCE(?, output_size),
        error = COALESCE(?, error)
    WHERE id = ?
  `).run(status, progress ?? null, outputPath ?? null, outputSize ?? null, error ?? null, id);
}

export function updateJobProgress(id: string, progress: number): void {
  const db = getDb();
  db.prepare('UPDATE jobs SET progress = ? WHERE id = ?').run(progress, id);
}

// ─── Serialise for API response ──────────────────────────────────────────────

export function toStatusResponse(row: JobRow): JobStatusResponse {
  return {
    id: row.id,
    status: row.status,
    progress: row.progress,
    error: row.error,
    originalFilename: row.original_filename,
    options: JSON.parse(row.options_json) as ConversionOptions,
    outputSize: row.output_size,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}
