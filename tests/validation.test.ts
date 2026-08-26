import { describe, it, expect } from 'vitest';
import {
  ALLOWED_FORMATS,
  ALLOWED_VIDEO_CODECS,
  ALLOWED_AUDIO_CODECS,
  ALLOWED_RESOLUTIONS,
  ALLOWED_MIME_TYPES,
  CODEC_FORMAT_COMPAT,
  CRF_MIN,
  CRF_MAX,
  type ConversionOptions,
  type OutputFormat,
  type VideoCodec,
  type AudioCodec,
  type Resolution,
} from '../shared/src/index';

// ─── Whitelist Completeness ───────────────────────────────────────────────────

describe('Whitelists', () => {
  it('ALLOWED_FORMATS contains expected values', () => {
    expect(ALLOWED_FORMATS).toContain('mp4');
    expect(ALLOWED_FORMATS).toContain('webm');
    expect(ALLOWED_FORMATS).toContain('mov');
  });

  it('ALLOWED_VIDEO_CODECS contains expected values', () => {
    expect(ALLOWED_VIDEO_CODECS).toContain('libx264');
    expect(ALLOWED_VIDEO_CODECS).toContain('libx265');
    expect(ALLOWED_VIDEO_CODECS).toContain('vp9');
  });

  it('ALLOWED_AUDIO_CODECS contains expected values', () => {
    expect(ALLOWED_AUDIO_CODECS).toContain('aac');
    expect(ALLOWED_AUDIO_CODECS).toContain('mp3');
    expect(ALLOWED_AUDIO_CODECS).toContain('opus');
  });

  it('ALLOWED_RESOLUTIONS contains expected values', () => {
    expect(ALLOWED_RESOLUTIONS).toContain('1080p');
    expect(ALLOWED_RESOLUTIONS).toContain('720p');
    expect(ALLOWED_RESOLUTIONS).toContain('480p');
    expect(ALLOWED_RESOLUTIONS).toContain('original');
  });

  it('ALLOWED_MIME_TYPES covers common video types', () => {
    expect(ALLOWED_MIME_TYPES).toContain('video/mp4');
    expect(ALLOWED_MIME_TYPES).toContain('video/quicktime');
    expect(ALLOWED_MIME_TYPES).toContain('video/x-matroska');
    expect(ALLOWED_MIME_TYPES).toContain('video/webm');
    expect(ALLOWED_MIME_TYPES).toContain('video/x-msvideo');
  });

  it('does not allow audio-only MIME types', () => {
    expect(ALLOWED_MIME_TYPES).not.toContain('audio/mpeg');
    expect(ALLOWED_MIME_TYPES).not.toContain('audio/wav');
  });
});

// ─── CRF Range ────────────────────────────────────────────────────────────────

describe('CRF constants', () => {
  it('CRF_MIN is 18', () => expect(CRF_MIN).toBe(18));
  it('CRF_MAX is 51', () => expect(CRF_MAX).toBe(51));
  it('CRF_MIN < CRF_MAX', () => expect(CRF_MIN).toBeLessThan(CRF_MAX));
});

// ─── Codec/Format Compatibility ───────────────────────────────────────────────

describe('CODEC_FORMAT_COMPAT', () => {
  it('vp9 only supports webm', () => {
    expect(CODEC_FORMAT_COMPAT.vp9).toEqual(['webm']);
    expect(CODEC_FORMAT_COMPAT.vp9).not.toContain('mp4');
    expect(CODEC_FORMAT_COMPAT.vp9).not.toContain('mov');
  });

  it('libx264 supports mp4 and mov', () => {
    expect(CODEC_FORMAT_COMPAT.libx264).toContain('mp4');
    expect(CODEC_FORMAT_COMPAT.libx264).toContain('mov');
  });

  it('libx265 supports mp4 and mov', () => {
    expect(CODEC_FORMAT_COMPAT.libx265).toContain('mp4');
    expect(CODEC_FORMAT_COMPAT.libx265).toContain('mov');
  });

  it('all video codecs have at least one compatible format', () => {
    for (const codec of ALLOWED_VIDEO_CODECS) {
      expect(CODEC_FORMAT_COMPAT[codec].length).toBeGreaterThan(0);
    }
  });

  it('all compatible formats are in ALLOWED_FORMATS', () => {
    for (const codec of ALLOWED_VIDEO_CODECS) {
      for (const fmt of CODEC_FORMAT_COMPAT[codec]) {
        expect(ALLOWED_FORMATS).toContain(fmt);
      }
    }
  });
});

// ─── Option validation logic (mirrors server-side logic) ─────────────────────

function isValidOptions(opts: Record<string, unknown>): { valid: boolean; error?: string } {
  if (!ALLOWED_FORMATS.includes(opts.outputFormat as OutputFormat)) {
    return { valid: false, error: `Invalid outputFormat: ${opts.outputFormat}` };
  }
  if (!ALLOWED_VIDEO_CODECS.includes(opts.videoCodec as VideoCodec)) {
    return { valid: false, error: `Invalid videoCodec: ${opts.videoCodec}` };
  }
  if (!ALLOWED_AUDIO_CODECS.includes(opts.audioCodec as AudioCodec)) {
    return { valid: false, error: `Invalid audioCodec: ${opts.audioCodec}` };
  }
  if (!ALLOWED_RESOLUTIONS.includes(opts.resolution as Resolution)) {
    return { valid: false, error: `Invalid resolution: ${opts.resolution}` };
  }
  const crf = opts.crf as number;
  if (typeof crf !== 'number' || !Number.isInteger(crf) || crf < CRF_MIN || crf > CRF_MAX) {
    return { valid: false, error: `Invalid CRF: ${crf}` };
  }
  return { valid: true };
}

describe('Option validation', () => {
  const base: Record<string, unknown> = {
    outputFormat: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    resolution: 'original',
    crf: 23,
  };

  it('accepts valid options', () => {
    expect(isValidOptions(base).valid).toBe(true);
  });

  it('rejects unknown outputFormat', () => {
    expect(isValidOptions({ ...base, outputFormat: 'avi' }).valid).toBe(false);
  });

  it('rejects unknown videoCodec', () => {
    expect(isValidOptions({ ...base, videoCodec: 'h264_nvenc' }).valid).toBe(false);
  });

  it('rejects unknown audioCodec', () => {
    expect(isValidOptions({ ...base, audioCodec: 'flac' }).valid).toBe(false);
  });

  it('rejects unknown resolution', () => {
    expect(isValidOptions({ ...base, resolution: '4K' }).valid).toBe(false);
  });

  it('rejects CRF below minimum', () => {
    expect(isValidOptions({ ...base, crf: 10 }).valid).toBe(false);
  });

  it('rejects CRF above maximum', () => {
    expect(isValidOptions({ ...base, crf: 60 }).valid).toBe(false);
  });

  it('rejects non-integer CRF', () => {
    expect(isValidOptions({ ...base, crf: 23.7 }).valid).toBe(false);
  });
});
