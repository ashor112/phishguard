/**
 * Compute the Shannon entropy (bits) of a string.
 * Used to detect high-entropy (random-looking) domain names.
 *
 * Typical values:
 *   'google'    ≈ 2.25 bits
 *   'facebook'  ≈ 2.75 bits
 *   'xk3j9a2m'  ≈ 3.0  bits  (suspicious)
 *   'a8df3k2j9x'≈ 3.8  bits  (very suspicious)
 *
 * Threshold used in domainPatternCheck: > 3.8 bits
 */
export function shannonEntropy(str) {
  if (!str || str.length === 0) return 0;

  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  return Object.values(freq).reduce((acc, count) => {
    const p = count / str.length;
    return acc - p * Math.log2(p);
  }, 0);
}

export default { shannonEntropy };
