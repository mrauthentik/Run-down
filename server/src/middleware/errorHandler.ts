import type { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  details?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Multer errors
  if (err.name === 'MulterError') {
    if (err.message.includes('File too large')) {
      res.status(413).json({
        error: `File exceeds the maximum allowed size of ${process.env.MAX_FILE_SIZE_MB ?? 2048} MB.`,
      });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }

  const status = err.statusCode ?? 500;
  const message = err.message ?? 'Internal server error';

  if (status >= 500) {
    console.error('[server] Unhandled error:', err);
  }

  res.status(status).json({
    error: message,
    ...(err.details ? { details: err.details } : {}),
  });
}

/** Convenience factory — attaches statusCode before throwing */
export function createError(message: string, statusCode = 500, details?: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.details = details;
  return err;
}
