import { useUIStore } from '../stores/uiStore';

/**
 * SideButton — half-circle button on right edge of camera view.
 * Toggles sidebar open/closed. Visible when sidebar is closed.
 * Can be activated by mouse click or Air Touch (finger pointing).
 */
export function SideButton() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  if (sidebarOpen) return null;

  return (
    <button
      data-side-button
      onClick={() => useUIStore.getState().setSidebarOpen(true)}
      style={{
        position: 'absolute',
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 32,
        height: 96,
        background: 'rgba(255,255,255,0.12)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRight: 'none',
        borderRadius: '12px 0 0 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        zIndex: 30,
        transition: 'all 0.3s cubic-bezier(.34,1.56,.64,1)',
        boxShadow: '0 0 12px rgba(94,92,230,0.15)',
        animation: 'breathe 3s ease-in-out infinite',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.width = '40px';
        e.currentTarget.style.background = 'rgba(94,92,230,0.3)';
        e.currentTarget.style.color = '#fff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.width = '32px';
        e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
        e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
      }}
      title="Open Panel"
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
