import { shannonEntropy } from '../utils/entropy.js';

const ENTROPY_THRESHOLD = 3.8;
const MAX_SUBDOMAIN_LEVELS = 3;

export default {
  run(parsed) {
    const findings = [];
    let riskPoints = 0;

    // IP address used as host (e.g., http://192.168.1.1/phish)
    if (parsed.isIP) {
      findings.push('IP address used as host instead of a domain name');
      riskPoints += 25;
    }

    // Excessive subdomain nesting (> 3 levels deep)
    if (!parsed.isIP && parsed.subdomainCount > MAX_SUBDOMAIN_LEVELS) {
      findings.push(`Excessive subdomain depth: ${parsed.subdomainCount} levels (e.g., login.secure.verify.example.com)`);
      riskPoints += 10;
    }

    // High-entropy registered domain — suggests randomly generated domain
    if (!parsed.isIP && parsed.registeredDomain) {
      const domainWithoutTld = parsed.registeredDomain.split('.')[0];
      const entropy = shannonEntropy(domainWithoutTld);
      if (entropy > ENTROPY_THRESHOLD) {
        findings.push(`Domain name appears randomly generated (entropy: ${entropy.toFixed(2)} bits > ${ENTROPY_THRESHOLD})`);
        riskPoints += 15;
      }
    }

    const passed = findings.length === 0;
    return {
      checkName: 'Domain Pattern',
      passed,
      riskPoints,
      details: passed
        ? 'No suspicious domain patterns detected'
        : findings.join('; '),
      description: 'Checks for IP-as-host, excessive subdomain nesting, and randomly-generated domain names — all common in phishing infrastructure.',
      findings,
    };
  },
};
