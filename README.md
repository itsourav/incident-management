# ADRIT — Zero-Trust Agentic AI Ops Platform

> **ADRIT (Agentic Incident Management)** is an enterprise-grade Zero-Trust Agentic AI Operations platform for automated incident triage, investigation, remediation, canary deployment, and post-mortem generation.

---

## Architecture Overview

ADRIT is built on a **Zero-Trust, Goal-Oriented, Hexagonal Architecture** partitioned into 4 core deployables backed by an asynchronous domain event bus:

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

---

## The 4 Deployables

1. **`adrit-core`** (The Brain): GOAP planning engine, in-memory Blackboard state projection, incident lifecycle FSM, multi-persona agent synthesis, REST/SSE stream controllers, `adrit-llm` module, and internal audit module.
2. **`adrit-mcp-gateway`** (Execution Perimeter): Zero-Trust reverse proxy, OPA Rego policy evaluation (blocks `deleteDeployment`), 5-minute ephemeral JIT token issuance, and anti-TOCTOU attestation verification.
3. **`adrit-hitl`** (Human Authorization): Approval portal API, RFC 8785 canonical JSON hashing, approval records, and SLA timeout escalation timers.
4. **`adrit-tooling`** (MCP Tool Servers): Model Context Protocol servers wrapping Kubernetes, ArgoCD, GitHub, and Observability tools (Prometheus, Loki, Tempo).

### Supporting Infrastructure
- **`adrit-ui`**: React 19 + Vite operational console and live simulation dashboard.
- **`PostgreSQL`**: Source of truth with separated schemas (`core` for blackboard/incident context, `audit` for immutable hash-chained ledger).
- **`Kafka / Redpanda`**: Durable domain event transport (`incident.alerts`, `incident.actions`, `incident.hitl`).
- **`Neo4j`**: Service topology graph database for blast-radius calculation.
- **`OPA`**: Declarative Rego policy engine.

---

## Documentation

- **[PLAN.md](PLAN.md)**: Detailed system specifications, architectural invariants, domain models, and security contracts.
- **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)**: Step-by-step 6-phase engineering roadmap with exit criteria.

---

## License

Proprietary / Private.
