/**
 * Builds the ffmpeg argument array from validated ConversionOptions.
 *
 * SECURITY: This function NEVER uses string interpolation or template literals
 * to construct command arguments. Every value passed to ffmpeg is sourced from
 * hardcoded lookup tables keyed by our whitelisted enum values.
 * The resulting string[] is passed to child_process.execFile (not exec/shell),
 * so no shell interpretation occurs.
 */

import type { ConversionOptions } from '@run-down/shared';
import { CRF_MIN, CRF_MAX } from '@run-down/shared';
import {
  VALID_FORMATS,
  VALID_VIDEO_CODECS,
  VALID_AUDIO_CODECS,
  VALID_RESOLUTIONS,
  FORMAT_TO_MUXER,
  FORMAT_TO_EXTENSION,
  VIDEO_CODEC_MAP,
  AUDIO_CODEC_MAP,
  RESOLUTION_SCALE,
} from './whitelist';

export interface FfmpegArgs {
  args: string[];
  outputExtension: string;
}

/**
 * Validates all option fields against the whitelist and returns the ffmpeg
 * argument array. Throws if any value is outside the whitelist.
 */
export function buildFfmpegArgs(
  inputPath: string,
  outputPath: string,
  options: ConversionOptions,
): FfmpegArgs {
  // ── Re-validate every field (defence in depth; server already validated) ──
  if (!VALID_FORMATS.has(options.outputFormat)) {
    throw new Error(`Rejected: outputFormat '${options.outputFormat}' not in whitelist.`);
  }
  if (!VALID_VIDEO_CODECS.has(options.videoCodec)) {
    throw new Error(`Rejected: videoCodec '${options.videoCodec}' not in whitelist.`);
  }
  if (!VALID_AUDIO_CODECS.has(options.audioCodec)) {
    throw new Error(`Rejected: audioCodec '${options.audioCodec}' not in whitelist.`);
  }
  if (!VALID_RESOLUTIONS.has(options.resolution)) {
    throw new Error(`Rejected: resolution '${options.resolution}' not in whitelist.`);
  }
  if (
    typeof options.crf !== 'number' ||
    !Number.isInteger(options.crf) ||
    options.crf < CRF_MIN ||
    options.crf > CRF_MAX
  ) {
    throw new Error(`Rejected: crf '${options.crf}' out of range [${CRF_MIN}, ${CRF_MAX}].`);
  }

  // ── Look up values from hardcoded maps (never from user input directly) ──
  const vcodec = VIDEO_CODEC_MAP[options.videoCodec];
  const acodec = AUDIO_CODEC_MAP[options.audioCodec];
  const muxer = FORMAT_TO_MUXER[options.outputFormat];
  const ext = FORMAT_TO_EXTENSION[options.outputFormat];
  const scaleFilter = RESOLUTION_SCALE[options.resolution];
  const crf = options.crf.toString(); // safe: already validated as integer in range

  // ── Build argument array (no shell, no interpolation) ─────────────────────
  const args: string[] = [
    '-i', inputPath,
    '-c:v', vcodec,
    '-crf', crf,
    '-c:a', acodec,
  ];

  // Add scale filter only if a resolution downscale was requested
  if (scaleFilter !== null) {
    args.push('-vf', scaleFilter);
  }

  // libx264/libx265 specific preset for speed/quality trade-off
  if (options.videoCodec === 'libx264' || options.videoCodec === 'libx265') {
    args.push('-preset', 'medium');
  }

  // Force keyframe interval for better seeking
  args.push('-g', '48');

  // Output muxer and file
  args.push('-f', muxer);
  args.push('-y'); // overwrite output if exists
  args.push(outputPath);

  return { args, outputExtension: ext };
}
