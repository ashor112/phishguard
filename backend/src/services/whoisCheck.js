import whoiser from 'whoiser';

const NEW_DOMAIN_DAYS = 30;
const TIMEOUT_MS = parseInt(process.env.WHOIS_TIMEOUT_MS) || 8000;

// Common WHOIS field names across different registrars
const CREATION_FIELDS = [
  'Created Date', 'Creation Date', 'creation date', 'registered',
  'Domain Registration Date', 'Registration Time', 'created',
];

function extractCreationDate(whoisData) {
  // whoiser returns an object keyed by WHOIS server
  for (const serverData of Object.values(whoisData)) {
    if (typeof serverData !== 'object') continue;
    for (const field of CREATION_FIELDS) {
      const val = serverData[field];
      if (val) {
        const date = new Date(Array.isArray(val) ? val[0] : val);
        if (!isNaN(date.getTime())) return date;
      }
    }
  }
  return null;
}

function extractRegistrar(whoisData) {
  for (const serverData of Object.values(whoisData)) {
    if (typeof serverData !== 'object') continue;
    const val = serverData['Registrar'] || serverData['registrar'];
    if (val) return Array.isArray(val) ? val[0] : val;
  }
  return null;
}

export default {
  async run(parsed) {
    if (parsed.isIP) {
      return {
        checkName: 'Domain Age (WHOIS)',
        passed: null,
        riskPoints: 0,
        details: 'Cannot perform WHOIS lookup on IP addresses',
        description: 'New domains (< 30 days old) are a strong indicator of phishing infrastructure.',
        ageDays: null,
      };
    }

    try {
      const whoisData = await Promise.race([
        whoiser(parsed.registeredDomain, { timeout: TIMEOUT_MS - 1000 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('WHOIS timeout')), TIMEOUT_MS)
        ),
      ]);

      const creationDate = extractCreationDate(whoisData);

      if (!creationDate) {
        return {
          checkName: 'Domain Age (WHOIS)',
          passed: null,
          riskPoints: 0,
          details: 'No creation date found in WHOIS record',
          description: 'New domains (< 30 days old) are a strong indicator of phishing infrastructure.',
          ageDays: null,
        };
      }

      const ageDays = Math.floor((Date.now() - creationDate.getTime()) / 86_400_000);
      const isNew = ageDays < NEW_DOMAIN_DAYS;

      return {
        checkName: 'Domain Age (WHOIS)',
        passed: !isNew,
        riskPoints: isNew ? 30 : 0,
        details: isNew
          ? `Domain registered only ${ageDays} day${ageDays === 1 ? '' : 's'} ago — newly registered domains are high risk`
          : `Domain registered ${ageDays} days ago (${Math.floor(ageDays / 365)} year${Math.floor(ageDays / 365) === 1 ? '' : 's'} old)`,
        description: 'New domains (< 30 days old) are a strong indicator of phishing infrastructure.',
        ageDays,
        creationDate: creationDate.toISOString(),
        registrar: extractRegistrar(whoisData),
        isNew,
      };
    } catch (err) {
      return {
        checkName: 'Domain Age (WHOIS)',
        passed: null,
        riskPoints: 0,
        details: `WHOIS check unavailable: ${err.message}`,
        description: 'New domains (< 30 days old) are a strong indicator of phishing infrastructure.',
        error: true,
        ageDays: null,
      };
    }
  },
};
