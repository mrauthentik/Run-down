import { execFile } from 'child_process';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

const ffprobePath = ffprobeInstaller.path;

const FFMPEG_TIMEOUT_MS =
  parseInt(process.env.FFMPEG_TIMEOUT_SECONDS ?? '1800', 10) * 1000;

// ─── Progress Parsing ────────────────────────────────────────────────────────
// ffmpeg writes lines like:
//   frame=  123 fps= 25 q=28.0 size=    1024kB time=00:00:05.00 bitrate=...
// We parse `time=HH:MM:SS.ss` and compare to total duration.

function parseTimeSeconds(timeStr: string): number {
  const [h, m, s] = timeStr.split(':').map(parseFloat);
  return h * 3600 + m * 60 + s;
}

function extractTime(line: string): number | null {
  const match = line.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
  if (!match) return null;
  return parseTimeSeconds(match[1]);
}

// ─── ffprobe: get video duration ────────────────────────────────────────────

export function getDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ];

    execFile(ffprobePath, args, { timeout: 30_000 }, (err, stdout) => {
      if (err) {
        reject(new Error(`ffprobe failed: ${err.message}`));
        return;
      }
      const duration = parseFloat(stdout.trim());
      if (isNaN(duration) || duration <= 0) {
        reject(new Error('Could not determine video duration.'));
        return;
      }
      resolve(duration);
    });
  });
}

// ─── ffmpeg runner ───────────────────────────────────────────────────────────

export interface RunOptions {
  onProgress: (percent: number) => void;
}

export function runFfmpeg(
  args: string[],
  totalDuration: number,
  { onProgress }: RunOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg binary not found (ffmpeg-static returned null).'));
      return;
    }

    console.log('[ffmpeg] Spawning:', path.basename(ffmpegPath), args.join(' '));

    const child = execFile(
      ffmpegPath,
      args,
      {
        timeout: FFMPEG_TIMEOUT_MS,
        // Do NOT set shell:true — args are passed as an array to execFile
        maxBuffer: 10 * 1024 * 1024, // 10 MB stderr buffer
      },
    );

    let stderr = '';

    // ffmpeg writes progress to stderr, not stdout
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;

      // Parse progress lines (they start with 'frame=')
      const lines = text.split('\r');
      for (const line of lines) {
        const elapsed = extractTime(line);
        if (elapsed !== null && totalDuration > 0) {
          const percent = Math.min(Math.round((elapsed / totalDuration) * 100), 99);
          onProgress(percent);
        }
      }
    });

    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
        reject(new Error(`ffmpeg timed out after ${FFMPEG_TIMEOUT_MS / 1000}s.`));
      } else {
        reject(new Error(`ffmpeg spawn error: ${err.message}`));
      }
    });

    child.on('close', (code, signal) => {
      if (code === 0) {
        onProgress(100);
        resolve();
      } else if (signal === 'SIGKILL') {
        reject(new Error('ffmpeg was killed (timeout or OOM).'));
      } else {
        // Extract last few lines of stderr for a useful error message
        const lastLines = stderr.split('\n').slice(-8).join('\n');
        reject(new Error(`ffmpeg exited with code ${code}.\n${lastLines}`));
      }
    });
  });
}
