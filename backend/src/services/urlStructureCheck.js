const LONG_URL_THRESHOLD = 75;
const ENCODED_CHAR_THRESHOLD = 3;
const ENCODED_CHAR_REGEX = /%[0-9A-Fa-f]{2}/g;
const SENSITIVE_PARAMS = /password|token|auth|login|verify|confirm|credential/i;

export default {
  run(parsed) {
    const findings = [];
    let riskPoints = 0;
    const fullUrl = parsed.href;

    // Very long URLs often used to hide malicious destination
    if (fullUrl.length > LONG_URL_THRESHOLD) {
      findings.push(`URL is ${fullUrl.length} characters long (threshold: ${LONG_URL_THRESHOLD})`);
      riskPoints += 10;
    }

    // Excessive percent-encoded characters — obfuscation technique
    const encodedMatches = (fullUrl.match(ENCODED_CHAR_REGEX) || []).length;
    if (encodedMatches > ENCODED_CHAR_THRESHOLD) {
      findings.push(`${encodedMatches} percent-encoded characters detected — possible obfuscation`);
      riskPoints += 15;
    }

    // At-sign in URL — can be used to fake the visible host (http://legitimate.com@evil.com/)
    if (fullUrl.includes('@') && fullUrl.indexOf('@') < fullUrl.indexOf('/', fullUrl.indexOf('//') + 2)) {
      findings.push('At-sign (@) found in URL authority — real destination may differ from visible domain');
      riskPoints += 20;
    }

    // Sensitive parameter names in query string (informational, flagged but no score)
    if (parsed.search && SENSITIVE_PARAMS.test(parsed.search)) {
      findings.push('Query string contains sensitive parameter names (password, token, auth, etc.)');
      // No score contribution — common in legitimate OAuth/auth flows too
    }

    const passed = riskPoints === 0;
    return {
      checkName: 'URL Structure',
      passed,
      riskPoints,
      details: passed
        ? 'No structural anomalies detected'
        : findings.join('; '),
      description: 'Analyzes URL length, encoding, and structural tricks used to obscure phishing destinations.',
      findings,
      urlLength: fullUrl.length,
      encodedCharCount: encodedMatches,
    };
  },
};
