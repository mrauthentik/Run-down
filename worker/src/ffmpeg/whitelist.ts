import {
  ALLOWED_FORMATS,
  ALLOWED_VIDEO_CODECS,
  ALLOWED_AUDIO_CODECS,
  ALLOWED_RESOLUTIONS,
  type OutputFormat,
  type VideoCodec,
  type AudioCodec,
  type Resolution,
} from '@run-down/shared';

// Re-export for convenience
export {
  ALLOWED_FORMATS,
  ALLOWED_VIDEO_CODECS,
  ALLOWED_AUDIO_CODECS,
  ALLOWED_RESOLUTIONS,
};

// ─── Maps from our whitelist values to ffmpeg flag values ────────────────────

export const FORMAT_TO_EXTENSION: Record<OutputFormat, string> = {
  mp4: 'mp4',
  webm: 'webm',
  mov: 'mov',
};

export const FORMAT_TO_MUXER: Record<OutputFormat, string> = {
  mp4: 'mp4',
  webm: 'webm',
  mov: 'mov',
};

// These are already valid ffmpeg codec names but we keep the map explicit
export const VIDEO_CODEC_MAP: Record<VideoCodec, string> = {
  libx264: 'libx264',
  libx265: 'libx265',
  vp9: 'libvpx-vp9',
};

export const AUDIO_CODEC_MAP: Record<AudioCodec, string> = {
  aac: 'aac',
  mp3: 'libmp3lame',
  opus: 'libopus',
};

// Scale filter values — using -2 keeps the output dimension divisible by 2
export const RESOLUTION_SCALE: Record<Resolution, string | null> = {
  '1080p': 'scale=-2:1080',
  '720p': 'scale=-2:720',
  '480p': 'scale=-2:480',
  original: null, // no scale filter
};

// Validation sets for quick O(1) lookups
export const VALID_FORMATS = new Set<string>(ALLOWED_FORMATS);
export const VALID_VIDEO_CODECS = new Set<string>(ALLOWED_VIDEO_CODECS);
export const VALID_AUDIO_CODECS = new Set<string>(ALLOWED_AUDIO_CODECS);
export const VALID_RESOLUTIONS = new Set<string>(ALLOWED_RESOLUTIONS);
