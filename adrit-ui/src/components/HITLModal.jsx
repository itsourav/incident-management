import { useState, useEffect } from 'react';

export default function HITLModal({ hitl, onApprove, onReject }) {
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (!hitl) { setCountdown(60); return; }
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [hitl]);

  if (!hitl) return null;

  return (
    <div className={`modal-overlay${hitl ? ' visible' : ''}`}>
      <div className="hitl-modal">
        <div className="hitl-modal__header">
          <div className="hitl-modal__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h2 className="hitl-modal__title">{hitl.title}</h2>
          <div className="hitl-modal__timer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>Auto-escalate in {countdown}s</span>
          </div>
        </div>

        <div className="hitl-modal__body">
          <div className="hitl-modal__agent">
            <span className="hitl-agent-label">Requesting Agent</span>
            <span className="hitl-agent-name">{hitl.agent}</span>
          </div>

          <div>
            <h3 className="hitl-proposal-title">Proposed Action</h3>
            <div className="hitl-proposal-content">
              {hitl.proposal.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>

          <div>
            <div className="risk-meter">
              <span className="risk-label">Risk Assessment</span>
              <div className="risk-bar">
                <div className={`risk-bar__fill ${hitl.risk}`} />
              </div>
              <span className={`risk-value ${hitl.risk}`}>
                {hitl.risk.toUpperCase()}
              </span>
            </div>
            <div className="risk-details">{hitl.riskDetails}</div>
          </div>
        </div>

        <div className="hitl-modal__footer">
          <button className="hitl-btn hitl-btn--reject" onClick={onReject}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Reject
          </button>
          <button className="hitl-btn hitl-btn--approve" onClick={onApprove}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
