import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import cron from 'node-cron';
import { processJob } from './processor';
import { getExpiredJobs, getStalledJobs, updateJobStatus } from './db/jobs';
import { deleteInputFile, deleteOutputFile } from './cleanup';
import type { BullJobData } from '@run-down/shared';

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '2', 10);

// ─── Redis connection ─────────────────────────────────────────────────────────
const connection = new IORedis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => {
  console.error('[worker] Redis connection error:', err.message);
});

// ─── BullMQ Worker ────────────────────────────────────────────────────────────
const worker = new Worker<BullJobData>(
  'video-conversion',
  async (job) => {
    await processJob(job);
  },
  {
    connection,
    concurrency: WORKER_CONCURRENCY,
    // Lock duration: how long a job can be held before BullMQ reclaims it
    // Set to 2x ffmpeg timeout so a crash doesn't leave jobs stuck forever
    lockDuration: parseInt(process.env.FFMPEG_TIMEOUT_SECONDS ?? '1800', 10) * 2000,
    stalledInterval: 60_000, // check for stalled jobs every minute
  },
);

worker.on('active', (job) => {
  console.log(`[worker] Job ${job.data.jobId} is now active`);
});

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.data.jobId} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.data?.jobId} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[worker] Worker error:', err);
});

// ─── Stalled job recovery ─────────────────────────────────────────────────────
// If the worker crashes mid-job, BullMQ will re-queue via stalledInterval,
// but also mark our SQLite record as failed so the UI isn't stuck.
worker.on('stalled', (jobId) => {
  console.warn(`[worker] Job ${jobId} stalled — marking failed in DB`);
  updateJobStatus(jobId, 'failed', {
    error: 'Job stalled (worker crash or timeout). Please retry.',
  });
});

// ─── Cleanup cron: every 15 minutes ──────────────────────────────────────────
cron.schedule('*/15 * * * *', () => {
  console.log('[cleanup] Running expiry sweep...');

  // Delete expired job files
  const expired = getExpiredJobs();
  for (const job of expired) {
    if (job.output_path) deleteOutputFile(job.output_path);
    // Input file should already be gone, but just in case:
    console.log(`[cleanup] Expired job ${job.id} files cleaned`);
  }

  // Recover jobs stuck in 'processing' for > 2x timeout (crash recovery)
  const stalled = getStalledJobs();
  for (const job of stalled) {
    console.warn(`[cleanup] Recovering stalled job ${job.id}`);
    updateJobStatus(job.id, 'failed', {
      error: 'Job timed out or worker crashed. Please try again.',
    });
  }
});

// ─── Startup ──────────────────────────────────────────────────────────────────
console.log(
  `[worker] Started. Concurrency: ${WORKER_CONCURRENCY}. Redis: ${process.env.REDIS_HOST ?? '127.0.0.1'}:${process.env.REDIS_PORT ?? '6379'}`,
);

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(): Promise<void> {
  console.log('[worker] Shutting down...');
  await worker.close();
  connection.disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (reason) => {
  console.error('[worker] Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[worker] Uncaught exception:', err);
  process.exit(1);
});
