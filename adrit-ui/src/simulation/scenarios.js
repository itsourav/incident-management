export const SCENARIOS = {
  'checkout-5xx': {
    id: 'checkout-5xx',
    name: 'Checkout 5xx Spike',
    icon: '🛒',
    incident: {
      id: 'INC-2024-0847',
      severity: 'P1',
      severityLabel: 'Critical',
      service: 'checkout-service',
      alert: '5xx Error Rate > 5% (currently 12.3%)',
      source: 'Prometheus AlertManager',
    },
    topology: [
      { name: 'checkout-service', status: 'affected' },
      { name: 'payment-gateway', status: 'root' },
      { name: 'cart-service', status: 'affected' },
      { name: 'inventory-service', status: 'healthy' },
      { name: 'orders-db', status: 'healthy' },
    ],
    stages: {
      triage: {
        hitl: true,
        hitlReason: 'P1 severity — requires Incident Commander confirmation',
        duration: 3000,
        description: 'Alert normalized from Prometheus. Severity classified as P1 based on error rate threshold. Service ownership verified via PagerDuty schedule.',
        proposal: 'Assign incident to checkout-team on-call engineer.\nEscalate to Incident Commander for P1 ownership confirmation.\nCreate Jira incident ticket INC-2024-0847.',
        risk: 'medium',
        riskDetails: 'Read-only triage operation. No infrastructure changes.',
        mcpCalls: [
          { tool: 'pagerduty.getSchedule', scope: 'mcp:oncall:read', result: 'allow' },
          { tool: 'jira.createTicket', scope: 'mcp:ticketing:write', result: 'allow' },
        ],
      },
      investigation: {
        hitl: false,
        duration: 5000,
        description: 'Querying Neo4j service topology graph for blast radius. Correlating metrics from Prometheus and traces from Jaeger. Identified root cause: deployment commit abc123f introduced regression in payment validation logic.',
        mcpCalls: [
          { tool: 'neo4j.queryTopology', scope: 'mcp:topology:read', result: 'allow' },
          { tool: 'prometheus.queryRange', scope: 'mcp:metrics:read', result: 'allow' },
          { tool: 'jaeger.searchTraces', scope: 'mcp:traces:read', result: 'allow' },
          { tool: 'github.getCommit', scope: 'mcp:vcs:read', result: 'allow' },
        ],
      },
      fixing: {
        hitl: true,
        hitlReason: 'Destructive action — rollback deployment to previous version',
        duration: 4000,
        description: 'Drafted rollback PR reverting commit abc123f. PR includes automated test verification. Rollback target: v2.14.7 (last known good).',
        proposal: 'Revert commit abc123f in checkout-service.\nCreate rollback PR #1847 targeting main branch.\nRollback to version v2.14.7 (last known good).\n\nAffected files:\n  - src/payment/validator.js\n  - src/payment/processor.js',
        risk: 'high',
        riskDetails: 'Destructive action: rolling back production code. Blast radius: 3 services. Estimated recovery: 8-12 minutes.',
        mcpCalls: [
          { tool: 'github.createPR', scope: 'mcp:vcs:write', result: 'allow' },
          { tool: 'github.mergePR', scope: 'mcp:vcs:write', result: 'allow' },
          { tool: 'k8s.deleteDeployment', scope: 'mcp:k8s:admin', result: 'deny' },
        ],
      },
      deploy: {
        hitl: true,
        hitlReason: 'MANDATORY — Production deployment requires human authorization',
        duration: 6000,
        description: 'Triggering canary deployment via ArgoCD. Traffic shift: 5% → 25% → 50% → 100%. Monitoring 5xx rate and p99 latency during canary phases.',
        proposal: 'Deploy rollback v2.14.7 to production via ArgoCD.\nCanary strategy: 5% → 25% → 50% → 100% over 10 minutes.\n\nValidation criteria:\n  ✓ 5xx rate < 1%\n  ✓ p99 latency < 500ms\n  ✓ Zero pod restarts',
        risk: 'high',
        riskDetails: 'Production deployment affecting live traffic. Canary validation will auto-rollback if thresholds are breached.',
        mcpCalls: [
          { tool: 'argocd.syncApp', scope: 'mcp:cicd:deploy', result: 'allow' },
          { tool: 'k8s.getDeploymentStatus', scope: 'mcp:k8s:read', result: 'allow' },
          { tool: 'prometheus.queryInstant', scope: 'mcp:metrics:read', result: 'allow' },
        ],
      },
      notify: {
        hitl: false,
        duration: 2000,
        description: 'Sending resolution notifications to all stakeholders. Updating Jira ticket status. Posting incident summary to #incidents Slack channel.',
        mcpCalls: [
          { tool: 'slack.postMessage', scope: 'mcp:notify:write', result: 'allow' },
          { tool: 'pagerduty.resolveIncident', scope: 'mcp:oncall:write', result: 'allow' },
          { tool: 'jira.updateTicket', scope: 'mcp:ticketing:write', result: 'allow' },
        ],
      },
    },
  },
  'memory-leak': {
    id: 'memory-leak',
    name: 'Auth Memory Leak',
    icon: '🧠',
    incident: {
      id: 'INC-2024-0848',
      severity: 'P2',
      severityLabel: 'High',
      service: 'auth-service',
      alert: 'OOMKilled pods (3 restarts in 15min)',
      source: 'Kubernetes Event Watcher',
    },
    topology: [
      { name: 'auth-service', status: 'affected' },
      { name: 'session-cache', status: 'root' },
      { name: 'user-service', status: 'healthy' },
      { name: 'api-gateway', status: 'affected' },
    ],
    stages: {
      triage: { hitl: false, duration: 2000, description: 'Clear ownership identified (auth-team). Auto-triaged as P2 based on pod restart count.', mcpCalls: [{ tool: 'k8s.getPodEvents', scope: 'mcp:k8s:read', result: 'allow' }] },
      investigation: { hitl: false, duration: 4000, description: 'Memory profiling reveals Redis connection pool leak in session-cache client. Connections not being released after timeout.', mcpCalls: [{ tool: 'prometheus.queryRange', scope: 'mcp:metrics:read', result: 'allow' }, { tool: 'k8s.execInPod', scope: 'mcp:k8s:exec', result: 'deny' }, { tool: 'grafana.getDashboard', scope: 'mcp:metrics:read', result: 'allow' }] },
      fixing: { hitl: false, duration: 3000, description: 'Config patch: increase connection pool timeout and add max-idle limit. Non-destructive ConfigMap update.', proposal: 'Update ConfigMap auth-service-config:\n  redis.pool.maxIdle: 10 → 50\n  redis.pool.timeout: 30s → 10s\n  redis.pool.maxLifetime: 300s', risk: 'low', riskDetails: 'Non-destructive configuration change. Rolling restart expected.', mcpCalls: [{ tool: 'k8s.patchConfigMap', scope: 'mcp:k8s:write', result: 'allow' }] },
      deploy: { hitl: true, hitlReason: 'MANDATORY — Production config change requires approval', duration: 4000, description: 'Rolling restart of auth-service pods to pick up new ConfigMap values.', proposal: 'Rolling restart auth-service deployment (3 replicas).\nExpected downtime: 0 (rolling strategy).\nMonitor memory usage for 5 minutes post-restart.', risk: 'medium', riskDetails: 'Rolling restart may cause brief latency spike during pod rotation.', mcpCalls: [{ tool: 'k8s.rolloutRestart', scope: 'mcp:k8s:write', result: 'allow' }] },
      notify: { hitl: false, duration: 1500, description: 'Posting resolution to Slack. Updating Jira with root cause analysis.', mcpCalls: [{ tool: 'slack.postMessage', scope: 'mcp:notify:write', result: 'allow' }] },
    },
  },
  'db-exhaustion': {
    id: 'db-exhaustion',
    name: 'DB Connection Exhaustion',
    icon: '🗄️',
    incident: {
      id: 'INC-2024-0849',
      severity: 'P1',
      severityLabel: 'Critical',
      service: 'orders-db',
      alert: 'Connection pool 98% saturated',
      source: 'CloudWatch Alarm',
    },
    topology: [
      { name: 'orders-db', status: 'affected' },
      { name: 'reporting-service', status: 'root' },
      { name: 'order-service', status: 'affected' },
      { name: 'fulfillment-service', status: 'affected' },
      { name: 'analytics-pipeline', status: 'affected' },
    ],
    stages: {
      triage: { hitl: true, hitlReason: 'Blast radius spans 4+ services — requires IC oversight', duration: 3000, description: 'Database connection pool at 98% capacity. Multiple dependent services reporting connection timeouts.', proposal: 'Declare P1 incident affecting orders-db and 4 downstream services.\nPage database on-call and platform team lead.\nActivate incident war room.', risk: 'high', riskDetails: 'Wide blast radius: 4 services impacted. Revenue-critical path affected.', mcpCalls: [{ tool: 'cloudwatch.getAlarm', scope: 'mcp:metrics:read', result: 'allow' }, { tool: 'pagerduty.triggerIncident', scope: 'mcp:oncall:write', result: 'allow' }] },
      investigation: { hitl: false, duration: 5000, description: 'Identified runaway analytical query from reporting-service executing full table scan on orders table. Query running for 47 minutes consuming 340 connections.', mcpCalls: [{ tool: 'rds.getProcessList', scope: 'mcp:db:read', result: 'allow' }, { tool: 'neo4j.queryTopology', scope: 'mcp:topology:read', result: 'allow' }] },
      fixing: { hitl: true, hitlReason: 'Destructive action — killing active database queries', duration: 3000, description: 'Kill runaway query (PID 28471) and add connection limit for reporting-service.', proposal: 'KILL QUERY PID 28471 (reporting-service full scan)\nALTER USER reporting_svc SET max_connections = 20\nAdd query timeout: SET statement_timeout = 300000', risk: 'high', riskDetails: 'Killing active query may cause data inconsistency in reporting pipeline. Connection limit prevents recurrence.', mcpCalls: [{ tool: 'rds.killQuery', scope: 'mcp:db:admin', result: 'allow' }, { tool: 'rds.alterUser', scope: 'mcp:db:admin', result: 'allow' }] },
      deploy: { hitl: false, duration: 3000, description: 'No deployment needed — database-level changes applied directly. Monitoring connection pool recovery.', mcpCalls: [{ tool: 'cloudwatch.getMetric', scope: 'mcp:metrics:read', result: 'allow' }] },
      notify: { hitl: false, duration: 1500, description: 'Resolution notification sent. Post-mortem scheduled for reporting-service query optimization.', mcpCalls: [{ tool: 'slack.postMessage', scope: 'mcp:notify:write', result: 'allow' }, { tool: 'jira.createTicket', scope: 'mcp:ticketing:write', result: 'allow' }] },
    },
  },
};

export const STAGE_ORDER = ['triage', 'investigation', 'fixing', 'deploy', 'notify'];

export const STAGE_CONFIG = {
  triage: { name: 'Triage', icon: '🔍', agent: 'Triage Agent' },
  investigation: { name: 'Investigation', icon: '🔬', agent: 'Investigation Agent' },
  fixing: { name: 'Fixing', icon: '🔧', agent: 'Fixing Agent' },
  deploy: { name: 'Deploy', icon: '🚀', agent: 'Deploy Agent' },
  notify: { name: 'Notify', icon: '📢', agent: 'Release Agent' },
};
