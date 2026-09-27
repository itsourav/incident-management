# Zero-Trust Agentic AI Ops — Implementation Roadmap

> A streamlined, incremental engineering plan to implement the **Infra-Agnostic Intelligent Ops Framework** described in [PLAN.md](PLAN.md).

---

## Roadmap Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PHASE-WISE EXECUTION TIMELINE                                   │
├───────────────────┬───────────────────┬───────────────────┬──────────────────┬──────────────────┤
│      PHASE 0      │      PHASE 1      │      PHASE 2      │     PHASE 3      │     PHASE 4      │
│  Local Stack &    │  Domain Models &  │   MCP Gateway &   │  5 Specialized   │   BFF Layer &    │
│  Containers       │  Kafka Topics     │   Tool Servers    │  Agents Pipeline │   HITL Gates     │
├───────────────────┴───────────────────┴───────────────────┴──────────────────┴──────────────────┤
│                                 PHASE 5                                                         │
│                adrit-ui Integration & End-to-End Incident Walkthrough                          │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Local Stack & Infrastructure Scaffolding
> **Duration:** Days 1–2  
> **Objective:** Stand up hermetic local infrastructure (Kafka, PostgreSQL, Neo4j, WireMock) with zero external cloud dependencies.

### Deliverables
1. **Docker Compose Environment (`docker/docker-compose.yml`)**:
   - **Apache Kafka / Redpanda**: Local broker pre-configured with core incident topics.
   - **PostgreSQL**: Initialized with tables for `incidents`, `approvals`, and `audit_trail`.
   - **Neo4j**: Graph database pre-seeded with sample microservice topology (`checkout-service` $\rightarrow$ `payment-gateway` $\rightarrow$ `orders-db`).
   - **WireMock Containers**: Canned API stubs for:
     - GitHub API (commit history, PR creation)
     - ArgoCD API (sync status, rollback endpoint)
     - PagerDuty & Slack webhooks
2. **Project Structure Setup**:
   - `adrit-domain`: Pure Java 21 domain records and event contracts.
   - `adrit-agents`: The 5 specialized agent implementations (Spring AI).
   - `adrit-mcp-gateway`: Policy enforcement gateway and tool servers.
   - `adrit-bff`: Backend-for-Frontend query & approval REST/SSE service.
   - `adrit-ui`: React 19 + Vite operations console.

### Verification & Exit Criteria
- `docker compose up -d` starts all services healthy.
- Seeded Neo4j Cypher query returns downstream dependency path for `checkout-service`.
- WireMock stubs return expected HTTP 200 responses.

---

## Phase 1: Domain Models & Kafka Event Contracts
> **Duration:** Days 3–5  
> **Objective:** Define immutable event schemas for asynchronous agent handoffs across Kafka.

### Deliverables
1. **Core Domain Models (`adrit-domain`)**:
   - Immutable Java 21 `record`s:
     - `IncidentAlert`: Source, severity, service, timestamp, raw telemetry.
     - `TriageAssessment`: Confirmed severity (`P1`–`P5`), assigned team, blast-radius summary, `requiresApproval` flag.
     - `RootCauseFinding`: Identified commit SHA, offending log snippet, downstream affected services.
     - `FixProposal`: Proposed rollback commit or config patch, risk level, affected systems.
     - `DeploymentResult`: Rollout status, canary health metrics, rollback verification.
     - `ApprovalRecord`: Approver identity (OIDC subject), stage, action, timestamp, decision reason.
     - `AuditEntry`: Monotonic sequence, timestamp, actor, eventType, raw payload, status.
2. **Kafka Event Topics & Serializers**:
   - `incident.alerts`: Raw normalized incoming alerts.
   - `incident.triaged`: Emitted by Triage Agent after classification.
   - `incident.investigated`: Emitted by Investigation Agent with root-cause finding.
   - `incident.fix_proposed`: Emitted by Fixing Agent with hotfix/rollback plan.
   - `incident.deployed`: Emitted by Deploy Agent after canary verification.
   - `incident.closed`: Emitted by Release Agent after notification dispatch.
   - `incident.hitl`: Approval request and approval grant events.

### Verification & Exit Criteria
- Unit tests verify serialization/deserialization across all Kafka event records.
- Integration test publishes an `AlertIngestedEvent` to Kafka and successfully consumes it.

---

## Phase 2: Zero-Trust MCP Gateway & Tool Servers
> **Duration:** Days 6–8  
> **Objective:** Build the secure tool execution layer with token scoping and policy deny-lists.

### Deliverables
1. **MCP Gateway Core (`adrit-mcp-gateway`)**:
   - **Token Scope Validator**: Validates short-lived JWT passed by agents, asserting required scopes:
     - `mcp:vcs:read` / `mcp:vcs:write`
     - `mcp:k8s:read` / `mcp:k8s:write`
     - `mcp:cicd:deploy`
   - **Policy & Deny-List Filter**: Enforces hard boundaries (e.g., blocks `k8s:deleteDeployment`, drops table commands, or unauthorized namespace modifications).
2. **Specialized MCP Servers**:
   - `mcp-vcs-server`: Wraps Git/GitHub API to fetch diffs and create rollback pull requests.
   - `mcp-cicd-server`: Wraps ArgoCD API to trigger rollbacks and monitor sync status.
   - `mcp-observability-server`: Wraps Prometheus/Loki to query metrics and recent error logs.

### Verification & Exit Criteria
- Integration test verifies that a permitted tool call (`getLogs`) succeeds with valid token.
- Integration test verifies that an unpermitted action (e.g. `deleteDeployment`) is rejected by the Gateway with an HTTP 403 `DENIED`.

---

## Phase 3: The 5 Specialized Agents & Cost-Aware Routing
> **Duration:** Days 9–13  
> **Objective:** Implement the 5 specialized agents that consume from Kafka, reason via LLMs, execute tools via MCP Gateway, and emit the next stage event.

### Deliverables
1. **Alert Normalizer**:
   - Ingests raw webhook alerts, cleans payload, publishes to `incident.alerts`.
2. **Triage Agent (`TriageAgent`)**:
   - Consumes `incident.alerts`.
   - Uses lightweight model (e.g., Llama 3 / Claude 3.5 Haiku) for rapid classification.
   - If P1 or ownership is ambiguous $\rightarrow$ halts and emits `ApprovalRequested(Stage.TRIAGE)`.
3. **Investigation Agent (`InvestigationAgent`)**:
   - Consumes `incident.triaged`.
   - Queries Neo4j service dependency graph for blast-radius analysis.
   - Queries recent logs via MCP Observability server.
   - Uses frontier reasoning model (Claude 3.7 Sonnet / GPT-4o) to isolate root-cause commit.
   - Emits `incident.investigated`.
4. **Fixing Agent (`FixingAgent`)**:
   - Consumes `incident.investigated`.
   - Drafts rollback PR or config patch via `mcp-vcs-server`.
   - Flags conditional approval gate for production changes $\rightarrow$ emits `ApprovalRequested(Stage.FIXING)`.
5. **Deploy / Validation Agent (`DeployAgent`)**:
   - Consumes `incident.fix_approved`.
   - Requires mandatory production approval $\rightarrow$ emits `ApprovalRequested(Stage.DEPLOY)`.
   - Once authorized, triggers ArgoCD rollback via `mcp-cicd-server`.
   - Polls Prometheus metrics to confirm error rate has normalized.
   - Emits `incident.deployed`.
6. **Release / Notify Agent (`ReleaseAgent`)**:
   - Consumes `incident.deployed`.
   - Outbound-only: updates Jira ticket status, posts resolution summary to Slack, and resolves PagerDuty incident.
   - Emits `incident.closed`.

### Verification & Exit Criteria
- Each agent can be tested in isolation using mocked Kafka inputs.
- Investigation agent successfully identifies the root cause commit from mock log traces.

---

## Phase 4: BFF Layer & Multi-Stage HITL Approval Gates
> **Duration:** Days 14–17  
> **Objective:** Connect the operational console to Kafka via a secure BFF query and approval API.

### Deliverables
1. **BFF Query & Approval Endpoints (`adrit-bff`)**:
   - `GET /api/v1/incidents`: List active and resolved incidents.
   - `GET /api/v1/incidents/{id}`: Detailed incident telemetry, findings, and current stage.
   - `GET /api/v1/incidents/{id}/stream`: Server-Sent Events (SSE) streaming real-time stage transitions and agent activity to the UI.
   - `POST /api/v1/incidents/{id}/approve`: Submit operator approval with OIDC user identity and rationale.
2. **Multi-Stage HITL Approval Orchestration**:
   - Intercepts approval requirements at **Triage**, **Fixing**, and **Deploy** stages.
   - Validates operator OIDC token and writes `ApprovalGrantedEvent` to Kafka, allowing the waiting agent to proceed.
3. **Append-Only Audit Logger**:
   - Persists every agent prompt, tool response, approval action, and state change to PostgreSQL.

### Verification & Exit Criteria
- API integration test triggers an incident, verifies workflow halts at the Fixing stage, submits approval via `/approve`, and verifies workflow resumes.
- SSE stream receives real-time progress events as agents complete their stages.

---

## Phase 5: UI Integration & End-to-End Walkthrough
> **Duration:** Days 18–20  
> **Objective:** Connect `adrit-ui` (React + Vite) to the BFF API and run the complete Asha 5xx surge scenario.

### Deliverables
1. **Frontend Updates (`adrit-ui`)**:
   - Connect live SSE stream to stage progression visualizer (`Triage` $\rightarrow$ `Investigation` $\rightarrow$ `Fixing` $\rightarrow$ `Deploy` $\rightarrow$ `Notify`).
   - Interactive HITL Approval Modals for:
     - Stage 1: Ownership confirmation
     - Stage 3: Rollback PR review and approval
     - Stage 4: Production deployment sign-off
   - Real-time Audit Trail viewer showing append-only ledger entries.
2. **End-to-End Scenario Walkthrough (Checkout 5xx Surge)**:
   - Trigger synthetic Prometheus alert $\rightarrow$ Triage prompt appears in UI $\rightarrow$ Asha approves ownership $\rightarrow$ Investigation isolates commit $\rightarrow$ Fixing drafts revert PR $\rightarrow$ Asha approves patch $\rightarrow$ Deploy agent requests rollout authorization $\rightarrow$ Asha authorizes $\rightarrow$ ArgoCD rollback completes $\rightarrow$ Metrics verify recovery $\rightarrow$ Slack/Jira notified.

### Verification & Exit Criteria
- Full end-to-end incident resolved in under 2 minutes with human approvals captured at all 3 checkpoints.
- Complete audit trail visible in PostgreSQL and UI.
