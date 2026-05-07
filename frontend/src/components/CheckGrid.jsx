import CheckCard from './CheckCard.jsx';
import './CheckGrid.css';

const CHECK_DISPLAY_ORDER = [
  'blacklist', 'whois', 'scheme', 'keyword', 'domain', 'ssl',
  'redirect', 'tld', 'structure', 'shortener',
];

export default function CheckGrid({ checks }) {
  // Build display list: sort by riskPoints desc, failed first, then passed, then unavailable
  const entries = Object.entries(checks || {})
    .map(([key, data]) => ({ key, ...data }))
    .sort((a, b) => {
      // Failed before passed before unavailable
      const stateA = a.passed === false ? 0 : a.passed === true ? 1 : 2;
      const stateB = b.passed === false ? 0 : b.passed === true ? 1 : 2;
      if (stateA !== stateB) return stateA - stateB;
      return (b.riskPoints || 0) - (a.riskPoints || 0);
    });

  return (
    <div className="check-grid">
      <h2 className="check-grid__title">Security Checks</h2>
      <div className="check-grid__grid">
        {entries.map(entry => (
          <CheckCard
            key={entry.key}
            checkName={entry.checkName}
            passed={entry.passed}
            riskPoints={entry.riskPoints}
            details={entry.details}
            description={entry.description}
          />
        ))}
      </div>
    </div>
  );
}
