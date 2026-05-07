export function truncateUrl(url, maxLen = 45) {
  if (!url) return '';
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + '…';
}

export function relativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function verdictColor(verdict) {
  switch (verdict) {
    case 'SAFE':       return 'var(--safe)';
    case 'SUSPICIOUS': return 'var(--warn)';
    case 'DANGEROUS':  return 'var(--danger)';
    default:           return 'var(--text-muted)';
  }
}

export function verdictBg(verdict) {
  switch (verdict) {
    case 'SAFE':       return 'var(--safe-bg)';
    case 'SUSPICIOUS': return 'var(--warn-bg)';
    case 'DANGEROUS':  return 'var(--danger-bg)';
    default:           return 'var(--bg-card)';
  }
}

export function scoreColor(score) {
  if (score < 30) return 'var(--safe)';
  if (score < 60) return 'var(--warn)';
  return 'var(--danger)';
}

export function verdictLabel(verdict) {
  switch (verdict) {
    case 'SAFE':       return '✅ Safe';
    case 'SUSPICIOUS': return '⚠️ Suspicious';
    case 'DANGEROUS':  return '🚨 Dangerous';
    default:           return verdict;
  }
}
