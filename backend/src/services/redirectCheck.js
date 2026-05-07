import axios from 'axios';

const TIMEOUT_MS = parseInt(process.env.REDIRECT_TIMEOUT_MS) || 8000;
const MAX_HOPS = 10;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// Extract the registered domain (last two parts) for cross-domain comparison.
// This prevents www.example.com → example.com from being flagged as cross-domain.
function registeredDomain(hostname) {
  const parts = hostname.split('.');
  return parts.length <= 2 ? hostname : parts.slice(-2).join('.');
}

export default {
  async run(parsed) {
    const chain = [];
    let current = parsed.href;
    const originalHost = parsed.hostname;
    const originalRD = registeredDomain(originalHost);
    let finalHost = originalHost;

    try {
      for (let hop = 0; hop < MAX_HOPS; hop++) {
        const resp = await axios.get(current, {
          maxRedirects: 0,
          validateStatus: () => true,
          timeout: TIMEOUT_MS,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SafetyChecker/1.0)' },
        });

        if (REDIRECT_STATUSES.has(resp.status) && resp.headers.location) {
          const next = new URL(resp.headers.location, current).href;
          chain.push({ from: current, to: next, statusCode: resp.status });
          current = next;
          finalHost = new URL(current).hostname;
        } else {
          break;
        }
      }

      // Compare registered domains so www.x.com → x.com is not flagged
      const isCrossDomain = chain.length > 0 && registeredDomain(finalHost) !== originalRD;

      return {
        checkName: 'Redirect Chain',
        passed: !isCrossDomain,
        riskPoints: isCrossDomain ? 15 : 0,
        details: chain.length === 0
          ? 'No redirects detected'
          : `${chain.length} redirect(s)${isCrossDomain ? ` — cross-domain redirect to "${finalHost}"` : ' (same domain)'}`,
        description: 'Cross-domain redirects are used by phishing pages to send victims from a convincing URL to a credential-harvesting site.',
        chain,
        hopCount: chain.length,
        finalUrl: current,
        finalHost,
        isCrossDomain,
      };
    } catch (err) {
      return {
        checkName: 'Redirect Chain',
        passed: null,
        riskPoints: 0,
        details: `Redirect check unavailable: ${err.message}`,
        description: 'Cross-domain redirects are used by phishing pages to send victims from a convincing URL to a credential-harvesting site.',
        error: true,
        chain: [],
        hopCount: 0,
      };
    }
  },
};
