/**
 * ShowcaseModal — Full-screen display of AI-enhanced muscular photo.
 * Only shows the generated image, not before/after comparison.
 */
import { useState } from 'react';

interface ShowcaseModalProps {
  imageSrc: string;  // data:image/jpeg;base64,...
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
 * ShowcaseCapture — Capture button + loading + result display.
 */
export function ShowcaseCapture({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const [loading, setLoading] = useState(false);
  const [resultSrc, setResultSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capture = async () => {
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
      <button
        onClick={capture}
        disabled={loading}
        style={{
          width: '100%', padding: 14, border: 'none',
          borderRadius: 14,
          background: loading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #5E5CE6, #BF5AF2)',
          color: '#fff', fontSize: 15, fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer',
          fontFamily: "'Inter', sans-serif",
          boxShadow: loading ? 'none' : '0 4px 16px rgba(94,92,230,.3)',
          transition: 'all .25s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        {loading ? 'Enhancing...' : 'Capture & Enhance'}
      </button>

      {error && (
        <div style={{ fontSize: 12, color: '#FF3B30', marginTop: 8, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {resultSrc && (
        <ShowcaseModal imageSrc={resultSrc} onClose={() => setResultSrc(null)} />
      )}
    </>
  );
}
