import { verdictColor, verdictBg } from '../utils/formatters.js';
import './VerdictBanner.css';

const VERDICT_DATA = {
  SAFE: {
    icon: '✅',
    label: 'Safe',
    description: 'This URL appears safe. No major risk indicators were detected.',
  },
  SUSPICIOUS: {
    icon: '⚠️',
    label: 'Suspicious',
    description: 'This URL has some warning signs. Proceed with caution.',
  },
  DANGEROUS: {
    icon: '🚨',
    label: 'Dangerous',
    description: 'This URL exhibits multiple high-risk indicators. Do not visit.',
  },
};

export default function VerdictBanner({ score, verdict }) {
  const data = VERDICT_DATA[verdict] || VERDICT_DATA.SUSPICIOUS;

  return (
    <div
      className="verdict-banner"
      style={{
        '--vcolor': verdictColor(verdict),
        '--vbg': verdictBg(verdict),
      }}
    >
      <div className="verdict-banner__icon">{data.icon}</div>
      <div className="verdict-banner__content">
        <div className="verdict-banner__label">{data.label}</div>
        <div className="verdict-banner__desc">{data.description}</div>
      </div>
      <div className="verdict-banner__score">{score}<span>/100</span></div>
    </div>
  );
}
