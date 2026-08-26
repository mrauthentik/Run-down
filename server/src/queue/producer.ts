import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { BullJobData } from '@run-down/shared';
import dotenv from 'dotenv';

dotenv.config();

const connection = new IORedis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // required by BullMQ
});

connection.on('error', (err) => {
  console.error('[queue/producer] Redis connection error:', err.message);
});

export const conversionQueue = new Queue<BullJobData>('video-conversion', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
});

export async function enqueueJob(data: BullJobData): Promise<void> {
  await conversionQueue.add('convert', data, {
    jobId: data.jobId, // use our own ID so we can look it up
  });
  console.log(`[queue] Enqueued job ${data.jobId}`);
}

export async function getQueuePosition(jobId: string): Promise<number> {
  const waiting = await conversionQueue.getWaiting();
  const idx = waiting.findIndex((j) => j.id === jobId);
  return idx === -1 ? 0 : idx + 1;
}
