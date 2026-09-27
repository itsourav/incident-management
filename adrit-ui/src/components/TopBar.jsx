import { useCallback } from 'react';

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export default function TopBar({ isPlaying, speed, simTime, kafkaMsgCount, mcpCallCount, activeCount, status, onPlay, onReset, onSpeedChange }) {
  const handleSpeedInput = useCallback((e) => {
    onSpeedChange(parseFloat(e.target.value));
  }, [onSpeedChange]);

  const isAlert = status === 'running' || status === 'error';

  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="topbar__logo">
          <div className="topbar__logo-icon">🛡️</div>
          <div>
            <span className="topbar__title">AEGIS</span>
            <span className="topbar__subtitle">Zero-Trust Agentic Ops</span>
          </div>
        </div>
        <div className={`topbar__status${isAlert ? ' alert-active' : ''}`}>
          <span className="status-dot"></span>
          <span className="status-label">
            {status === 'idle' ? 'System Operational' :
             status === 'running' ? 'Incident Active' :
             status === 'completed' ? 'Resolved' :
             status === 'error' ? 'Pipeline Halted' : 'System Operational'}
          </span>
        </div>
      </div>

      <div className="topbar__center">
        <div className="topbar__controls">
          <button className="control-btn" onClick={onReset} title="Reset (R)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 1 9 9"/><path d="M3 12V3"/><path d="M3 12h9"/>
            </svg>
          </button>
          <button className={`control-btn control-btn--primary${isPlaying ? ' playing' : ''}`} onClick={onPlay} title="Play (Space)">
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            )}
          </button>
          <div className="speed-control">
            <span className="speed-label">Speed</span>
            <input type="range" className="speed-slider" min="0.5" max="4" step="0.5" value={speed} onChange={handleSpeedInput} />
            <span className="speed-value">{speed}×</span>
          </div>
        </div>
      </div>

      <div className="topbar__right">
        <div className="topbar__metrics">
          <div className="metric-badge">
            <span className="metric-badge__label">Active</span>
            <span className="metric-badge__value">{activeCount}</span>
          </div>
          <div className="metric-badge metric-badge--kafka">
            <span className="metric-badge__label">Kafka</span>
            <span className="metric-badge__value">{kafkaMsgCount}</span>
          </div>
          <div className="metric-badge metric-badge--mcp">
            <span className="metric-badge__label">MCP</span>
            <span className="metric-badge__value">{mcpCallCount}</span>
          </div>
        </div>
        <div className="topbar__clock">{formatTime(simTime)}</div>
      </div>
    </header>
  );
}
