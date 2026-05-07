import { useState } from 'react';
import { useDarkMode } from './hooks/useDarkMode.js';
import { useHistory } from './hooks/useHistory.js';
import { useAnalyze } from './hooks/useAnalyze.js';

import UrlInput from './components/UrlInput.jsx';
import VerdictBanner from './components/VerdictBanner.jsx';
import RiskGauge from './components/RiskGauge.jsx';
import CheckGrid from './components/CheckGrid.jsx';
import HistorySidebar from './components/HistorySidebar.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import DarkModeToggle from './components/DarkModeToggle.jsx';
import ShareButton from './components/ShareButton.jsx';

export default function App() {
  const [isDark, setIsDark] = useDarkMode();
  const { history, addEntry, clearHistory } = useHistory();
  const [url, setUrl] = useState('');

  const { analyze, isLoading, result, error } = useAnalyze((data) => {
    addEntry(data.url, data.score, data.verdict);
  });

  function handleSubmit() {
    const trimmed = url.trim();
    if (trimmed) analyze(trimmed);
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__logo">
          <span className="app__logo-icon">🛡️</span>
          PhishGuard
        </div>
        <DarkModeToggle isDark={isDark} onToggle={() => setIsDark(v => !v)} />
      </header>

      <div className="app__body">
        <aside className="app__sidebar">
          <HistorySidebar
            history={history}
            onSelect={(u) => { setUrl(u); }}
            onClear={clearHistory}
          />
        </aside>

        <main className="app__main">
          <h1 className="app__hero-title">Is this URL safe?</h1>
          <p className="app__tagline">Paste any link to check for phishing, malware, and security risks before clicking.</p>

          <UrlInput
            url={url}
            onChange={setUrl}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />

          {error && <div className="error-banner">{error}</div>}

          {isLoading && <LoadingSpinner />}

          {result && !isLoading && (
            <div className="result-section">
              <VerdictBanner score={result.score} verdict={result.verdict} />
              <RiskGauge score={result.score} verdict={result.verdict} />
              {result.meta?.unavailableChecks > 0 && (
                <p className="unavailable-notice">
                  ⚠ {result.meta.unavailableChecks} check{result.meta.unavailableChecks > 1 ? 's' : ''} could not complete — score based on available data.
                </p>
              )}
              <CheckGrid checks={result.checks} breakdown={result.breakdown} />
              <ShareButton result={result} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
