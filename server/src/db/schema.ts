import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DB_PATH
  ? process.env.DB_PATH
  : path.join(__dirname, '..', '..', 'data', 'rundown.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);

  // WAL mode for better concurrent read performance
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  migrate(_db);

  return _db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id              TEXT PRIMARY KEY,
      status          TEXT NOT NULL DEFAULT 'queued'
                        CHECK(status IN ('queued','processing','done','failed')),
      original_filename TEXT NOT NULL,
      options_json    TEXT NOT NULL,
      progress        REAL NOT NULL DEFAULT 0,
      output_path     TEXT,
      output_size     INTEGER,
      error           TEXT,
      created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      expires_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_expires_at ON jobs(expires_at);
  `);
}
