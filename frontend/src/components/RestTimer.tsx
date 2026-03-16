import { useTrainingStore } from '../stores/trainingStore';
import { useEffect, useRef } from 'react';

/**
 * RestTimer — Apple Watch style circular countdown ring.
 * Color transitions: green → yellow → red (last 10s).
 * Shows in center of camera view during rest periods.
 */
export function RestTimer() {
  const restTimerSeconds = useTrainingStore((s) => s.restTimerSeconds);
  const maxRef = useRef(120);

  // Capture max on first render when timer starts
  useEffect(() => {
    if (restTimerSeconds > 0 && restTimerSeconds > maxRef.current * 0.9) {
      maxRef.current = restTimerSeconds;
    }
  }, [restTimerSeconds]);

  useEffect(() => {
    if (restTimerSeconds <= 0) return;
    const timer = setInterval(() => {
      useTrainingStore.setState((s) => {
        if (s.restTimerSeconds <= 1) {
          clearInterval(timer);
          return { restTimerSeconds: 0 };
        }
        return { restTimerSeconds: s.restTimerSeconds - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [restTimerSeconds > 0]);

  if (restTimerSeconds <= 0) return null;

  const maxTime = maxRef.current;
  const progress = restTimerSeconds / maxTime;
  const minutes = Math.floor(restTimerSeconds / 60);
  const seconds = restTimerSeconds % 60;

  // Color: green → yellow (< 30%) → red (< 10s)
  let ringColor: string;
  if (restTimerSeconds <= 10) {
    ringColor = '#FF3B30';
  } else if (progress < 0.3) {
    ringColor = '#FF9500';
  } else {
    ringColor = '#34C759';
  }

  const size = 140;
  const strokeW = 6;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      animation: 'scaleIn 0.4s cubic-bezier(.34,1.56,.64,1) both',
    }}>
      {/* Glassmorphism background */}
      <div style={{
        width: size + 24, height: size + 24, borderRadius: '50%',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 20px ${ringColor}30`,
        transition: 'box-shadow 0.5s',
      }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <circle
            cx={size/2} cy={size/2} r={r}
            fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeW}
          />
          {/* Progress ring */}
          <circle
            cx={size/2} cy={size/2} r={r}
            fill="none" stroke={ringColor} strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{
              transition: 'stroke-dashoffset 1s linear, stroke 0.5s',
              filter: `drop-shadow(0 0 6px ${ringColor}60)`,
            }}
          />
          {/* Time text */}
          <text
            x={size/2} y={size/2 - 4}
            textAnchor="middle" dominantBaseline="central"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 32, fontWeight: 800,
              fill: '#fff',
            }}
          >
            {minutes}:{seconds.toString().padStart(2, '0')}
          </text>
          {/* REST label */}
          <text
            x={size/2} y={size/2 + 22}
            textAnchor="middle" dominantBaseline="central"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 11, fontWeight: 600,
              fill: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
            }}
          >
            REST
          </text>
        </svg>
      </div>

      {/* Last 10s pulse indicator */}
      {restTimerSeconds <= 10 && (
        <div style={{
          fontSize: 12, fontWeight: 700, color: '#FF3B30',
          animation: 'pulse 1s ease-in-out infinite',
          letterSpacing: '.05em',
        }}>
          GET READY
        </div>
      )}
    </div>
  );
}
