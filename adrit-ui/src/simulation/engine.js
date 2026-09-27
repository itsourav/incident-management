import { SCENARIOS, STAGE_ORDER, STAGE_CONFIG } from './scenarios';

export function createSimulationEngine() {
  let state = getInitialState();
  let listeners = new Set();
  let timerId = null;
  let speed = 1;
  let stepResolve = null;

  function getInitialState() {
    return {
      status: 'idle',
      scenarioId: 'checkout-5xx',
      incident: null,
      currentStageIndex: -1,
      stages: {},
      kafka: { messages: [], topics: {} },
      audit: [],
      mcp: { calls: [], tokensIssued: 0, allowed: 0, denied: 0 },
      hitl: null,
      simTime: 0,
      kafkaMsgCount: 0,
      mcpCallCount: 0,
    };
  }

  function emit() {
    const snapshot = { ...state };
    listeners.forEach(fn => fn(snapshot));
  }

  function addAudit(type, message, payload = null) {
    state.audit = [...state.audit, { id: Date.now() + Math.random(), type, message, payload, time: state.simTime }];
    if (type === 'kafka') {
      state.kafkaMsgCount++;
    }
  }

  function addKafkaMessage(topic, key, value) {
    const msg = { topic, key, value, time: state.simTime };
    state.kafka.messages = [...state.kafka.messages, msg];
    if (!state.kafka.topics[topic]) state.kafka.topics[topic] = [];
    state.kafka.topics[topic] = [...state.kafka.topics[topic], msg];
    state.kafkaMsgCount++;
    addAudit('kafka', `${topic}: ${key}`, JSON.stringify(value, null, 2));
  }

  function addMCPCall(call) {
    const jwtToken = `eyJhbGciOiJSUzI1NiJ9.${btoa(JSON.stringify({ sub: call.agent, scope: call.scope, exp: Date.now() + 300000 })).replace(/=/g, '')}.sig`;
    const entry = { ...call, jwt: jwtToken, time: state.simTime, id: Date.now() + Math.random() };
    state.mcp.calls = [...state.mcp.calls, entry];
    state.mcp.tokensIssued++;
    state.mcpCallCount++;
    if (call.result === 'allow') {
      state.mcp.allowed++;
      addAudit('mcp', `✓ ${call.tool} — ALLOW (scope: ${call.scope})`, JSON.stringify(entry, null, 2));
    } else {
      state.mcp.denied++;
      addAudit('mcp', `✗ ${call.tool} — DENY (scope: ${call.scope})`, JSON.stringify(entry, null, 2));
    }
  }

  function wait(ms) {
    return new Promise(resolve => {
      timerId = setTimeout(resolve, ms / speed);
    });
  }

  function waitForApproval() {
    return new Promise(resolve => {
      stepResolve = resolve;
    });
  }

  async function runStage(stageKey, stageData, scenario) {
    const stageIndex = STAGE_ORDER.indexOf(stageKey);
    const config = STAGE_CONFIG[stageKey];
    state.currentStageIndex = stageIndex;
    state.stages[stageKey] = { status: 'active', startTime: state.simTime };
    addAudit('agent', `${config.agent} activated — starting ${config.name} phase`);
    addKafkaMessage(`ops.incident.${stageKey}`, scenario.incident.id, { stage: stageKey, status: 'started', agent: config.agent });
    emit();

    // Simulate MCP calls
    if (stageData.mcpCalls) {
      for (const call of stageData.mcpCalls) {
        await wait(600);
        addMCPCall({ ...call, agent: config.agent });
        emit();
      }
    }

    await wait(stageData.duration / 2);
    state.simTime += stageData.duration / 2000;
    addAudit('agent', `${config.agent}: ${stageData.description.substring(0, 100)}...`);
    emit();

    // HITL gate
    if (stageData.hitl) {
      state.stages[stageKey] = { ...state.stages[stageKey], status: 'waiting' };
      state.hitl = {
        stage: stageKey,
        agent: config.agent,
        title: `Human Approval Required — ${config.name}`,
        proposal: stageData.proposal || stageData.description,
        risk: stageData.risk || 'medium',
        riskDetails: stageData.riskDetails || '',
        reason: stageData.hitlReason || 'Approval required',
      };
      addAudit('approval', `⏳ HITL Gate: ${config.agent} awaiting human approval — ${stageData.hitlReason || 'Approval required'}`);
      addKafkaMessage('ops.hitl.request', scenario.incident.id, { stage: stageKey, agent: config.agent, reason: stageData.hitlReason });
      emit();

      const approved = await waitForApproval();
      state.hitl = null;

      if (approved) {
        addAudit('approval', `✅ HITL Gate: ${config.name} — APPROVED by Incident Commander`);
        addKafkaMessage('ops.hitl.response', scenario.incident.id, { stage: stageKey, decision: 'approved' });
      } else {
        addAudit('denied', `❌ HITL Gate: ${config.name} — REJECTED by Incident Commander`);
        addKafkaMessage('ops.hitl.response', scenario.incident.id, { stage: stageKey, decision: 'rejected' });
        state.stages[stageKey] = { ...state.stages[stageKey], status: 'error' };
        emit();
        return false;
      }
    }

    await wait(stageData.duration / 2);
    state.simTime += stageData.duration / 2000;
    state.stages[stageKey] = { ...state.stages[stageKey], status: 'completed', endTime: state.simTime };
    addAudit('agent', `${config.agent} completed ${config.name} phase`);
    addKafkaMessage(`ops.incident.${stageKey}`, scenario.incident.id, { stage: stageKey, status: 'completed' });
    emit();
    return true;
  }

  async function runSimulation() {
    const scenario = SCENARIOS[state.scenarioId];
    if (!scenario) return;

    state.status = 'running';
    state.incident = scenario.incident;
    state.simTime = 0;
    addAudit('system', `Simulation started — Scenario: ${scenario.name}`);
    addAudit('system', `Alert received from ${scenario.incident.source}: ${scenario.incident.alert}`);
    addKafkaMessage('ops.alerts.normalized', scenario.incident.id, { alert: scenario.incident.alert, service: scenario.incident.service, severity: scenario.incident.severity });
    emit();

    await wait(1000);

    for (const stageKey of STAGE_ORDER) {
      if (state.status === 'stopped') return;
      const stageData = scenario.stages[stageKey];
      const success = await runStage(stageKey, stageData, scenario);
      if (!success) {
        state.status = 'error';
        addAudit('system', `Pipeline halted at ${STAGE_CONFIG[stageKey].name} — Action rejected`);
        emit();
        return;
      }
      await wait(500);
    }

    state.status = 'completed';
    addAudit('system', `🎉 Incident ${scenario.incident.id} resolved successfully — Total time: ${state.simTime.toFixed(1)}s`);
    emit();
  }

  return {
    subscribe(fn) {
      listeners.add(fn);
      fn({ ...state });
      return () => listeners.delete(fn);
    },
    getState() { return { ...state }; },
    setScenario(id) {
      if (state.status === 'running') return;
      state.scenarioId = id;
      emit();
    },
    setSpeed(s) { speed = s; },
    start() {
      if (state.status === 'running') return;
      state = getInitialState();
      state.scenarioId = state.scenarioId || 'checkout-5xx';
      runSimulation();
    },
    pause() { /* For future use */ },
    reset() {
      if (timerId) clearTimeout(timerId);
      state = { ...getInitialState(), scenarioId: state.scenarioId };
      stepResolve = null;
      emit();
    },
    approveHITL() {
      if (stepResolve) { stepResolve(true); stepResolve = null; }
    },
    rejectHITL() {
      if (stepResolve) { stepResolve(false); stepResolve = null; }
    },
  };
}
