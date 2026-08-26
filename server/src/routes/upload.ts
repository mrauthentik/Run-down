import { Router, Request, Response, NextFunction } from 'express';
import { upload, validateMimeType } from '../middleware/upload';
import { uploadRateLimit } from '../middleware/rateLimit';
import { createJob } from '../db/jobs';
import { enqueueJob } from '../queue/producer';
import { deleteFile } from '../storage';
import { createError } from '../middleware/errorHandler';
import {
  ALLOWED_FORMATS,
  ALLOWED_VIDEO_CODECS,
  ALLOWED_AUDIO_CODECS,
  ALLOWED_RESOLUTIONS,
  CODEC_FORMAT_COMPAT,
  DEFAULT_OPTIONS,
  CRF_MIN,
  CRF_MAX,
  type ConversionOptions,
  type OutputFormat,
  type VideoCodec,
  type AudioCodec,
  type Resolution,
} from '@run-down/shared';

export const uploadRouter = Router();

// ─── Validation helpers ───────────────────────────────────────────────────────

function parseAndValidateOptions(body: Record<string, unknown>): ConversionOptions {
  const outputFormat = (body.outputFormat ?? DEFAULT_OPTIONS.outputFormat) as OutputFormat;
  const videoCodec = (body.videoCodec ?? DEFAULT_OPTIONS.videoCodec) as VideoCodec;
  const audioCodec = (body.audioCodec ?? DEFAULT_OPTIONS.audioCodec) as AudioCodec;
  const resolution = (body.resolution ?? DEFAULT_OPTIONS.resolution) as Resolution;
  const crf = parseInt(String(body.crf ?? DEFAULT_OPTIONS.crf), 10);

  if (!ALLOWED_FORMATS.includes(outputFormat)) {
    throw createError(`Invalid outputFormat '${outputFormat}'. Allowed: ${ALLOWED_FORMATS.join(', ')}`, 400);
  }
  if (!ALLOWED_VIDEO_CODECS.includes(videoCodec)) {
    throw createError(`Invalid videoCodec '${videoCodec}'. Allowed: ${ALLOWED_VIDEO_CODECS.join(', ')}`, 400);
  }
  if (!ALLOWED_AUDIO_CODECS.includes(audioCodec)) {
    throw createError(`Invalid audioCodec '${audioCodec}'. Allowed: ${ALLOWED_AUDIO_CODECS.join(', ')}`, 400);
  }
  if (!ALLOWED_RESOLUTIONS.includes(resolution)) {
    throw createError(`Invalid resolution '${resolution}'. Allowed: ${ALLOWED_RESOLUTIONS.join(', ')}`, 400);
  }
  if (isNaN(crf) || crf < CRF_MIN || crf > CRF_MAX) {
    throw createError(`CRF must be between ${CRF_MIN} and ${CRF_MAX}.`, 400);
  }

  // Check codec/format compatibility
  const compatibleFormats = CODEC_FORMAT_COMPAT[videoCodec];
  if (!compatibleFormats.includes(outputFormat)) {
    throw createError(
      `Video codec '${videoCodec}' is not compatible with format '${outputFormat}'. ` +
        `Use one of: ${compatibleFormats.join(', ')}.`,
      400,
    );
  }

  return { outputFormat, videoCodec, audioCodec, resolution, crf };
}

// ─── POST /api/upload ─────────────────────────────────────────────────────────

uploadRouter.post(
  '/',
  uploadRateLimit,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;

    if (!file) {
      return next(createError('No file uploaded. Include a file field named "file".', 400));
    }

    try {
      // Phase 1: Content-based MIME validation (reads magic bytes)
      await validateMimeType(file.path);

      // Phase 2: Validate conversion options (all values whitelisted)
      const options = parseAndValidateOptions(req.body as Record<string, unknown>);

      // Phase 3: Create job record in DB and enqueue
      const job = createJob(file.originalname, options);
      await enqueueJob({
        jobId: job.id,
        inputPath: file.path,
        options,
      });

      res.status(202).json({
        jobId: job.id,
        message: 'Upload accepted. Conversion queued.',
      });
    } catch (err) {
      // Clean up the saved file on any validation error
      deleteFile(file.path);
      next(err);
    }
  },
);
