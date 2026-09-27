# Zero-Trust Agentic AI Ops — Implementation Roadmap

> A streamlined, incremental engineering plan to implement the **Infra-Agnostic Intelligent Ops Framework** described in [PLAN.md](PLAN.md).  
> Built with standard **Spring Boot MVC (layered: controller, service, dao, model, config)** and **Embabel (GOAP)**.

---

## Roadmap Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PHASE-WISE EXECUTION TIMELINE                                   │
├───────────────────┬───────────────────┬───────────────────┬──────────────────┬──────────────────┤
│      PHASE 0      │      PHASE 1      │      PHASE 2      │     PHASE 3      │     PHASE 4      │
│  Scaffolding &    │  Models, DAO &    │   MCP Gateway &   │  Embabel GOAP    │   BFF Layer &    │
│  Containers       │  Kafka Topics     │   Tool Security   │  Agents Pipeline │   HITL Gates     │
├───────────────────┴───────────────────┴───────────────────┴──────────────────┴──────────────────┤
│                                 PHASE 5                                                         │
│                adrit-ui Integration & End-to-End Incident Walkthrough                          │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Scaffolding, Standard Layered Structure & Infrastructure
> **Duration:** Days 1–2  
> **Objective:** Establish the 3 standard Spring Boot MVC microservices and hermetic local container infrastructure.

### Deliverables
1. **Docker Compose Environment (`docker/docker-compose.yml`)**:
   - **Apache Kafka / Redpanda**: Local broker with pre-configured incident topics.
   - **PostgreSQL**: Relational schema for incidents, approvals, and append-only audit trail.
   - **Neo4j**: Pre-seeded with service dependency graph (`checkout-service` $\rightarrow$ `payment-gateway` $\rightarrow$ `orders-db`).
   - **Jaeger**: Distributed tracing backend capturing end-to-end spans.
   - **WireMock Containers**: Canned API stubs for GitHub, ArgoCD, PagerDuty, and Slack.
2. **Standard Layered Microservices Layout**:
   - `adrit-bff` (Spring Boot MVC):
     - `controller/`, `service/`, `dao/`, `model/`, `config/`
   - `adrit-agents` (Spring Boot + Embabel GOAP):
     - `consumer/`, `embabel/`, `service/`, `client/`, `model/`, `config/`
   - `adrit-mcp-gateway` (Spring Boot Gateway):
     - `controller/`, `filter/`, `service/`, `tools/`, `model/`, `config/`
   - `adrit-ui` (React 19 + Vite):
     - Ops console dashboard and interactive HITL modals.

### Verification & Exit Criteria
- `docker compose up -d` starts Kafka, Postgres, Neo4j, Jaeger, and WireMock healthy.
- All 3 Spring Boot applications build and start cleanly with standard Tomcat servlet containers.

---

## Phase 1: Models, DAO Layer & Kafka Topic Schemas
> **Duration:** Days 3–5  
> **Objective:** Implement data access objects, JPA entities/repositories, and Kafka serialization contracts.

### Deliverables
1. **Domain Models & Entities**:
   - `IncidentEntity`: Stores incident ID, title, status, severity, timestamps, and current stage.
   - `ApprovalRecord`: Approver identity (OIDC subject), stage, action, timestamp, decision rationale.
   - `AuditEntry`: Monotonic sequence, timestamp, actor, event type, raw payload, status.
2. **DAO / Repository Layer (`dao/`)**:
   - `IncidentDao` (Spring Data JPA / JDBC): CRUD for active incidents and status updates.
   - `AuditDao`: Append-only queries and inserts for compliance audit logs.
3. **Kafka Event Topic Schemas**:
   - `incident.alerts`: Raw normalized incoming alerts.
   - `incident.triaged`: Emitted by Triage Agent after classification.
   - `incident.investigated`: Emitted by Investigation Agent with root-cause finding.
   - `incident.fix_proposed`: Emitted by Fixing Agent with hotfix/rollback plan.
   - `incident.deployed`: Emitted by Deploy Agent after canary verification.
   - `incident.closed`: Emitted by Release Agent after notification dispatch.
   - `incident.hitl`: Approval request and approval grant events.

### Verification & Exit Criteria
- Unit tests verify serialization/deserialization across all Kafka event records.
- Integration test persists an `IncidentEntity` and verifies append-only audit trail logging.

---

## Phase 2: Zero-Trust MCP Gateway & Tool Security
> **Duration:** Days 6–8  
> **Objective:** Build the secure tool execution layer with token scoping, deny-lists, and dynamic secret injection.

### Deliverables
1. **MCP Gateway Core (`adrit-mcp-gateway`)**:
   - `ToolExecutionController`: Exposes JSON-RPC / REST endpoint for tool execution.
   - `TokenScopeFilter`: Validates short-lived JWT passed by agents, asserting required scopes:
     - `mcp:vcs:read` / `mcp:vcs:write`
     - `mcp:k8s:read` / `mcp:k8s:write`
     - `mcp:cicd:deploy`
   - `DenyListSecurityFilter`: Enforces hard safety boundaries (blocks destructive operations like `k8s:deleteDeployment` or dropping database tables).
   - `VaultSecretService`: Retrieves short-lived cluster/repo credentials dynamically from secret manager.
2. **Tool Implementations (`tools/`)**:
   - `GitHubTool`: Fetches commit diffs and creates rollback pull requests.
   - `ArgoCdTool`: Triggers rollbacks and monitors sync status.
   - `ObservabilityTool`: Queries Prometheus metrics and recent Loki logs.
   - `KubernetesTool`: Fetches pod status, logs, and restarts deployments.

### Verification & Exit Criteria
- Integration test verifies that a permitted tool call (`getLogs`) succeeds with a valid JWT token.
- Integration test verifies that a blacklisted action (`deleteDeployment`) is rejected with HTTP 403 `DENIED`.

---

## Phase 3: Embabel (GOAP) Agents & Kafka Pipeline
> **Duration:** Days 9–13  
> **Objective:** Implement the 5 specialized agents using Embabel's Goal-Oriented Action Planning and Spring AI model routing.

### Deliverables
1. **Alert Normalizer**:
   - Ingests raw webhook alerts, cleans payload, publishes to `incident.alerts`.
2. **Triage Agent (`TriageAgent`)**:
   - Consumes `incident.alerts`.
   - Embabel Goal: `IncidentClassifiedAndOwned`.
   - Uses lightweight model (Llama 3 / Claude 3.5 Haiku) for rapid classification.
   - If P1 or ownership is ambiguous $\rightarrow$ halts and emits `ApprovalRequested(Stage.TRIAGE)`.
3. **Investigation Agent (`InvestigationAgent`)**:
   - Consumes `incident.triaged`.
   - Embabel Goal: `RootCauseCommitIdentified`.
   - Queries Neo4j service dependency graph for blast-radius analysis.
   - Queries recent logs via MCP Gateway.
   - Uses frontier model (Claude 3.7 Sonnet / GPT-4o) to isolate root-cause commit.
   - Emits `incident.investigated`.
4. **Fixing Agent (`FixingAgent`)**:
   - Consumes `incident.investigated`.
   - Embabel Goal: `RollbackPrFormulated`.
   - Drafts rollback PR via `GitHubTool` in MCP Gateway.
   - Flags conditional approval gate for production changes $\rightarrow$ emits `ApprovalRequested(Stage.FIXING)`.
5. **Deploy / Validation Agent (`DeployAgent`)**:
   - Consumes `incident.fix_approved`.
   - Embabel Goal: `ProductionHealthVerified`.
   - Requires mandatory production approval $\rightarrow$ emits `ApprovalRequested(Stage.DEPLOY)`.
   - Once authorized, triggers ArgoCD rollback via `ArgoCdTool`.
   - Polls Prometheus metrics to confirm error rate has normalized.
   - Emits `incident.deployed`.
6. **Release / Notify Agent (`ReleaseAgent`)**:
   - Consumes `incident.deployed`.
   - Embabel Goal: `StakeholdersInformed`.
   - Outbound-only: updates Jira ticket status, posts resolution summary to Slack, and resolves PagerDuty incident.
   - Emits `incident.closed`.

### Verification & Exit Criteria
- Each agent can be tested in isolation using mocked Kafka inputs.
- Embabel planner successfully backward-plans from goal to tool execution and produces expected findings.

---

## Phase 4: BFF Layer & Multi-Stage HITL Approval Gates
> **Duration:** Days 14–17  
> **Objective:** Connect the operational console to Kafka via a secure Spring MVC BFF query and approval API.

### Deliverables
1. **BFF Controllers (`adrit-bff/controller`)**:
   - `IncidentController`:
     - `GET /api/v1/incidents`: List active and resolved incidents.
     - `GET /api/v1/incidents/{id}`: Detailed incident telemetry, findings, and current stage.
   - `SseController`:
     - `GET /api/v1/incidents/{id}/stream`: Standard `SseEmitter` streaming real-time stage transitions and agent activity to the UI.
   - `ApprovalController`:
     - `POST /api/v1/incidents/{id}/approve`: Submit operator approval with OIDC user identity and rationale.
2. **Multi-Stage HITL Approval Orchestration**:
   - Intercepts approval requirements at **Triage**, **Fixing**, and **Deploy** stages.
   - Validates operator OIDC token and writes `ApprovalGrantedEvent` to Kafka, allowing the waiting agent to proceed.
3. **Jaeger Tracing Integration**:
   - Injects OpenTelemetry / Jaeger trace headers across Kafka messages and HTTP calls for distributed execution visibility.

### Verification & Exit Criteria
- API integration test triggers an incident, verifies workflow halts at the Fixing stage, submits approval via `/approve`, and verifies workflow resumes.
- `SseEmitter` delivers real-time progress events as agents complete their stages.

---

## Phase 5: UI Integration & End-to-End Walkthrough
> **Duration:** Days 18–20  
> **Objective:** Connect `adrit-ui` (React + Vite) to the BFF API and execute the complete Asha 5xx surge scenario.

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
- Complete audit trail visible in PostgreSQL and UI; distributed trace visible in Jaeger.
