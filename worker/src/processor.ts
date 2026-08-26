import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { updateJobStatus, updateJobProgress, getJobById } from '../db/jobs';
import { buildFfmpegArgs } from './ffmpeg/builder';
import { getDuration, runFfmpeg } from './ffmpeg/runner';
import { deleteInputFile, deleteOutputFile } from './cleanup';
import type { BullJobData } from '@run-down/shared';
import type { Job as BullJob } from 'bullmq';

const SERVER_ROOT = path.join(__dirname, '..', '..', '..', 'server');
const OUTPUTS_DIR =
  process.env.OUTPUTS_DIR ?? path.join(SERVER_ROOT, 'outputs');

export async function processJob(bullJob: BullJob<BullJobData>): Promise<void> {
  const { jobId, inputPath, options } = bullJob.data;

  console.log(`[worker] Starting job ${jobId}`);

  // ── Mark as processing ────────────────────────────────────────────────────
  updateJobStatus(jobId, 'processing', { progress: 0 });

  let outputPath: string | null = null;

  try {
    // ── Ensure output directory exists ────────────────────────────────────
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

    // ── Get total duration for progress calculation ────────────────────────
    const totalDuration = await getDuration(inputPath);

    // ── Build output path with UUID filename ──────────────────────────────
    const { args, outputExtension } = buildFfmpegArgs(
      inputPath,
      'PLACEHOLDER', // we resolve the real path below
      options,
    );

    outputPath = path.join(OUTPUTS_DIR, `${uuidv4()}.${outputExtension}`);

    // Re-build with the real output path (builder is pure, call again)
    const { args: finalArgs } = buildFfmpegArgs(inputPath, outputPath, options);

    // ── Run ffmpeg ────────────────────────────────────────────────────────
    await runFfmpeg(finalArgs, totalDuration, {
      onProgress: (percent) => {
        updateJobProgress(jobId, percent);
        // Also update BullMQ job progress for queue monitoring
        bullJob.updateProgress(percent).catch(() => {/* non-critical */});
      },
    });

    // ── Success ───────────────────────────────────────────────────────────
    const outputSize = fs.statSync(outputPath).size;
    updateJobStatus(jobId, 'done', {
      progress: 100,
      outputPath,
      outputSize,
    });

    console.log(`[worker] Job ${jobId} done. Output: ${outputPath}`);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] Job ${jobId} failed:`, message);

    updateJobStatus(jobId, 'failed', { error: message });

    // Clean up partial output file on failure
    if (outputPath) {
      deleteOutputFile(outputPath);
    }

  } finally {
    // Always delete the input file — we no longer need it after processing
    deleteInputFile(inputPath);
  }
}
