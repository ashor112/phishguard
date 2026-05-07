import './CheckCard.css';

function StatusIcon({ passed }) {
  if (passed === true)  return <span className="check-card__icon pass" title="Passed">✓</span>;
  if (passed === false) return <span className="check-card__icon fail" title="Failed">✗</span>;
  return <span className="check-card__icon unavail" title="Unavailable">–</span>;
}

export default function CheckCard({ checkName, passed, riskPoints, details, description }) {
  const stateClass = passed === true ? 'pass' : passed === false ? 'fail' : 'unavail';

  return (
    <div className={`check-card check-card--${stateClass}`}>
      <div className="check-card__header">
        <StatusIcon passed={passed} />
        <span className="check-card__name">{checkName}</span>
        <div className="check-card__badge-wrap">
          {passed === false && riskPoints > 0 && (
            <span className="check-card__badge risk">+{riskPoints} pts</span>
          )}
          {passed === true && (
            <span className="check-card__badge pass">PASS</span>
          )}
          {passed === null && (
            <span className="check-card__badge unavail">N/A</span>
          )}
        </div>
      </div>
      {description && <p className="check-card__desc">{description}</p>}
      <p className="check-card__details">{details}</p>
    </div>
  );
}
