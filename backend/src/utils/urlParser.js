// Known second-level domains under country TLDs (e.g., co.uk, com.au)
const COMPOUND_SLDS = new Set([
  'co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'ne', 'or',
]);

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

export function addSchemeIfMissing(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function computeRegisteredDomain(hostname) {
  if (IP_REGEX.test(hostname)) return hostname;
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;

  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];

  // Handle compound TLDs like .co.uk, .com.au
  if (parts.length >= 3 && COMPOUND_SLDS.has(sld) && tld.length === 2) {
    return parts.slice(-3).join('.');
  }

  return parts.slice(-2).join('.');
}

/**
 * Parse a raw URL string into a normalized object consumed by all service modules.
 * Automatically prepends https:// if no scheme is present.
 *
 * @param {string} rawUrl
 * @returns {{ href, protocol, hostname, registeredDomain, tld, subdomains, subdomainCount, pathname, search, isIP }}
 */
export function parse(rawUrl) {
  const withScheme = addSchemeIfMissing(rawUrl);
  const u = new URL(withScheme); // throws on malformed URL

  const hostname = u.hostname.toLowerCase();
  const isIP = IP_REGEX.test(hostname);
  const parts = hostname.split('.');
  const tld = isIP ? '' : parts[parts.length - 1];
  const registeredDomain = computeRegisteredDomain(hostname);

  const rdParts = registeredDomain.split('.');
  const subdomainParts = parts.slice(0, parts.length - rdParts.length);
  const subdomains = subdomainParts.join('.');
  const subdomainCount = subdomainParts.filter(Boolean).length;

  return {
    href: u.href,
    protocol: u.protocol,           // 'https:' or 'http:'
    hostname,                        // full host
    registeredDomain,                // e.g. 'example.com' or 'example.co.uk'
    tld,                             // e.g. 'com'
    subdomains,                      // e.g. 'login.secure' (empty string if none)
    subdomainCount,                  // number of subdomain levels
    pathname: u.pathname,
    search: u.search,
    hash: u.hash,
    isIP,
  };
}

export default { parse, addSchemeIfMissing };
