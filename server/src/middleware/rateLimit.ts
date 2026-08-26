import rateLimit from 'express-rate-limit';

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10); // 15 min
const MAX = parseInt(process.env.RATE_LIMIT_MAX ?? '10', 10);

export const uploadRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many uploads from this IP — please try again later.',
  },
  keyGenerator: (req) => req.ip ?? 'unknown',
});
