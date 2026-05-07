export default {
  run(parsed) {
    const isHttp = parsed.protocol === 'http:';
    return {
      checkName: 'HTTPS Scheme',
      passed: !isHttp,
      riskPoints: isHttp ? 20 : 0,
      details: isHttp
        ? 'URL uses insecure HTTP — traffic is unencrypted and unauthenticated'
        : 'URL uses secure HTTPS',
      description: 'HTTPS encrypts traffic and authenticates the server. HTTP-only sites are a common red flag for phishing pages.',
    };
  },
};
