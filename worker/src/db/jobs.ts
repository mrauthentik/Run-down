/**
 * Worker-side DB helpers — same SQLite file as the server.
 * The worker only needs to update job state, not create jobs.
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_ROOT = path.join(__dirname, '..', '..', '..', 'server');
const DB_PATH = process.env.DB_PATH ?? path.join(SERVER_ROOT, 'data', 'rundown.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  return _db;
}

import type { JobRow, JobStatus } from '@run-down/shared';

export function getJobById(id: string): JobRow | null {
  return getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | null;
}

export function updateJobStatus(
  id: string,
  status: JobStatus,
  extra: { progress?: number; outputPath?: string; outputSize?: number; error?: string } = {},
): void {
  const { progress, outputPath, outputSize, error } = extra;
  getDb().prepare(`
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
  getDb().prepare('UPDATE jobs SET progress = ? WHERE id = ?').run(progress, id);
}

export function getExpiredJobs(): JobRow[] {
  return getDb()
    .prepare(`SELECT * FROM jobs WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%SZ','now')`)
    .all() as JobRow[];
}

export function getStalledJobs(): JobRow[] {
  const timeoutSec = parseInt(process.env.FFMPEG_TIMEOUT_SECONDS ?? '1800', 10);
  const cutoff = new Date(Date.now() - timeoutSec * 2 * 1000).toISOString();
  return getDb()
    .prepare(`SELECT * FROM jobs WHERE status = 'processing' AND created_at < ?`)
    .all(cutoff) as JobRow[];
}
