import { useState, useRef } from 'react';
import { adkClient } from '../ws/adkClient';
import { useAppStore } from '../stores/appStore';

export function ChatInput() {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const connected = useAppStore((s) => s.connected);

  function send() {
    const msg = text.trim();
    if (!msg || !connected) return;
    adkClient.sendText(msg);
    useAppStore.getState().addTranscript('user', msg);
    setText('');
    inputRef.current?.focus();
  }

  return (
    <div style={{
      position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 8, alignItems: 'center',
      background: 'rgba(10,10,15,0.75)', backdropFilter: 'blur(12px)',
      border: '1px solid var(--color-border)', borderRadius: 24,
      padding: '6px 6px 6px 16px', width: 'min(480px, 80%)',
      animation: 'fadeIn 0.3s ease',
    }}>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
        placeholder={connected ? '和 MuscleClaw 对话...' : '连接中...'}
        disabled={!connected}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: 'var(--color-text)', fontSize: 14, fontFamily: 'var(--font-sans)',
        }}
      />
      <button
        onClick={send}
        disabled={!connected || !text.trim()}
        style={{
          background: text.trim() ? 'var(--color-brand)' : 'var(--color-border)',
          border: 'none', borderRadius: 18, width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: text.trim() ? 'pointer' : 'default',
          transition: 'background 0.2s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0a0a0f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
