import React, { useEffect, useMemo, useState } from 'react';
import {
  IntelligenceFlowActionType,
  IntelligenceFlowSourceKind,
  IntelligenceFlowStatus,
  IntelligenceFlowStepRow,
  IntelligenceFlowType
} from '../types';
import { collection, db, onSnapshot, orderBy, query, where } from '../services/supabase';
import { BackIcon } from './Icon';

type FlowRow = {
  id: string;
  workspaceId: string;
  ventureId?: string | null;
  conversationId?: string | null;
  turnId?: number | null;
  executionRunId?: string | null;
  flowType: IntelligenceFlowType;
  sourceKind: IntelligenceFlowSourceKind;
  sourceId?: string | null;
  origin: string;
  finalAction: string;
  status: IntelligenceFlowStatus;
  participants: string[];
  payload?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

interface IntelligenceFlowViewProps {
  workspaceId?: string | null;
  onBack?: () => void;
}

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const toNumber = (value: any): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeParticipants = (value: any): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') return String(item.name || item.label || item.id || '').trim();
      return '';
    })
    .filter(Boolean);
};

const formatDateTime = (value: Date) => value.toLocaleString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

const flowTypeLabel = (value: IntelligenceFlowType | string) => {
  const map: Record<string, string> = {
    conversation: 'Conversa',
    handoff: 'Handoff',
    decision: 'Decisão',
    task_generation: 'Geração de tarefa',
    cid_processing: 'Processamento CID'
  };
  return map[String(value)] || 'Conversa';
};

const actionTypeLabel = (value: IntelligenceFlowActionType | string) => {
  const map: Record<string, string> = {
    question: 'Pergunta',
    analysis: 'Análise',
    response: 'Resposta',
    handoff: 'Handoff',
    synthesis: 'Síntese',
    task_created: 'Tarefa criada',
    agenda_created: 'Pauta criada',
    decision_registered: 'Decisão registrada',
    knowledge_saved: 'Conhecimento salvo',
    error: 'Erro'
  };
  return map[String(value)] || 'Ação';
};

const statusLabel = (value: IntelligenceFlowStatus | string) => {
  const map: Record<string, string> = {
    pending: 'Pendente',
    running: 'Executando',
    ok: 'Ok',
    warning: 'Atenção',
    error: 'Erro',
    cancelled: 'Cancelado'
  };
  return map[String(value)] || 'Pendente';
};

const sourceKindLabel = (value: IntelligenceFlowSourceKind | string) => {
  const map: Record<string, string> = {
    conversation: 'Conversa',
    operation: 'Operação',
    quality: 'Qualidade',
    governance: 'Governança',
    cid: 'CID',
    n8n: 'n8n'
  };
  return map[String(value)] || 'Conversa';
};

const typeBadge = (flowType: string) => {
  if (flowType === 'handoff') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
  if (flowType === 'decision') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (flowType === 'task_generation') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (flowType === 'cid_processing') return 'bg-purple-50 text-purple-700 border-purple-100';
  return 'bg-slate-50 text-slate-700 border-slate-100';
};

const statusBadge = (status: string) => {
  if (status === 'ok') return 'bg-green-100 text-green-700';
  if (status === 'running') return 'bg-blue-100 text-blue-700';
  if (status === 'warning') return 'bg-yellow-100 text-yellow-700';
  if (status === 'error') return 'bg-red-100 text-red-700';
  if (status === 'cancelled') return 'bg-gray-200 text-gray-700';
  return 'bg-gray-100 text-gray-600';
};

const actorDot = (actorType: string) => {
  if (actorType === 'user') return 'bg-blue-500';
  if (actorType === 'agent') return 'bg-indigo-500';
  if (actorType === 'cid') return 'bg-purple-500';
  if (actorType === 'governance') return 'bg-amber-500';
  return 'bg-gray-400';
};

const periodToMs = (period: string): number | null => {
  if (period === '24h') return 24 * 60 * 60 * 1000;
  if (period === '7d') return 7 * 24 * 60 * 60 * 1000;
  if (period === '30d') return 30 * 24 * 60 * 60 * 1000;
  if (period === '90d') return 90 * 24 * 60 * 60 * 1000;
  return null;
};

const IntelligenceFlowView: React.FC<IntelligenceFlowViewProps> = ({ workspaceId, onBack }) => {
  const scopedWorkspaceId = workspaceId && workspaceId.trim() ? workspaceId : DEFAULT_WORKSPACE_ID;
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [steps, setSteps] = useState<IntelligenceFlowStepRow[]>([]);
  const [flowTableMissing, setFlowTableMissing] = useState(false);
  const [stepsTableMissing, setStepsTableMissing] = useState(false);

  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | '24h' | '7d' | '30d' | '90d'>('7d');
  const [ventureFilter, setVentureFilter] = useState('all');
  const [flowTypeFilter, setFlowTypeFilter] = useState<'all' | IntelligenceFlowType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | IntelligenceFlowStatus>('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [sourceKindFilter, setSourceKindFilter] = useState<'all' | IntelligenceFlowSourceKind>('all');
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);

  useEffect(() => {
    let flowDisabled = false;
    let stepsDisabled = false;

    const flowsQuery = query(
      collection(db, 'intelligence_flows'),
      where('workspaceId', '==', scopedWorkspaceId),
      orderBy('createdAt', 'desc')
    );
    const stepsQuery = query(
      collection(db, 'intelligence_flow_steps'),
      where('workspaceId', '==', scopedWorkspaceId),
      orderBy('eventTime', 'asc')
    );

    const unsubscribeFlows = onSnapshot(flowsQuery, (snapshot) => {
      if (flowDisabled) return;
      const rows = snapshot.docs.map((doc) => {
        const row = doc.data() as any;
        return {
          id: String(row.id || doc.id),
          workspaceId: String(row.workspaceId || scopedWorkspaceId),
          ventureId: row.ventureId || null,
          conversationId: row.conversationId || null,
          turnId: row.turnId ?? null,
          executionRunId: row.executionRunId || null,
          flowType: row.flowType || 'conversation',
          sourceKind: row.sourceKind || 'conversation',
          sourceId: row.sourceId || null,
          origin: String(row.origin || 'Fluxo'),
          finalAction: String(row.finalAction || 'Sem ação final'),
          status: row.status || 'pending',
          participants: normalizeParticipants(row.participants),
          payload: row.payload || {},
          createdAt: toDate(row.createdAt),
          updatedAt: toDate(row.updatedAt)
        } as FlowRow;
      });
      setFlows(rows);
    }, (error: any) => {
      const message = String(error?.details?.message || error?.message || '');
      if (/Could not find the table 'public\.intelligence_flows'/i.test(message)) {
        flowDisabled = true;
        setFlowTableMissing(true);
        setFlows([]);
        return;
      }
      console.error('Erro ao carregar intelligence_flows:', error);
    });

    const unsubscribeSteps = onSnapshot(stepsQuery, (snapshot) => {
      if (stepsDisabled) return;
      const rows = snapshot.docs.map((doc) => {
        const row = doc.data() as any;
        return {
          id: String(row.id || doc.id),
          flowId: String(row.flowId || ''),
          workspaceId: String(row.workspaceId || scopedWorkspaceId),
          conversationId: row.conversationId || null,
          turnId: row.turnId ?? null,
          stepOrder: Number(row.stepOrder || 0),
          actorType: row.actorType || 'system',
          actorId: row.actorId || null,
          actorName: String(row.actorName || 'Sistema'),
          actionType: row.actionType || 'analysis',
          status: row.status || 'pending',
          modelUsed: row.modelUsed || null,
          workflowVersion: row.workflowVersion || null,
          policyVersion: row.policyVersion || null,
          dnaVersion: row.dnaVersion || null,
          latencyMs: row.latencyMs ?? null,
          estimatedCost: row.estimatedCost ?? null,
          tokensIn: row.tokensIn ?? null,
          tokensOut: row.tokensOut ?? null,
          note: row.note || null,
          eventTime: toDate(row.eventTime),
          payload: row.payload || null,
          createdAt: toDate(row.createdAt)
        } as IntelligenceFlowStepRow;
      });
      rows.sort((a, b) => a.stepOrder - b.stepOrder || a.eventTime.getTime() - b.eventTime.getTime());
      setSteps(rows);
    }, (error: any) => {
      const message = String(error?.details?.message || error?.message || '');
      if (/Could not find the table 'public\.intelligence_flow_steps'/i.test(message)) {
        stepsDisabled = true;
        setStepsTableMissing(true);
        setSteps([]);
        return;
      }
      console.error('Erro ao carregar intelligence_flow_steps:', error);
    });

    return () => {
      unsubscribeFlows?.();
      unsubscribeSteps?.();
    };
  }, [scopedWorkspaceId]);

  const stepsByFlow = useMemo(() => {
    return steps.reduce<Record<string, IntelligenceFlowStepRow[]>>((acc, step) => {
      if (!acc[step.flowId]) acc[step.flowId] = [];
      acc[step.flowId].push(step);
      return acc;
    }, {});
  }, [steps]);

  const filterOptions = useMemo(() => {
    const ventures = Array.from(new Set(flows.map((flow) => String(flow.ventureId || '').trim()).filter(Boolean))).sort();
    const agents = Array.from(new Set(
      steps
        .filter((step) => step.actorType === 'agent')
        .map((step) => String(step.actorName || '').trim())
        .filter(Boolean)
    )).sort();
    const models = Array.from(new Set(
      steps
        .map((step) => String(step.modelUsed || '').trim())
        .filter(Boolean)
    )).sort();
    const sourceKinds = Array.from(new Set(flows.map((flow) => String(flow.sourceKind || '').trim()).filter(Boolean))).sort();
    return { ventures, agents, models, sourceKinds };
  }, [flows, steps]);

  const filteredFlows = useMemo(() => {
    const now = Date.now();
    const periodWindowMs = periodToMs(periodFilter);
    const searchTerm = search.trim().toLowerCase();

    return flows.filter((flow) => {
      if (periodWindowMs !== null) {
        const delta = now - flow.createdAt.getTime();
        if (delta > periodWindowMs) return false;
      }
      if (ventureFilter !== 'all' && String(flow.ventureId || '') !== ventureFilter) return false;
      if (flowTypeFilter !== 'all' && flow.flowType !== flowTypeFilter) return false;
      if (statusFilter !== 'all' && flow.status !== statusFilter) return false;
      if (sourceKindFilter !== 'all' && flow.sourceKind !== sourceKindFilter) return false;

      const flowSteps = stepsByFlow[flow.id] || [];
      if (agentFilter !== 'all') {
        const hasAgent = flowSteps.some((step) => step.actorType === 'agent' && step.actorName === agentFilter);
        if (!hasAgent) return false;
      }
      if (modelFilter !== 'all') {
        const hasModel = flowSteps.some((step) => String(step.modelUsed || '') === modelFilter);
        if (!hasModel) return false;
      }

      if (searchTerm) {
        const haystack = [
          flow.origin,
          flow.finalAction,
          flow.sourceKind,
          flow.sourceId,
          flow.conversationId,
          flow.executionRunId,
          flow.participants.join(' '),
          ...flowSteps.map((step) => `${step.actorName} ${step.actionType} ${step.note || ''}`)
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }

      return true;
    });
  }, [flows, stepsByFlow, periodFilter, ventureFilter, flowTypeFilter, statusFilter, sourceKindFilter, agentFilter, modelFilter, search]);

  useEffect(() => {
    if (filteredFlows.length === 0) {
      setSelectedFlowId(null);
      return;
    }
    if (!selectedFlowId || !filteredFlows.some((flow) => flow.id === selectedFlowId)) {
      setSelectedFlowId(filteredFlows[0].id);
    }
  }, [filteredFlows, selectedFlowId]);

  const selectedFlow = useMemo(() => {
    if (!selectedFlowId) return null;
    return filteredFlows.find((flow) => flow.id === selectedFlowId) || null;
  }, [filteredFlows, selectedFlowId]);

  const selectedSteps = useMemo(() => {
    if (!selectedFlow) return [];
    return (stepsByFlow[selectedFlow.id] || []).slice().sort((a, b) => a.stepOrder - b.stepOrder);
  }, [selectedFlow, stepsByFlow]);

  const selectedMetrics = useMemo(() => {
    return selectedSteps.reduce((acc, step) => {
      acc.tokensIn += toNumber(step.tokensIn);
      acc.tokensOut += toNumber(step.tokensOut);
      acc.latencyMs += toNumber(step.latencyMs);
      acc.estimatedCost += toNumber(step.estimatedCost);
      return acc;
    }, {
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
      estimatedCost: 0
    });
  }, [selectedSteps]);

  return (
    <div className="flex-1 h-full bg-[#F9FAFB] flex flex-col font-nunito overflow-hidden">
      <div className="max-w-[1600px] mx-auto w-full px-6 py-6 h-full flex flex-col gap-4">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                <BackIcon className="w-6 h-6" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-black text-bitrix-nav uppercase tracking-tighter">Fluxo de Inteligência</h2>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                Trilha oficial das interações até virar ação, decisão, handoff ou processamento
              </p>
            </div>
          </div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {filteredFlows.length} de {flows.length} fluxos
          </div>
        </header>

        {(flowTableMissing || stepsTableMissing) && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-800">
            {flowTableMissing && <div>• Tabela `public.intelligence_flows` não encontrada.</div>}
            {stepsTableMissing && <div>• Tabela `public.intelligence_flow_steps` não encontrada.</div>}
            <div className="mt-1 font-semibold">Aplique a migration V2 do Fluxo de Inteligência no Supabase.</div>
          </div>
        )}

        <section className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por origem, participante, ação final, source_id..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
            <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value as any)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              <option value="all">Período: tudo</option>
              <option value="24h">Últimas 24h</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
            </select>
            <select value={ventureFilter} onChange={(event) => setVentureFilter(event.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              <option value="all">Venture: todas</option>
              {filterOptions.ventures.map((venture) => (
                <option key={venture} value={venture}>{venture}</option>
              ))}
            </select>
            <select value={flowTypeFilter} onChange={(event) => setFlowTypeFilter(event.target.value as any)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              <option value="all">Tipo: todos</option>
              <option value="conversation">Conversa</option>
              <option value="handoff">Handoff</option>
              <option value="decision">Decisão</option>
              <option value="task_generation">Geração de tarefa</option>
              <option value="cid_processing">Processamento CID</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as any)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              <option value="all">Status: todos</option>
              <option value="pending">Pendente</option>
              <option value="running">Executando</option>
              <option value="ok">Ok</option>
              <option value="warning">Atenção</option>
              <option value="error">Erro</option>
              <option value="cancelled">Cancelado</option>
            </select>
            <select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              <option value="all">Agente: todos</option>
              {filterOptions.agents.map((agent) => (
                <option key={agent} value={agent}>{agent}</option>
              ))}
            </select>
            <select value={modelFilter} onChange={(event) => setModelFilter(event.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              <option value="all">Modelo: todos</option>
              {filterOptions.models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <select value={sourceKindFilter} onChange={(event) => setSourceKindFilter(event.target.value as any)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              <option value="all">Origem técnica: todas</option>
              {filterOptions.sourceKinds.map((sourceKind) => (
                <option key={sourceKind} value={sourceKind}>{sourceKindLabel(sourceKind)}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[440px_1fr] gap-4">
          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-500">
              Fluxos monitorados
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {filteredFlows.length === 0 && (
                <div className="text-sm text-gray-400 p-4">Nenhum fluxo encontrado para os filtros atuais.</div>
              )}

              {filteredFlows.map((flow) => {
                const flowSteps = stepsByFlow[flow.id] || [];
                const isActive = selectedFlowId === flow.id;
                return (
                  <button
                    key={flow.id}
                    onClick={() => setSelectedFlowId(flow.id)}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${
                      isActive ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${typeBadge(flow.flowType)}`}>
                        {flowTypeLabel(flow.flowType)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusBadge(flow.status)}`}>
                        {statusLabel(flow.status)}
                      </span>
                    </div>
                    <div className="text-sm font-black text-gray-900 truncate">{flow.origin}</div>
                    <div className="text-xs text-gray-500 mt-1 truncate">{flow.participants.join(' -> ') || 'Sem participantes'}</div>
                    <div className="text-xs text-gray-600 mt-2">
                      <span className="font-semibold">Resultado:</span> {flow.finalAction}
                    </div>
                    <div className="mt-2 text-[11px] text-gray-400 flex items-center justify-between">
                      <span>{formatDateTime(flow.createdAt)}</span>
                      <span>{flowSteps.length} step(s)</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden flex flex-col min-h-0">
            {!selectedFlow && (
              <div className="flex-1 grid place-items-center text-sm text-gray-400">
                Selecione um fluxo para abrir a timeline detalhada.
              </div>
            )}

            {selectedFlow && (
              <>
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-gray-900 tracking-tight">{selectedFlow.origin}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{selectedFlow.participants.join(' -> ') || 'Sem participantes'}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${typeBadge(selectedFlow.flowType)}`}>
                        {flowTypeLabel(selectedFlow.flowType)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusBadge(selectedFlow.status)}`}>
                        {statusLabel(selectedFlow.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 border-b border-gray-100 grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-gray-100 px-3 py-2">
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">Tokens In</div>
                    <div className="text-lg font-black text-gray-800">{Math.round(selectedMetrics.tokensIn).toLocaleString('pt-BR')}</div>
                  </div>
                  <div className="rounded-lg border border-gray-100 px-3 py-2">
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">Tokens Out</div>
                    <div className="text-lg font-black text-gray-800">{Math.round(selectedMetrics.tokensOut).toLocaleString('pt-BR')}</div>
                  </div>
                  <div className="rounded-lg border border-gray-100 px-3 py-2">
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">Latência total</div>
                    <div className="text-lg font-black text-gray-800">{Math.round(selectedMetrics.latencyMs).toLocaleString('pt-BR')} ms</div>
                  </div>
                  <div className="rounded-lg border border-gray-100 px-3 py-2">
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">Custo estimado</div>
                    <div className="text-lg font-black text-gray-800">${selectedMetrics.estimatedCost.toFixed(4)}</div>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Timeline detalhada</div>
                  <div className="space-y-3">
                    {selectedSteps.length === 0 && (
                      <div className="text-sm text-gray-400">Sem etapas registradas neste fluxo.</div>
                    )}

                    {selectedSteps.map((step) => (
                      <div key={step.id} className="rounded-xl border border-gray-100 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${actorDot(step.actorType)}`}></span>
                            <span className="text-xs font-black text-gray-900">{step.actorName}</span>
                            <span className="text-xs text-gray-400">#{step.stepOrder}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusBadge(step.status)}`}>
                              {statusLabel(step.status)}
                            </span>
                            <span className="text-[11px] text-gray-400">{formatDateTime(step.eventTime)}</span>
                          </div>
                        </div>

                        <div className="text-xs text-gray-700 mt-2">
                          <span className="font-semibold">{actionTypeLabel(step.actionType)}</span>
                          {step.modelUsed && <span className="text-gray-400"> • {step.modelUsed}</span>}
                        </div>

                        {step.note && (
                          <div className="text-xs text-gray-500 mt-1 break-words">{step.note}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 px-5 py-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Metadados do fluxo</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 text-xs text-gray-600">
                    <div><span className="font-semibold text-gray-700">source_kind:</span> {sourceKindLabel(selectedFlow.sourceKind)}</div>
                    <div><span className="font-semibold text-gray-700">source_id:</span> {selectedFlow.sourceId || '-'}</div>
                    <div><span className="font-semibold text-gray-700">conversation_id:</span> {selectedFlow.conversationId || '-'}</div>
                    <div><span className="font-semibold text-gray-700">turn_id:</span> {selectedFlow.turnId ?? '-'}</div>
                    <div><span className="font-semibold text-gray-700">execution_run_id:</span> {selectedFlow.executionRunId || '-'}</div>
                    <div><span className="font-semibold text-gray-700">final_action:</span> {selectedFlow.finalAction}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default IntelligenceFlowView;
