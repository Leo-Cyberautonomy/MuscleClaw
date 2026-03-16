import { useUIStore } from '../stores/uiStore';
import { useEffect } from 'react';

/**
 * SafetyAlert — full-screen emergency overlay.
 * Red pulsing background, large countdown, "EMERGENCY" text.
 * Per acceptance criteria 3D.5.
 */
export function SafetyAlert() {
  const safetyCountdown = useUIStore((s) => s.safetyCountdown);

  useEffect(() => {
    if (safetyCountdown <= 0) return;
    const timer = setInterval(() => {
      useUIStore.setState((s) => {
        if (s.safetyCountdown <= 1) {
          clearInterval(timer);
          return { safetyCountdown: 0 };
        }
        return { safetyCountdown: s.safetyCountdown - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [safetyCountdown > 0]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(220, 20, 20, 0.15)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column',
      animation: 'alertPulse 1.5s ease-in-out infinite',
    }}>
      {/* Red vignette overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(200,0,0,0.3) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1, textAlign: 'center',
        animation: 'scaleIn 0.3s cubic-bezier(.34,1.56,.64,1) both',
      }}>
        {/* Emergency badge */}
        <div style={{
          display: 'inline-block',
          padding: '8px 24px', borderRadius: 12,
          background: 'rgba(255,59,48,0.9)',
          color: '#fff', fontSize: 18, fontWeight: 800,
          letterSpacing: '.15em', textTransform: 'uppercase',
          boxShadow: '0 0 30px rgba(255,59,48,0.5)',
          marginBottom: 32,
        }}>
          EMERGENCY
        </div>

        {/* Countdown */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 96, fontWeight: 800,
          color: '#FF3B30',
          textShadow: '0 0 40px rgba(255,59,48,0.6), 0 0 80px rgba(255,59,48,0.3)',
          lineHeight: 1,
          animation: 'countdownPulse 1s ease-in-out infinite',
        }}>
          {safetyCountdown}
        </div>

        {/* Description */}
        <div style={{
          marginTop: 24, fontSize: 18, fontWeight: 600,
          color: 'rgba(255,255,255,0.9)',
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          Calling emergency contact in {safetyCountdown}s
        </div>

        {/* Cancel instruction */}
        <div style={{
          marginTop: 16, fontSize: 14, fontWeight: 500,
          color: 'rgba(255,255,255,0.6)',
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        }}>
          Say "cancel" or "I'm fine" to stop
        </div>
      </div>

      <style>{`
        @keyframes alertPulse {
          0%, 100% { background-color: rgba(220,20,20,0.1); }
          50% { background-color: rgba(220,20,20,0.2); }
        }
        @keyframes countdownPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
