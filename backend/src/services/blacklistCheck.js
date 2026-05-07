// Static mock blacklist — structured for easy replacement with Google Safe Browsing API
// Each entry: registeredDomain → { reason, category }
export const BLACKLIST = new Map([
  ['malware-site.com',          { reason: 'Known malware distributor', category: 'malware' }],
  ['phishing-example.net',      { reason: 'Confirmed phishing page', category: 'phishing' }],
  ['suspicious-login.xyz',      { reason: 'Credential harvesting site', category: 'phishing' }],
  ['fake-paypal-secure.com',    { reason: 'PayPal impersonation', category: 'phishing' }],
  ['free-crypto-now.tk',        { reason: 'Cryptocurrency scam', category: 'scam' }],
  ['win-iphone-2024.ml',        { reason: 'Prize scam', category: 'scam' }],
  ['login-apple-id-verify.com', { reason: 'Apple ID phishing', category: 'phishing' }],
  ['secure-bankofamerica.net',  { reason: 'Bank of America impersonation', category: 'phishing' }],
  ['amazon-order-confirm.tk',   { reason: 'Amazon phishing', category: 'phishing' }],
  ['netflix-update-billing.xyz',{ reason: 'Netflix credential theft', category: 'phishing' }],
  ['microsoft-support-alert.ml',{ reason: 'Microsoft tech support scam', category: 'scam' }],
  ['irs-tax-refund.cf',         { reason: 'IRS tax refund scam', category: 'scam' }],
  ['coinbase-verification.ga',  { reason: 'Crypto exchange phishing', category: 'phishing' }],
  ['dhl-package-tracking.xyz',  { reason: 'Delivery phishing', category: 'phishing' }],
  ['fedex-delivery-alert.tk',   { reason: 'Delivery phishing', category: 'phishing' }],
]);

export default {
  run(parsed) {
    const entry = BLACKLIST.get(parsed.registeredDomain);

    if (entry) {
      return {
        checkName: 'Blacklist',
        passed: false,
        riskPoints: 50,
        details: `Domain "${parsed.registeredDomain}" is blacklisted — ${entry.reason} (category: ${entry.category})`,
        description: 'Checks the domain against a threat blacklist. Structure is API-ready for Google Safe Browsing integration.',
        category: entry.category,
        reason: entry.reason,
      };
    }

    return {
      checkName: 'Blacklist',
      passed: true,
      riskPoints: 0,
      details: 'Domain not found in threat blacklist',
      description: 'Checks the domain against a threat blacklist. Structure is API-ready for Google Safe Browsing integration.',
    };
  },
};
