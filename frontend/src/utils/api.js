const BASE = import.meta.env.VITE_API_URL || '/api';

export async function analyzeUrl(url) {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.error || `Server error (${res.status})`);
  }

  return body;
}
