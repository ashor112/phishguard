import sslChecker from 'ssl-checker';

const TIMEOUT_MS = parseInt(process.env.SSL_TIMEOUT_MS) || 10000;

export default {
  async run(parsed) {
    if (parsed.protocol !== 'https:') {
      return {
        checkName: 'SSL Certificate',
        passed: false,
        riskPoints: 20,
        details: 'URL uses HTTP — no SSL/TLS certificate present',
        description: 'A valid SSL certificate encrypts data and proves server identity. Missing or invalid certificates are a serious security risk.',
        valid: false,
        daysRemaining: null,
        issuer: null,
      };
    }

    try {
      const result = await Promise.race([
        sslChecker(parsed.hostname),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SSL check timed out')), TIMEOUT_MS)
        ),
      ]);

      const valid = result.valid === true;

      return {
        checkName: 'SSL Certificate',
        passed: valid,
        riskPoints: valid ? 0 : 20,
        details: valid
          ? `Valid certificate — expires in ${result.daysRemaining} days${result.issuer ? ` (Issuer: ${result.issuer})` : ''}`
          : `Invalid or expired SSL certificate${result.daysRemaining != null ? ` (${result.daysRemaining} days remaining)` : ''}`,
        description: 'A valid SSL certificate encrypts data and proves server identity. Missing or invalid certificates are a serious security risk.',
        valid,
        daysRemaining: result.daysRemaining ?? null,
        issuer: result.issuer ?? null,
      };
    } catch (err) {
      return {
        checkName: 'SSL Certificate',
        passed: null,
        riskPoints: 0,
        details: `SSL check unavailable: ${err.message}`,
        description: 'A valid SSL certificate encrypts data and proves server identity. Missing or invalid certificates are a serious security risk.',
        error: true,
        valid: null,
        daysRemaining: null,
        issuer: null,
      };
    }
  },
};
