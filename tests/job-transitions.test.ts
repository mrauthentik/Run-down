import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JobStatus } from '../shared/src/index';

// ─── Simulate the job state machine in isolation ──────────────────────────────
// We test the state transition logic without touching SQLite.

type JobState = {
  id: string;
  status: JobStatus;
  progress: number;
  error: string | null;
  outputPath: string | null;
};

function createMockJob(id: string): JobState {
  return { id, status: 'queued', progress: 0, error: null, outputPath: null };
}

function transitionToProcessing(job: JobState): JobState {
  if (job.status !== 'queued') {
    throw new Error(`Cannot start processing from status '${job.status}'`);
  }
  return { ...job, status: 'processing', progress: 0 };
}

function updateProgress(job: JobState, percent: number): JobState {
  if (job.status !== 'processing') {
    throw new Error(`Cannot update progress when status is '${job.status}'`);
  }
  if (percent < 0 || percent > 100) {
    throw new Error(`Progress ${percent} out of range [0, 100]`);
  }
  return { ...job, progress: percent };
}

function transitionToDone(job: JobState, outputPath: string): JobState {
  if (job.status !== 'processing') {
    throw new Error(`Cannot mark done from status '${job.status}'`);
  }
  return { ...job, status: 'done', progress: 100, outputPath };
}

function transitionToFailed(job: JobState, error: string): JobState {
  if (job.status === 'done') {
    throw new Error(`Cannot mark a completed job as failed`);
  }
  return { ...job, status: 'failed', error };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Job state machine', () => {
  let job: JobState;

  beforeEach(() => {
    job = createMockJob('test-job-1');
  });

  it('initial state is queued with 0 progress', () => {
    expect(job.status).toBe('queued');
    expect(job.progress).toBe(0);
    expect(job.error).toBeNull();
    expect(job.outputPath).toBeNull();
  });

  it('transitions queued → processing', () => {
    const next = transitionToProcessing(job);
    expect(next.status).toBe('processing');
    expect(next.progress).toBe(0);
  });

  it('throws if trying to start processing a non-queued job', () => {
    const processing = transitionToProcessing(job);
    expect(() => transitionToProcessing(processing)).toThrow(/Cannot start processing/);
  });

  it('updates progress while processing', () => {
    let j = transitionToProcessing(job);
    j = updateProgress(j, 50);
    expect(j.progress).toBe(50);
    j = updateProgress(j, 99);
    expect(j.progress).toBe(99);
  });

  it('throws if updating progress on non-processing job', () => {
    expect(() => updateProgress(job, 50)).toThrow(/Cannot update progress/);
  });

  it('throws if progress is out of range', () => {
    const processing = transitionToProcessing(job);
    expect(() => updateProgress(processing, -1)).toThrow(/out of range/);
    expect(() => updateProgress(processing, 101)).toThrow(/out of range/);
  });

  it('transitions processing → done with output path', () => {
    let j = transitionToProcessing(job);
    j = transitionToDone(j, '/outputs/uuid.mp4');
    expect(j.status).toBe('done');
    expect(j.progress).toBe(100);
    expect(j.outputPath).toBe('/outputs/uuid.mp4');
  });

  it('throws if trying to mark done from non-processing state', () => {
    expect(() => transitionToDone(job, '/outputs/file.mp4')).toThrow(/Cannot mark done/);
  });

  it('transitions queued → failed directly (rejected before processing)', () => {
    const failed = transitionToFailed(job, 'MIME type not allowed');
    expect(failed.status).toBe('failed');
    expect(failed.error).toBe('MIME type not allowed');
  });

  it('transitions processing → failed on ffmpeg error', () => {
    let j = transitionToProcessing(job);
    j = transitionToFailed(j, 'ffmpeg exited with code 1');
    expect(j.status).toBe('failed');
    expect(j.error).toBe('ffmpeg exited with code 1');
  });

  it('throws if trying to fail an already-done job', () => {
    let j = transitionToProcessing(job);
    j = transitionToDone(j, '/outputs/file.mp4');
    expect(() => transitionToFailed(j, 'some error')).toThrow(/Cannot mark a completed job/);
  });

  it('happy path: queued → processing → 50% → 100% → done', () => {
    let j = job;
    expect(j.status).toBe('queued');
    j = transitionToProcessing(j);
    expect(j.status).toBe('processing');
    j = updateProgress(j, 50);
    expect(j.progress).toBe(50);
    j = transitionToDone(j, '/outputs/out.mp4');
    expect(j.status).toBe('done');
    expect(j.progress).toBe(100);
    expect(j.outputPath).toBe('/outputs/out.mp4');
  });
});
