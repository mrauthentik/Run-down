/**
 * Database setup using Node.js built-in `node:sqlite` (added in Node.js 22.5.0).
 * No native compilation required — it's part of the Node.js binary itself.
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DB_PATH
  ? process.env.DB_PATH
  : path.join(__dirname, '..', '..', 'data', 'rundown.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;

  _db = new DatabaseSync(DB_PATH);

  // WAL mode for better concurrent read performance (server + worker share same file)
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');

  migrate(_db);

  return _db;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id                TEXT PRIMARY KEY,
      status            TEXT NOT NULL DEFAULT 'queued'
                          CHECK(status IN ('queued','processing','done','failed')),
      original_filename TEXT NOT NULL,
      options_json      TEXT NOT NULL,
      progress          REAL NOT NULL DEFAULT 0,
      output_path       TEXT,
      output_size       INTEGER,
      error             TEXT,
      created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      expires_at        TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status     ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_expires_at ON jobs(expires_at);
  `);
}
