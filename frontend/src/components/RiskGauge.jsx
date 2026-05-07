import { useEffect, useRef } from 'react';
import { scoreColor } from '../utils/formatters.js';
import './RiskGauge.css';

// SVG semicircle gauge parameters
const RADIUS = 68;
const STROKE_WIDTH = 12;
const CX = 90;
const CY = 90;
const CIRCUMFERENCE = Math.PI * RADIUS; // half-circle arc length

export default function RiskGauge({ score, verdict }) {
  const arcRef = useRef(null);

  useEffect(() => {
    if (!arcRef.current) return;
    const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
    arcRef.current.style.strokeDashoffset = offset;
  }, [score]);

  const color = scoreColor(score);

  return (
    <div className="risk-gauge">
      <svg
        viewBox={`0 0 ${CX * 2} ${CY + 20}`}
        className="risk-gauge__svg"
        aria-label={`Risk score: ${score} out of 100`}
      >
        {/* Track arc */}
        <path
          d={`M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          ref={arcRef}
          className="risk-gauge__arc"
          d={`M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`}
          fill="none"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
        />
        {/* Score text */}
        <text x={CX} y={CY - 6} textAnchor="middle" className="risk-gauge__number" fill={color}>
          {score}
        </text>
        {/* Label */}
        <text x={CX} y={CY + 16} textAnchor="middle" className="risk-gauge__label" fill="var(--text-muted)">
          Risk Score
        </text>
        {/* Range labels */}
        <text x={CX - RADIUS} y={CY + 18} textAnchor="middle" className="risk-gauge__range" fill="var(--safe)">0</text>
        <text x={CX + RADIUS} y={CY + 18} textAnchor="middle" className="risk-gauge__range" fill="var(--danger)">100</text>
      </svg>

      <div className="risk-gauge__legend">
        <span className="risk-gauge__pill safe">0–29 Safe</span>
        <span className="risk-gauge__pill warn">30–59 Suspicious</span>
        <span className="risk-gauge__pill danger">60–100 Dangerous</span>
      </div>
    </div>
  );
}
