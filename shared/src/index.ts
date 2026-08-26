// ─── Job Status & Options ────────────────────────────────────────────────────

export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

export type OutputFormat = 'mp4' | 'webm' | 'mov';
export type VideoCodec = 'libx264' | 'libx265' | 'vp9';
export type AudioCodec = 'aac' | 'mp3' | 'opus';
export type Resolution = '1080p' | '720p' | '480p' | 'original';

export interface ConversionOptions {
  outputFormat: OutputFormat;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  resolution: Resolution;
  /** CRF value 18–51 (lower = better quality, larger file). Default 23. */
  crf: number;
}

// ─── Database Row ────────────────────────────────────────────────────────────

export interface JobRow {
  id: string;
  status: JobStatus;
  original_filename: string;
  options_json: string; // JSON-serialised ConversionOptions
  progress: number;     // 0–100
  output_path: string | null;
  output_size: number | null; // bytes
  error: string | null;
  created_at: string;  // ISO 8601
  expires_at: string;  // ISO 8601
}

// ─── API Response Shapes ─────────────────────────────────────────────────────

export interface UploadResponse {
  jobId: string;
  message: string;
}

export interface JobStatusResponse {
  id: string;
  status: JobStatus;
  progress: number;
  error: string | null;
  originalFilename: string;
  options: ConversionOptions;
  outputSize: number | null;
  createdAt: string;
  expiresAt: string;
}

export interface ApiError {
  error: string;
  details?: string;
}

// ─── BullMQ Job Payload ──────────────────────────────────────────────────────

export interface BullJobData {
  jobId: string;
  inputPath: string;
  options: ConversionOptions;
}

// ─── Whitelists (source of truth shared between server + worker) ──────────────

export const ALLOWED_FORMATS: readonly OutputFormat[] = ['mp4', 'webm', 'mov'];
export const ALLOWED_VIDEO_CODECS: readonly VideoCodec[] = ['libx264', 'libx265', 'vp9'];
export const ALLOWED_AUDIO_CODECS: readonly AudioCodec[] = ['aac', 'mp3', 'opus'];
export const ALLOWED_RESOLUTIONS: readonly Resolution[] = ['1080p', '720p', '480p', 'original'];

export const ALLOWED_MIME_TYPES: readonly string[] = [
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/x-msvideo',
  'video/webm',
  'video/mpeg',
  'video/3gpp',
  'video/x-flv',
];

export const DEFAULT_OPTIONS: ConversionOptions = {
  outputFormat: 'mp4',
  videoCodec: 'libx264',
  audioCodec: 'aac',
  resolution: 'original',
  crf: 23,
};

export const CRF_MIN = 18;
export const CRF_MAX = 51;

// Codec compatibility matrix: which video codecs work with which containers
export const CODEC_FORMAT_COMPAT: Record<VideoCodec, OutputFormat[]> = {
  libx264: ['mp4', 'mov'],
  libx265: ['mp4', 'mov'],
  vp9: ['webm'],
};
