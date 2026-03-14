import { useUIStore } from './stores/uiStore';
import { CameraView } from './components/CameraView';
import { Sidebar } from './components/Sidebar';
import { SafetyAlert } from './components/SafetyAlert';
import { TranscriptBar } from './components/TranscriptBar';
import { ChatInput } from './components/ChatInput';
import { ControlBar } from './components/ControlBar';

export function App() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const safetyAlertActive = useUIStore((s) => s.safetyAlertActive);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0a0a0f' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <CameraView />
        <ControlBar />
        <ChatInput />
        <TranscriptBar />
      </div>
      {sidebarOpen && <Sidebar />}
      {safetyAlertActive && <SafetyAlert />}
    </div>
  );
}
