import { useState, useRef, useEffect } from 'react';

function AuditEntry({ entry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`audit-entry${expanded ? ' expanded' : ''}`} onClick={() => entry.payload && setExpanded(!expanded)}>
      <span className={`audit-dot ${entry.type}`} />
      <div className="audit-body">
        <div className="audit-msg">{entry.message}</div>
        <div className="audit-time">{entry.time.toFixed(1)}s</div>
        {entry.payload && <pre className="audit-payload">{entry.payload}</pre>}
      </div>
    </div>
  );
}

function MCPEntry({ entry }) {
  const [showJWT, setShowJWT] = useState(false);
  return (
    <div className="mcp-entry">
      <div className="mcp-entry__header">
        <span className="mcp-entry__agent">{entry.agent}</span>
        <span className={`mcp-entry__verdict ${entry.result}`}>{entry.result}</span>
      </div>
      <div className="mcp-entry__tool">{entry.tool}</div>
      <div className="mcp-entry__scope">Scope: {entry.scope}</div>
      {entry.jwt && (
        <div className="mcp-entry__jwt" onClick={() => setShowJWT(!showJWT)} title="Click to toggle JWT">
          {showJWT ? entry.jwt : `${entry.jwt.substring(0, 40)}...`}
        </div>
      )}
    </div>
  );
}

function KafkaTopic({ name, messages }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="kafka-topic">
      <div className="kafka-topic__header" onClick={() => setExpanded(!expanded)}>
        <span className="kafka-topic__name">{name}</span>
        <span className="kafka-topic__count">{messages.length} msgs</span>
      </div>
      {expanded && (
        <div className="kafka-topic__messages">
          {messages.map((msg, i) => (
            <div key={i} className="kafka-msg">
              <span className="kafka-msg__key">{msg.key}</span> → {typeof msg.value === 'object' ? JSON.stringify(msg.value) : msg.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RightPanel({ audit, mcp, kafka }) {
  const [activeTab, setActiveTab] = useState('audit');
  const [auditFilter, setAuditFilter] = useState('all');
  const auditListRef = useRef(null);

  useEffect(() => {
    if (auditListRef.current) {
      auditListRef.current.scrollTop = auditListRef.current.scrollHeight;
    }
  }, [audit]);

  const filteredAudit = auditFilter === 'all'
    ? audit
    : audit.filter(e => e.type === auditFilter);

  const tabs = [
    { id: 'audit', label: 'Audit Trail', badge: audit.length, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { id: 'mcp', label: 'MCP Gateway', badge: mcp.calls.length, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
    { id: 'kafka', label: 'Kafka Bus', badge: kafka.messages.length, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  ];

  return (
    <aside className="sidebar sidebar--right">
      <div className="tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
            <span className="tab-badge">{tab.badge}</span>
          </button>
        ))}
      </div>
      <div className="tab-content">
        {/* AUDIT TAB */}
        <div className={`tab-panel${activeTab === 'audit' ? ' active' : ''}`}>
          <div className="audit-filters">
            {['all', 'agent', 'approval', 'mcp', 'kafka', 'system'].map(f => (
              <button key={f} className={`filter-btn${auditFilter === f ? ' active' : ''}`} onClick={() => setAuditFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="audit-list" ref={auditListRef}>
            {filteredAudit.length === 0 ? (
              <div className="empty-state empty-state--small" style={{ padding: '24px' }}>
                <p className="empty-state__text">Audit trail empty</p>
              </div>
            ) : (
              filteredAudit.map(entry => <AuditEntry key={entry.id} entry={entry} />)
            )}
          </div>
        </div>

        {/* MCP TAB */}
        <div className={`tab-panel${activeTab === 'mcp' ? ' active' : ''}`}>
          <div className="mcp-header-stats">
            <div className="mcp-stat">
              <span className="mcp-stat__label">Tokens</span>
              <span className="mcp-stat__value">{mcp.tokensIssued}</span>
            </div>
            <div className="mcp-stat">
              <span className="mcp-stat__label">Allowed</span>
              <span className="mcp-stat__value mcp-stat__value--green">{mcp.allowed}</span>
            </div>
            <div className="mcp-stat">
              <span className="mcp-stat__label">Denied</span>
              <span className="mcp-stat__value mcp-stat__value--red">{mcp.denied}</span>
            </div>
          </div>
          <div className="mcp-list" style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            {mcp.calls.length === 0 ? (
              <div className="empty-state empty-state--small" style={{ padding: '24px' }}>
                <p className="empty-state__text">No MCP requests yet</p>
              </div>
            ) : (
              [...mcp.calls].reverse().map(entry => <MCPEntry key={entry.id} entry={entry} />)
            )}
          </div>
        </div>

        {/* KAFKA TAB */}
        <div className={`tab-panel${activeTab === 'kafka' ? ' active' : ''}`}>
          <div className="kafka-topics" style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            {Object.keys(kafka.topics).length === 0 ? (
              <div className="empty-state empty-state--small" style={{ padding: '24px' }}>
                <p className="empty-state__text">No Kafka activity</p>
              </div>
            ) : (
              Object.entries(kafka.topics).map(([name, msgs]) => (
                <KafkaTopic key={name} name={name} messages={msgs} />
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
