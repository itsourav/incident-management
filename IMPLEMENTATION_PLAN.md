# Zero-Trust Agentic AI Ops — Phase-Wise Implementation Plan

This document outlines the step-by-step, incremental engineering roadmap for building **ADRIT (Agentic Incident Management)**. It connects the architecture defined in [PLAN.md](file:///Users/sourav/Documents/Development/Agent%20Development/Incident%20Management/PLAN.md) to a verified, testable implementation.

---

## Roadmap Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PHASE-WISE EXECUTION TIMELINE                                   │
├───────────────────┬───────────────────┬───────────────────┬──────────────────┬──────────────────┤
│      PHASE 0      │      PHASE 1      │      PHASE 2      │     PHASE 3      │     PHASE 4      │
│  Scaffolding &    │  Domain Core &    │   LLM Adapter &   │  GOAP Engine &   │   HITL Gate &    │
│  Local Mocks      │  Port Interfaces  │   MCP Zero-Trust  │  Multi-Persona   │   SSE Streaming  │
├───────────────────┴───────────────────┴───────────────────┴──────────────────┴──────────────────┤
│                                 PHASE 5                                  │       PHASE 6        │
│                         adrit-ui Live Integration                        │   Scenario E2E Tests │
└──────────────────────────────────────────────────────────────────────────┴──────────────────────┘
```

---

## Architectural Topology & Deployable Boundaries

The following diagram defines the **4 deployable backend services**, the synchronous execution perimeter, the dual-schema PostgreSQL persistence model, and the asynchronous Kafka event bus:

```mermaid
flowchart TB
    %% Styling Classes
    classDef uiStyle fill:#4f46e5,stroke:#3730a3,stroke-width:2px,color:#ffffff,font-weight:bold
    classDef coreStyle fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#ffffff
    classDef gatewayStyle fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#ffffff
    classDef hitlStyle fill:#1e293b,stroke:#ec4899,stroke-width:2px,color:#ffffff
    classDef toolingStyle fill:#1e293b,stroke:#10b981,stroke-width:2px,color:#ffffff
    classDef dbStyle fill:#0f172a,stroke:#64748b,stroke-width:2px,color:#94a3b8
    classDef busStyle fill:#083344,stroke:#06b6d4,stroke-width:2px,color:#67e8f9
    classDef extStyle fill:#18181b,stroke:#52525b,stroke-width:1px,color:#d4d4d8

    %% Top-Level User Interface
    UI["ADRIT UI (React 19 + Vite Operational Console)"]:::uiStyle

    %% ==========================================
    %% DEPLOYABLE 1: ADRIT-CORE
    %% ==========================================
    subgraph CoreService ["DEPLOYABLE 1: adrit-core (The Brain & Orchestrator)"]
        direction TB
        FSM["Lifecycle FSM (TRIAGE to NOTIFY)"]
        GOAP["GOAP Planning Engine"]
        BB["In-Memory Blackboard Projection"]
        AGENTS["Multi-Persona Reasoning (Senior SRE, RCA Specialist)"]
        ROUTER["adrit-llm (ModelRouter / LlmPort)"]
        AUDIT_MOD["Modular Audit Ledger (Isolated Java Module)"]
        SSE_CTRL["REST & SSE Stream Controllers"]
    end
    class CoreService coreStyle

    %% ==========================================
    %% DEPLOYABLE 2: ADRIT-MCP-GATEWAY
    %% ==========================================
    subgraph GatewayService ["DEPLOYABLE 2: adrit-mcp-gateway (Zero-Trust PEP)"]
        direction TB
        PEP["Policy Enforcement Point (PEP Proxy)"]
        RISK["Risk & Blast Radius Engine"]
        JIT["JIT Ephemeral Token Mint (5-min Scope)"]
        ATTEST["Anti-TOCTOU Attestation Verifier"]
    end
    class GatewayService gatewayStyle

    %% ==========================================
    %% DEPLOYABLE 3: ADRIT-HITL
    %% ==========================================
    subgraph HitlService ["DEPLOYABLE 3: adrit-hitl (Human Authorization)"]
        direction TB
        CANON["RFC 8785 Canonical JSON Hasher"]
        HITL_API["Approval Portal & Attestation API"]
        SLA["SLA Escalation Timer (5-min PagerDuty)"]
    end
    class HitlService hitlStyle

    %% ==========================================
    %% DEPLOYABLE 4: ADRIT-TOOLING
    %% ==========================================
    subgraph ToolingService ["DEPLOYABLE 4: adrit-tooling (MCP Server Suite)"]
        direction TB
        K8S_MCP["Kubernetes MCP Server"]
        ARGO_MCP["ArgoCD MCP Server"]
        GIT_MCP["GitHub / VCS MCP Server"]
        OBS_MCP["Observability MCP Server (Prometheus / Loki / Tempo)"]
    end
    class ToolingService toolingStyle

    %% ==========================================
    %% STORAGE & SUPPORTING INFRASTRUCTURE
    %% ==========================================
    subgraph StorageInfra ["PostgreSQL Database (Dual-Schema System of Record)"]
        direction LR
        PG_CORE[("Schema: core\n(Incidents, Facts, Evidence, Decisions)")]:::dbStyle
        PG_AUDIT[("Schema: audit\n(Monotonic SHA-256 Hash Chain)")]:::dbStyle
    end

    NEO4J[("Neo4j Graph DB\n(Service Topology)")]:::dbStyle
    OPA["Open Policy Agent (OPA)\n(Declarative Rego Rules)"]:::gatewayStyle
    LLM_EXT["LLM Provider Gateway\n(OpenRouter / Claude 3.7 / GPT-4o)"]:::extStyle

    %% ==========================================
    %% EVENT BUS
    %% ==========================================
    KAFKA{{"Kafka / Redpanda Event Bus (Durable Domain Event Transport)"}}:::busStyle

    %% ==========================================
    %% EXTERNAL PLATFORMS & ACTORS
    %% ==========================================
    EXT_OPS["External Cloud Systems (K8s, ArgoCD, GitHub, Telemetry)"]:::extStyle
    OPERATOR["Human On-Call Operator"]:::extStyle
    ALERTS["External Monitoring (Prometheus Alertmanager / PagerDuty)"]:::extStyle

    %% ==========================================
    %% SYNCHRONOUS CONNECTIONS (Solid Lines)
    %% ==========================================
    UI <-->|HTTP REST & SSE Stream| SSE_CTRL
    GOAP <-->|Reconstruct / Read / Write| BB
    BB <-->|Load & Project State| PG_CORE
    FSM -->|Goal Assignment| GOAP
    GOAP -->|Synthesize Reasoning| AGENTS
    AGENTS -->|completePrompt| ROUTER
    ROUTER <-->|HTTPS API| LLM_EXT
    AUDIT_MOD -->|Monotonic Hash Block Append| PG_AUDIT
    GOAP <-->|Cypher Topology Queries| NEO4J

    %% Zero-Trust Tool Egress (Sync)
    GOAP ==>|1. ProposedAction + EvidenceSet| PEP
    PEP <-->|2. Evaluate Rego Policy| OPA
    PEP -->|3. Evaluate Blast Radius| RISK

    %% Gateway branches (Sync)
    PEP -->|4a. Safe / Pre-authorized Tool Call with JIT Token| ToolingService
    PEP -->|4b. Destructive Action: Halt & Register Gate| HitlService
    ATTEST -->|Verify Re-hash of Proposal == Attestation Hash| PEP

    %% Tooling to External Systems (Sync)
    ToolingService <-->|Native APIs / SDKs| EXT_OPS

    %% HITL to Operator (Sync)
    HitlService <-->|OIDC Auth & Proposal Signing| OPERATOR

    %% ==========================================
    %% ASYNCHRONOUS EVENT CONNECTIONS (Dashed Lines)
    %% ==========================================
    ALERTS -.->|incident.alerts| KAFKA
    KAFKA -.->|Ingest Alert| CoreService
    CoreService -.->|incident.lifecycle & incident.evidence| KAFKA
    GatewayService -.->|incident.actions| KAFKA
    HitlService -.->|incident.hitl (ApprovalGranted)| KAFKA
    KAFKA -.->|Resume Workflow| CoreService
    KAFKA -.->|Stream Events| SSE_CTRL
```

---

## Phase 0: Scaffolding & Local Test Infrastructure
> **Duration:** Days 1–2  
> **Objective:** Zero external dependencies; establish project skeleton, compile-time architecture guardrails, and hermetic local container mocks.

### Deliverables
1. **Multi-Module Project Layout (`adrit-backend/`)**:
   - `adrit-domain`: Shared pure Java 21 library (models, records, enums, port interfaces — 0 framework deps).
   - `adrit-core` **[Deployable 1]**: Spring Boot WebFlux service hosting the GOAP Planning Engine, persistent Blackboard projection, Lifecycle FSM, Multi-Persona agents, REST/SSE streaming APIs, `adrit-llm` module, and `adrit-audit` module (backed by dedicated `audit` schema in PostgreSQL).
   - `adrit-mcp-gateway` **[Deployable 2]**: Spring Cloud Gateway / PEP reverse proxy, OPA policy evaluation client, ephemeral JIT token issuer, and Anti-TOCTOU attestation verifier.
   - `adrit-hitl` **[Deployable 3]**: Human approval management service, RFC 8785 canonical JSON hashing, approval records/API, and SLA escalation timers.
   - `adrit-tooling` **[Deployable 4]**: MCP Server suite wrapping external infrastructure (Kubernetes, ArgoCD, GitHub, Prometheus/Loki/Tempo, PagerDuty, Slack).
2. **ArchUnit Boundary Rules (`ArchitectureTest.java`)**:
   - `adrit-domain` must have zero dependencies on Spring, Jackson, or external libraries.
   - Domain classes must strictly be `record`, `enum`, or `RuntimeException`.
   - Outer layers can only communicate with the domain via Port interfaces.
   - **Hard Architectural Invariant (Zero Direct Tool Egress):** Neither `adrit-domain` nor `adrit-core` may directly reference or instantiate external tool SDKs (Kubernetes, GitHub, ArgoCD, Cloud APIs). All tool invocations must strictly route through the `McpGatewayClient` port to `adrit-mcp-gateway`.
   - **LLM Decoupling Invariant:** `adrit-core` and agents must interact with LLMs solely via `LlmPort` from `adrit-domain`, with zero compile-time references to provider SDKs (OpenRouter, OpenAI, or Spring AI packages).
   - **Audit Schema Boundary:** `adrit-audit` code inside `adrit-core` must operate exclusively against the `audit.*` PostgreSQL schema, maintaining complete database and code isolation so it can be extracted to a standalone service without refactoring.
3. **Local Docker Compose Stack (`adrit-service/docker/`)**:
   - **Neo4j:** Pre-seeded graph with services (`checkout-service`, `payment-gateway`, `cart-service`, `auth-service`, `orders-db`).
   - **WireMock Containers:** Stubs with canned JSON responses for:
     - ArgoCD API (revisions, sync status, rollback metadata)
     - PagerDuty API (schedules, incidents, notes)
     - Slack Webhook receiver
     - Jira REST API (ticket create/update)
     - GitHub API (commit inspection, PR creation)
   - **Kafka / Redpanda:** Local event broker pre-seeded with domain event topics (`incident.alerts`, `incident.lifecycle`, `incident.evidence`, `incident.actions`, `incident.hitl`, `incident.audit`). Architectural rule: Kafka is event transport only, never procedural workflow choreography.

### Verification & Exit Criteria
- `./gradlew check` or `mvn test` passes cleanly with ArchUnit boundary validation.
- `docker compose up -d` brings up all mock containers healthy with pre-seeded data.

---

## Phase 1: Pure Domain Model & Port Interfaces
> **Duration:** Days 3–5  
> **Objective:** Model the entire incident lifecycle in pure, immutable Java 21 without framework contamination.

### Deliverables
1. **Domain Models (`adrit-domain`)**:
   - Core records: `Incident`, `IncidentContext`, `AlertContext`, `BlastRadius`, `RemediationPlan`, `CanarySpec`.
   - **Evidence (first-class domain concept)** — every agent observation is a structured, typed, confidence-scored record with full provenance. Agents never pass around arbitrary strings:
     ```java
     public record Evidence(
         String evidenceId,            // "EV-182"
         EvidenceType type,            // METRIC_ANOMALY, LOG_PATTERN, TRACE_BOTTLENECK, DEPLOY_CORRELATION
         String source,                // "prometheus", "loki", "tempo", "argocd"
         Instant observedAt,           // when the observation was made
         String rawReference,          // link/ID to the raw data (query, trace ID, log line)
         String observation,           // human-readable extracted finding
         double confidence,            // 0.0 – 1.0
         String provenance             // which GOAP action produced this evidence
     ) {}
     ```
   - **Hypothesis** — LLM-generated candidate root causes backed by evidence:
     ```java
     public record Hypothesis(
         String hypothesisId,
         String description,            // "Regression in payment validation from commit abc123f"
         List<String> supportingEvidenceIds,
         double confidence,             // aggregated from supporting evidence
         HypothesisStatus status        // CANDIDATE, CONFIRMED, REJECTED
     ) {}
     ```
   - **ProposedAction & PolicyDecision (Separation of Decision vs. Execution Authority)**:
     ```java
     public record ProposedAction(
         String actionId,
         ActionType action,              // ROLLBACK, RESTART_POD, SCALE_UP, KILL_QUERY, CONFIG_PATCH
         Resource resource,              // e.g. Resource.k8s("checkout-service", "deployment")
         Environment environment,        // PROD, STAGING, DEV
         RiskLevel risk,                 // LOW, MEDIUM, HIGH, CRITICAL
         EvidenceSet evidence,           // required: supporting Evidence justifying this proposal
         Instant proposedAt
     ) {}

     public record PolicyDecision(
         Decision decision,              // ALLOW, DENY, HITL_REQUIRED
         List<String> reasons,
         boolean requiresApproval,
         Instant decidedAt
     ) {}

     public record ApprovalAttestation(
         String attestationId,
         String incidentId,
         String proposalId,
         String proposalHash,          // SHA-256 of RFC 8785 Canonical JSON
         String approverId,            // OIDC subject (e.g. "sre-lead@company.com") or public key thumbprint
         Instant approvedAt,
         Instant expiresAt,            // e.g. 15-minute validity window
         AttestationMode mode,         // OIDC_BEARER (Day 1 MVP) vs CRYPTOGRAPHIC_ED25519 (Hardened)
         String signatureAlgorithm,    // "OIDC_JWT" (MVP) or "Ed25519" (Hardened)
         String signature,             // OIDC JWT signature or Base64 Ed25519 signature
         String nonce                  // anti-replay nonce (used in Hardened mode)
     ) {}

     public record AuditEvent(
         String eventId,               // "AUD-00192"
         String incidentId,            // "INC-8821"
         long sequence,                // 1, 2, 3... (strictly monotonic per incident)
         Instant timestamp,            // ISO-8601 UTC
         String actor,                 // "SeniorSreAgent", "sre-lead@company.com", "McpGateway"
         ActorType actorType,          // AGENT, HUMAN_OPERATOR, SYSTEM, MCP_GATEWAY
         AuditEventType eventType,     // AGENT_PROMPT, LLM_RESPONSE, TOOL_REQUEST, TOOL_RESPONSE, POLICY_DECISION, HITL_APPROVAL
         Object payload,               // structured event details
         String payloadHash,           // SHA-256 of RFC 8785 Canonical JSON payload
         String previousHash,          // chainHash of sequence - 1 (or "GENESIS" for sequence == 1)
         String chainHash              // SHA-256 hash linking the block
     ) {}
     ```
   - **Formal reasoning chain:** `Evidence[]` → `Hypothesis` → `Supporting Evidence[]` → `Root Cause` → `ProposedAction` → `PolicyDecision` → `ApprovalAttestation` → `AuditEvent`. Every conclusion, proposal, and destructive execution is mathematically bound and audit-traceable.
   - Enums: `IncidentSeverity` (`P1`-`P5`), `ActionRisk`/`RiskLevel` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), `Decision` (`ALLOW`, `DENY`, `HITL_REQUIRED`), `Environment` (`PROD`, `STAGING`, `DEV`), `ActionType`, `EvidenceType`, `HypothesisStatus` (`CANDIDATE`, `CONFIRMED`, `REJECTED`), `GateStatus`, `FindingCategory`, `ModelPurpose` (`TRIAGE`, `INVESTIGATION`, `REMEDIATION`, `DEPLOY_SAFETY`, `SUMMARIZATION`, `EXTRACTION`), `AttestationMode` (`OIDC_BEARER`, `CRYPTOGRAPHIC_ED25519`), `ActorType` (`AGENT`, `HUMAN_OPERATOR`, `SYSTEM`, `MCP_GATEWAY`), `AuditEventType` (`AGENT_PROMPT`, `LLM_RESPONSE`, `TOOL_REQUEST`, `TOOL_RESPONSE`, `POLICY_DECISION`, `HITL_APPROVAL`).
   - Output reports: `TriageReport`, `TopologyAssessment`, `RollbackProposal`, `PostMortemDraft`.
2. **Port Interfaces (`adrit-domain/port`)**:
   - **LLM Reasoning Port:** `LlmPort` — pure domain abstraction separating reasoning from providers:
     ```java
     public interface LlmPort {
         CompletionResponse complete(PromptRequest request);
         <T> T completeStructured(PromptRequest request, Class<T> responseType);
     }
     ```
     The agent calls `llm.complete(PromptRequest.forPurpose(ModelPurpose.TRIAGE, ...))`. It specifies **semantic intent**, possessing zero awareness of OpenRouter, model IDs, or temperatures.
   - **Observability Ports:** `MetricsPort`, `LogPort`, `TracePort`.
   - **Topology & Infrastructure Ports:** `TopologyPort`, `DeploymentPort`, `VcsPort`.
   - **Operations & Alerting Ports:** `OnCallPort`, `TicketingPort`, `NotificationPort`.
3. **Mock Adapters & Shared Test Fixtures (`adrit-adapters`)**:
   - Implement WireMock-backed HTTP clients for each port.
   - Shared test fixture factories (`IncidentFixtures`, `EvidenceFixtures`, `MetricFixtures`, `TopologyFixtures`).

### Verification & Exit Criteria
- Unit tests verify all records and port contracts.
- Evidence records can be constructed, serialized, and deserialized with full provenance chain.
- Zero framework imports in `adrit-domain` verified by ArchUnit.

---

## Phase 2: LLM Adapter (`adrit-llm`), Zero-Trust Gateway (`adrit-mcp-gateway`), Tooling (`adrit-tooling`) & Modular Audit
> **Duration:** Days 6–9  
> **Objective:** Pluggable LLM provider integration, configuration-driven model routing, Zero-Trust MCP Gateway reverse proxy with JIT tokens, Tooling servers, and modular tamper-evident auditing.

### Deliverables
1. **Pluggable LLM Adapter Module (`adrit-llm`) & Configuration-Driven `ModelRouter`**:
   - Implements `LlmPort` from `adrit-domain` using Spring AI / OpenRouter HTTP client.
   - Decoupled from `adrit-core` GOAP orchestration:
     ```
     adrit-domain (LlmPort)
           ▲
           │ implements
     adrit-llm (ModelRouter ──► OpenRouter / Spring AI)
           ▲
           │ wired via Spring Boot configuration
     adrit-core (calls llm.complete(PromptRequest))
     ```
   - **Configuration-Driven `ModelRouter` (`@ConfigurationProperties("adrit.llm.models")`):**
     Model names are **never hardcoded into agents or personas**. Agents supply only a `ModelPurpose`, and `ModelRouter` resolves the provider, model string, and hyperparameters from `application.yml`:
     ```yaml
     adrit:
       llm:
         models:
           triage:
             provider: openrouter
             model: anthropic/claude-3.7-sonnet
             temperature: 0.1
           investigation:
             provider: openrouter
             model: anthropic/claude-3.7-sonnet
             temperature: 0.0
           remediation:
             provider: openrouter
             model: openai/gpt-4o
             temperature: 0.2
           deploy-safety:
             provider: openrouter
             model: openai/gpt-4o
             temperature: 0.0
           summarization:
             provider: openrouter
             model: meta-llama/llama-3.3-70b-instruct
             temperature: 0.3
     ```
   - **Evaluation & Benchmarking Agility:**
     Comparing frontier models (e.g., Claude 3.7 vs. DeepSeek R1 vs. GPT-4o for root cause accuracy) is an external profile override (`application-eval.yml`) with zero code modifications.
   - **Provider Agnostic:** Easily swappable with local models (Ollama/vLLM) or direct Azure OpenAI endpoints.
2. **MCP Gateway (`adrit-mcp-gateway` - Deployable 2) & Tooling Servers (`adrit-tooling` - Deployable 4)**:
   - **Hard Invariant:** The core agent NEVER calls external infrastructure directly (`Agent ──x──► Kubernetes/GitHub/ArgoCD`). All tool requests must traverse the gateway pipeline:
     ```
     adrit-core ──► ProposedAction ──► [AuthN ──► AuthZ ──► OPA Policy ──► Risk Engine ──► HITL Gate?] ──► adrit-tooling (MCP Server) ──► External System
     ```
   - **Stage 1 (AuthN):** Authenticate agent identity and validate token signature.
   - **Stage 2 (AuthZ):** Check stage-bound scopes (`mcp:metrics:read`, `mcp:vcs:write`).
   - **Stage 3 (OPA Policy Engine):** Evaluates declarative security rules against the `ProposedAction` (e.g., unconditionally block `k8s:deleteDeployment`).
   - **Stage 4 (Risk Engine):** Dynamically computes blast radius and assigns `RiskLevel` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
   - **Stage 5 (PolicyDecision Verdict)**:
     - `DENY`: Action blocked immediately with explicit reasons. Returns `PolicyDecision(DENY, reasons)` to `adrit-core` for replanning. Never reaches external systems.
     - `ALLOW`: Safe, pre-authorized action (read-only queries, staging fixes). Mints 5-minute JIT token and forwards to `adrit-tooling` MCP Server.
     - `HITL_REQUIRED`: Destructive or `HIGH`/`CRITICAL` risk action. Suspends pipeline and emits `HitlApprovalRequiredEvent` to `adrit-hitl` requiring cryptographic operator signature.
   - **JIT Ephemeral Token Scoping:** Tokens minted with narrow 5-minute validity per incident stage.
   - **Deployable 4 (`adrit-tooling`)**: Standard MCP server implementations exposing tools:
     - Kubernetes (`k8s.getPods`, `k8s.getEvents`, `k8s.getLogs`, `k8s.restartDeployment`)
     - ArgoCD (`argocd.getApplication`, `argocd.getRevisions`, `argocd.rollback`)
     - GitHub (`github.getDiff`, `github.getCommitLog`, `github.createRevertPr`)
     - Observability (`prometheus.queryRange`, `loki.queryLogs`, `tempo.getTrace`)
   - **ArchUnit Rule (`NoDirectExternalEgressTest.java`):** Test-time enforcement verifying that `adrit-core` has zero imports or runtime linkages to Kubernetes, GitHub, or ArgoCD client SDKs.
3. **Modular Append-Only SHA-256 Audit Ledger (`adrit-audit` inside `adrit-core` with dedicated schema)**:
   - Built as an internal module in `adrit-core` on Day 1 to avoid premature network hops, while operating against an isolated PostgreSQL schema (`audit.*`).
   - Every agent prompt, LLM response, MCP invocation, policy decision, and operator sign-off is committed as an immutable `AuditEvent`.
   - **Monotonically Increasing `sequence` per Incident:**
     - PostgreSQL sequence / atomic counter generates strictly sequential `sequence` numbers (1, 2, 3...) per `incidentId`.
     - Eliminates race conditions during parallel GOAP action execution, establishing total deterministic chronological ordering.
   - **Cryptographic Chaining Formula:**
     - Genesis event ($n=1$): `previousHash = "GENESIS"`.
     - For $n > 1$: $\text{chainHash}_n = \text{SHA-256}(\text{previousHash}_{n-1} + \text{sequence} + \text{timestamp} + \text{actor} + \text{eventType} + \text{payloadHash})$.
   - **Verification Endpoint (`GET /api/v1/audit/verify/{incidentId}`):**
     - Traverses sequence $1 \dots N$, validating sequence continuity ($\text{seq}_i == \text{seq}_{i-1} + 1$), hash link continuity ($\text{previousHash}_i == \text{chainHash}_{i-1}$), and payload integrity.

### Verification & Exit Criteria
- `NoDirectExternalEgressTest` ArchUnit test passes, proving `adrit-core` cannot bypass `adrit-mcp-gateway`.
- ArchUnit test asserts that `adrit-core` orchestration has 0 compile-time dependencies on `adrit-llm` provider packages (OpenRouter / Spring AI).
- Unit tests verify `LlmPort` implementation in `adrit-llm` routes prompts correctly and produces structured JSON responses.
- Automated integration test asserts that an unpermitted action (`k8s.deleteDeployment`) is rejected by `adrit-mcp-gateway` with a 403 `DENY`.
- Integration test verifies the 8-stage gate pipeline correctly routes read tools to `adrit-tooling`, blocks blacklisted actions, and halts for HITL on destructive actions.
- **Monotonic Sequence & Tamper Test:** Modifying any historical audit entry in the `audit` schema, altering sequence ordering, or dropping an event causes `/api/v1/audit/verify/{id}` to detect and flag hash chain corruption or missing sequence gap.

---

## Phase 3: Lifecycle State Machine, GOAP Planner & Multi-Persona Reasoning
> **Duration:** Days 10–14  
> **Objective:** Separate lifecycle state management from autonomous action planning; wire up the GOAP replanning loop and persona-driven LLM synthesis.

### Key Architectural Distinction
The 5 stages (`TRIAGE`, `INVESTIGATION`, `FIXING`, `DEPLOY`, `NOTIFY`) are **business lifecycle states** — they describe *where* the incident is. **GOAP is the decision-maker *within* each state** — it decides *what* actions to execute, evaluates whether the state's goal is satisfied, and replans if not.

```
Lifecycle FSM                              GOAP Planner (inside each state)
─────────────                              ─────────────────────────────────
TRIAGE ──► INVESTIGATION ──► FIXING ──►    For each state:
  DEPLOY ──► NOTIFY                          1. Receive goal (e.g., RootCauseIsolated)
                                             2. Inspect Blackboard for known facts
  FSM transitions ONLY when GOAP             3. Plan backward → select actions
  reports the current state's goal           4. Execute actions (parallel where safe)
  is satisfied.                              5. Write results to Blackboard
                                             6. Evaluate goal → satisfied? transition
                                                              → not yet? replan
```

### Deliverables
1. **Lifecycle State Machine (`LifecycleStateMachine`)**:
   - Simple deterministic FSM with states: `TRIAGE`, `INVESTIGATION`, `FIXING`, `DEPLOY`, `NOTIFY`, `RESOLVED`.
   - Transition guard: the FSM only advances when the `GoalEvaluator` reports the current state's GOAP goal is satisfied.
   - FSM state is **persisted** in PostgreSQL as part of `IncidentContext`; on restart, the FSM resumes from the persisted state.
   - Emits `LifecycleTransitionEvent` to Kafka on each state change.
2. **Persistent Incident Context & Reconstructable Blackboard**:
   - **PostgreSQL is the system of record.** The Blackboard is a fast, in-memory projection rebuilt from persisted state.
   - **`IncidentContext`** (root aggregate): lifecycle state, assigned owner, severity, timestamps, persisted in PostgreSQL.
   - **`Facts`**: Immutable observations (topology graphs, metric snapshots, log clusters, trace spans), stored as rows linked to the incident.
   - **`Evidence`**: Typed, confidence-scored findings derived from facts:
     ```java
     public record Evidence(
         String evidenceId,
         EvidenceType type,       // METRIC_ANOMALY, LOG_PATTERN, TRACE_BOTTLENECK, DEPLOY_CORRELATION
         String source,           // "prometheus", "loki", "tempo", "argocd"
         Instant observedAt,
         Object value,
         double confidence        // 0.0 – 1.0
     ) {}
     ```
   - **`Decisions`**: Operator approvals, GOAP action selections, LLM synthesis outputs.
   - **Crash Recovery:** On restart, `BlackboardRepository` loads `IncidentContext` + `Facts` + `Evidence` + `Decisions` from PostgreSQL, reconstructs the in-memory `Blackboard`, and the GOAP planner replans from the current goal with all prior evidence intact.
3. **GOAP Planner (`GoapPlanner`)**:
   - Each lifecycle state defines a **Goal** (e.g., `INVESTIGATION` → goal is `RootCauseIsolated`).
   - The planner inspects the Blackboard, plans backward from the goal, and selects actions:
     - `ParseAlertAction` → produces `AlertContext`
     - `QueryTopologyAction` → produces `TopologyGraph`
     - `FetchMetricsAction` → produces `MetricsSnapshot`
     - `FetchLogsAction` → produces `LogClusters`
     - `FetchTracesAction` → produces `TraceAnalysis`
     - `DraftRemediationAction` → produces `ProposedAction` (with justifying `EvidenceSet`)
   - **Zero Direct Execution:** Operational actions are emitted as `ProposedAction` records and dispatched through the MCP Gateway's policy pipeline.
   - After each action round, results and decisions are **persisted to PostgreSQL** and projected onto the Blackboard.
   - **Autonomous Replanning on `DENY`:** If the Policy Engine returns `PolicyDecision(DENY, reasons)` (e.g., production deployment freeze or blacklisted resource), the denial is written to the Blackboard as a `Decision` record. GOAP immediately replans an alternative mitigation strategy (e.g., scale out replicas instead of rollback).
   - **Internal Execution vs. Kafka Boundary:** GOAP plans, executes, and replans sub-actions entirely within the `adrit-core` process against the in-memory Blackboard and PostgreSQL state. Sub-actions are **never** choreographed across Kafka topics (topics like `investigate.step.1` are strictly banned). Kafka is purely an asynchronous transport for broadcasting factual domain events (`evidence.collected`, `action.proposed`, `incident.stage.changed`).
   - The `GoalEvaluator` checks if the goal is met:
     - **Satisfied** → signals the FSM to transition.
     - **Not satisfied** → GOAP replans and selects additional actions (e.g., fetches traces after logs alone proved insufficient).
4. **Multi-Persona LLM Synthesis & ModelPurpose Mapping**:
   - Personas are injected at the LLM *synthesis checkpoints* within GOAP actions — they determine **how** the LLM reasons about Blackboard evidence, not which actions to take.
   - Each persona calls `llm.complete(PromptRequest.forPurpose(purpose, ...))`. **Zero model strings or providers are hardcoded in agent prompts.**

   | Lifecycle State | GOAP Goal | Persona | ModelPurpose | LLM Task |
   |-----------------|-----------|---------|--------------|----------|
   | `TRIAGE` | `IncidentClassified` | Senior SRE | `TRIAGE` | Classify severity, estimate blast radius from initial signals |
   | `INVESTIGATION` | `RootCauseIsolated` | Topology & RCA Specialist | `INVESTIGATION` | Correlate topology + metrics + logs → single root cause |
   | `FIXING` | `RemediationFormulated` | Remediation Engineer | `REMEDIATION` | Draft minimal rollback PR or config patch |
   | `DEPLOY` | `RemediationApplied` | Release & Safety Controller | `DEPLOY_SAFETY` | Validate canary health, SLO burn rate |
   | `NOTIFY` | `StakeholdersInformed` | Incident Commander | `SUMMARIZATION` | Compile blameless post-mortem, Jira action items |

### Verification & Exit Criteria
- Lifecycle FSM transitions through all 5 states on mock data.
- GOAP planner demonstrates **replanning**: given insufficient initial evidence, it autonomously selects additional trace-fetching actions before satisfying `RootCauseIsolated`.
- **Crash recovery test**: Kill the Spring Boot process mid-`INVESTIGATION`, restart it, verify the Blackboard is reconstructed from PostgreSQL and GOAP resumes without re-executing completed actions.
- Each state produces a typed output report (e.g., `TriageReport`, `RemediationPlan`).

---

## Phase 4: HITL Approval Service (`adrit-hitl`), Anti-TOCTOU & SSE Streaming
> **Duration:** Days 15–18  
> **Objective:** Human-in-the-loop pause/resume gates with OIDC authentication, Canonical RFC 8785 proposal hashing, anti-TOCTOU verification, and real-time streaming.

### Deliverables
1. **Asynchronous HITL Approval Service (`adrit-hitl` - Deployable 3) & Canonical Payload Hashing**:
   - Triggered whenever the Policy Engine returns `PolicyDecision.decision == HITL_REQUIRED` (destructive actions, production rollbacks, traffic shifting).
   - Serializes `ProposedAction` using **Canonical JSON (RFC 8785)** for deterministic byte representation.
   - Computes `proposalHash = SHA-256(canonicalJsonBytes)`.
   - Suspends the pipeline and emits `HitlApprovalRequiredEvent` containing the `ProposedAction`, its `proposalHash`, justifying `EvidenceSet`, and `RiskLevel` to Kafka topic `incident.hitl.requests`.
2. **Two-Stage Attestation & Anti-TOCTOU Verification (`adrit-mcp-gateway` - Deployable 2)**:
   - **Day 1 MVP Mode (Zero Key Management Overhead):**
     - Relies on **OIDC User Authentication (JWT) + Canonical RFC 8785 Proposal Hash + Audit Entry**.
     - Operator signs off in UI using their authenticated OIDC session.
     - The MCP Gateway `AttestationVerifier`:
       1. Validates operator identity and role from OIDC JWT claims.
       2. Re-canonicalizes the submitted `ProposedAction` via RFC 8785 and re-computes `computedHash = SHA-256(...)`.
       3. **Asserts Hash Match:** `computedHash == attestation.proposalHash()` (immediately stops TOCTOU tampering if payload was altered after approval).
       4. Records immutable entry in `adrit-audit`.
     - **No PKI / Key Distribution on Day 1:** Developers and operators don't need to generate, manage, or register Ed25519 keypairs during MVP development.
   - **Hardened Mode (Ready by Design, Hardened in Phase 6):**
     - Full asymmetric Ed25519 signature + anti-replay nonce + operator public key directory verification.
3. **SLA Timeout Escalation Timer (`adrit-hitl`)**:
   - Configurable timeout (default: 5 minutes).
   - If no human responds within the SLA window, triggers automated secondary on-call escalation via PagerDuty.
4. **Server-Sent Events (SSE) Streaming Controller (`adrit-core`)**:
   - Endpoint: `GET /api/v1/incidents/{id}/stream`.
   - Streams real-time pipeline status, agent thought logs, MCP tool results, and HITL interrupt events to subscribed web clients.

### Verification & Exit Criteria
- Automated integration test triggers an incident, verifies the workflow halts at the `fixing` stage, and verifies execution resumes only when a valid approval payload is posted to `/api/v1/incidents/{id}/approve`.
- **Anti-TOCTOU Tamper Test:** Modifying any parameter (e.g. image tag, service name, replica count) of an approved `ProposedAction` before submitting to MCP Gateway causes hash mismatch and triggers an immediate `403 FORBIDDEN: payload_tampered`.

---

## Phase 5: Frontend Integration & Live Operational Mode (`adrit-ui`)
> **Duration:** Days 19–21  
> **Objective:** Connect the React frontend to the Spring Boot backend with full live-streaming parity.

### Deliverables
1. **Dual-Mode Switcher in `adrit-ui`**:
   - TopBar toggle: **Simulation Mode** (in-browser mock engine) vs. **Live Backend Mode** (HTTP/SSE).
2. **SSE Streaming Ingress**:
   - Connect `Pipeline.jsx`, `MCPGatewayPanel.jsx`, and `AuditTrail.jsx` to `/api/v1/incidents/{id}/stream`.
   - Real-time animated stage progression driven by actual backend events.
3. **Interactive HITL Signing Modal**:
   - Update `HITLModal.jsx` to display live blast-radius risks from the backend.
   - Clicking "Approve" generates and posts the operator's cryptographic approval signature to `/api/v1/incidents/{id}/approve`.
4. **Real-Time Topology Graph Rendering**:
   - Update `ServiceTopology.jsx` to render live node status directly from the backend's Neo4j query results.

### Verification & Exit Criteria
- An operator can trigger an incident in `adrit-ui`, watch live agent reasoning, review the blast radius, approve the HITL gate in the modal, and observe ArgoCD canary deployment completion.

---

## Phase 6: Scenario Validation, Failure Injections & Hardening
> **Duration:** Days 22–25  
> **Objective:** Rigorous end-to-end validation across the 3 core business scenarios and chaos edge cases.

### Deliverables
1. **End-to-End Scenario Test Suite**:
   - **Scenario 1 (Checkout 5xx Spike):** Prometheus alert $\rightarrow$ Neo4j payment root cause $\rightarrow$ Rollback PR $\rightarrow$ Canary traffic shift $\rightarrow$ Slack/Jira notification.
   - **Scenario 2 (Auth Memory Leak):** OOMKilled events $\rightarrow$ JVM heap saturation diagnosis $\rightarrow$ Config patch PR approval $\rightarrow$ Pod restart stabilization.
   - **Scenario 3 (DB Pool Exhaustion):** HikariCP saturation $\rightarrow$ Jaeger slow-query trace detection $\rightarrow$ Query kill approval $\rightarrow$ Pool connection recovery.
2. **Chaos & Failure Injections**:
   - *LLM Timeout / 503:* OpenRouter retry with exponential backoff and failover model.
   - *Operator Rejection:* Operator clicks "Reject" at the HITL modal; agent gracefully halts and escalates to human commander.
   - *Expired Token Injection:* Verify gateway immediately returns 401/403 when using expired JIT token.
3. **Production Polish & Cryptographic Hardening**:
   - **Hardened Attestation Mode:** Activates asymmetric Ed25519 signing over `proposalHash + nonce + timestamp` for environments requiring mathematical non-repudiation beyond OIDC tokens.
   - Health check endpoints (`/actuator/health`).
   - Micrometer metrics tracking MTTR and agent execution latency.
   - One-command launcher: `make run-stack` (starts WireMock, Neo4j, backend, and UI).

---

## Summary Matrix

| Phase | Core Deliverable | Primary Tech Stack | Key Test Gate |
|---|---|---|---|
| **Phase 0** | Project Scaffolding & Mocks | 4 Deployables (`adrit-core`, `adrit-mcp-gateway`, `adrit-hitl`, `adrit-tooling`) + `adrit-domain`, Docker Compose | ArchUnit boundaries pass; containers healthy |
| **Phase 1** | Pure Domain Models & Ports | Java 21 Records, `LlmPort` & Port Interfaces (`adrit-domain`) | 100% domain purity; unit fixtures pass |
| **Phase 2** | Gateway, Tooling & Modular Audit | `adrit-mcp-gateway`, `adrit-tooling`, `adrit-llm`, OPA, Modular `adrit-audit` (dedicated schema) | ArchUnit blocks direct egress & LLM leakage; deleteDeployment denied (403); monotonic audit chain verified |
| **Phase 3** | Core FSM + GOAP Planner + Personas | `adrit-core`, `LifecycleStateMachine`, `GoapPlanner`, `Blackboard` | FSM transitions all states; GOAP replanning on DENY and insufficient evidence |
| **Phase 4** | HITL Service & Anti-TOCTOU (MVP) | `adrit-hitl`, RFC 8785 Canonical JSON, OIDC JWT, WebFlux SSE | Pipeline halts for approval; anti-TOCTOU test proves modified proposals fail hash verification |
| **Phase 5** | Frontend Live Integration | React 19, EventSource SSE, `adrit-ui` | UI streams live backend events & approves gates |
| **Phase 6** | E2E Scenarios & Ed25519 Hardening | Testcontainers, Chaos Injections, Ed25519, Actuator | All 3 scenarios pass; Ed25519 cryptographic non-repudiation verified |
