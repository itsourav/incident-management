import { SCENARIOS, STAGE_ORDER, STAGE_CONFIG } from '../simulation/scenarios';

export default function IncidentPanel({ incident, stages, currentStageIndex, simTime, selectedScenario, onScenarioChange, isPlaying, scenarioData }) {
  return (
    <aside className="sidebar">
      <div className="panel-header">
        <h2 className="panel-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Incident Details
        </h2>
      </div>
      <div className="panel-body">
        {!incident ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/>
              </svg>
            </div>
            <p className="empty-state__text">No active incident</p>
            <p className="empty-state__hint">Press Play to start a simulation</p>
          </div>
        ) : (
          <div>
            <div className="incident-header-card">
              <div className="incident-id">{incident.id}</div>
              <div className="incident-severity">⚠ {incident.severity} — {incident.severityLabel}</div>
            </div>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Service</span>
                <span className="info-value">{incident.service}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Alert</span>
                <span className="info-value" style={{ fontSize: '10px' }}>{incident.alert}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Source</span>
                <span className="info-value" style={{ fontSize: '10px' }}>{incident.source}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Duration</span>
                <span className="info-value">{simTime.toFixed(1)}s</span>
              </div>
            </div>

            <div className="section-divider" />
            <h3 className="section-title">Blast Radius</h3>
            <div className="topology-graph">
              {scenarioData?.topology?.map((node, i) => (
                <span key={node.name}>
                  <span className={`topo-node ${node.status}`}>{node.status === 'root' ? '⚠ ' : node.status === 'affected' ? '● ' : '○ '}{node.name}</span>
                  {i < scenarioData.topology.length - 1 && <span className="topo-arrow">→</span>}
                </span>
              ))}
            </div>

            <div className="section-divider" />
            <h3 className="section-title">Stage Timeline</h3>
            <div className="stage-timeline">
              {STAGE_ORDER.map((key, idx) => {
                const stageState = stages[key];
                let dotClass = 'pending';
                if (stageState?.status === 'completed') dotClass = 'completed';
                else if (stageState?.status === 'waiting') dotClass = 'waiting';
                else if (stageState?.status === 'active') dotClass = 'active';
                else if (stageState?.status === 'error') dotClass = 'active'; // show red via css

                return (
                  <div key={key} className={`timeline-entry${idx === currentStageIndex ? ' active' : ''}`}>
                    <span className={`timeline-dot ${dotClass}`} />
                    <span className="timeline-label">{STAGE_CONFIG[key].icon} {STAGE_CONFIG[key].name}</span>
                    {stageState?.endTime && <span className="timeline-time">{stageState.endTime.toFixed(1)}s</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="scenario-selector">
        <h3 className="panel-subtitle">Scenarios</h3>
        {Object.entries(SCENARIOS).map(([id, sc]) => (
          <button
            key={id}
            className={`scenario-btn${selectedScenario === id ? ' scenario-btn--active' : ''}`}
            onClick={() => onScenarioChange(id)}
            disabled={isPlaying}
            style={isPlaying ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            <span className="scenario-icon">{sc.icon}</span>
            <span className="scenario-info">
              <span className="scenario-name">{sc.name}</span>
              <span className="scenario-desc">{sc.incident.alert.substring(0, 40)}</span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
