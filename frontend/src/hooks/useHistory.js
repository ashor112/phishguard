import { useState } from 'react';

const STORAGE_KEY = 'urlHistory';
const MAX_ENTRIES = 10;

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function useHistory() {
  const [history, setHistory] = useState(loadHistory);

  function addEntry(url, score, verdict) {
    setHistory(prev => {
      // Deduplicate by URL, newest first, max 10
      const filtered = prev.filter(e => e.url !== url);
      const next = [
        { url, score, verdict, analyzedAt: new Date().toISOString() },
        ...filtered,
      ].slice(0, MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }

  return { history, addEntry, clearHistory };
}
