import { AgentQualityEvent, IntelligenceFlow, IntelligenceFlowStatus, IntelligenceFlowStep, IntelligenceFlowType, KnowledgeNode, Task, Topic } from '../types';

type ChatSessionLike = {
  id: string;
  workspaceId?: string;
  title?: string;
  agentId?: string;
  status?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  lastMessageAt?: Date | string;
  payload?: Record<string, any>;
};

type ChatMessageLike = {
  id: string;
  workspaceId?: string;
  sessionId?: string;
  agentId?: string;
  sender?: string;
  text?: string;
  participantName?: string;
  createdAt?: Date | string;
  payload?: Record<string, any>;
};

type BuildFlowsParams = {
  workspaceId?: string | null;
  sessions?: ChatSessionLike[];
  messages?: ChatMessageLike[];
  tasks?: Task[];
  topics?: Topic[];
  knowledgeNodes?: KnowledgeNode[];
  qualityEvents?: AgentQualityEvent[];
  limit?: number;
};

type FlowSummary = {
  total: number;
  byType: Record<IntelligenceFlowType, number>;
  byStatus: Record<IntelligenceFlowStatus, number>;
};

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const normalizeText = (value: any): string => String(value || '').trim();

const safeList = <T>(list: T[] | undefined | null): T[] => (Array.isArray(list) ? list : []);

const statusFromText = (text: string): IntelligenceFlowStatus => {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return 'pending';
  if (
    normalized.includes('erro') ||
    normalized.includes('timeout') ||
    normalized.includes('falha') ||
    normalized.includes('nao foi possivel') ||
    normalized.includes('não foi possível')
  ) {
    return 'error';
  }
  return 'ok';
};

const detectResultAction = (messages: ChatMessageLike[]): { action: string; flowType: IntelligenceFlowType } => {
  const joined = messages.map((message) => normalizeText(message.text).toLowerCase()).join('\n');
  if (/(nova pauta|pauta criada|gerar pauta|sess[aã]o de pautas)/i.test(joined)) {
    return { action: 'Pauta criada', flowType: 'operation' };
  }
  if (/(tarefa criada|task criada|nova tarefa)/i.test(joined)) {
    return { action: 'Tarefa criada', flowType: 'operation' };
  }
  if (/(decis[aã]o|decidir|aprovado|aprovada|registrada)/i.test(joined)) {
    return { action: 'Decisão registrada', flowType: 'decision' };
  }
  return { action: 'Resposta gerada', flowType: 'conversation' };
};

const createStep = (params: Omit<IntelligenceFlowStep, 'id'> & { id: string }): IntelligenceFlowStep => ({
  id: params.id,
  actorType: params.actorType,
  actorName: params.actorName,
  actionType: params.actionType,
  status: params.status,
  timestamp: params.timestamp,
  modelUsed: params.modelUsed,
  note: params.note
});

const buildConversationFlow = (session: ChatSessionLike, sessionMessages: ChatMessageLike[]): IntelligenceFlow => {
  const orderedMessages = [...sessionMessages].sort((a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime());
  const steps: IntelligenceFlowStep[] = [];
  const participants = new Set<string>();
  const flowId = `flow_chat_${session.id}`;

  const firstUserMessage = orderedMessages.find((message) => String(message.sender || '').toLowerCase() === 'user');
  if (firstUserMessage) {
    participants.add('Rodrigues');
    steps.push(createStep({
      id: `${flowId}_q1`,
      actorType: 'user',
      actorName: 'Rodrigues',
      actionType: 'question',
      status: 'ok',
      timestamp: toDate(firstUserMessage.createdAt)
    }));
  }

  let previousBotSpeaker = '';
  let stepIndex = 2;
  let hasError = false;
  let hasHandoff = false;

  orderedMessages
    .filter((message) => String(message.sender || '').toLowerCase() === 'bot')
    .forEach((message) => {
      const speaker = normalizeText(message.participantName) || normalizeText(message.agentId) || 'Agente';
      participants.add(speaker);
      const text = normalizeText(message.text);
      const modelUsed = normalizeText(message.payload?.model_used || message.payload?.modelUsed || '');
      const messageStatus = statusFromText(text);

      if (previousBotSpeaker && previousBotSpeaker !== speaker) {
        hasHandoff = true;
        steps.push(createStep({
          id: `${flowId}_s${stepIndex++}`,
          actorType: 'system',
          actorName: 'Sistema',
          actionType: 'handoff',
          status: 'ok',
          timestamp: toDate(message.createdAt),
          note: `${previousBotSpeaker} -> ${speaker}`
        }));
      }

      if (messageStatus === 'error') hasError = true;

      steps.push(createStep({
        id: `${flowId}_s${stepIndex++}`,
        actorType: 'agent',
        actorName: speaker,
        actionType: 'response',
        status: messageStatus,
        timestamp: toDate(message.createdAt),
        modelUsed: modelUsed || undefined,
        note: text.slice(0, 120)
      }));

      previousBotSpeaker = speaker;
    });

  const resultDetection = detectResultAction(orderedMessages);
  let flowType: IntelligenceFlowType = resultDetection.flowType;
  if (hasError) flowType = 'error';
  else if (hasHandoff) flowType = 'handoff';

  const finalStatus: IntelligenceFlowStatus = hasError ? 'error' : (steps.length > 0 ? 'ok' : 'pending');
  const flowTimestamp = toDate(session.lastMessageAt || session.updatedAt || session.createdAt);

  return {
    id: flowId,
    workspaceId: session.workspaceId,
    flowType,
    origin: normalizeText(session.title) || 'Nova conversa',
    participants: Array.from(participants),
    steps,
    finalAction: resultDetection.action,
    status: finalStatus,
    timestamp: flowTimestamp,
    sourceKind: 'conversation',
    sourceId: session.id,
    payload: {
      agentId: session.agentId || null,
      sessionStatus: session.status || null
    }
  };
};

const buildKnowledgeFlow = (node: KnowledgeNode): IntelligenceFlow => {
  const ts = toDate((node as any).updatedAt || (node as any).createdAt);
  const id = `flow_kn_${node.id}`;
  const title = normalizeText(node.title) || 'Documento sem título';

  return {
    id,
    workspaceId: node.workspaceId,
    flowType: 'knowledge',
    origin: `CID: ${title}`,
    participants: ['Sistema', 'CID'],
    steps: [
      createStep({
        id: `${id}_s1`,
        actorType: 'cid',
        actorName: 'CID',
        actionType: 'analysis',
        status: 'ok',
        timestamp: ts,
        note: 'Conteúdo processado'
      }),
      createStep({
        id: `${id}_s2`,
        actorType: 'cid',
        actorName: 'CID',
        actionType: 'synthesis',
        status: 'ok',
        timestamp: ts,
        note: 'Resumo e estrutura gerados'
      }),
      createStep({
        id: `${id}_s3`,
        actorType: 'system',
        actorName: 'Sistema',
        actionType: 'knowledge',
        status: 'ok',
        timestamp: ts,
        note: 'Base de conhecimento atualizada'
      })
    ],
    finalAction: 'Conhecimento salvo',
    status: 'ok',
    timestamp: ts,
    sourceKind: 'knowledge',
    sourceId: node.id
  };
};

const buildQualityFlow = (event: AgentQualityEvent): IntelligenceFlow => {
  const ts = toDate(event.createdAt);
  const isError = String(event.eventType || '').toLowerCase().endsWith('_error');
  const status = (String(event.status || '').toLowerCase() === 'closed' && !isError) ? 'ok' : (isError ? 'error' : 'pending');
  const id = `flow_qe_${event.id}`;
  const agentName = normalizeText(event.agentName || event.agentId) || 'Agente';

  return {
    id,
    workspaceId: event.workspaceId,
    flowType: isError ? 'error' : 'decision',
    origin: event.conversationId ? `Conversa ${event.conversationId.slice(0, 8)}` : 'Monitoramento de qualidade',
    participants: ['Sistema', agentName],
    steps: [
      createStep({
        id: `${id}_s1`,
        actorType: 'system',
        actorName: 'Sensor',
        actionType: isError ? 'error' : 'analysis',
        status: isError ? 'error' : 'ok',
        timestamp: ts,
        note: String(event.eventType || 'quality_event')
      }),
      createStep({
        id: `${id}_s2`,
        actorType: 'agent',
        actorName: agentName,
        actionType: isError ? 'response' : 'decision',
        status,
        timestamp: ts,
        modelUsed: event.modelUsed || undefined,
        note: normalizeText(event.excerpt || event.correctionText || '')
      })
    ],
    finalAction: isError ? 'Erro detectado' : 'Qualidade validada',
    status,
    timestamp: ts,
    sourceKind: 'quality',
    sourceId: event.id,
    payload: {
      eventType: event.eventType,
      severity: event.severity,
      detectedBy: event.detectedBy
    }
  };
};

const pushOperationFlows = (
  target: IntelligenceFlow[],
  list: Array<Task | Topic>,
  flowType: IntelligenceFlowType,
  finalAction: string
) => {
  safeList(list).forEach((item: any) => {
    const ts = toDate(item.createdAt || item.timestamp || item.updatedAt);
    const id = `flow_op_${flowType}_${item.id}`;
    const title = normalizeText(item.title) || 'Registro sem título';
    target.push({
      id,
      workspaceId: item.workspaceId,
      flowType,
      origin: title,
      participants: ['Rodrigues', 'Sistema'],
      steps: [
        createStep({
          id: `${id}_s1`,
          actorType: 'user',
          actorName: 'Rodrigues',
          actionType: flowType === 'decision' ? 'decision' : 'agenda',
          status: 'ok',
          timestamp: ts
        }),
        createStep({
          id: `${id}_s2`,
          actorType: 'system',
          actorName: 'Sistema',
          actionType: flowType === 'decision' ? 'decision' : 'task',
          status: 'ok',
          timestamp: ts
        })
      ],
      finalAction,
      status: 'ok',
      timestamp: ts,
      sourceKind: 'operation',
      sourceId: String(item.id || '')
    });
  });
};

export const buildIntelligenceFlows = (params: BuildFlowsParams): IntelligenceFlow[] => {
  const workspaceId = normalizeText(params.workspaceId);
  const sessions = safeList(params.sessions);
  const messages = safeList(params.messages);
  const tasks = safeList(params.tasks);
  const topics = safeList(params.topics);
  const knowledgeNodes = safeList(params.knowledgeNodes);
  const qualityEvents = safeList(params.qualityEvents);

  const scopedSessions = workspaceId
    ? sessions.filter((session) => !session.workspaceId || String(session.workspaceId) === workspaceId)
    : sessions;
  const scopedMessages = workspaceId
    ? messages.filter((message) => !message.workspaceId || String(message.workspaceId) === workspaceId)
    : messages;
  const scopedKnowledge = workspaceId
    ? knowledgeNodes.filter((node) => !node.workspaceId || String(node.workspaceId) === workspaceId)
    : knowledgeNodes;
  const scopedQuality = workspaceId
    ? qualityEvents.filter((event) => !event.workspaceId || String(event.workspaceId) === workspaceId)
    : qualityEvents;

  const messagesBySession = scopedMessages.reduce<Record<string, ChatMessageLike[]>>((acc, message) => {
    const sessionId = normalizeText(message.sessionId);
    if (!sessionId) return acc;
    if (!acc[sessionId]) acc[sessionId] = [];
    acc[sessionId].push(message);
    return acc;
  }, {});

  const flows: IntelligenceFlow[] = [];

  scopedSessions.forEach((session) => {
    const sessionMessages = messagesBySession[session.id] || [];
    flows.push(buildConversationFlow(session, sessionMessages));
  });

  scopedKnowledge.slice(0, 50).forEach((node) => flows.push(buildKnowledgeFlow(node)));
  scopedQuality.slice(0, 80).forEach((event) => flows.push(buildQualityFlow(event)));

  pushOperationFlows(flows, topics, 'operation', 'Pauta registrada');
  pushOperationFlows(flows, tasks, 'operation', 'Tarefa registrada');

  return flows
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, params.limit || 200);
};

export const summarizeIntelligenceFlows = (flows: IntelligenceFlow[]): FlowSummary => {
  const safeFlows = safeList(flows);
  const byType: FlowSummary['byType'] = {
    conversation: 0,
    handoff: 0,
    decision: 0,
    operation: 0,
    knowledge: 0,
    error: 0
  };
  const byStatus: FlowSummary['byStatus'] = {
    ok: 0,
    pending: 0,
    error: 0,
    waiting: 0
  };

  safeFlows.forEach((flow) => {
    byType[flow.flowType] += 1;
    byStatus[flow.status] += 1;
  });

  return {
    total: safeFlows.length,
    byType,
    byStatus
  };
};

export const formatFlowTypeLabel = (value: IntelligenceFlowType | string): string => {
  const labels: Record<string, string> = {
    conversation: 'Conversa',
    handoff: 'Handoff',
    decision: 'Decisão',
    operation: 'Operação',
    knowledge: 'Conhecimento',
    error: 'Erro'
  };
  return labels[String(value)] || 'Conversa';
};

export const formatFlowStatusLabel = (value: IntelligenceFlowStatus | string): string => {
  const labels: Record<string, string> = {
    ok: 'Ok',
    pending: 'Pendente',
    error: 'Erro',
    waiting: 'Aguardando'
  };
  return labels[String(value)] || 'Pendente';
};

export const formatFlowActionLabel = (value: string): string => {
  const labels: Record<string, string> = {
    question: 'Pergunta',
    analysis: 'Análise',
    handoff: 'Handoff',
    response: 'Resposta',
    synthesis: 'Síntese',
    task: 'Tarefa',
    agenda: 'Pauta',
    decision: 'Decisão',
    knowledge: 'Conhecimento',
    error: 'Erro'
  };
  return labels[String(value)] || 'Ação';
};
