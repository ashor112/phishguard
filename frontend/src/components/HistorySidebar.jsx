import { truncateUrl, relativeTime, verdictColor } from '../utils/formatters.js';
import './HistorySidebar.css';

export default function HistorySidebar({ history, onSelect, onClear }) {
  if (history.length === 0) {
    return (
      <div className="history">
        <div className="history__header">
          <span className="history__title">Recent Checks</span>
        </div>
        <p className="history__empty">No URLs checked yet.</p>
      </div>
    );
  }

  return (
    <div className="history">
      <div className="history__header">
        <span className="history__title">Recent Checks</span>
        <button className="history__clear" onClick={onClear} title="Clear history">
          Clear
        </button>
      </div>
      <ul className="history__list">
        {history.map((entry, i) => (
          <li key={`${entry.url}-${i}`} className="history__item">
            <button
              className="history__item-btn"
              onClick={() => onSelect(entry.url)}
              title={entry.url}
            >
              <div className="history__item-top">
                <span
                  className="history__verdict-dot"
                  style={{ background: verdictColor(entry.verdict) }}
                />
                <span className="history__url">{truncateUrl(entry.url, 32)}</span>
                <span className="history__score" style={{ color: verdictColor(entry.verdict) }}>
                  {entry.score}
                </span>
              </div>
              <div className="history__item-bottom">
                <span
                  className="history__verdict-label"
                  style={{ color: verdictColor(entry.verdict) }}
                >
                  {entry.verdict}
                </span>
                <span className="history__time">{relativeTime(entry.analyzedAt)}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
