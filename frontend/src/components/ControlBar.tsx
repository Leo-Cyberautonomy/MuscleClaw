import { useAppStore, type AppMode } from '../stores/appStore';
import { useUIStore } from '../stores/uiStore';
import { adkClient } from '../ws/adkClient';

const MODES: { mode: AppMode; label: string }[] = [
  { mode: 'dashboard', label: 'Dashboard' },
  { mode: 'planning', label: 'Plan' },
  { mode: 'training', label: 'Train' },
];

export function ControlBar() {
  const mode = useAppStore((s) => s.mode);
  const connected = useAppStore((s) => s.connected);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  function switchMode(m: AppMode) {
    const store = useAppStore.getState();
    if (mode === m) {
      // Toggle off → idle
      store.setMode('idle');
    } else {
      store.setMode(m);
      // Also tell backend about mode switch
      if (connected) {
        adkClient.sendText(`[MODE] 切换到${m === 'dashboard' ? '仪表盘' : m === 'planning' ? '训练计划' : m === 'training' ? '训练模式' : m}`);
      }
    }
  }

  function toggleSidebar() {
    useUIStore.getState().setSidebarOpen(!sidebarOpen);
  }

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16,
      display: 'flex', gap: 6, alignItems: 'center',
      animation: 'fadeIn 0.3s ease',
    }}>
      {MODES.map(({ mode: m, label }) => (
        <button
          key={m}
          onClick={() => switchMode(m)}
          style={{
            background: mode === m ? 'rgba(94,92,230,.9)' : 'rgba(0,0,0,.5)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${mode === m ? 'rgba(94,92,230,.6)' : 'rgba(255,255,255,.1)'}`,
            borderRadius: 10, padding: '7px 14px',
            color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(.34,1.56,.64,1)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {label}
        </button>
      ))}
      <button
        onClick={toggleSidebar}
        style={{
          background: sidebarOpen ? 'rgba(94,92,230,.9)' : 'rgba(0,0,0,.5)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${sidebarOpen ? 'rgba(94,92,230,.6)' : 'rgba(255,255,255,.1)'}`,
          borderRadius: 10, width: 36, height: 36,
          color: '#fff', fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.25s cubic-bezier(.34,1.56,.64,1)',
        }}
        title="Sidebar"
      >
        ☰
      </button>
    </div>
  );
}
