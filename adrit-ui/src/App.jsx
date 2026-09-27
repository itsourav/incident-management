import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createSimulationEngine } from './simulation/engine';
import { SCENARIOS, STAGE_ORDER, STAGE_CONFIG } from './simulation/scenarios';
import TopBar from './components/TopBar';
import IncidentPanel from './components/IncidentPanel';
import PipelineView from './components/PipelineView';
import RightPanel from './components/RightPanel';
import HITLModal from './components/HITLModal';
import ToastContainer from './components/ToastContainer';

function App() {
  const engineRef = useRef(null);
  const [simState, setSimState] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState('checkout-5xx');

  useEffect(() => {
    const engine = createSimulationEngine();
    engineRef.current = engine;
    const unsub = engine.subscribe(s => {
      setSimState(s);
      setIsPlaying(s.status === 'running');
    });
    return unsub;
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const handlePlay = useCallback(() => {
    if (!engineRef.current) return;
    const state = engineRef.current.getState();
    if (state.status === 'running') return;
    engineRef.current.start();
    addToast('Simulation started', 'info');
  }, [addToast]);

  const handleReset = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.reset();
    setIsPlaying(false);
    addToast('Simulation reset', 'info');
  }, [addToast]);

  const handleSpeedChange = useCallback((newSpeed) => {
    setSpeed(newSpeed);
    if (engineRef.current) engineRef.current.setSpeed(newSpeed);
  }, []);

  const handleScenarioChange = useCallback((scenarioId) => {
    if (isPlaying) return;
    setSelectedScenario(scenarioId);
    if (engineRef.current) {
      engineRef.current.reset();
      engineRef.current.setScenario(scenarioId);
    }
  }, [isPlaying]);

  const handleApprove = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.approveHITL();
      addToast('Action approved ✅', 'success');
    }
  }, [addToast]);

  const handleReject = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.rejectHITL();
      addToast('Action rejected ❌', 'error');
    }
  }, [addToast]);

  if (!simState) return null;

  return (
    <>
      <TopBar
        isPlaying={isPlaying}
        speed={speed}
        simTime={simState.simTime}
        kafkaMsgCount={simState.kafkaMsgCount}
        mcpCallCount={simState.mcpCallCount}
        activeCount={simState.incident ? 1 : 0}
        status={simState.status}
        onPlay={handlePlay}
        onReset={handleReset}
        onSpeedChange={handleSpeedChange}
      />
      <main className="main-layout">
        <IncidentPanel
          incident={simState.incident}
          stages={simState.stages}
          currentStageIndex={simState.currentStageIndex}
          simTime={simState.simTime}
          selectedScenario={selectedScenario}
          onScenarioChange={handleScenarioChange}
          isPlaying={isPlaying}
          scenarioData={SCENARIOS[selectedScenario]}
        />
        <PipelineView
          stages={simState.stages}
          currentStageIndex={simState.currentStageIndex}
          status={simState.status}
          scenarioData={SCENARIOS[simState.scenarioId]}
        />
        <RightPanel
          audit={simState.audit}
          mcp={simState.mcp}
          kafka={simState.kafka}
        />
      </main>
      <HITLModal
        hitl={simState.hitl}
        onApprove={handleApprove}
        onReject={handleReject}
      />
      <ToastContainer toasts={toasts} />
    </>
  );
}

export default App;
