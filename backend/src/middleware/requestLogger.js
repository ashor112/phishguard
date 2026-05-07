import { logRequest } from '../utils/activityLog.js';

export function requestLogger(req, res, next) {
  const start = Date.now();
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';

  res.on('finish', () => {
    logRequest({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      ip,
    });
  });

  next();
}
