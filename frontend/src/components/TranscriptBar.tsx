import { useAppStore } from '../stores/appStore';
import { useEffect, useState } from 'react';

/**
 * TranscriptBar — floating subtitle bar above the chat input.
 * Shows last 2 transcript lines, auto-fades after 5s.
 */
export function TranscriptBar() {
  const transcript = useAppStore((s) => s.transcript);
  const [visible, setVisible] = useState<typeof transcript>([]);

  useEffect(() => {
    if (transcript.length === 0) return;
    setVisible(transcript.slice(-2));
    const timer = setTimeout(() => setVisible([]), 5000);
    return () => clearTimeout(timer);
  }, [transcript]);

  if (visible.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', bottom: 60, left: 16, right: 16,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: 12,
      padding: '10px 16px',
      display: 'flex', flexDirection: 'column', gap: 4,
      animation: 'fadeUp 0.25s ease-out',
      maxWidth: 600,
    }}>
      {visible.map((t, i) => (
        <div key={i} style={{
          fontSize: 13, fontWeight: 500, lineHeight: 1.4,
          color: t.role === 'model' ? 'rgba(100,255,218,0.9)' : 'rgba(255,255,255,0.8)',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.05em',
            color: t.role === 'model' ? 'rgba(94,92,230,0.8)' : 'rgba(255,255,255,0.4)',
            marginRight: 6,
          }}>
            {t.role === 'model' ? 'AI' : 'YOU'}
          </span>
          {t.text}
        </div>
      ))}
    </div>
  );
}
