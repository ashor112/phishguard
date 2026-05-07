import { addSchemeIfMissing } from '../utils/urlParser.js';

const MAX_URL_LENGTH = 2048;

export function validateRequest(req, res, next) {
  const { url } = req.body || {};

  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return res.status(400).json({ error: 'URL is required', code: 'MISSING_URL' });
  }

  if (url.length > MAX_URL_LENGTH) {
    return res.status(400).json({ error: `URL exceeds maximum length of ${MAX_URL_LENGTH} characters`, code: 'URL_TOO_LONG' });
  }

  // Validate that the URL parses correctly and has a proper hostname
  try {
    const parsed = new URL(addSchemeIfMissing(url.trim()));
    // Hostname must consist only of valid characters (letters, digits, hyphens, dots)
    // or be a valid IPv4 address
    const validHostname = /^([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(parsed.hostname)
      || /^(\d{1,3}\.){3}\d{1,3}$/.test(parsed.hostname);
    if (!validHostname) throw new Error('invalid hostname');
  } catch {
    return res.status(400).json({ error: 'Invalid URL format', code: 'INVALID_URL' });
  }

  next();
}
