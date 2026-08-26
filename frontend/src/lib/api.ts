import type {
  UploadResponse,
  JobStatusResponse,
  ConversionOptions,
} from '@run-down/shared';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadVideo(
  file: File,
  options: ConversionOptions,
  onProgress: (percent: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('outputFormat', options.outputFormat);
    formData.append('videoCodec', options.videoCodec);
    formData.append('audioCodec', options.audioCodec);
    formData.append('resolution', options.resolution);
    formData.append('crf', String(options.crf));

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 202) {
        resolve(JSON.parse(xhr.responseText) as UploadResponse);
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error ?? `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload was aborted.')));

    xhr.open('POST', `${API_URL}/api/upload`);
    xhr.send(formData);
  });
}

// ─── Job status polling ───────────────────────────────────────────────────────

export async function getJobStatus(
  jobId: string,
): Promise<JobStatusResponse & { queuePosition?: number }> {
  const res = await fetch(`${API_URL}/api/jobs/${jobId}/status`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `Status check failed (${res.status})`);
  }

  return res.json();
}

// ─── Download URL (served via API — never exposes real path) ──────────────────

export function getDownloadUrl(jobId: string): string {
  return `${API_URL}/api/jobs/${jobId}/download`;
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
