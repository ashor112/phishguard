const VERDICT_THRESHOLDS = {
  SAFE: 30,
  SUSPICIOUS: 60,
};

function getVerdict(score) {
  if (score < VERDICT_THRESHOLDS.SAFE) return 'SAFE';
  if (score < VERDICT_THRESHOLDS.SUSPICIOUS) return 'SUSPICIOUS';
  return 'DANGEROUS';
}

/**
 * Aggregate all check results into a 0–100 risk score with verdict.
 *
 * @param {Object} checks - keyed by check name (scheme, domain, whois, etc.)
 * @returns {{ score: number, verdict: string, breakdown: Array }}
 */
export function calculateScore(checks) {
  let rawPoints = 0;

  // Collect points from every check — if passed: null (unavailable), riskPoints is already 0
  for (const check of Object.values(checks)) {
    if (check && typeof check.riskPoints === 'number') {
      rawPoints += check.riskPoints;
    }
  }

  const score = Math.min(Math.max(rawPoints, 0), 100);
  const verdict = getVerdict(score);

  // Build breakdown sorted by highest risk first
  const breakdown = Object.values(checks)
    .filter(Boolean)
    .map(({ checkName, passed, riskPoints, details }) => ({
      checkName,
      passed,
      riskPoints,
      details,
    }))
    .sort((a, b) => b.riskPoints - a.riskPoints);

  return { score, verdict, breakdown };
}

export default { calculateScore };
