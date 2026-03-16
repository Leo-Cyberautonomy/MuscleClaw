import { useUIStore } from './stores/uiStore';
import { CameraView } from './components/CameraView';
import { Sidebar } from './components/Sidebar';
import { SafetyAlert } from './components/SafetyAlert';
import { TranscriptBar } from './components/TranscriptBar';
import { ChatInput } from './components/ChatInput';
import { ControlBar } from './components/ControlBar';
import { SideButton } from './components/SideButton';

export function App() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const safetyAlertActive = useUIStore((s) => s.safetyAlertActive);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0a0a0f' }}>
      {/* Camera area — expands to full width when sidebar closed */}
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        transition: 'flex 0.35s cubic-bezier(.34,1.56,.64,1)',
      }}>
        <CameraView />
        <ControlBar />
        <ChatInput />
        <TranscriptBar />
        <SideButton />
      </div>

      {/* Sidebar — slides in from right */}
      <div style={{
        width: sidebarOpen ? 'var(--sidebar-width, 400px)' : '0px',
        overflow: 'hidden',
        transition: 'width 0.35s cubic-bezier(.34,1.56,.64,1)',
        flexShrink: 0,
      }}>
        {sidebarOpen && <Sidebar />}
      </div>

      {safetyAlertActive && <SafetyAlert />}
    </div>
  );
}
