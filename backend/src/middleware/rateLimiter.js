import rateLimit from 'express-rate-limit';

export const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 30,
  message: { error: 'Too many requests. Please wait before checking another URL.', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});
