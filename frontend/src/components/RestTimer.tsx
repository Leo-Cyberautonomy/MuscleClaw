import { useAppStore } from '../stores/appStore';
import { useEffect } from 'react';

export function RestTimer() {
  const restTimerSeconds = useAppStore((s) => s.restTimerSeconds);

  useEffect(() => {
    if (restTimerSeconds <= 0) return;
    const timer = setInterval(() => {
      useAppStore.setState((s) => {
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

  const minutes = Math.floor(restTimerSeconds / 60);
  const seconds = restTimerSeconds % 60;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const progress = restTimerSeconds / 120; // assume 120s max

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      <svg width={130} height={130} viewBox="0 0 130 130">
        {/* Background circle */}
        <circle cx="65" cy="65" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        {/* Progress circle */}
        <circle
          cx="65" cy="65" r={radius} fill="none"
          stroke="var(--color-brand)" strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          transform="rotate(-90 65 65)"
        />
        {/* Time text */}
        <text x="65" y="65" textAnchor="middle" dominantBaseline="central"
          fill="var(--color-text)" fontFamily="var(--font-mono)" fontSize="28" fontWeight="700">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </text>
      </svg>
      <div style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>REST</div>
    </div>
  );
}
