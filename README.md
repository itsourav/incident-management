# Zero-Trust Agentic AI Operations Framework for Incident Management

> Implementation of the **Infra-Agnostic Intelligent Ops Framework** by Brajveer Singh.  
> An event-driven, multi-agent architecture where **autonomous speed meets enterprise-grade guardrails**.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │                   Ops UI                     │
                      │       (React 19 + Vite Live Dashboard)       │
                      └──────────────────────┬───────────────────────┘
                                             │ HTTP REST / SSE Stream
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │                  BFF Layer                   │
                      │         (Backend-for-Frontend API)           │
                      │  • Telemetry Aggregation  • SSE Stream       │
                      │  • OIDC Authentication    • Approval Checkpt │
                      └──────┬────────────────────────────────┬──────┘
                             │ State / Audit                  │ Approval Events
                             ▼                                ▼
                      ┌──────────────┐                 ┌──────────────┐
                      │  PostgreSQL  │                 │    Kafka     │
                      │ (Audit & DB) │                 │  Event Bus   │
                      └──────────────┘                 └──────┬───────┘
                                                              │
        ┌───────────────────┬───────────────────┬─────────────┴─────┬───────────────────┐
        ▼                   ▼                   ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Alert Normal. │   │ Triage Agent  │   │ Invest. Agent │   │ Fixing Agent  │   │ Deploy Agent  │
│ & Ingestion   │   │ (Opt. HITL 1) │   │ (Automated)   │   │ (Cond. HITL 2)│   │ (Mand. HITL 3)│
└───────────────┘   └───────┬───────┘   └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
                            │                   │                   │                   │
                            └───────────────────┴─────────┬─────────┴───────────────────┘
                                                          │ Token-Scoped Tool Calls
                                                          ▼
                                            ┌───────────────────────────┐
                                            │        MCP Gateway        │
                                            │ (Scope Check & Deny-List) │
                                            └─────────────┬─────────────┘
                                                          │ Dynamic Secrets
                                                          ▼
                                            ┌───────────────────────────┐
                                            │  Specialized MCP Servers  │
                                            │ (Git, K8s, CI/CD, Obs.)   │
                                            └─────────────┬─────────────┘
                                                          │ Native APIs
                                                          ▼
                                            ┌───────────────────────────┐
                                            │ External Ops & Cloud Syst.│
                                            └───────────────────────────┘
```

---

## Key Pillars

1. **Decoupled by Design (Kafka Choreography + BFF Layer)**: Agents coordinate asynchronously across Kafka (`Kafka -> Agent -> Kafka -> Next Agent`). The browser is completely isolated behind a dedicated BFF API.
2. **Zero-Trust Tool Enforcement (The MCP Gateway)**: Agents hold zero static credentials and never call production tools directly. Calls are gated behind token-scoped JWTs and deny-list policy checks.
3. **Multi-Stage Human-in-the-Loop (HITL) Guardrails**:
   * **Stage 1 (Triage):** Optional gate for P1 / ambiguous ownership.
   * **Stage 2 (Investigation):** Automated read-only analysis using Neo4j topology graphs and logs.
   * **Stage 3 (Fixing):** Conditional gate for rollback PRs / schema changes.
   * **Stage 4 (Deploy/Validation):** Mandatory gate for all production traffic shifts.
   * **Stage 5 (Release/Notify):** Automated outbound updates to Slack, Jira, PagerDuty.
4. **Cost-Aware Model Routing**: Lightweight models for triage classification; frontier models (Claude Sonnet / GPT-4o) for root cause analysis and fix generation.

---

## Documentation

* **[PLAN.md](PLAN.md)**: Architecture specifications, agent responsibilities, MCP gateway contracts, and the Asha 5xx checkout scenario.
* **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)**: 6-phase engineering plan and exit criteria.

---

## Advanced Architecture

The previous comprehensive design (incorporating GOAP backward planning, four isolated deployable services, and mathematical RFC 8785 canonical hash attestation) has been preserved on the **`advance`** branch:
```bash
git checkout advance
```
