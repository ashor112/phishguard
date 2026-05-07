export const SUSPICIOUS_KEYWORDS = [
  'login', 'secure', 'verify', 'update', 'account', 'banking',
  'confirm', 'authenticate', 'wallet', 'signin', 'support',
  'password', 'recover', 'activation', 'unlock', 'suspended',
  'unusual-activity', 'security-alert', 'validate', 'required',
  'billing', 'payment', 'invoice', 'credential', 'access',
];

const KEYWORD_REGEX = new RegExp(SUSPICIOUS_KEYWORDS.join('|'), 'i');

export default {
  run(parsed) {
    const subdomainMatches = [];
    const pathMatches = [];

    if (parsed.subdomains) {
      for (const kw of SUSPICIOUS_KEYWORDS) {
        if (parsed.subdomains.toLowerCase().includes(kw)) {
          subdomainMatches.push(kw);
        }
      }
    }

    const pathAndQuery = (parsed.pathname + parsed.search).toLowerCase();
    for (const kw of SUSPICIOUS_KEYWORDS) {
      if (pathAndQuery.includes(kw) && !subdomainMatches.includes(kw)) {
        pathMatches.push(kw);
      }
    }

    const hasSubdomainMatch = subdomainMatches.length > 0;
    const hasPathMatch = pathMatches.length > 0;
    const riskPoints = hasSubdomainMatch ? 20 : (hasPathMatch ? 10 : 0);
    const passed = riskPoints === 0;

    let details;
    if (passed) {
      details = 'No phishing-related keywords detected in URL';
    } else if (hasSubdomainMatch) {
      details = `Phishing keywords in subdomain: ${subdomainMatches.join(', ')}${hasPathMatch ? `; also in path: ${pathMatches.join(', ')}` : ''}`;
    } else {
      details = `Phishing keywords in path/query: ${pathMatches.join(', ')}`;
    }

    return {
      checkName: 'Phishing Keywords',
      passed,
      riskPoints,
      details,
      description: 'Detects words commonly used in phishing URLs to impersonate login pages, account verification flows, or banking portals.',
      subdomainMatches,
      pathMatches,
    };
  },
};
