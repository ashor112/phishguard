import './LoadingSpinner.css';

const STEPS = [
  { label: 'Static Analysis', detail: 'Checking URL structure, scheme, keywords…' },
  { label: 'Domain Lookup',   detail: 'Querying WHOIS for domain age…' },
  { label: 'SSL Validation',  detail: 'Verifying TLS certificate…' },
  { label: 'Redirect Trace',  detail: 'Following redirect chain…' },
];

export default function LoadingSpinner() {
  return (
    <div className="loading-spinner">
      <div className="loading-spinner__pulse" />
      <p className="loading-spinner__headline">Analyzing URL…</p>
      <ul className="loading-spinner__steps">
        {STEPS.map((step, i) => (
          <li key={step.label} className="loading-spinner__step" style={{ animationDelay: `${i * 0.18}s` }}>
            <span className="loading-spinner__dot" style={{ animationDelay: `${i * 0.18}s` }} />
            <span className="loading-spinner__step-label">{step.label}</span>
            <span className="loading-spinner__step-detail">{step.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
