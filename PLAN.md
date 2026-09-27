# Zero-Trust Agentic AI Ops — Incident Management

## Project Structure

```
Incident Management/
├── PLAN.md                     ← Architecture & specifications
├── IMPLEMENTATION_PLAN.md      ← Step-by-step 6-phase engineering roadmap
├── adrit-ui/                   ← React + Vite frontend (interactive simulation & live dashboard)
└── adrit-backend/              ← Multi-module Java 21 / Spring Boot repository
    ├── adrit-domain/           ← Shared pure domain library (records, enums, ports — 0 framework deps)
    │
    ├── [DEPLOYABLE 1] adrit-core/
    │   ├── GOAP Planner & in-memory Blackboard projection
    │   ├── Multi-Persona Agent Reasoning (Senior SRE, RCA Specialist, etc.)
    │   ├── Lifecycle FSM (TRIAGE → INVESTIGATION → FIXING → DEPLOY → NOTIFY)
    │   ├── REST & Server-Sent Events (SSE) streaming API
    │   ├── adrit-llm (LlmPort adapter for OpenRouter / Spring AI with ModelRouter)
    │   └── adrit-audit (Module inside core for Day 1; dedicated PostgreSQL "audit" schema)
    │
    ├── [DEPLOYABLE 2] adrit-mcp-gateway/
    │   ├── Policy Enforcement Point (PEP) reverse proxy
    │   ├── OPA Policy Client & Rego rule evaluation (block deleteDeployment)
    │   ├── Ephemeral JIT token minting & stage-scoped validation
    │   └── Anti-TOCTOU Attestation Verification
    │
    ├── [DEPLOYABLE 3] adrit-hitl/
    │   ├── Human-in-the-Loop Approval Management API
    │   ├── RFC 8785 Canonical JSON hashing & proposal store
    │   ├── Operator authentication & sign-off processing
    │   └── SLA timeout escalation timer (PagerDuty integration)
    │
    ├── [DEPLOYABLE 4] adrit-tooling/
    │   ├── Kubernetes MCP Server (pods, deployments, events, logs)
    │   ├── ArgoCD MCP Server (application sync, rollback, revisions)
    │   ├── GitHub / VCS MCP Server (diffs, commit history, revert PRs)
    │   ├── Observability MCP Servers (Prometheus metrics, Loki logs, Tempo traces)
    │   └── PagerDuty / Slack MCP Servers
    │
    ├── docker/                 ← Docker Compose & WireMock stubs for local testing
    └── pom.xml / settings.gradle.kts
```

---

## 1. adrit-ui — Frontend (Simulation & Operational Console)

Interactive web-based console providing both simulated walkthroughs and live operational control for the Zero-Trust Agentic incident lifecycle.

### Key Capabilities
1. **Pipeline Visualizer** — Live 5-stage flow: `Triage` → `Investigate` → `Fix` → `Deploy` → `Notify`
2. **HITL Approval Gates** — Interactive modals pausing execution with risk blast-radius details and cryptographic sign-off
3. **MCP Gateway Panel** — Visualizes JIT-scoped tool access with real-time `ALLOW` / `DENY` verdicts
4. **Audit Trail** — Tamper-evident, filterable, hash-linked append-only log viewer
5. **Kafka Event Bus Stream** — Real-time topic visualization (`incident.alerts`, `incident.mcp.events`, `incident.hitl`)
6. **Service Topology Graph** — Visual blast-radius mapping powered by Neo4j graph data

### Running the Frontend
```bash
cd adrit-ui
npm install
npm run dev
```

## 2. adrit-backend — 4 Deployable Services & Architecture

The backend implements a **Zero-Trust, Goal-Oriented, Hexagonal Architecture** designed for high-stakes enterprise incident response.

### 2.0 Deployment Topology (Day 1 Working Version vs. Target Evolution)

ADRIT starts with **4 primary deployable services** for the first working version, backed by essential infrastructure:

```
                 ┌──────────────┐
                 │   ADRIT UI   │
                 └──────┬───────┘
                        │ HTTP / SSE
                 ┌──────▼───────┐
                 │  ADRIT CORE  │
                 │              │
                 │ GOAP Planner │
                 │ Agent Personas│
                 │ Blackboard   │
                 │ Incident FSM │
                 │ [Audit Mod.] │  (isolated schema: audit.*)
                 └──────┬───────┘
                        │ Tool Requests (ProposedAction)
                 ┌──────▼───────┐
                 │ MCP GATEWAY  │
                 │              │
                 │ Policy (OPA) │
                 │ JIT Token    │
                 │ Authorization│
                 └──────┬───────┘
                        │
          ┌─────────────┼──────────────┐
          │             │              │
          ▼             ▼              ▼
    adrit-tooling   adrit-hitl       Audit
    (MCP Servers)  (Human Appr.)   (PostgreSQL)
          │             │              │
          ▼             ▼              ▼
      External        Human        Dedicated
       Systems       Operator        Schema
```

#### The 4 Deployables (Working Version):
1. **`adrit-core`** (Brain & Orchestration):
   - Houses the GOAP Planning Engine, Agent Personas, Blackboard state projection, Incident Lifecycle FSM, and REST / SSE streaming endpoints.
   - Includes `adrit-llm` (pluggable `LlmPort` implementation for OpenRouter / Spring AI with semantic `ModelRouter`).
   - **Pragmatic Modular Audit (Day 1):** The audit ledger initially lives inside `adrit-core` as an isolated module, maintaining its own dedicated database schema (`audit.*`) in PostgreSQL. This eliminates unnecessary microservice network hops and operational overhead on Day 1 while keeping data schemas and domain boundaries strictly decoupled.
2. **`adrit-mcp-gateway`** (Policy & Execution Perimeter):
   - Zero-Trust reverse tool proxy and Policy Enforcement Point (PEP).
   - Enforces OPA declarative policies, risk scoring, stage-scoped ephemeral JIT token issuance, and anti-TOCTOU proposal hash verification.
3. **`adrit-hitl`** (Human Authorization & Attestation):
   - Human-in-the-loop approval management service, proposal canonicalization & hashing (RFC 8785), approval records/API, and SLA escalation timers.
4. **`adrit-tooling`** (Tooling & Infrastructure Adapters):
   - MCP Server wrappers exposing standard Model Context Protocol tools for Kubernetes, ArgoCD, GitHub, Prometheus, Loki, Tempo, and PagerDuty.

#### Supporting Infrastructure:
- **`adrit-ui`**: React 19 + Vite operational console and live simulation dashboard.
- **`Kafka / Redpanda`**: Durable event transport for domain occurrences (`incident.alerts`, `incident.actions`, `incident.hitl`).
- **`PostgreSQL`**: Source of truth with separated schemas (`core` for incident context/blackboard facts, `audit` for immutable hash-chained audit events).
- **`Neo4j`**: Service topology graph database for blast-radius calculations.
- **`Open Policy Agent (OPA)`**: Declarative Rego policy evaluation engine.

#### Evolution Path:
As traffic and operational scaling demand, `adrit-audit` cleanly extracts from `adrit-core` into an independent microservice subscribe-streaming from Kafka or downstream of `adrit-mcp-gateway`, without altering the PostgreSQL audit schema, event contracts, or verification algorithms.

### 2.1 Core Architectural Principles

1. **Hexagonal Architecture (Ports & Adapters) Enforced by ArchUnit**
   - The `adrit-domain` module contains zero framework annotations (no Spring, no Jackson, no JPA).
   - Domain models are strictly immutable Java 21 `record`s and `enum`s.
   - All external systems (monitoring, VCS, cloud, alerting, and **LLM inference via `LlmPort`**) are accessed strictly through Port interfaces.
   - The agent and orchestrator invoke `llmPort.complete(...)` or `llmPort.completeStructured(...)` — they have zero compile-time awareness of OpenRouter, OpenAI, or Spring AI.
   - The dedicated `adrit-llm` module implements `LlmPort` with pluggable providers (OpenRouter, Spring AI, local models).
   - ArchUnit unit tests fail the build if any outer layer or provider dependency leaks into `adrit-domain` or `adrit-orchestrator`.

2. **Lifecycle State Machine + GOAP Planner (Two Separate Concerns)**

   The architecture cleanly separates **where** the incident is from **what** to do about it:

   - **Lifecycle State Machine** — A simple, deterministic finite state machine managing the business lifecycle of an incident through 5 states:
     ```
     TRIAGE → INVESTIGATION → FIXING → DEPLOY → NOTIFY
     ```
     These are **business states**, not execution steps. The state machine only manages transitions (e.g., "move from INVESTIGATION to FIXING when the GOAP engine reports the `RootCauseIsolated` goal is satisfied").

   - **GOAP Planner (the Decision-Maker)** — Operates *inside* each lifecycle state as the autonomous planning engine. For each state, the planner:
     1. Receives a **Goal** from the lifecycle state (e.g., in `INVESTIGATION` the goal is `RootCauseIsolated`).
     2. Inspects the **Blackboard** (shared evidence store) to determine what facts are already known.
     3. **Plans backward** from the goal to determine which actions are needed.
     4. Executes actions in parallel where possible (e.g., `QueryTopology`, `GetLogs`, `GetMetrics` run concurrently).
     5. Writes results to the Blackboard.
     6. **Evaluates** whether the goal is now satisfied.
     7. If **yes** → signals the lifecycle state machine to transition to the next state.
     8. If **no** → **replans** and selects additional actions (e.g., fetches traces after logs proved insufficient).

   ```
                    Incident
                       │
                       ▼
              ┌────────────────┐
              │ Lifecycle FSM  │    (business states: TRIAGE, INVESTIGATION, ...)
              └───────┬────────┘
                      │ current state goal
                      ▼
               ┌─────────────┐
               │ GOAP Planner│    (autonomous decision-maker)
               └──────┬──────┘
                      │ backward plan from goal
            ┌─────────┼─────────┐
            ▼         ▼         ▼
      QueryTopology  GetLogs  GetMetrics    (parallel actions)
            │         │         │
            └─────────┼─────────┘
                      ▼
                 Blackboard     (in-memory projection)
                      │
                      ▼
               Evaluate Goal
                 │         │
              enough?     no
                 │         │
                yes       replan ──► execute more actions
                 │
                 ▼
          Goal Satisfied → FSM transitions to next state
   ```

   - **Why this matters:** Free-form ReAct loops are avoided — the planner has a bounded goal and a finite action space. But unlike a rigid pipeline, GOAP can adapt mid-state (e.g., if topology queries reveal an unexpected dependency, it autonomously fetches additional traces without being told to).

3. **Evidence as a First-Class Domain Concept**

   Agents never pass around arbitrary strings like `"Payment service looks healthy."` Every observation produced by the system is a structured, typed, confidence-scored **`Evidence`** record with full provenance:

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

   Example:
   ```json
   {
     "evidenceId": "EV-182",
     "type": "DEPLOY_CORRELATION",
     "source": "argocd",
     "observedAt": "2026-09-27T14:31:00Z",
     "rawReference": "argocd://checkout-service/revisions/abc123f",
     "observation": "checkout-service v1.42 deployed 12min before 5xx spike",
     "confidence": 0.92,
     "provenance": "QueryDeployHistoryAction"
   }
   ```

   **Formal Reasoning Chain (Evidence → Hypothesis → Root Cause):**
   ```
   Incident
      │
      ▼
   Evidence[]                  (structured observations from GOAP actions)
      │
      ▼
   Hypothesis                  (LLM-generated candidate cause + supporting evidence IDs)
      │
      ▼
   Supporting Evidence[]       (subset of Evidence[] that supports this hypothesis)
      │
      ▼
   Confidence Score            (aggregate confidence from supporting evidence)
      │
      ▼
   Root Cause                  (highest-confidence hypothesis promoted to root cause)
   ```

   ```java
   public record Hypothesis(
       String hypothesisId,
       String description,            // "Regression in payment validation from commit abc123f"
       List<String> supportingEvidenceIds,
       double confidence,             // aggregated from supporting evidence
       HypothesisStatus status        // CANDIDATE, CONFIRMED, REJECTED
   ) {}
   ```

   This makes the system **dramatically easier to evaluate**: every root cause conclusion is traceable back through a chain of typed, timestamped, confidence-scored evidence — not opaque LLM prose.

4. **Persistent Incident Context & Reconstructable Blackboard**

   The Blackboard is **not** the system of record. PostgreSQL is. The Blackboard is a fast, in-memory projection that can be rebuilt from persisted state at any time.

   ```
                  PostgreSQL
               (system of record)
                      │
                      ▼
               IncidentContext
                      │
          ┌───────────┼────────────────────────┐
          ▼           ▼            ▼            ▼
        Facts      Evidence    Hypotheses   Decisions
          │           │            │            │
          └───────────┼────────────┼────────────┘
                      │ load & project
                      ▼
             Blackboard (in-memory)
   ```

   - **`IncidentContext`**: Root aggregate — lifecycle state, assigned owner, severity, timestamps.
   - **`Facts`**: Immutable raw observations (topology graphs, metric snapshots, log clusters, trace spans).
   - **`Evidence`**: First-class typed records with confidence scores and provenance (see above).
   - **`Hypotheses`**: LLM-generated candidate root causes, each linked to supporting `Evidence` IDs.
   - **`Decisions`**: Operator approvals, GOAP action selections, LLM synthesis outputs.

   **Crash Recovery Flow:**
   ```
   Agent crashes / pod killed
        ↓
   Spring Boot restarts
        ↓
   Load IncidentContext from PostgreSQL
        ↓
   Rebuild Blackboard (Facts + Evidence + Hypotheses + Decisions)
        ↓
   Restore Lifecycle FSM to persisted state
        ↓
   GOAP replans from current goal + existing Blackboard
        ↓
   Continue incident response (no data lost)
   ```

   This makes the platform resilient to pod evictions, OOM kills, rolling deployments, and multi-replica failover — essential for a system that operates during the most critical moments of an outage.

5. **Zero-Trust MCP Gateway & Hard Architectural Invariant (Zero Direct Tool Egress)**
   
   **The agent should never directly touch infrastructure.** The agent must NEVER perform direct communication with external tools or operational platforms:
   ```
   Agent ──x──► Kubernetes
   Agent ──x──► GitHub
   Agent ──x──► ArgoCD
   ```
   Instead, every operational action must strictly traverse the **8-Stage MCP Gateway Pipeline**:
   ```
   Agent
     │ (Tool Request)
     ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │                       ADRIT MCP GATEWAY                          │
   │ 1. Authentication (AuthN)   ── Verify Agent Identity & Token      │
   │ 2. Authorization (AuthZ)    ── Check Stage Scopes (e.g. read/write)│
   │ 3. Policy Enforcement (PDP) ── OPA/Cedar rules (block deleteDeploy)│
   │ 4. Risk Assessment Engine   ── Classify blast radius & risk tier  │
   │ 5. HITL Gate Decision       ── Pause & require sign-off if HIGH   │
   └─────────────────────────────┬────────────────────────────────────┘
                                 │ Forward via JIT Token
                                 ▼
                             MCP Server
                                 │ Native API
                                 ▼
                          External System
   ```

   - **Hard Architectural Invariant (Enforced by ArchUnit):**
     - `adrit-orchestrator` and `adrit-domain` are strictly barred from importing or referencing external SDKs (e.g., Fabric8/Kubernetes Client, Kohsuke GitHub API, ArgoCD REST clients).
     - ArchUnit test `NoDirectExternalEgressArchitectureTest` fails the build immediately if any orchestrator class bypasses the `McpGatewayPort`.
   - **Network Perimeter Isolation:**
     - Container network policies physically isolate the orchestrator; only the `adrit-mcp-gateway` has egress access to MCP servers and external endpoints.
   - **No Static Agent Credentials:** Agents hold zero default write permissions.
   - **Just-In-Time (JIT) Ephemeral Token Scoping:** The agent requests ephemeral (5-minute expiry) JWT tokens with narrow scopes (e.g., `mcp:metrics:read`, `mcp:vcs:write`) bound to the active `incidentId` and current `lifecycleState`.
   - **Policy Enforcement Point (PEP) + Open Policy Agent (OPA):** Every MCP call passes through a PEP that evaluates declarative OPA security rules before hitting underlying infrastructure (e.g., automated agents are unconditionally denied `k8s:deleteDeployment`).

6. **Separation of Decision Authority vs. Execution Permission**

   The cornerstone of Zero-Trust Agentic Architecture: **GOAP deciding on a corrective action does NOT grant permission to execute it.**

   The agent possesses **Decision Authority** ("Based on the evidence, I conclude we should roll back checkout-service to commit abc123f"), but **Zero Execution Authority**. The agent cannot self-authorize execution.

   ```
   GOAP Planner
        │
        │ emits ProposedAction (with justifying EvidenceSet)
        ▼
   Risk Engine
        │ computes RiskLevel & BlastRadius
        ▼
   Policy Engine (PDP)
        │ evaluates declarative OPA/Cedar rules & environment constraints
        ▼
   PolicyDecision
        ├── DENY           ──► GOAP receives denial reasons on Blackboard & replans
        ├── ALLOW          ──► Pre-authorized safe action, dispatched to MCP Server via JIT token
        └── HITL_REQUIRED  ──► Destructive or HIGH risk; pipeline halts for operator crypto sign-off
   ```

   **Domain Model Contracts:**
   ```java
   public record ProposedAction(
       String actionId,
       ActionType action,              // ROLLBACK, RESTART_POD, SCALE_UP, KILL_QUERY, CONFIG_PATCH
       Resource resource,              // e.g. Resource.k8s("checkout-service", "deployment")
       Environment environment,        // PROD, STAGING, DEV
       RiskLevel risk,                 // LOW, MEDIUM, HIGH, CRITICAL
       EvidenceSet evidence,           // strictly required: supporting Evidence IDs justifying this proposal
       Instant proposedAt
   ) {}

   public record PolicyDecision(
       Decision decision,              // ALLOW, DENY, HITL_REQUIRED
       List<String> reasons,           // ["Production rollback requires operator attestation", "Policy rule argocd_prod_freeze active"]
       boolean requiresApproval,
       Instant decidedAt
   ) {}
   ```

   - **Why this separation is profound:**
     1. **Traceable Justification:** An action cannot even be evaluated by the policy engine without an accompanying `EvidenceSet`. "Hallucinated" or ungrounded actions are rejected upfront.
     2. **Autonomous Replanning on `DENY`:** If the Policy Engine returns `DENY` (e.g., during a production deployment freeze or blacklisted operation), the denial with its reasons is written back to the Blackboard as a `Decision`. The GOAP planner immediately re-evaluates and replans an alternative strategy (e.g., scale out replicas or isolate traffic instead of rolling back).
     3. **Deterministic Governance:** The policy engine is completely independent of the LLM. Rules are written in declarative code (OPA Rego / Cedar), not natural language system prompts, making compliance mathematically verifiable.

7. **Human-in-the-Loop (HITL) Attestation & Anti-TOCTOU Tamper Resistance**

   In high-stakes autonomous operations, a critical vulnerability is **Time-of-Check to Time-of-Use (TOCTOU) payload tampering**:
   ```
   Human approves Rollback Proposal A
          ↓
   Agent modifies proposal (hallucination, drift, or compromise)
          ↓
   Actually executes Rollback Proposal B (or destructive deletion)
   ```

   To prevent this, approvals are mathematically bound to the exact payload hash via **Canonical JSON (RFC 8785) + SHA-256**. The architecture supports a **pragmatic two-stage rollout**:

   ```
   ProposedAction ──► Canonical JSON (RFC 8785) ──► SHA-256 ──► proposalHash
                                                                      │
                    ┌─────────────────────────────────────────────────┴───────────────────────────────────────────────┐
                    ▼                                                                                                 ▼
             [MVP Mode - Day 1]                                                                            [Hardened Mode - Production]
             OIDC User Authentication                                                                      Client-Side Ed25519 Private Key
             + proposalHash Match                                                                          + proposalHash + Nonce + Timestamp
             + Tamper-Evident Audit Entry                                                                  + Gateway Public Key Verification
             (Zero PKI / key management overhead)                                                          (Cryptographic non-repudiation)
   ```

   **Domain Model Contract (`ApprovalAttestation`):**
   ```java
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
   ```

   **MCP Gateway Verification Pipeline:**
   1. **Verify Operator Identity & Role:** Via OIDC claims (MVP) or registered public key (Hardened).
   2. **Re-canonicalize & Re-hash:** Re-runs RFC 8785 canonicalization on the submitted `ProposedAction` and computes `SHA-256`.
   3. **Assert Hash Match:** `computedHash == attestation.proposalHash()`. If any parameter changed between approval and execution $\rightarrow$ abort immediately (`403 FORBIDDEN: payload_tampered`).
   4. **Verify Signature/Token:** Validates OIDC JWT signature (MVP) or Ed25519 signature (Hardened).
   5. **Verify TTL:** Validates `expiresAt > now()`.

   - **Why this staging is practical:** Key management and PKI distribution are notoriously complex operational burdens. With this design, **Day 1 MVP gets 100% of the anti-tamper / anti-TOCTOU benefits and identity auditing** using existing OIDC tokens, while the domain model is already primed for Ed25519 asymmetric signatures when hardening for production.
   - **SLA Timeout Escalation:** If an unapproved P1/P2 gate exceeds its SLA (e.g., 5 minutes), the engine automatically pages secondary on-call contacts via PagerDuty.

8. **Tamper-Evident Hash-Chained Audit Ledger with Monotonic Sequencing**

   Every operational action, agent prompt, LLM response, MCP invocation, policy decision, and operator sign-off is committed as an immutable **`AuditEvent`**.

   **Deterministic Total Ordering Under Concurrency:**
   During parallel GOAP execution (e.g. `QueryTopology`, `GetLogs`, and `GetMetrics` running concurrently), wall-clock timestamps alone can collide or arrive out of order. ADRIT enforces a **monotonically increasing `sequence` number per incident** (1, 2, 3...) backed by an atomic counter / PostgreSQL sequence:
   - Eliminates race conditions in the audit trail.
   - Guarantees a deterministic, totally-ordered directed ledger.
   - Any gap (e.g. sequence 1, 2, 4) or out-of-order event is mathematically detected immediately.

   **Cryptographic Chaining Formula:**
   For sequence $n = 1$ (Genesis block):
   $$\text{previousHash} = \text{"GENESIS"}$$
   For sequence $n > 1$:
   $$\text{chainHash}_n = \text{SHA-256}(\text{previousHash}_{n-1} + \text{sequence} + \text{timestamp} + \text{actor} + \text{eventType} + \text{payloadHash})$$

   **Domain Model Contract (`AuditEvent`):**
   ```java
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

   - **Mathematical Verification Endpoint (`GET /api/v1/audit/verify/{incidentId}`):**
     Reconstructs the full chain from `sequence = 1` to tip:
     1. Verifies monotonic sequence continuity: $\text{sequence}_i == \text{sequence}_{i-1} + 1$ (zero missing or duplicate events).
     2. Verifies hash link continuity: $\text{previousHash}_i == \text{chainHash}_{i-1}$.
     3. Re-computes payload hash and chain hash for every single block.
     4. Returns a verifiable cryptographic proof report for regulatory compliance, post-mortems, and legal non-repudiation.

---

### 2.2 Lifecycle States & GOAP Goals

| Lifecycle State | GOAP Goal | Goal Satisfied When | HITL Gate? |
|-----------------|-----------|---------------------|------------|
| `TRIAGE` | `IncidentClassified` | Severity confirmed, ownership assigned, blast radius estimated | Optional (P1 only) |
| `INVESTIGATION` | `RootCauseIsolated` | Single root-cause service identified with supporting evidence on the Blackboard | No |
| `FIXING` | `RemediationFormulated` | A concrete fix (rollback PR, config patch, query kill) is drafted and verified | **Yes** — destructive action |
| `DEPLOY` | `RemediationApplied` | Fix deployed to production and canary health checks pass | **Yes** — production deployment |
| `NOTIFY` | `StakeholdersInformed` | Post-mortem drafted, Jira action items created, Slack/PagerDuty notifications sent | No |

The GOAP Planner has full autonomy over *which* actions to take within each state. It may fetch topology, logs, and metrics in parallel, or it may decide traces are needed after an initial round of evidence is insufficient — the planner adapts based on what the Blackboard contains.

---

### 2.3 Deployable Services & Component Matrix

The ADRIT backend is partitioned into **4 deployable services**, one shared pure domain library, and supporting infrastructure:

| Unit | Type | Responsibility | Key Classes / Components |
|---|---|---|---|
| **`adrit-domain`** | **Shared Library** (0 framework deps) | Pure business models, ports (`LlmPort`, `MetricsPort`, etc.), records, enums | `Incident`, `IncidentContext`, `AlertContext`, `Evidence`, `EvidenceSet`, `Hypothesis`, `ProposedAction`, `PolicyDecision`, `ApprovalAttestation`, `AuditEvent`, `LlmPort`, `PromptRequest`, `CompletionResponse` |
| **`adrit-core`** | **Deployable 1** (Spring Boot WebFlux) | **The Brain**: GOAP planning, Blackboard state, Lifecycle FSM, LLM adapter, and internal Audit module | `LifecycleStateMachine`, `GoapPlanner`, `Blackboard`, `BlackboardRepository`, `IncidentContextRepository`, `ActionRegistry`, `GoalEvaluator`, `ProposedActionEmitter`, `OpenRouterLlmAdapter`, `DynamicModelRouter`, `AuditLedgerService` (module), `IncidentController`, `SseStreamController` |
| **`adrit-mcp-gateway`** | **Deployable 2** (Spring Cloud / PEP Proxy) | **Execution Perimeter**: PEP reverse proxy, OPA policy evaluation, JIT token minting, Anti-TOCTOU verification | `McpGatewayFilter`, `RiskEngine`, `PolicyEngine` (OPA Rego), `AttestationVerifier`, `JitTokenManager`, `OpaPolicyClient`, `ScopeValidator` |
| **`adrit-hitl`** | **Deployable 3** (Spring Boot Web Service) | **Human Authorization**: Approval portal API, RFC 8785 canonical hashing, proposal store, SLA escalation | `CanonicalJsonSerializer`, `ProposalHasher`, `ApprovalAttestationService`, `HitlApprovalController`, `EscalationTimer` |
| **`adrit-tooling`** | **Deployable 4** (MCP Server Suite) | **Infrastructure Adapters**: Standard MCP tool endpoints wrapping external cloud & operations systems | `KubernetesMcpServer`, `ArgoCdMcpServer`, `GitHubMcpServer`, `PrometheusMcpServer`, `LokiMcpServer`, `TempoMcpServer`, `PagerDutyMcpServer` |
| **PostgreSQL** | **Infrastructure** (Multi-schema) | System of record for all state, separated into isolated schemas | `core` schema (`incident_context`, `facts`, `evidence`, `decisions`), `audit` schema (`audit_events`, monotonic sequence counter) |
| **OPA / Kafka / Neo4j** | **Infrastructure** | Security policy evaluation, durable domain event transport, and service dependency graph | OPA Rego rules (`block_delete_deployment.rego`), Kafka topics (`incident.*`), Neo4j Cypher queries |

---

### 2.4 Multi-Persona Agent Reasoning

Personas are injected at the LLM synthesis checkpoints within GOAP actions — the persona determines *how* the LLM reasons about evidence on the Blackboard, not which actions to take.

Each persona requests inference using a semantic **`ModelPurpose`**. The concrete model, provider, temperature, and token budgets are resolved entirely from external configuration by **`ModelRouter`** — **zero model names are hardcoded into agents or personas**.

| Persona | Lifecycle State | ModelPurpose | Primary Focus | Backstory & Goal |
|---------|-----------------|--------------|---------------|-------------------|
| **Senior SRE** | `TRIAGE` | `TRIAGE` | MTTR & Signal Isolation | 12+ years experience. Rapidly filters alerts, correlates metrics, and determines initial severity and ownership. |
| **Topology & RCA Specialist** | `INVESTIGATION` | `INVESTIGATION` | Blast Radius & Graph Traversal | Deep distributed systems knowledge. Traverses Neo4j service dependency graphs to isolate root-cause services. |
| **Remediation Engineer** | `FIXING` | `REMEDIATION` | Minimal Safe Diffs | Builds precise, low-risk rollback PRs or configuration patches with automated unit/canary verification tests. |
| **Release & Safety Controller** | `DEPLOY` | `DEPLOY_SAFETY` | Canary Validation | Enforces blast-radius safety, step-down traffic routing (5% → 25% → 100%), and SLO burn rate verification. |
| **Incident Commander** | `NOTIFY` | `SUMMARIZATION` | Blameless Post-Mortem | Assembles precise timeline reconstructions, blameless RCA summaries, and time-bound Jira prevention action items. |

---

### 2.5 Event Bus Architecture & Component Boundaries

A critical architectural invariant: **Kafka is durable event infrastructure — NOT the brain.**

#### 2.5.1 Component Responsibility Matrix

| Component | Architectural Role | Core Invariant |
|---|---|---|
| **PostgreSQL** | Source of Truth | Persistent store for `IncidentContext`, `Facts`, `Evidence`, `Decisions`, and `AuditEvents` |
| **GOAP Planner** | The Brain (Reasoning & Planning) | Autonomous action selection, backward planning from goals, and dynamic replanning |
| **Kafka / Redpanda** | Durable Event Transport | Asynchronous broadcast of factual domain events; **never a distributed state machine** |
| **Neo4j** | Topology Knowledge | Service dependency graph traversal, downstream blast radius mapping |
| **ADRIT MCP Gateway** | Execution Boundary | Zero-Trust tool proxy, JIT token minting, Anti-TOCTOU attestation verification |
| **Open Policy Agent (OPA)** | Policy Decision (PDP) | Declarative security rule evaluation, invariant enforcement (block `deleteDeployment`) |
| **HITL Engine** | Human Authorization | Operator attestation gates, canonical hashing, SLA timeout escalation |

#### 2.5.2 Event Bus Topology & Clean Event Taxonomy

```
[External Alerts / Webhooks]
             │
             ▼
      (incident.alerts)
             │
             ▼
      [adrit-core] ────────► [adrit-mcp-gateway] ───► (incident.actions)
      (GOAP/Blackboard/               │                       │
       Audit Mod/SSE)                 ├──────► [adrit-hitl] ──┼──► (incident.hitl)
             │                        │            │          │         │
             │                        │            ▼          │         │
             │                        │       Human Sign-off  │         │
             │                        │                       │         │
             │                        └──────► [adrit-tooling]│         │
             │                                     │          │         │
             │                                     ▼          │         │
             │                              External Systems  │         │
             │                                                ▼         ▼
             └◄─────────────────────────── (Domain Events) ◄──┴─────────┘
             │ (Server-Sent Events)
             ▼
         [adrit-ui]
```

Kafka topics represent **factual business domain occurrences**, not procedural execution steps:

| Kafka Topic | Domain Event Type | Purpose / Emitted When |
|---|---|---|
| `incident.alerts` | `AlertIngestedEvent` | Raw alert arrival from Prometheus, PagerDuty, or Kubernetes |
| `incident.lifecycle` | `IncidentCreatedEvent`<br>`IncidentStageChangedEvent`<br>`IncidentResolvedEvent` | Lifecycle state machine transitions |
| `incident.evidence` | `EvidenceCollectedEvent` | Typed observation (metrics, logs, traces) committed to Blackboard |
| `incident.actions` | `ActionProposedEvent`<br>`ActionExecutedEvent` | GOAP planner proposes action or MCP gateway dispatches execution |
| `incident.hitl` | `ApprovalRequestedEvent`<br>`ApprovalGrantedEvent` | High-risk gate paused or operator attestation provided |
| `incident.audit` | `AuditEventCommitted` | Monotonic hash-chained ledger block persisted |

#### 2.5.3 Banned Anti-Pattern: Procedural Step Choreography

```
// STRICTLY FORBIDDEN IN ADRIT:
investigate.step.1 ──► investigate.step.2 ──► investigate.step.3  (BANNED!)
```

Turning Kafka into a procedural pipeline robs GOAP of its autonomous decision-making ability. **GOAP decides and executes actions internally within the orchestrator** (evaluating preconditions, running queries in parallel, assessing evidence, and replanning on failure). Kafka merely transports the resulting factual domain events to downstream consumers, audit storage, and the web console.

---

### 2.6 Local Developer & Testing Harness

To enable full offline development without requiring real external service bills or credentials:
* **Docker Compose Stack:**
  * **Neo4j:** Pre-seeded with service dependency graphs.
  * **WireMock Containers:** Mocking ArgoCD, PagerDuty, Jira, GitHub, and Slack APIs with pre-recorded response stubs.
  * **Prometheus + OpenTelemetry Collector:** Synthetic metrics and trace generators.
* **Model Gateway (`adrit-llm` implementing `LlmPort`):**
  * **Unified Provider Service:** Implements domain `LlmPort` using **OpenRouter** (`https://openrouter.ai/api/v1`) or Spring AI `ChatModel` as a pluggable adapter. The orchestrator calls `llm.complete(...)` with zero vendor coupling.
  * **Policy/Configuration-Driven `ModelRouter`:**
    Model selection is declared entirely in configuration (`application.yml`), mapping each `ModelPurpose` to a provider and model:
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
  * **Evaluation & Benchmarking Agility:**
    Swapping models to evaluate performance (e.g., comparing Claude 3.7 vs. DeepSeek R1 vs. GPT-4o on root cause accuracy and MTTR) is a single-line configuration override (`application-eval.yml`) with zero code modifications.
  * **Resilience & Fallback:** Built-in provider fallback and load balancing with unified billing and key management, eliminating local GPU/RAM hardware constraints.

---

## 3. Technology Stack

| Layer | Component | Technology | Rationale |
|-------|-----------|------------|-----------|
| **Frontend** | UI & Visualization | React 19 + Vite + Vanilla CSS | High performance, instant HMR, no CSS framework bloat |
| **Backend Runtime** | Language & Platform | Java 21 LTS + Spring Boot 3.3+ (WebFlux) | Reactive non-blocking I/O, records, pattern matching |
| **Architecture** | Hexagonal Enforcement | ArchUnit | Strict compile/test-time boundary rules |
| **Agent Planning** | Workflow Engine | Embabel Agent (GOAP) / Spring StateMachine | Precondition/effect planning, typed blackboard state |
| **Model Gateway** | LLM Abstraction & Adapters | `LlmPort` (`adrit-domain`) + OpenRouter / Spring AI (`adrit-llm`) | Pure domain port; unified gateway for Claude, GPT-4o, Llama 3 with dynamic routing |
| **Security & Auth** | JIT Token & Policy | Keycloak (OIDC) + Open Policy Agent (OPA) | Enterprise Zero-Trust PEP/PDP architecture |
| **Event Bus** | Message Streaming | Apache Kafka / Redpanda | Decoupled event choreography & audit stream |
| **Persistence** | Audit & Relational | PostgreSQL (Append-only hash chain) | Relational integrity with cryptographic verification |
| **Topology** | Graph DB | Neo4j | Fast recursive downstream dependency & blast radius queries |
| **Observability** | Telemetry Ingress | Prometheus, Loki, Tempo / Jaeger | Comprehensive metrics, logs, and distributed trace analysis |
| **Testing** | Mocks & Verification | WireMock + Testcontainers | Completely hermetic, deterministic local integration tests |

---

## 4. Scenarios & End-to-End Test Matrix

| # | Scenario Name | Primary Signal | Investigation Path | Remediation & HITL Gate | Post-Remediation Verification |
|---|---------------|----------------|--------------------|-------------------------|-------------------------------|
| **1** | **Checkout 5xx Spike** | Prometheus 5xx alert (>12%) | Neo4j topology queries payment gateway $\rightarrow$ Git commit diff reveals null pointer | **HITL Gate 1:** Revert PR creation<br>**HITL Gate 2:** ArgoCD rollback approval | ArgoCD Canary traffic shift (5% $\rightarrow$ 100%) + 5xx rate drops < 0.5% |
| **2** | **Auth Memory Leak** | Kubernetes OOMKilled events | Profiling memory dump metrics + Loki log stack traces | **HITL Gate:** JVM heap limit config patch PR approval | Pod restart stabilization + heap saturation metric stays under 65% |
| **3** | **DB Connection Pool Exhaustion** | HikariCP pool saturation alert | Jaeger trace shows unindexed slow query locking pool | **HITL Gate:** Read-replica query kill & circuit-breaker trip approval | Active pool connections drop to healthy threshold + latency p95 < 200ms |
