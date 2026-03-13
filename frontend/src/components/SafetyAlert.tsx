import { useAppStore } from '../stores/appStore';
import { useEffect } from 'react';

export function SafetyAlert() {
  const { safetyCountdown } = useAppStore();

  useEffect(() => {
    if (safetyCountdown <= 0) return;
    const timer = setInterval(() => {
      useAppStore.setState((s) => {
        if (s.safetyCountdown <= 1) {
          clearInterval(timer);
          return { safetyCountdown: 0 };
        }
        return { safetyCountdown: s.safetyCountdown - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [safetyCountdown > 0]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(180, 0, 0, 0.35)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'rgba(20, 0, 0, 0.85)', border: '2px solid var(--color-danger)',
        borderRadius: 20, padding: '48px 64px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>
          SAFETY ALERT
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 80, fontWeight: 800,
          color: 'var(--color-danger)', margin: '16px 0',
          animation: 'pulse 1s ease-in-out infinite',
        }}>
          {safetyCountdown}
        </div>
        <div style={{ fontSize: 16, color: 'var(--color-text-dim)' }}>
          秒后拨打紧急联系人
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-text-dim)', marginTop: 12 }}>
          说"取消"或"我没事"停止倒计时
        </div>
      </div>
    </div>
  );
}
