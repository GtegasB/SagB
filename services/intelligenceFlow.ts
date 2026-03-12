import {
  Agent,
  IntelligenceFlowActionType,
  IntelligenceFlowActorType,
  IntelligenceFlowSourceKind,
  IntelligenceFlowStatus,
  IntelligenceFlowType
} from '../types';
import { addDoc, collection, db, doc, updateDoc } from './supabase';

type StartIntelligenceFlowParams = {
  workspaceId: string;
  ventureId?: string | null;
  conversationId?: string | null;
  turnId?: number | null;
  executionRunId?: string | null;
  flowType: IntelligenceFlowType;
  sourceKind: IntelligenceFlowSourceKind;
  sourceId?: string | null;
  origin: string;
  participants?: string[];
  finalAction?: string;
  status?: IntelligenceFlowStatus;
  payload?: Record<string, any>;
};

type AppendIntelligenceFlowStepParams = {
  flowId: string;
  workspaceId: string;
  conversationId?: string | null;
  turnId?: number | null;
  stepOrder: number;
  actorType: IntelligenceFlowActorType;
  actorId?: string | null;
  actorName: string;
  actionType: IntelligenceFlowActionType;
  status?: IntelligenceFlowStatus;
  modelUsed?: string | null;
  workflowVersion?: string | null;
  policyVersion?: string | null;
  dnaVersion?: string | null;
  latencyMs?: number | null;
  estimatedCost?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  note?: string | null;
  eventTime?: Date;
  payload?: Record<string, any>;
};

type FinalizeIntelligenceFlowParams = {
  flowId: string;
  flowType?: IntelligenceFlowType;
  finalAction: string;
  status: IntelligenceFlowStatus;
  participants?: string[];
  payload?: Record<string, any>;
};

const toNumberOrNull = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeParticipants = (participants?: string[]) => {
  return Array.from(
    new Set(
      (participants || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
};

export const startIntelligenceFlow = async (params: StartIntelligenceFlowParams): Promise<string> => {
  const now = new Date();
  const flowDoc = await addDoc(collection(db, 'intelligence_flows'), {
    workspaceId: params.workspaceId,
    ventureId: params.ventureId || null,
    conversationId: params.conversationId || null,
    turnId: params.turnId ?? null,
    executionRunId: params.executionRunId || null,
    flowType: params.flowType,
    sourceKind: params.sourceKind,
    sourceId: params.sourceId || null,
    origin: params.origin || 'Fluxo de Inteligência',
    finalAction: params.finalAction || 'Em processamento',
    status: params.status || 'running',
    participants: normalizeParticipants(params.participants),
    payload: params.payload || {},
    createdAt: now,
    updatedAt: now
  });
  return flowDoc.id;
};

export const appendIntelligenceFlowStep = async (params: AppendIntelligenceFlowStepParams) => {
  return addDoc(collection(db, 'intelligence_flow_steps'), {
    flowId: params.flowId,
    workspaceId: params.workspaceId,
    conversationId: params.conversationId || null,
    turnId: params.turnId ?? null,
    stepOrder: params.stepOrder,
    actorType: params.actorType,
    actorId: params.actorId || null,
    actorName: params.actorName || 'Sistema',
    actionType: params.actionType,
    status: params.status || 'ok',
    modelUsed: params.modelUsed || null,
    workflowVersion: params.workflowVersion || null,
    policyVersion: params.policyVersion || null,
    dnaVersion: params.dnaVersion || null,
    latencyMs: toNumberOrNull(params.latencyMs),
    estimatedCost: toNumberOrNull(params.estimatedCost),
    tokensIn: toNumberOrNull(params.tokensIn),
    tokensOut: toNumberOrNull(params.tokensOut),
    note: params.note || null,
    eventTime: params.eventTime || new Date(),
    payload: params.payload || null,
    createdAt: new Date()
  });
};

export const finalizeIntelligenceFlow = async (params: FinalizeIntelligenceFlowParams) => {
  return updateDoc(doc(db, 'intelligence_flows', params.flowId), {
    ...(params.flowType ? { flowType: params.flowType } : {}),
    finalAction: params.finalAction,
    status: params.status,
    ...(params.participants ? { participants: normalizeParticipants(params.participants) } : {}),
    ...(params.payload ? { payload: params.payload } : {}),
    updatedAt: new Date()
  });
};

export const inferFlowFinalAction = (params: {
  userText: string;
  generatedReplies: Array<{ text: string }>;
  suggestionsCount?: number;
}) => {
  const joined = [
    params.userText,
    ...(params.generatedReplies || []).map((reply) => String(reply.text || ''))
  ].join('\n').toLowerCase();

  if (/pauta criada|nova pauta|agenda criada|sess[aã]o de pautas/.test(joined)) return 'Pauta criada';
  if (/tarefa criada|task criada|nova tarefa/.test(joined)) return 'Tarefa criada';
  if (/decis[aã]o registrada|decis[aã]o tomada|aprovado/.test(joined)) return 'Decisão registrada';
  if ((params.suggestionsCount || 0) > 0) return `${params.suggestionsCount} sugestão(ões) de pauta gerada(s)`;
  return 'Resposta gerada';
};

export const createTaskGenerationFlow = async (params: {
  workspaceId: string;
  ventureId?: string | null;
  conversationId?: string | null;
  turnId?: number | null;
  sourceId?: string | null;
  userName: string;
  agent?: Agent | null;
  title: string;
  actionType: 'task_created' | 'agenda_created';
  note?: string;
}) => {
  const participants = [params.userName, params.agent?.name || 'Sistema'].filter(Boolean);
  const flowId = await startIntelligenceFlow({
    workspaceId: params.workspaceId,
    ventureId: params.ventureId || params.agent?.ventureId || null,
    conversationId: params.conversationId || null,
    turnId: params.turnId ?? null,
    flowType: 'task_generation',
    sourceKind: 'operation',
    sourceId: params.sourceId || params.conversationId || null,
    origin: params.title || 'Geração operacional',
    participants,
    finalAction: params.actionType === 'agenda_created' ? 'Pauta criada' : 'Tarefa criada',
    status: 'ok',
    payload: {
      trigger: 'chat_operation',
      actionType: params.actionType
    }
  });

  await appendIntelligenceFlowStep({
    flowId,
    workspaceId: params.workspaceId,
    conversationId: params.conversationId || null,
    turnId: params.turnId ?? null,
    stepOrder: 1,
    actorType: 'user',
    actorName: params.userName || 'Usuário',
    actionType: 'question',
    status: 'ok',
    note: 'Solicitação operacional disparada via chat'
  });

  if (params.agent?.name) {
    await appendIntelligenceFlowStep({
      flowId,
      workspaceId: params.workspaceId,
      conversationId: params.conversationId || null,
      turnId: params.turnId ?? null,
      stepOrder: 2,
      actorType: 'agent',
      actorId: params.agent.id,
      actorName: params.agent.name,
      actionType: 'synthesis',
      status: 'ok',
      note: params.note || `Título operacional: ${params.title}`
    });
  }

  await appendIntelligenceFlowStep({
    flowId,
    workspaceId: params.workspaceId,
    conversationId: params.conversationId || null,
    turnId: params.turnId ?? null,
    stepOrder: params.agent?.name ? 3 : 2,
    actorType: 'system',
    actorName: 'Sistema',
    actionType: params.actionType,
    status: 'ok',
    note: params.actionType === 'agenda_created' ? 'Pauta registrada no sistema' : 'Tarefa registrada no sistema'
  });

  return flowId;
};
