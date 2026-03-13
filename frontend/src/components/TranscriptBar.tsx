import { useAppStore } from '../stores/appStore';
import { useEffect, useState } from 'react';

export function TranscriptBar() {
  const transcript = useAppStore((s) => s.transcript);
  const [visible, setVisible] = useState<typeof transcript>([]);

  useEffect(() => {
    if (transcript.length === 0) return;
    setVisible(transcript.slice(-2));
    const timer = setTimeout(() => setVisible([]), 4000);
    return () => clearTimeout(timer);
  }, [transcript]);

  if (visible.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 48,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 24,
      fontSize: 14, animation: 'fadeIn 0.2s ease',
    }}>
      {visible.map((t, i) => (
        <span key={i} style={{
          color: t.role === 'model' ? 'var(--color-brand)' : 'var(--color-text)',
          opacity: 0.9,
        }}>
          {t.role === 'model' ? 'AI: ' : 'You: '}{t.text}
        </span>
      ))}
    </div>
  );
}
