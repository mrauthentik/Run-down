# Run-down — Video Converter

> Upload a video → choose codec/format → download the result.
> Built with Next.js, Express, BullMQ + Redis, and ffmpeg.

```
 ┌──────────────────────────────────────────────────────────────┐
 │                       Browser (Next.js)                      │
 │  Drag-drop upload · options form · live progress · download  │
 └────────────────────────┬─────────────────────────────────────┘
                          │ HTTP (upload + status polling)
 ┌────────────────────────▼─────────────────────────────────────┐
 │                  API Server  (Express)                       │
 │  POST /api/upload   → validate → save → enqueue → return ID  │
 │  GET  /api/jobs/:id/status  → DB lookup                      │
 │  GET  /api/jobs/:id/download → stream file                   │
 └────────────────────────┬─────────────────────────────────────┘
                          │ BullMQ job
 ┌────────────────────────▼─────────────────────────────────────┐
 │                   Redis  (BullMQ queue)                      │
 └────────────────────────┬─────────────────────────────────────┘
                          │
 ┌────────────────────────▼─────────────────────────────────────┐
 │                   Worker  (Node.js process)                  │
 │  Dequeue → ffmpeg subprocess → parse progress → update DB    │
 └──────────────────────────────────────────────────────────────┘
                          │
 ┌────────────────────────▼─────────────────────────────────────┐
 │               SQLite  (jobs table, WAL mode)                 │
 │  id · status · options · progress · output_path · expires_at │
 └──────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | v18+ | v24 recommended |
| npm | v9+ | workspaces support |
| Redis | v6+ | **required** — see below |
| ffmpeg | bundled | via `ffmpeg-static` npm package — no manual install |

### Start Redis

**Docker (easiest on Windows):**
```bash
docker run -d -p 6379:6379 --name rundown-redis redis:alpine
```

**WSL2:**
```bash
sudo service redis-server start
```

---

## Setup

```bash
# 1. Clone
git clone <repo-url>
cd run-down

# 2. Copy environment config
cp .env.example .env
# Edit .env as needed (defaults work for local dev)

# 3. Install all workspace packages
npm install
```

---

## Running Locally

Open **three terminals**:

```bash
# Terminal 1 — API server (port 3001)
npm run dev:server

# Terminal 2 — Worker process
npm run dev:worker

# Terminal 3 — Frontend (port 3000)
npm run dev:frontend
```

Then open http://localhost:3000

> **Or run all three together:**
> ```bash
> npm run dev
> ```

---

## Environment Variables

All variables have sensible defaults for local development. Copy `.env.example` to `.env`.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | API server port |
| `MAX_FILE_SIZE_MB` | `2048` | Max upload size (MB) |
| `RETENTION_HOURS` | `1` | Hours before output files are deleted |
| `RATE_LIMIT_MAX` | `10` | Max uploads per IP per window |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `REDIS_HOST` | `127.0.0.1` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | *(none)* | Redis auth password |
| `WORKER_CONCURRENCY` | `2` | Max simultaneous ffmpeg processes |
| `FFMPEG_TIMEOUT_SECONDS` | `1800` | Per-job ffmpeg timeout (30 min) |
| `UPLOADS_DIR` | `server/uploads/` | Input file storage path |
| `OUTPUTS_DIR` | `server/outputs/` | Output file storage path |
| `DB_PATH` | `server/data/rundown.db` | SQLite database file path |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | API base URL (frontend) |

---

## API Reference

### `POST /api/upload`

**Form fields:**
| Field | Required | Description |
|---|---|---|
| `file` | Yes | Video file (mp4/mov/mkv/avi/webm) |
| `outputFormat` | Yes | `mp4` or `webm` or `mov` |
| `videoCodec` | Yes | `libx264` or `libx265` or `vp9` |
| `audioCodec` | Yes | `aac` or `mp3` or `opus` |
| `resolution` | Yes | `original`, `1080p`, `720p`, `480p` |
| `crf` | Yes | 18-51 (18 = best quality) |

**Response 202:** `{ "jobId": "uuid", "message": "..." }`

### `GET /api/jobs/:id/status`

```json
{
  "id": "uuid",
  "status": "queued | processing | done | failed",
  "progress": 67,
  "queuePosition": 2,
  "error": null,
  "outputSize": 14208512,
  "expiresAt": "2024-01-01T01:00:00Z"
}
```

### `GET /api/jobs/:id/download`

Streams the converted file. Only available when `status === "done"`.

---

## Project Structure

```
run-down/
├── shared/          # Types, whitelists, constants (server + worker)
├── server/          # Express API
│   └── src/
│       ├── db/           # SQLite schema + CRUD
│       ├── middleware/   # multer, rate-limit, error handler
│       ├── queue/        # BullMQ producer
│       ├── routes/       # upload, jobs, health
│       └── storage/      # path helpers
├── worker/          # BullMQ consumer
│   └── src/
│       ├── db/           # worker-side DB updates
│       ├── ffmpeg/       # whitelist, arg builder, runner
│       └── cleanup.ts
├── frontend/        # Next.js 15 App Router
│   └── src/
│       ├── app/          # page.tsx, layout.tsx, globals.css
│       ├── components/   # UploadZone, ConversionOptions, ProgressView
│       └── lib/          # api.ts, utils.ts
└── tests/           # Vitest tests
```

---

## Tests

```bash
npm test
```

- **`ffmpeg-builder.test.ts`** — Whitelist enforcement + injection prevention
- **`validation.test.ts`** — Whitelist completeness, CRF range, codec/format compat
- **`job-transitions.test.ts`** — State machine (queued → processing → done/failed)

---

## Architecture Decisions

**Why BullMQ + Redis?** True pub/sub locking prevents two workers claiming the same job. Built-in retry with exponential backoff. The tradeoff is the Redis dependency (one Docker command).

**Why SQLite?** Zero extra services. WAL mode allows concurrent reads from both API + worker sharing one file. Swap to Postgres by replacing `better-sqlite3` with `pg`.

**Why `execFile` not `exec`?** `execFile` accepts a string array and never invokes a shell. `exec` spawns a shell that interprets metacharacters. Combined with the whitelist in `builder.ts`, command injection is structurally impossible.

**Why XHR for upload?** `fetch` has no upload progress API. XHR's `upload.onprogress` gives real byte-level progress mapped to 0-30% of the combined progress display.

---

## Security Design

| Threat | Mitigation |
|---|---|
| Command injection | `execFile` + whitelist array — no shell, no interpolation |
| Malicious file content | `file-type` reads magic bytes, not extension |
| Path traversal | Filenames are UUIDs on disk; download served via DB lookup |
| Large file DoS | `MAX_FILE_SIZE_MB` enforced by multer before bytes hit disk |
| Abuse / spam | `express-rate-limit` per IP (10 uploads / 15 min) |
| Runaway ffmpeg | Per-job timeout (SIGKILL after N seconds) |
| Storage bloat | Cron purges files after `RETENTION_HOURS` |
| Stalled jobs | BullMQ `stalledInterval` + cron marks stuck jobs as `failed` |
