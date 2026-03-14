import { useAppStore } from './stores/appStore';
import { CameraView } from './components/CameraView';
import { Sidebar } from './components/Sidebar';
import { SafetyAlert } from './components/SafetyAlert';
import { TranscriptBar } from './components/TranscriptBar';
import { ChatInput } from './components/ChatInput';
import { ControlBar } from './components/ControlBar';

export function App() {
  const { sidebarOpen, safetyAlertActive } = useAppStore();

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
