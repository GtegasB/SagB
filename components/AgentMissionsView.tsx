import React, { useEffect, useMemo, useState } from 'react';
import {
  Agent,
  AgentArtifact,
  AgentHandoff,
  AgentMission,
  AgentMissionStep
} from '../types';
import { BackIcon } from './Icon';
import {
  collection,
  db,
  onSnapshot,
  orderBy,
  query,
  where
} from '../services/supabase';
import { createMissionWithSteps } from '../services/missionService';
import {
  reprocessMissionStep,
  runMissionOrchestration
} from '../services/orchestrationRunner';
import { resolveWorkspaceId } from '../utils/supabaseChat';

interface AgentMissionsViewProps {
  workspaceId?: string | null;
  ownerUserId?: string | null;
  agents: Agent[];
  onBack?: () => void;
}

type TimelineEvent = {
  id: string;
  kind: 'mission' | 'step' | 'artifact' | 'handoff';
  timestamp: Date;
  title: string;
  note: string;
  status: string;
};

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const toMission = (row: any, fallbackWorkspaceId: string): AgentMission => ({
  id: String(row.id || ''),
  workspaceId: String(row.workspaceId || fallbackWorkspaceId),
  title: String(row.title || 'Missao'),
  initialInput: String(row.initialInput || ''),
  status: row.status || 'queued',
  currentStepIndex: Number(row.currentStepIndex || 1),
  createdBy: row.createdBy || null,
  startedAt: row.startedAt ? toDate(row.startedAt) : null,
  finishedAt: row.finishedAt ? toDate(row.finishedAt) : null,
  createdAt: toDate(row.createdAt),
  updatedAt: toDate(row.updatedAt),
  payload: row.payload || {}
});

const toStep = (row: any, fallbackWorkspaceId: string): AgentMissionStep => ({
  id: String(row.id || ''),
  workspaceId: String(row.workspaceId || fallbackWorkspaceId),
  missionId: String(row.missionId || ''),
  stepIndex: Number(row.stepIndex || 0),
  agentId: row.agentId || null,
  agentName: String(row.agentName || 'Agente'),
  stepName: String(row.stepName || 'Etapa'),
  artifactType: String(row.artifactType || 'artifact'),
  status: row.status || 'pending',
  validationStatus: row.validationStatus || null,
  retryCount: Number(row.retryCount || 0),
  promptSnapshot: row.promptSnapshot || null,
  contextSnapshot: row.contextSnapshot || null,
  errorMessage: row.errorMessage || null,
  startedAt: row.startedAt ? toDate(row.startedAt) : null,
  finishedAt: row.finishedAt ? toDate(row.finishedAt) : null,
  createdAt: toDate(row.createdAt),
  updatedAt: toDate(row.updatedAt),
  payload: row.payload || {}
});

const toArtifact = (row: any, fallbackWorkspaceId: string): AgentArtifact => ({
  id: String(row.id || ''),
  workspaceId: String(row.workspaceId || fallbackWorkspaceId),
  missionId: String(row.missionId || ''),
  stepId: String(row.stepId || ''),
  artifactType: String(row.artifactType || 'artifact'),
  status: row.status || 'created',
  version: Number(row.version || 1),
  contentJson: row.contentJson || null,
  contentText: row.contentText || null,
  createdByAgentId: row.createdByAgentId || null,
  createdAt: toDate(row.createdAt),
  payload: row.payload || {}
});

const toHandoff = (row: any, fallbackWorkspaceId: string): AgentHandoff => ({
  id: String(row.id || ''),
  workspaceId: String(row.workspaceId || fallbackWorkspaceId),
  missionId: String(row.missionId || ''),
  fromStepId: String(row.fromStepId || ''),
  toStepId: row.toStepId || null,
  fromAgentId: row.fromAgentId || null,
  toAgentId: row.toAgentId || null,
  artifactId: row.artifactId || null,
  status: row.status || 'created',
  note: row.note || null,
  createdAt: toDate(row.createdAt),
  acceptedAt: row.acceptedAt ? toDate(row.acceptedAt) : null,
  payload: row.payload || {}
});

const formatDateTime = (value?: Date | null) => value
  ? value.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
  : '-';

const badgeClasses = (status: string) => {
  if (status === 'completed' || status === 'validated' || status === 'accepted') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'running' || status === 'ready' || status === 'created' || status === 'queued') return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (status === 'failed' || status === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    queued: 'Na fila',
    running: 'Executando',
    completed: 'Concluida',
    failed: 'Falhou',
    pending: 'Pendente',
    ready: 'Pronta',
    created: 'Criado',
    validated: 'Validado',
    rejected: 'Rejeitado',
    accepted: 'Aceito'
  };
  return map[status] || status;
};

const buildTimeline = (
  mission: AgentMission | null,
  steps: AgentMissionStep[],
  artifacts: AgentArtifact[],
  handoffs: AgentHandoff[]
): TimelineEvent[] => {
  if (!mission) return [];

  const stepMap = new Map(steps.map((step) => [step.id, step]));
  const events: TimelineEvent[] = [
    {
      id: `mission-${mission.id}-created`,
      kind: 'mission',
      timestamp: mission.createdAt,
      title: 'Missao criada',
      note: mission.title,
      status: mission.status
    }
  ];

  if (mission.startedAt) {
    events.push({
      id: `mission-${mission.id}-started`,
      kind: 'mission',
      timestamp: mission.startedAt,
      title: 'Runner iniciado',
      note: 'Execucao automatica iniciada.',
      status: 'running'
    });
  }

  if (mission.finishedAt) {
    events.push({
      id: `mission-${mission.id}-finished`,
      kind: 'mission',
      timestamp: mission.finishedAt,
      title: mission.status === 'completed' ? 'Missao concluida' : 'Missao encerrada com falha',
      note: `Status final: ${statusLabel(mission.status)}`,
      status: mission.status
    });
  }

  steps.forEach((step) => {
    if (step.startedAt) {
      events.push({
        id: `step-${step.id}-started`,
        kind: 'step',
        timestamp: step.startedAt,
        title: `Etapa ${step.stepIndex} iniciada`,
        note: `${step.agentName} executando ${step.stepName}.`,
        status: 'running'
      });
    }
    if (step.finishedAt) {
      events.push({
        id: `step-${step.id}-finished`,
        kind: 'step',
        timestamp: step.finishedAt,
        title: `Etapa ${step.stepIndex} ${step.status === 'completed' ? 'concluida' : 'falhou'}`,
        note: step.errorMessage || step.stepName,
        status: step.status
      });
    }
  });

  artifacts.forEach((artifact) => {
    const step = stepMap.get(artifact.stepId);
    events.push({
      id: `artifact-${artifact.id}`,
      kind: 'artifact',
      timestamp: artifact.createdAt,
      title: `Artifact ${artifact.artifactType}`,
      note: `${step?.stepName || 'Etapa'} • v${artifact.version}`,
      status: artifact.status
    });
  });

  handoffs.forEach((handoff) => {
    const fromStep = stepMap.get(handoff.fromStepId);
    const toStep = handoff.toStepId ? stepMap.get(handoff.toStepId) : null;
    events.push({
      id: `handoff-${handoff.id}`,
      kind: 'handoff',
      timestamp: handoff.acceptedAt || handoff.createdAt,
      title: 'Handoff formal',
      note: `${fromStep?.stepName || 'Origem'} -> ${toStep?.stepName || 'Destino'}`,
      status: handoff.status
    });
  });

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

const AgentMissionsView: React.FC<AgentMissionsViewProps> = ({
  workspaceId,
  ownerUserId,
  agents,
  onBack
}) => {
  const scopedWorkspaceId = resolveWorkspaceId(workspaceId);
  const [initialInput, setInitialInput] = useState('');
  const [missions, setMissions] = useState<AgentMission[]>([]);
  const [steps, setSteps] = useState<AgentMissionStep[]>([]);
  const [artifacts, setArtifacts] = useState<AgentArtifact[]>([]);
  const [handoffs, setHandoffs] = useState<AgentHandoff[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [busyMissionId, setBusyMissionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);

  useEffect(() => {
    const missingPattern = /Could not find the table 'public\.(agent_missions|agent_mission_steps|agent_artifacts|agent_handoffs)'/i;

    const missionsQuery = query(
      collection(db, 'agent_missions'),
      where('workspaceId', '==', scopedWorkspaceId),
      orderBy('createdAt', 'desc')
    );
    const stepsQuery = query(
      collection(db, 'agent_mission_steps'),
      where('workspaceId', '==', scopedWorkspaceId),
      orderBy('createdAt', 'asc')
    );
    const artifactsQuery = query(
      collection(db, 'agent_artifacts'),
      where('workspaceId', '==', scopedWorkspaceId),
      orderBy('createdAt', 'asc')
    );
    const handoffsQuery = query(
      collection(db, 'agent_handoffs'),
      where('workspaceId', '==', scopedWorkspaceId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribeMissions = onSnapshot(missionsQuery, (snapshot) => {
      setMissions(snapshot.docs.map((row: any) => toMission(row.data(), scopedWorkspaceId)));
      setSchemaMissing(false);
    }, (error: any) => {
      if (missingPattern.test(String(error?.details?.message || error?.message || ''))) {
        setSchemaMissing(true);
        setMissions([]);
        return;
      }
      console.error('Erro ao carregar agent_missions:', error);
    });

    const unsubscribeSteps = onSnapshot(stepsQuery, (snapshot) => {
      setSteps(snapshot.docs.map((row: any) => toStep(row.data(), scopedWorkspaceId)));
    }, (error: any) => {
      if (missingPattern.test(String(error?.details?.message || error?.message || ''))) {
        setSchemaMissing(true);
        setSteps([]);
        return;
      }
      console.error('Erro ao carregar agent_mission_steps:', error);
    });

    const unsubscribeArtifacts = onSnapshot(artifactsQuery, (snapshot) => {
      setArtifacts(snapshot.docs.map((row: any) => toArtifact(row.data(), scopedWorkspaceId)));
    }, (error: any) => {
      if (missingPattern.test(String(error?.details?.message || error?.message || ''))) {
        setSchemaMissing(true);
        setArtifacts([]);
        return;
      }
      console.error('Erro ao carregar agent_artifacts:', error);
    });

    const unsubscribeHandoffs = onSnapshot(handoffsQuery, (snapshot) => {
      setHandoffs(snapshot.docs.map((row: any) => toHandoff(row.data(), scopedWorkspaceId)));
    }, (error: any) => {
      if (missingPattern.test(String(error?.details?.message || error?.message || ''))) {
        setSchemaMissing(true);
        setHandoffs([]);
        return;
      }
      console.error('Erro ao carregar agent_handoffs:', error);
    });

    return () => {
      unsubscribeMissions();
      unsubscribeSteps();
      unsubscribeArtifacts();
      unsubscribeHandoffs();
    };
  }, [scopedWorkspaceId]);

  useEffect(() => {
    if (selectedMissionId && missions.some((mission) => mission.id === selectedMissionId)) return;
    setSelectedMissionId(missions[0]?.id || null);
  }, [missions, selectedMissionId]);

  const selectedMission = useMemo(
    () => missions.find((mission) => mission.id === selectedMissionId) || null,
    [missions, selectedMissionId]
  );

  const selectedMissionSteps = useMemo(
    () => steps
      .filter((step) => step.missionId === selectedMissionId)
      .sort((a, b) => a.stepIndex - b.stepIndex),
    [steps, selectedMissionId]
  );

  const selectedMissionArtifacts = useMemo(
    () => artifacts
      .filter((artifact) => artifact.missionId === selectedMissionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    [artifacts, selectedMissionId]
  );

  const selectedMissionHandoffs = useMemo(
    () => handoffs
      .filter((handoff) => handoff.missionId === selectedMissionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    [handoffs, selectedMissionId]
  );

  const timeline = useMemo(
    () => buildTimeline(selectedMission, selectedMissionSteps, selectedMissionArtifacts, selectedMissionHandoffs),
    [selectedMission, selectedMissionSteps, selectedMissionArtifacts, selectedMissionHandoffs]
  );

  const missionStats = useMemo(() => ({
    total: missions.length,
    running: missions.filter((mission) => mission.status === 'running').length,
    completed: missions.filter((mission) => mission.status === 'completed').length,
    failed: missions.filter((mission) => mission.status === 'failed').length
  }), [missions]);

  const latestArtifactByStepId = useMemo(() => {
    const map = new Map<string, AgentArtifact>();
    selectedMissionArtifacts.forEach((artifact) => {
      const previous = map.get(artifact.stepId);
      if (!previous || artifact.version >= previous.version) {
        map.set(artifact.stepId, artifact);
      }
    });
    return map;
  }, [selectedMissionArtifacts]);

  const handleRunPoc = async () => {
    const cleanedInput = initialInput.trim();
    if (!cleanedInput) {
      setFeedback('Descreva a ideia inicial antes de executar a POC.');
      return;
    }

    setFeedback('Criando missao e iniciando o runner...');
    try {
      const created = await createMissionWithSteps({
        workspaceId: scopedWorkspaceId,
        createdBy: ownerUserId,
        initialInput: cleanedInput,
        agents
      });
      setSelectedMissionId(created.mission.id);
      setInitialInput('');
      setBusyMissionId(created.mission.id);
      await runMissionOrchestration({
        mission: created.mission,
        steps: created.steps,
        artifacts: [],
        agents
      });
      setFeedback('POC executada. A missao ficou registrada e rastreavel.');
    } catch (error: any) {
      setFeedback(String(error?.message || 'Falha ao iniciar a POC.'));
    } finally {
      setBusyMissionId(null);
    }
  };

  const handleReprocessStep = async (stepId: string) => {
    if (!selectedMission) return;
    setFeedback('Reprocessando etapa e retomando a missao...');
    setBusyMissionId(selectedMission.id);
    try {
      await reprocessMissionStep({
        mission: selectedMission,
        steps: selectedMissionSteps,
        artifacts: selectedMissionArtifacts,
        handoffs: selectedMissionHandoffs,
        stepId,
        agents
      });
      setFeedback('Etapa reenfileirada e runner retomado.');
    } catch (error: any) {
      setFeedback(String(error?.message || 'Falha ao reprocessar etapa.'));
    } finally {
      setBusyMissionId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(236,253,255,0.88)_38%,_rgba(239,246,255,0.84)_100%)]">
      <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
        <section className="rounded-[2rem] border border-cyan-100 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.08)] px-8 py-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex gap-4">
              <button
                onClick={onBack}
                className="w-12 h-12 rounded-2xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:text-slate-900 hover:border-slate-300 transition-colors"
              >
                <BackIcon className="w-5 h-5" />
              </button>
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.34em] text-cyan-600">POC DE ORQUESTRACAO NATIVA</p>
                <h1 className="text-5xl font-black tracking-tight text-slate-950">Missoes</h1>
                <p className="max-w-3xl text-sm leading-7 text-slate-600">
                  Runner deterministico para validar a cadeia nativa de 3 agentes no SagB:
                  descoberta e requisitos, escopo de produto e arquitetura tecnica.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 min-w-[320px]">
              {[
                { label: 'Total', value: missionStats.total, tone: 'border-cyan-100 bg-cyan-50/70 text-cyan-800' },
                { label: 'Executando', value: missionStats.running, tone: 'border-sky-100 bg-sky-50/70 text-sky-800' },
                { label: 'Concluidas', value: missionStats.completed, tone: 'border-emerald-100 bg-emerald-50/70 text-emerald-800' },
                { label: 'Falhas', value: missionStats.failed, tone: 'border-rose-100 bg-rose-50/70 text-rose-800' }
              ].map((card) => (
                <div key={card.label} className={`rounded-2xl border px-4 py-4 ${card.tone}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">{card.label}</p>
                  <p className="mt-2 text-3xl font-black">{card.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {schemaMissing && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            A base da POC ainda nao existe neste ambiente. Aplique a migration
            <span className="font-bold"> 20260314000101_agent_missions_poc.sql</span> no Supabase para ativar o modulo.
          </div>
        )}

        <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.9fr] gap-6">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Input inicial</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Dispare a POC</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Um unico input gera a missao, as 3 etapas, os artifacts e os handoffs formais.
                </p>
              </div>

              <textarea
                value={initialInput}
                onChange={(event) => setInitialInput(event.target.value)}
                placeholder="Descreva a ideia bruta que deve passar pelos 3 agentes..."
                className="w-full min-h-[180px] rounded-3xl border border-slate-200 bg-slate-50/80 px-5 py-4 text-sm leading-7 text-slate-700 outline-none focus:border-cyan-300 focus:bg-white"
              />

              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Cadeia oficial</p>
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <span className="font-semibold">1. Analista de Descoberta e Requisitos</span>
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">requirements_brief</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <span className="font-semibold">2. Estrategista de Produto</span>
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">product_scope</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <span className="font-semibold">3. Arquiteto Tecnico</span>
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">technical_architecture</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleRunPoc}
                disabled={Boolean(busyMissionId) || schemaMissing}
                className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyMissionId ? 'Executando POC...' : 'Executar POC'}
              </button>

              {feedback && (
                <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
                  {feedback}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Missoes registradas</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Fila e historico</h2>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Workspace</p>
                <p className="mt-1 text-xs font-semibold text-slate-700">{scopedWorkspaceId}</p>
              </div>
            </div>

            <div className="mt-6 space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {missions.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                  Nenhuma missao criada ainda neste workspace.
                </div>
              )}

              {missions.map((mission) => {
                const isSelected = selectedMissionId === mission.id;
                return (
                  <button
                    key={mission.id}
                    onClick={() => setSelectedMissionId(mission.id)}
                    className={`w-full rounded-3xl border px-5 py-4 text-left transition ${
                      isSelected
                        ? 'border-cyan-200 bg-cyan-50/80 shadow-[0_12px_30px_rgba(34,211,238,0.14)]'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                          Missao #{mission.id.slice(0, 8)}
                        </p>
                        <h3 className="mt-2 text-lg font-black tracking-tight text-slate-950">{mission.title}</h3>
                        <p className="mt-2 text-sm text-slate-600 line-clamp-2">{mission.initialInput}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeClasses(mission.status)}`}>
                        {statusLabel(mission.status)}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                      <span>Etapa atual: {mission.currentStepIndex}/3</span>
                      <span>{formatDateTime(mission.updatedAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {selectedMission && (
          <section className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
            <div className="space-y-6">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Missao selecionada</p>
                    <h2 className="text-3xl font-black tracking-tight text-slate-950">{selectedMission.title}</h2>
                    <p className="text-sm leading-7 text-slate-600">{selectedMission.initialInput}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeClasses(selectedMission.status)}`}>
                      {statusLabel(selectedMission.status)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                      Etapa atual {selectedMission.currentStepIndex}/3
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Criada em', value: formatDateTime(selectedMission.createdAt) },
                    { label: 'Inicio', value: formatDateTime(selectedMission.startedAt) },
                    { label: 'Fim', value: formatDateTime(selectedMission.finishedAt) }
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Etapas</p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Cadeia executada</h3>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                    Runner deterministico
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  {selectedMissionSteps.map((step) => {
                    const latestArtifact = latestArtifactByStepId.get(step.id);
                    return (
                      <div key={step.id} className="rounded-3xl border border-slate-200 bg-slate-50/80 px-5 py-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                                Etapa {step.stepIndex}
                              </span>
                              <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeClasses(step.status)}`}>
                                {statusLabel(step.status)}
                              </span>
                              <span className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">
                                {step.artifactType}
                              </span>
                            </div>
                            <h4 className="text-xl font-black tracking-tight text-slate-950">{step.stepName}</h4>
                            <p className="text-sm text-slate-600">
                              {step.agentName}
                              {step.payload?.agentSource === 'poc_template' && (
                                <span className="ml-2 text-xs font-semibold text-amber-700">template interno</span>
                              )}
                            </p>
                          </div>

                          {step.status === 'failed' && (
                            <button
                              onClick={() => handleReprocessStep(step.id)}
                              disabled={busyMissionId === selectedMission.id}
                              className="rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Reprocessar etapa
                            </button>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Rastreio da etapa</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-600">
                              <p><span className="font-semibold text-slate-800">Inicio:</span> {formatDateTime(step.startedAt)}</p>
                              <p><span className="font-semibold text-slate-800">Fim:</span> {formatDateTime(step.finishedAt)}</p>
                              <p><span className="font-semibold text-slate-800">Validacao:</span> {step.validationStatus || '-'}</p>
                              <p><span className="font-semibold text-slate-800">Retries:</span> {step.retryCount}</p>
                            </div>
                            {step.errorMessage && (
                              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                                {step.errorMessage}
                              </div>
                            )}
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Artifact mais recente</p>
                            {!latestArtifact ? (
                              <p className="mt-3 text-sm text-slate-500">Nenhum artifact gerado ainda.</p>
                            ) : (
                              <div className="mt-3 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeClasses(latestArtifact.status)}`}>
                                    {statusLabel(latestArtifact.status)}
                                  </span>
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                                    v{latestArtifact.version}
                                  </span>
                                </div>
                                <pre className="max-h-[220px] overflow-auto rounded-2xl bg-slate-950 px-4 py-4 text-[11px] leading-6 text-cyan-100">
                                  {JSON.stringify(latestArtifact.contentJson || {}, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Handoffs</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Transicoes formais</h3>
                <div className="mt-5 space-y-3">
                  {selectedMissionHandoffs.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      Nenhum handoff formal registrado ainda.
                    </div>
                  )}

                  {selectedMissionHandoffs.map((handoff) => {
                    const fromStep = selectedMissionSteps.find((step) => step.id === handoff.fromStepId);
                    const toStep = selectedMissionSteps.find((step) => step.id === handoff.toStepId);
                    return (
                      <div key={handoff.id} className="rounded-3xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{fromStep?.stepName || 'Origem'} -&gt; {toStep?.stepName || 'Destino'}</p>
                            <p className="mt-1 text-xs text-slate-500">{handoff.note || 'Handoff formal criado.'}</p>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeClasses(handoff.status)}`}>
                            {statusLabel(handoff.status)}
                          </span>
                        </div>
                        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {formatDateTime(handoff.acceptedAt || handoff.createdAt)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Timeline</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Rastreabilidade</h3>
                <div className="mt-5 space-y-3 max-h-[560px] overflow-y-auto pr-1">
                  {timeline.map((event) => (
                    <div key={event.id} className="rounded-3xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{event.title}</p>
                          <p className="mt-1 text-sm text-slate-600">{event.note}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeClasses(event.status)}`}>
                          {statusLabel(event.status)}
                        </span>
                      </div>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {formatDateTime(event.timestamp)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default AgentMissionsView;
