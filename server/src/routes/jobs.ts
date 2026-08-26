import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { getJobById, toStatusResponse } from '../db/jobs';
import { getQueuePosition } from '../queue/producer';
import { createError } from '../middleware/errorHandler';

export const jobsRouter = Router();

// ─── GET /api/jobs/:id/status ─────────────────────────────────────────────────

jobsRouter.get(
  '/:id/status',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const job = getJobById(req.params.id);
      if (!job) {
        return next(createError('Job not found.', 404));
      }

      const response = toStatusResponse(job);

      // Include queue position for queued jobs
      if (job.status === 'queued') {
        const position = await getQueuePosition(job.id);
        res.json({ ...response, queuePosition: position });
      } else {
        res.json(response);
      }
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/jobs/:id/download ───────────────────────────────────────────────

jobsRouter.get(
  '/:id/download',
  (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const job = getJobById(req.params.id);

      if (!job) {
        return next(createError('Job not found.', 404));
      }
      if (job.status !== 'done') {
        return next(
          createError(
            `Job is not ready for download (status: ${job.status}).`,
            409,
          ),
        );
      }
      if (!job.output_path || !fs.existsSync(job.output_path)) {
        return next(createError('Output file not found — it may have expired.', 404));
      }

      const filename = `${path.basename(
        job.original_filename,
        path.extname(job.original_filename),
      )}_converted${path.extname(job.output_path)}`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'video/mp4'); // browser-friendly default
      res.setHeader('Cache-Control', 'no-store');

      const stream = fs.createReadStream(job.output_path);
      stream.on('error', (err) => next(err));
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  },
);
