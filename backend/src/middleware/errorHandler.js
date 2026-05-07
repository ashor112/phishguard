import { logError } from '../utils/activityLog.js';

export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  const code = err.code || 'INTERNAL_ERROR';

  logError({
    message,
    code,
    stack: err.stack,
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket?.remoteAddress || 'unknown',
  });

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${req.method} ${req.path}:`, message);
  }

  res.status(status).json({ error: message, code });
}
