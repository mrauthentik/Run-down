/**
 * Worker-side DB helpers — same SQLite file as the server.
 * Uses Node.js built-in `node:sqlite` (no C++ compilation required).
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_ROOT = path.join(__dirname, '..', '..', '..', 'server');
const DB_PATH = process.env.DB_PATH ?? path.join(SERVER_ROOT, 'data', 'rundown.db');

let _db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (_db) return _db;
  _db = new DatabaseSync(DB_PATH);
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');
  return _db;
}

import type { JobRow, JobStatus } from '@run-down/shared';

function toRow(raw: unknown): JobRow {
  return raw as JobRow;
}

function toRows(raw: unknown[]): JobRow[] {
  return raw as JobRow[];
}

export function getJobById(id: string): JobRow | null {
  const raw = getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  return raw ? toRow(raw) : null;
}

export function updateJobStatus(
  id: string,
  status: JobStatus,
  extra: { progress?: number; outputPath?: string; outputSize?: number; error?: string } = {},
): void {
  const { progress, outputPath, outputSize, error } = extra;
  getDb().prepare(`
    UPDATE jobs
    SET status      = ?,
        progress    = COALESCE(?, progress),
        output_path = COALESCE(?, output_path),
        output_size = COALESCE(?, output_size),
        error       = COALESCE(?, error)
    WHERE id = ?
  `).run(status, progress ?? null, outputPath ?? null, outputSize ?? null, error ?? null, id);
}

export function updateJobProgress(id: string, progress: number): void {
  getDb().prepare('UPDATE jobs SET progress = ? WHERE id = ?').run(progress, id);
}

export function getExpiredJobs(): JobRow[] {
  return toRows(
    getDb()
      .prepare(`SELECT * FROM jobs WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%SZ','now')`)
      .all(),
  );
}

export function getStalledJobs(): JobRow[] {
  const timeoutSec = parseInt(process.env.FFMPEG_TIMEOUT_SECONDS ?? '1800', 10);
  const cutoff = new Date(Date.now() - timeoutSec * 2 * 1000).toISOString();
  return toRows(
    getDb()
      .prepare(`SELECT * FROM jobs WHERE status = 'processing' AND created_at < ?`)
      .all(cutoff),
  );
}
