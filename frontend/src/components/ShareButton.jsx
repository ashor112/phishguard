import { useState } from 'react';
import './ShareButton.css';

function buildShareText(result) {
  const failedChecks = result.breakdown
    .filter(c => c.passed === false)
    .map(c => `• ${c.checkName}: ${c.details}`)
    .join('\n');

  return `🛡️ URL Safety Check — ${result.verdict} (${result.score}/100)
URL: ${result.url}
${failedChecks ? `\nRisk Factors:\n${failedChecks}` : '\nNo risk factors detected.'}

Checked at: ${new Date(result.analyzedAt).toLocaleString()}
Powered by PhishGuard`;
}

export default function ShareButton({ result }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const text = buildShareText(result);

    if (navigator.share) {
      try {
        await navigator.share({ title: 'PhishGuard URL Safety Check', text });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  }

  return (
    <div className="share-btn-wrap">
      <button className="share-btn" onClick={handleShare}>
        {copied ? '✓ Copied!' : '📤 Share Result'}
      </button>
    </div>
  );
}
