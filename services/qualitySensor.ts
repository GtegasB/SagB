import { Agent, AgentQualityDetectedBy, AgentQualityEventType, AgentQualitySeverity, Message, ModelProvider, Sender } from '../types';
import { addDoc, collection, db } from './supabase';

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

const CORRECTION_PATTERNS = [
  /nao foi isso/i,
  /não foi isso/i,
  /entendeu errado/i,
  /nao era isso/i,
  /não era isso/i,
  /deixa eu reformular/i,
  /vou reformular/i
];

const APPROVAL_PATTERNS = [
  /agora sim/i,
  /perfeito/i,
  /otimo/i,
  /ótimo/i,
  /era isso/i,
  /boa resposta/i,
  /excelente/i
];

const RESOLUTION_PATTERNS = [
  /resolvido/i,
  /deu certo/i,
  /funcionou/i,
  /fechado/i,
  /pode seguir/i
];

const STRATEGIC_KEYWORDS = [
  'estrategia',
  'estratégia',
  'roadmap',
  'go to market',
  'go-to-market',
  'prioridade executiva',
  'expansao',
  'expansão',
  'posicionamento',
  'alocacao',
  'alocação'
];

const ESCALATION_TOKENS = ['escalar', 'escalonar', 'encaminhar', 'supervisor', 'diretoria'];

const PROVIDER_COST_TABLE: Partial<Record<ModelProvider, { inputPer1k: number; outputPer1k: number }>> = {
  // Valores estimados internos para telemetria comparativa (nao fiscal/contabil).
  gemini: { inputPer1k: 0.00035, outputPer1k: 0.00070 },
  deepseek: { inputPer1k: 0.00014, outputPer1k: 0.00028 },
  openai: { inputPer1k: 0.00015, outputPer1k: 0.00060 },
  claude: { inputPer1k: 0.00025, outputPer1k: 0.00125 },
  qwen: { inputPer1k: 0.00020, outputPer1k: 0.00060 },
  llama_local: { inputPer1k: 0, outputPer1k: 0 }
};

export type QualityEventDraft = {
  eventType: AgentQualityEventType | string;
  eventSubtype?: string;
  severity?: AgentQualitySeverity | string;
  detectedBy?: AgentQualityDetectedBy | string;
  messageRef?: string;
  excerpt?: string;
  correctionText?: string;
  status?: string;
  payload?: Record<string, any>;
};

export type QualityContext = {
  workspaceId?: string | null;
  ventureId?: string | null;
  conversationId?: string | null;
  turnId?: number | null;
  agent?: Agent | null;
  modelUsed?: ModelProvider | string | null;
  workflowVersion?: string;
  policyVersion?: string;
};

const normalizeText = (value: string): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const compact = (value: string, max = 900): string => {
  const trimmed = String(value || '').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}...`;
};

const hasAnyPattern = (text: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));

const countTokenEstimate = (text: string) => {
  const chars = String(text || '').length;
  return Math.max(1, Math.ceil(chars / 4));
};

const textSimilarity = (a: string, b: string) => {
  const na = normalizeText(a).replace(/\s+/g, ' ').trim();
  const nb = normalizeText(b).replace(/\s+/g, ' ').trim();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    const minLen = Math.min(na.length, nb.length);
    const maxLen = Math.max(na.length, nb.length);
    return minLen / maxLen;
  }
  const wordsA = new Set(na.split(' ').filter(Boolean));
  const wordsB = new Set(nb.split(' ').filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter((word) => wordsB.has(word)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
};

const detectStrategicLanguage = (text: string) => {
  const normalized = normalizeText(text);
  return STRATEGIC_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)));
};

const detectEscalationLanguage = (text: string) => {
  const normalized = normalizeText(text);
  return ESCALATION_TOKENS.some((token) => normalized.includes(normalizeText(token)));
};

const estimateCostUsd = (provider: ModelProvider | string | null | undefined, promptTokens: number, completionTokens: number) => {
  const key = (provider || '') as ModelProvider;
  const rates = PROVIDER_COST_TABLE[key];
  if (!rates) return null;
  const inputCost = (promptTokens / 1000) * rates.inputPer1k;
  const outputCost = (completionTokens / 1000) * rates.outputPer1k;
  return Number((inputCost + outputCost).toFixed(6));
};

export const createMessageTelemetry = (params: {
  provider?: ModelProvider | string | null;
  promptText?: string;
  completionText?: string;
  latencyMs?: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
}) => {
  const promptTokens = params.promptTokens ?? countTokenEstimate(params.promptText || '');
  const completionTokens = params.completionTokens ?? countTokenEstimate(params.completionText || '');
  const totalTokens = promptTokens + completionTokens;
  const costEstimatedUsd = estimateCostUsd(params.provider, promptTokens, completionTokens);

  return {
    model_used: params.provider || null,
    latency_ms: Number(params.latencyMs || 0),
    prompt_tokens_estimated: promptTokens,
    completion_tokens_estimated: completionTokens,
    total_tokens_estimated: totalTokens,
    cost_estimated_usd: costEstimatedUsd,
    pricing_note: 'estimated_internal_rates_v1'
  };
};

export const detectUserQualityEvents = (userText: string): QualityEventDraft[] => {
  const text = String(userText || '').trim();
  if (!text) return [];

  const events: QualityEventDraft[] = [];
  if (hasAnyPattern(text, CORRECTION_PATTERNS)) {
    events.push({
      eventType: 'understanding_error',
      eventSubtype: 'user_correction',
      severity: 'medium',
      detectedBy: 'user',
      correctionText: compact(text),
      excerpt: compact(text)
    });
  }

  if (hasAnyPattern(text, APPROVAL_PATTERNS)) {
    events.push({
      eventType: 'approved_response',
      eventSubtype: 'explicit_approval',
      severity: 'low',
      detectedBy: 'user',
      excerpt: compact(text),
      status: 'closed'
    });
  }

  if (hasAnyPattern(text, RESOLUTION_PATTERNS)) {
    events.push({
      eventType: 'successful_resolution',
      eventSubtype: 'user_resolution_signal',
      severity: 'low',
      detectedBy: 'user',
      excerpt: compact(text),
      status: 'closed'
    });
  }

  return events;
};

export const detectBotQualityEvents = (params: {
  speaker: Agent;
  finalBotText: string;
  previousBotText?: string;
  summonTargetName?: string | null;
  summonTargetAgent?: Agent | null;
}): QualityEventDraft[] => {
  const events: QualityEventDraft[] = [];
  const text = String(params.finalBotText || '').trim();
  if (!text) return events;

  if (params.previousBotText) {
    const similarity = textSimilarity(text, params.previousBotText);
    if (similarity >= 0.92) {
      events.push({
        eventType: 'repetition_error',
        eventSubtype: 'high_similarity_with_previous_reply',
        severity: 'low',
        detectedBy: 'rule',
        excerpt: compact(text),
        payload: { similarity }
      });
    }
  }

  if (params.speaker.tier === 'OPERACIONAL' && detectStrategicLanguage(text) && !detectEscalationLanguage(text)) {
    events.push({
      eventType: 'hierarchy_error',
      eventSubtype: 'operational_agent_answered_strategic_scope',
      severity: 'medium',
      detectedBy: 'rule',
      excerpt: compact(text)
    });
  }

  if (params.summonTargetName) {
    if (!params.summonTargetAgent) {
      events.push({
        eventType: 'handoff_error',
        eventSubtype: 'target_not_found',
        severity: 'medium',
        detectedBy: 'rule',
        excerpt: compact(text),
        payload: { summonTargetName: params.summonTargetName }
      });
    } else if (params.summonTargetAgent.id === params.speaker.id) {
      events.push({
        eventType: 'handoff_error',
        eventSubtype: 'self_handoff',
        severity: 'medium',
        detectedBy: 'rule',
        excerpt: compact(text),
        payload: { summonTargetName: params.summonTargetName }
      });
    } else {
      const sourceArea = normalizeText(params.speaker.area || '');
      const targetArea = normalizeText(params.summonTargetAgent.area || '');
      const areaMismatch = sourceArea && targetArea && sourceArea !== targetArea;

      if (areaMismatch) {
        events.push({
          eventType: 'handoff_error',
          eventSubtype: 'cross_area_handoff_needs_review',
          severity: 'medium',
          detectedBy: 'rule',
          excerpt: compact(text),
          payload: {
            sourceArea: params.speaker.area,
            targetArea: params.summonTargetAgent.area,
            summonTargetName: params.summonTargetName
          }
        });
      } else {
        events.push({
          eventType: 'correct_handoff',
          eventSubtype: 'valid_handoff',
          severity: 'low',
          detectedBy: 'rule',
          excerpt: compact(text),
          status: 'closed',
          payload: {
            summonTargetName: params.summonTargetName
          }
        });
      }
    }
  }

  const hasDepthMarkers =
    text.length >= 420 &&
    (text.includes('\n- ') || text.includes('\n•') || /\n\d+\./.test(text));
  if (hasDepthMarkers) {
    events.push({
      eventType: 'strong_response',
      eventSubtype: 'structured_detailed_response',
      severity: 'low',
      detectedBy: 'rule',
      excerpt: compact(text, 500),
      status: 'closed'
    });
  }

  return events;
};

export const persistQualityEvent = async (context: QualityContext, draft: QualityEventDraft) => {
  const workspaceId = context.workspaceId && String(context.workspaceId).trim()
    ? String(context.workspaceId)
    : DEFAULT_WORKSPACE_ID;
  const now = new Date();

  return addDoc(collection(db, 'agent_quality_events'), {
    workspaceId,
    ventureId: context.ventureId || context.agent?.ventureId || null,
    conversationId: context.conversationId || null,
    turnId: context.turnId ?? null,
    agentId: context.agent?.id || null,
    agentName: context.agent?.name || null,
    eventType: draft.eventType,
    eventSubtype: draft.eventSubtype || null,
    severity: draft.severity || 'medium',
    detectedBy: draft.detectedBy || 'system',
    messageRef: draft.messageRef || null,
    excerpt: draft.excerpt || null,
    correctionText: draft.correctionText || null,
    modelUsed: context.modelUsed || null,
    workflowVersion: context.workflowVersion || 'chat-v1',
    dnaVersion: context.agent?.version || context.workflowVersion || 'v1',
    policyVersion: context.policyVersion || 'governance-v1',
    status: draft.status || 'open',
    createdAt: now,
    resolvedAt: null,
    payload: draft.payload || null
  });
};

export const persistQualityEventsBatch = async (context: QualityContext, drafts: QualityEventDraft[]) => {
  const list = Array.isArray(drafts) ? drafts.filter(Boolean) : [];
  if (list.length === 0) return;

  await Promise.all(
    list.map((draft) =>
      persistQualityEvent(context, draft).catch((error) => {
        console.warn('Falha ao persistir agent_quality_events:', error);
      })
    )
  );
};

export const getTurnIdFromMessages = (messages: Message[]) => {
  const userTurns = (messages || []).filter((message) => message.sender === Sender.User).length;
  return userTurns + 1;
};
