// TLDs historically associated with free/abused registrations and phishing campaigns
export const SUSPICIOUS_TLDS = new Set([
  'xyz', 'tk', 'ml', 'ga', 'cf', 'gq', 'top', 'club',
  'work', 'date', 'faith', 'review', 'stream', 'download',
  'bid', 'win', 'loan', 'men', 'cricket', 'accountant',
  'science', 'party', 'trade', 'racing', 'webcam',
  'click', 'link', 'zip', 'mov',
]);

export default {
  run(parsed) {
    if (!parsed.tld || parsed.isIP) {
      return {
        checkName: 'Suspicious TLD',
        passed: true,
        riskPoints: 0,
        details: 'No TLD to evaluate (IP address)',
        description: 'Some top-level domains are disproportionately used in phishing and scam campaigns due to free or low-cost registration.',
      };
    }

    const isSuspicious = SUSPICIOUS_TLDS.has(parsed.tld.toLowerCase());

    return {
      checkName: 'Suspicious TLD',
      passed: !isSuspicious,
      riskPoints: isSuspicious ? 15 : 0,
      details: isSuspicious
        ? `.${parsed.tld} is a TLD commonly associated with phishing and scam campaigns`
        : `.${parsed.tld} is not a commonly-abused TLD`,
      description: 'Some top-level domains are disproportionately used in phishing and scam campaigns due to free or low-cost registration.',
      tld: parsed.tld,
    };
  },
};
