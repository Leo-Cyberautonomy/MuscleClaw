/**
 * ShowcaseModal — Before/After muscular transformation display.
 * Shows original photo next to AI-generated muscular version.
 * Jarvis HUD aesthetic with scan line animation on reveal.
 */
import { useState } from 'react';

interface ShowcaseModalProps {
  originalSrc: string;  // data:image/jpeg;base64,...
  generatedSrc: string; // data:image/jpeg;base64,...
  onClose: () => void;
}

export function ShowcaseModal({ originalSrc, generatedSrc, onClose }: ShowcaseModalProps) {
  const [revealed, setRevealed] = useState(false);

  // Auto-reveal after 1.5s scan animation
  setTimeout(() => setRevealed(true), 1500);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.3s ease',
    }} onClick={onClose}>

      {/* Title */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 14, fontWeight: 700, letterSpacing: '.15em',
        color: 'rgba(0,210,255,0.8)', marginBottom: 20,
        textTransform: 'uppercase',
        textShadow: '0 0 12px rgba(0,210,255,0.4)',
      }}>
        Muscle Enhancement Protocol
      </div>

      {/* Before / After container */}
      <div style={{
        display: 'flex', gap: 20, alignItems: 'center',
      }} onClick={e => e.stopPropagation()}>

        {/* Before */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            color: 'rgba(255,255,255,0.4)', marginBottom: 8,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            BEFORE
          </div>
          <div style={{
            position: 'relative', borderRadius: 12, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}>
            <img src={originalSrc} alt="Before" style={{
              width: 280, height: 'auto', display: 'block',
              filter: 'brightness(0.9)',
            }} />
          </div>
        </div>

        {/* Arrow */}
        <div style={{
          fontSize: 24, color: 'rgba(0,210,255,0.6)',
          textShadow: '0 0 8px rgba(0,210,255,0.4)',
          animation: 'hudPulse 2s ease-in-out infinite',
        }}>
          →
        </div>

        {/* After */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            color: 'rgba(0,210,255,0.8)', marginBottom: 8,
            fontFamily: "'JetBrains Mono', monospace",
            textShadow: '0 0 8px rgba(0,210,255,0.3)',
          }}>
            ENHANCED
          </div>
          <div style={{
            position: 'relative', borderRadius: 12, overflow: 'hidden',
            border: '1px solid rgba(0,210,255,0.3)',
            boxShadow: `0 0 24px rgba(0,210,255,0.2), 0 4px 24px rgba(0,0,0,0.5)`,
          }}>
            <img src={generatedSrc} alt="Enhanced" style={{
              width: 280, height: 'auto', display: 'block',
              opacity: revealed ? 1 : 0,
              transition: 'opacity 0.8s ease',
            }} />
            {/* Scan reveal overlay */}
            {!revealed && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  position: 'absolute', left: 0, right: 0, height: 3,
                  background: 'linear-gradient(90deg, transparent, rgba(0,210,255,0.6), transparent)',
                  boxShadow: '0 0 12px rgba(0,210,255,0.5)',
                  animation: 'scanReveal 1.5s ease-out',
                }} />
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11, color: 'rgba(0,210,255,0.6)',
                  letterSpacing: '.1em',
                }}>
                  PROCESSING...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close hint */}
      <div style={{
        marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.3)',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        tap anywhere to close
      </div>

      <style>{`
        @keyframes scanReveal {
          0% { top: 0%; }
          100% { top: 100%; }
        }
        @keyframes hudPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}


/**
 * ShowcaseCapture — "Take Photo" button + loading state.
 * Captures video frame, sends to /api/showcase, shows modal.
 */
export function ShowcaseCapture({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ original: string; generated: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);

    try {
      // Capture frame from video
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64 = dataUrl.split(',')[1];

      // Send to backend
      const resp = await fetch('/api/showcase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: base64 }),
      });
      const data = await resp.json();

      if (data.image) {
        setResult({
          original: dataUrl,
          generated: `data:image/jpeg;base64,${data.image}`,
        });
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Capture button */}
      <button
        onClick={capture}
        disabled={loading}
        style={{
          width: '100%', padding: 14, border: 'none',
          borderRadius: 14,
          background: loading
            ? 'rgba(255,255,255,0.1)'
            : 'linear-gradient(135deg, #5E5CE6, #BF5AF2)',
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

      {/* Result modal */}
      {result && (
        <ShowcaseModal
          originalSrc={result.original}
          generatedSrc={result.generated}
          onClose={() => setResult(null)}
        />
      )}
    </>
  );
}
