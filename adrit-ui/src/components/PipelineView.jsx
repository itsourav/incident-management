import { STAGE_ORDER, STAGE_CONFIG } from '../simulation/scenarios';

function PipelineNode({ stageKey, stageState, config, isActive, scenarioData }) {
  const status = stageState?.status || 'idle';
  const hasHITL = scenarioData?.stages?.[stageKey]?.hitl;

  return (
    <div className={`pipeline-node ${status}`}>
      {hasHITL && <div className="node-hitl-badge" title="HITL Gate">H</div>}
      <span className="node-icon">{config.icon}</span>
      <span className="node-name">{config.name}</span>
      <span className={`node-status ${status}`}>
        {status === 'idle' ? 'Standby' :
         status === 'active' ? 'Processing...' :
         status === 'waiting' ? 'Awaiting Approval' :
         status === 'completed' ? 'Complete' :
         status === 'error' ? 'Rejected' : status}
      </span>
    </div>
  );
}

function Connector({ leftStatus, rightStatus }) {
  const isActive = leftStatus === 'active' || rightStatus === 'active';
  const isCompleted = leftStatus === 'completed';

  return (
    <div className="pipeline-connector">
      <div className={`connector-line${isCompleted ? ' completed' : isActive ? ' active' : ''}`}>
        {isActive && <div className="connector-particle" />}
      </div>
    </div>
  );
}

export default function PipelineView({ stages, currentStageIndex, status, scenarioData }) {
  const currentStage = STAGE_ORDER[currentStageIndex];
  const currentConfig = currentStage ? STAGE_CONFIG[currentStage] : null;
  const currentData = currentStage && scenarioData ? scenarioData.stages[currentStage] : null;

  return (
    <section className="main-content">
      <div className="pipeline-container">
        <div className="pipeline-header">
          <h2 className="pipeline-title">Incident Response Pipeline</h2>
          <div className="pipeline-legend">
            <span className="legend-item"><span className="legend-dot legend-dot--idle"></span> Idle</span>
            <span className="legend-item"><span className="legend-dot legend-dot--active"></span> Active</span>
            <span className="legend-item"><span className="legend-dot legend-dot--waiting"></span> Awaiting</span>
            <span className="legend-item"><span className="legend-dot legend-dot--completed"></span> Done</span>
          </div>
        </div>

        <div className="pipeline-flow">
          {STAGE_ORDER.map((key, idx) => (
            <span key={key} style={{ display: 'contents' }}>
              <PipelineNode
                stageKey={key}
                stageState={stages[key]}
                config={STAGE_CONFIG[key]}
                isActive={idx === currentStageIndex}
                scenarioData={scenarioData}
              />
              {idx < STAGE_ORDER.length - 1 && (
                <Connector
                  leftStatus={stages[key]?.status || 'idle'}
                  rightStatus={stages[STAGE_ORDER[idx + 1]]?.status || 'idle'}
                />
              )}
            </span>
          ))}
        </div>

        <div className="pipeline-details">
          {!currentStage ? (
            <div className="empty-state" style={{ padding: '16px' }}>
              <p className="empty-state__text">Select a scenario and press Play to begin</p>
            </div>
          ) : (
            <div>
              <div className="details-header">
                <span className="details-agent-icon">{currentConfig.icon}</span>
                <span className="details-agent-name">{currentConfig.agent}</span>
                <span className="details-stage-label">{currentConfig.name}</span>
                {stages[currentStage]?.status === 'waiting' && (
                  <span className="details-stage-label" style={{ background: 'var(--accent-amber-dim)', color: 'var(--accent-amber)' }}>
                    ⏳ HITL Gate
                  </span>
                )}
              </div>
              <div className="details-content">
                <p>{currentData?.description}</p>
                {currentData?.mcpCalls && (
                  <p style={{ marginTop: '8px' }}>
                    <strong style={{ color: 'var(--accent-purple)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MCP Tool Calls: </strong>
                    {currentData.mcpCalls.map((c, i) => (
                      <code key={i} style={{ marginRight: '4px', color: c.result === 'allow' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {c.result === 'allow' ? '✓' : '✗'} {c.tool}
                      </code>
                    ))}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {status === 'completed' && (
        <div style={{
          textAlign: 'center', padding: '16px',
          background: 'var(--accent-green-dim)', border: '1px solid var(--accent-green-border)',
          borderRadius: 'var(--radius-lg)', animation: 'fadeIn 500ms ease'
        }}>
          <span style={{ fontSize: '24px' }}>🎉</span>
          <p style={{ color: 'var(--accent-green)', fontWeight: 600, marginTop: '4px' }}>
            Incident Resolved Successfully
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            All pipeline stages completed. Zero-Trust policies enforced throughout.
          </p>
        </div>
      )}
    </section>
  );
}
