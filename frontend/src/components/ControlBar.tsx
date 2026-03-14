import { useAppStore, type AppMode } from '../stores/appStore';
import { adkClient } from '../ws/adkClient';

const MODES: { mode: AppMode; label: string; icon: string }[] = [
  { mode: 'body_scan', label: '身体扫描', icon: '🦴' },
  { mode: 'planning', label: '训练计划', icon: '📋' },
  { mode: 'training', label: '开始训练', icon: '💪' },
];

export function ControlBar() {
  const { mode, connected, sidebarOpen } = useAppStore();

  function switchMode(m: AppMode) {
    const store = useAppStore.getState();
    if (mode === m) {
      // Toggle off → idle
      store.setMode('idle');
    } else {
      store.setMode(m);
      // Also tell backend about mode switch
      if (connected) {
        adkClient.sendText(`[MODE] 切换到${m === 'body_scan' ? '身体扫描' : m === 'planning' ? '训练计划' : m === 'training' ? '训练模式' : m}`);
      }
    }
  }

  function toggleSidebar() {
    useAppStore.getState().setSidebarOpen(!sidebarOpen);
  }

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16,
      display: 'flex', gap: 6, alignItems: 'center',
      animation: 'fadeIn 0.3s ease',
    }}>
      {MODES.map(({ mode: m, label, icon }) => (
        <button
          key={m}
          onClick={() => switchMode(m)}
          style={{
            background: mode === m ? 'var(--color-brand)' : 'var(--color-panel)',
            backdropFilter: 'var(--blur-panel)',
            border: `1px solid ${mode === m ? 'var(--color-brand)' : 'var(--color-border)'}`,
            borderRadius: 8, padding: '6px 12px',
            color: mode === m ? '#0a0a0f' : 'var(--color-text)',
            fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            transition: 'all 0.2s',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </button>
      ))}
      <button
        onClick={toggleSidebar}
        style={{
          background: sidebarOpen ? 'var(--color-brand)' : 'var(--color-panel)',
          backdropFilter: 'var(--blur-panel)',
          border: `1px solid ${sidebarOpen ? 'var(--color-brand)' : 'var(--color-border)'}`,
          borderRadius: 8, width: 36, height: 36,
          color: sidebarOpen ? '#0a0a0f' : 'var(--color-text)',
          fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        title="侧边栏"
      >
        ☰
      </button>
    </div>
  );
}
