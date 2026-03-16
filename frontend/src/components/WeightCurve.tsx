/**
 * WeightCurve — SVG line chart for exercise weight progression.
 * Apple Health style: gradient fill, animated line draw, hover data points.
 */

interface DataPoint {
  date: string;
  weight: number;
}

interface Props {
  data: DataPoint[];
  height?: number;
  color?: string;
}

export function WeightCurve({ data, height = 100, color = '#5E5CE6' }: Props) {
  if (data.length < 2) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic',
      }}>
        Not enough data for chart
      </div>
    );
  }

  const padding = { top: 10, right: 10, bottom: 24, left: 10 };
  const width = 320;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const weights = data.map(d => d.weight);
  const minW = Math.min(...weights) * 0.9;
  const maxW = Math.max(...weights) * 1.05;
  const range = maxW - minW || 1;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - ((d.weight - minW) / range) * chartH,
    ...d,
  }));

  // SVG path
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  // Area fill path (close to bottom)
  const areaD = pathD + ` L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  // Total path length for stroke-dasharray animation
  let pathLength = 0;
  for (let i = 1; i < points.length; i++) {
    pathLength += Math.sqrt((points[i].x - points[i-1].x) ** 2 + (points[i].y - points[i-1].y) ** 2);
  }

  const gradientId = `wc-grad-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Gradient fill area */}
      <path d={areaD} fill={`url(#${gradientId})`} />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathLength}
        strokeDashoffset={pathLength}
        style={{
          animation: `lineDrawIn 1s ease-out forwards`,
          filter: `drop-shadow(0 0 4px ${color}40)`,
        }}
      />

      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x} cy={p.y} r={4}
            fill="#fff" stroke={color} strokeWidth={2}
            style={{
              opacity: 0,
              animation: `fadeIn 0.2s ease-out ${0.8 + i * 0.05}s forwards`,
            }}
          />
          {/* Weight label on last and max points */}
          {(i === points.length - 1 || p.weight === Math.max(...weights)) && (
            <text
              x={p.x} y={p.y - 10}
              textAnchor="middle"
              style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                fill: p.weight === Math.max(...weights) ? color : 'var(--text-primary, #1c1c1e)',
                opacity: 0,
                animation: `fadeIn 0.2s ease-out ${1 + i * 0.05}s forwards`,
              }}
            >
              {p.weight}kg
            </text>
          )}
        </g>
      ))}

      {/* X-axis date labels (first and last) */}
      <text x={points[0].x} y={height - 4} textAnchor="start"
        style={{ fontSize: 9, fill: '#8e8e93', fontFamily: "'JetBrains Mono', monospace" }}>
        {data[0].date.slice(5)}
      </text>
      <text x={points[points.length - 1].x} y={height - 4} textAnchor="end"
        style={{ fontSize: 9, fill: '#8e8e93', fontFamily: "'JetBrains Mono', monospace" }}>
        {data[data.length - 1].date.slice(5)}
      </text>

      <style>{`
        @keyframes lineDrawIn {
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          to { opacity: 1; }
        }
      `}</style>
    </svg>
  );
}
