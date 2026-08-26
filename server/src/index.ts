import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ensureStorageDirs } from './storage';
import { getDb } from './db/schema';
import { uploadRouter } from './routes/upload';
import { jobsRouter } from './routes/jobs';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  }),
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Trust proxy for correct IP in rate limiter ───────────────────────────────
app.set('trust proxy', 1);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/jobs', jobsRouter);

// 404 fallthrough
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Centralised error handler (must be last) ─────────────────────────────────
app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  // Ensure upload/output directories exist
  ensureStorageDirs();

  // Initialise DB (runs migrations)
  getDb();
  console.log('[server] Database initialised');

  app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  process.exit(1);
});
