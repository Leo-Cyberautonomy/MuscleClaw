/**
 * ShowcaseModal — Full-screen display of AI-enhanced muscular photo.
 */
import { useState, useEffect, useRef } from 'react';

interface ShowcaseModalProps {
  imageSrc: string;
  onClose: () => void;
}

export function ShowcaseModal({ imageSrc, onClose }: ShowcaseModalProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.9)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.3s ease',
      cursor: 'pointer',
    }} onClick={onClose}>
      <div style={{
        fontSize: 12, fontWeight: 700, letterSpacing: '.12em',
        color: 'rgba(0,210,255,0.7)', marginBottom: 16,
        textTransform: 'uppercase',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        Enhanced by AI
      </div>
      <img src={imageSrc} alt="Enhanced" style={{
        maxWidth: '90vw', maxHeight: '75vh',
        borderRadius: 16,
        border: '2px solid rgba(0,210,255,0.3)',
        boxShadow: '0 0 40px rgba(0,210,255,0.15), 0 8px 32px rgba(0,0,0,0.5)',
        animation: 'scaleIn 0.5s cubic-bezier(.34,1.56,.64,1) both',
      }} />
      <div style={{
        marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.3)',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        tap anywhere to close
      </div>
    </div>
  );
}


/**
 * ShowcaseCapture — Auto-captures after 5s countdown, or manual button.
 * When entering showcase mode, starts countdown automatically.
 */
export function ShowcaseCapture({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const [loading, setLoading] = useState(false);
  const [resultSrc, setResultSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capturedRef = useRef(false);

  // Auto-countdown on mount
  useEffect(() => {
    capturedRef.current = false;
    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          if (!capturedRef.current) {
            capturedRef.current = true;
            doCapture();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const doCapture = async () => {
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64 = dataUrl.split(',')[1];

      const resp = await fetch('/api/showcase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: base64 }),
      });
      const data = await resp.json();

      if (data.image) {
        setResultSrc(`data:image/jpeg;base64,${data.image}`);
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Countdown or status */}
      {!loading && !resultSrc && countdown > 0 && (
        <div style={{
          textAlign: 'center', marginBottom: 12,
          fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 800,
          color: 'var(--brand-purple)',
          animation: 'scaleIn 0.3s var(--spring) both',
        }}>
          {countdown}
        </div>
      )}

      {loading && (
        <div style={{
          textAlign: 'center', padding: 20,
          fontSize: 14, color: 'var(--text-secondary)',
        }}>
          Enhancing your muscles...
        </div>
      )}

      {/* Manual capture button (if countdown finished but capture failed, or user wants to retry) */}
      {!loading && !resultSrc && countdown === 0 && (
        <button
          onClick={doCapture}
          style={{
            width: '100%', padding: 14, border: 'none',
            borderRadius: 14,
            background: 'linear-gradient(135deg, #5E5CE6, #BF5AF2)',
            color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: "'Inter', sans-serif",
            boxShadow: '0 4px 16px rgba(94,92,230,.3)',
          }}
        >
          Retry Capture
        </button>
      )}

      {error && (
        <div style={{ fontSize: 12, color: '#FF3B30', marginTop: 8, textAlign: 'center' }}>
          {error}
          <button onClick={doCapture} style={{
            display: 'block', margin: '8px auto 0', padding: '8px 16px',
            border: 'none', borderRadius: 8, background: 'var(--bg-subtle)',
            color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer',
          }}>
            Try Again
          </button>
        </div>
      )}

      {resultSrc && (
        <ShowcaseModal imageSrc={resultSrc} onClose={() => setResultSrc(null)} />
      )}
    </>
  );
}
