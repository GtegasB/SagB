import React, { useEffect, useMemo, useState } from 'react';
import { AgentQualityEvent } from '../types';
import { BackIcon } from './Icon';
import { collection, db, onSnapshot, orderBy, query, where } from '../services/supabase';
import { getProvidersHealth, ProvidersHealthMap } from '../services/providerHealth';

interface QualitySensorViewProps {
  qualityEvents: AgentQualityEvent[];
  workspaceId?: string | null;
  onBack?: () => void;
}

type ChatSessionRow = {
  id: string;
  workspaceId?: string;
  title?: string;
  agentId?: string;
};

type ChatMessageRow = {
  id: string;
  workspaceId?: string;
  sessionId?: string;
  agentId?: string;
  sender?: string;
  participantName?: string;
  createdAt?: Date | string;
  payload?: Record<string, any>;
};

const toLabel = (value: string) => {
  const normalized = String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  if (!normalized) return '-';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getSeverityBadge = (severity: string) => {
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'critical') return 'bg-red-100 text-red-700';
  if (normalized === 'high') return 'bg-orange-100 text-orange-700';
  if (normalized === 'medium') return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-600';
};

const getEventBadge = (eventType: string) => {
  const normalized = String(eventType || '').toLowerCase();
  if (normalized.endsWith('_error')) return 'bg-red-50 text-red-700';
  return 'bg-green-50 text-green-700';
};

const QualitySensorView: React.FC<QualitySensorViewProps> = ({
  qualityEvents,
  workspaceId,
  onBack
}) => {
  const [chatSessions, setChatSessions] = useState<ChatSessionRow[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessageRow[]>([]);
  const [providersHealth, setProvidersHealth] = useState<Partial<ProvidersHealthMap>>({});
  const [providersHealthCheckedAt, setProvidersHealthCheckedAt] = useState<string>('');
  const [providersHealthError, setProvidersHealthError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const loadProvidersHealth = async () => {
      try {
        const result = await getProvidersHealth();
        if (cancelled) return;
        setProvidersHealth(result.providers || {});
        setProvidersHealthCheckedAt(result.checkedAt || '');
        setProvidersHealthError('');
      } catch (error: any) {
        if (cancelled) return;
        setProvidersHealthError(String(error?.message || 'Falha ao carregar saúde das APIs.'));
      }
    };

    loadProvidersHealth();
    intervalId = window.setInterval(loadProvidersHealth, 30000);

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const hasWorkspace = typeof workspaceId === 'string' && workspaceId.length > 0;
    let sessionsSubscriptionDisabled = false;
    let messagesSubscriptionDisabled = false;

    const sessionsQuery = hasWorkspace
      ? query(collection(db, 'chat_sessions'), where('workspaceId', '==', workspaceId), orderBy('updatedAt', 'desc'))
      : query(collection(db, 'chat_sessions'), orderBy('updatedAt', 'desc'));

    const messagesQuery = hasWorkspace
      ? query(collection(db, 'chat_messages'), where('workspaceId', '==', workspaceId), orderBy('createdAt', 'desc'))
      : query(collection(db, 'chat_messages'), orderBy('createdAt', 'desc'));

    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      if (sessionsSubscriptionDisabled) return;
      const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
      setChatSessions(rows as ChatSessionRow[]);
    }, (error: any) => {
      const rawMessage = String(error?.details?.message || error?.message || '');
      if (/Could not find the table 'public\.chat_sessions'/i.test(rawMessage)) {
        sessionsSubscriptionDisabled = true;
        setChatSessions([]);
        console.warn('Tabela public.chat_sessions não existe. Métricas por conversa desativadas.');
        return;
      }
      console.error('Erro ao carregar chat_sessions para dashboard de tokens:', error);
    });

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      if (messagesSubscriptionDisabled) return;
      const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
      setChatMessages(rows as ChatMessageRow[]);
    }, (error: any) => {
      const rawMessage = String(error?.details?.message || error?.message || '');
      if (/Could not find the table 'public\.chat_messages'/i.test(rawMessage)) {
        messagesSubscriptionDisabled = true;
        setChatMessages([]);
        console.warn('Tabela public.chat_messages não existe. Métricas por mensagem desativadas.');
        return;
      }
      console.error('Erro ao carregar chat_messages para dashboard de tokens:', error);
    });

    return () => {
      unsubscribeSessions?.();
      unsubscribeMessages?.();
    };
  }, [workspaceId]);

  const qualitySummary = useMemo(() => {
    const rows = Array.isArray(qualityEvents) ? qualityEvents : [];
    const total = rows.length;
    const open = rows.filter((event) => String(event.status || 'open').toLowerCase() === 'open').length;
    const critical = rows.filter((event) => String(event.severity || '').toLowerCase() === 'critical').length;
    const errors = rows.filter((event) => String(event.eventType || '').toLowerCase().endsWith('_error')).length;
    const positives = rows.filter((event) => !String(event.eventType || '').toLowerCase().endsWith('_error')).length;

    const byType = rows.reduce<Record<string, number>>((acc, event) => {
      const type = String(event.eventType || 'unknown');
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const topTypes = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const byAgent = rows.reduce<Record<string, number>>((acc, event) => {
      const name = String(event.agentName || event.agentId || 'Sem agente');
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    const topAgents = Object.entries(byAgent)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      total,
      open,
      critical,
      errors,
      positives,
      topTypes,
      topAgents
    };
  }, [qualityEvents]);

  const recentQualityEvents = useMemo(() => {
    return [...(qualityEvents || [])]
      .sort((a, b) => {
        const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as any).getTime();
        const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt as any).getTime();
        return tb - ta;
      })
      .slice(0, 50);
  }, [qualityEvents]);

  const tokenMetrics = useMemo(() => {
    const toNumber = (value: any): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number(value.replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    const sessionTitleById = new Map<string, string>();
    (chatSessions || []).forEach((session) => {
      const sessionId = String(session.id || '').trim();
      if (!sessionId) return;
      sessionTitleById.set(sessionId, String(session.title || 'Nova Conversa'));
    });

    const enriched = (chatMessages || []).map((message) => {
      const payload = (message.payload && typeof message.payload === 'object') ? message.payload : {};
      const promptTokens = toNumber(payload.prompt_tokens_estimated ?? payload.promptTokensEstimated);
      const completionTokens = toNumber(payload.completion_tokens_estimated ?? payload.completionTokensEstimated);
      const totalTokens = toNumber(payload.total_tokens_estimated ?? payload.totalTokensEstimated ?? (promptTokens + completionTokens));
      const costEstimatedUsd = toNumber(payload.cost_estimated_usd ?? payload.costEstimatedUsd);
      const latencyMs = toNumber(payload.latency_ms ?? payload.latencyMs);
      const modelUsed = String(payload.model_used ?? payload.modelUsed ?? '').trim().toLowerCase();
      const sessionId = String(message.sessionId || '').trim();
      const sender = String(message.sender || '').toLowerCase();
      const agentLabel = String(message.participantName || message.agentId || 'Sem agente');

      return {
        id: String(message.id || ''),
        sessionId,
        sessionTitle: sessionTitleById.get(sessionId) || 'Sessão sem título',
        sender,
        agentLabel,
        modelUsed: modelUsed || '-',
        promptTokens,
        completionTokens,
        totalTokens,
        costEstimatedUsd,
        latencyMs
      };
    }).filter((row) => row.totalTokens > 0 || row.costEstimatedUsd > 0 || row.latencyMs > 0);

    const totals = enriched.reduce((acc, row) => {
      acc.promptTokens += row.promptTokens;
      acc.completionTokens += row.completionTokens;
      acc.totalTokens += row.totalTokens;
      acc.costEstimatedUsd += row.costEstimatedUsd;
      if (row.latencyMs > 0) {
        acc.latencyCount += 1;
        acc.latencyTotal += row.latencyMs;
      }
      return acc;
    }, {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costEstimatedUsd: 0,
      latencyCount: 0,
      latencyTotal: 0
    });

    const byConversationMap = new Map<string, {
      sessionId: string;
      title: string;
      totalTokens: number;
      costEstimatedUsd: number;
      messageCount: number;
    }>();

    const byAgentMap = new Map<string, {
      agent: string;
      totalTokens: number;
      costEstimatedUsd: number;
      responses: number;
    }>();

    const byModelMap = new Map<string, {
      model: string;
      totalTokens: number;
      costEstimatedUsd: number;
      responses: number;
    }>();

    enriched.forEach((row) => {
      const conversationKey = row.sessionId || 'sem_sessao';
      const previousConversation = byConversationMap.get(conversationKey) || {
        sessionId: row.sessionId || '—',
        title: row.sessionTitle,
        totalTokens: 0,
        costEstimatedUsd: 0,
        messageCount: 0
      };
      previousConversation.totalTokens += row.totalTokens;
      previousConversation.costEstimatedUsd += row.costEstimatedUsd;
      previousConversation.messageCount += 1;
      byConversationMap.set(conversationKey, previousConversation);

      if (row.sender === 'bot') {
        const agentKey = row.agentLabel || 'Sem agente';
        const previousAgent = byAgentMap.get(agentKey) || {
          agent: agentKey,
          totalTokens: 0,
          costEstimatedUsd: 0,
          responses: 0
        };
        previousAgent.totalTokens += row.totalTokens;
        previousAgent.costEstimatedUsd += row.costEstimatedUsd;
        previousAgent.responses += 1;
        byAgentMap.set(agentKey, previousAgent);

        const modelKey = row.modelUsed || '-';
        const previousModel = byModelMap.get(modelKey) || {
          model: modelKey,
          totalTokens: 0,
          costEstimatedUsd: 0,
          responses: 0
        };
        previousModel.totalTokens += row.totalTokens;
        previousModel.costEstimatedUsd += row.costEstimatedUsd;
        previousModel.responses += 1;
        byModelMap.set(modelKey, previousModel);
      }
    });

    const byConversation = [...byConversationMap.values()]
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 20);

    const byAgent = [...byAgentMap.values()]
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 20);

    const byModel = [...byModelMap.values()]
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 20);

    return {
      totals,
      byConversation,
      byAgent,
      byModel,
      recordsCount: enriched.length,
      avgLatencyMs: totals.latencyCount > 0 ? Math.round(totals.latencyTotal / totals.latencyCount) : 0
    };
  }, [chatMessages, chatSessions]);

  const formatMoneyUsd = (value: number) => {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  return (
    <div className="flex-1 h-full bg-[#F9FAFB] flex flex-col font-nunito overflow-y-auto custom-scrollbar relative">
      <div className="max-w-6xl mx-auto w-full p-8">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                <BackIcon className="w-6 h-6" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-black text-bitrix-nav uppercase tracking-tighter">Sensor de Qualidade</h2>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Eventos de erro e acerto nas interações dos agentes</p>
            </div>
          </div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {qualitySummary.total} eventos totais
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
            <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Total</div>
            <div className="text-xl font-black text-gray-800">{qualitySummary.total}</div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
            <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Erros</div>
            <div className="text-xl font-black text-red-600">{qualitySummary.errors}</div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
            <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Positivos</div>
            <div className="text-xl font-black text-green-600">{qualitySummary.positives}</div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
            <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Abertos</div>
            <div className="text-xl font-black text-orange-600">{qualitySummary.open}</div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
            <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Críticos</div>
            <div className="text-xl font-black text-red-700">{qualitySummary.critical}</div>
          </div>
        </div>

        <section className="rounded-2xl border border-gray-100 overflow-hidden bg-white mb-6">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-widest">
            Saúde das APIs de IA oficiais
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {(['gemini', 'deepseek', 'openai', 'claude', 'llama_local'] as const).map((provider) => {
                const item = providersHealth?.[provider];
                const isOk = Boolean(item?.ok);
                return (
                  <div key={provider} className="rounded-xl border border-gray-100 bg-white px-4 py-3">
                    <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">{provider}</div>
                    <div className={`text-sm font-black ${item ? (isOk ? 'text-emerald-600' : 'text-red-600') : 'text-gray-500'}`}>
                      {item ? (isOk ? '🟢 ONLINE' : '🔴 OFFLINE') : '⚪ SEM DADO'}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">{item?.latencyMs ? `${item.latencyMs} ms` : '-'}</div>
                    <div className="text-[11px] text-gray-400 mt-1 line-clamp-2">{item?.message || 'Sem diagnóstico'}</div>
                  </div>
                );
              })}
            </div>
            {providersHealthCheckedAt && (
              <div className="text-[11px] text-gray-400 mt-3">
                Última checagem: {new Date(providersHealthCheckedAt).toLocaleString('pt-BR')}
              </div>
            )}
            {providersHealthError && (
              <div className="text-[11px] text-red-500 mt-2">{providersHealthError}</div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl border border-gray-100 p-4 bg-white">
            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Top tipos</h4>
            <div className="space-y-2">
              {qualitySummary.topTypes.length === 0 && (
                <div className="text-xs text-gray-400">Sem eventos ainda.</div>
              )}
              {qualitySummary.topTypes.map(([eventType, count]) => (
                <div key={eventType} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-700">{toLabel(eventType)}</span>
                  <span className="font-black text-gray-500">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 p-4 bg-white">
            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Top agentes</h4>
            <div className="space-y-2">
              {qualitySummary.topAgents.length === 0 && (
                <div className="text-xs text-gray-400">Sem eventos ainda.</div>
              )}
              {qualitySummary.topAgents.map(([agentName, count]) => (
                <div key={agentName} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-700">{agentName}</span>
                  <span className="font-black text-gray-500">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-gray-100 overflow-hidden bg-white mb-6">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-widest">
            Dashboard de tokens e custo (por conversa)
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
              <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Registros</div>
                <div className="text-lg font-black text-gray-800">{tokenMetrics.recordsCount}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Tokens total</div>
                <div className="text-lg font-black text-gray-800">{Math.round(tokenMetrics.totals.totalTokens).toLocaleString('pt-BR')}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Prompt</div>
                <div className="text-lg font-black text-gray-800">{Math.round(tokenMetrics.totals.promptTokens).toLocaleString('pt-BR')}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Completion</div>
                <div className="text-lg font-black text-gray-800">{Math.round(tokenMetrics.totals.completionTokens).toLocaleString('pt-BR')}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Custo estimado</div>
                <div className="text-lg font-black text-gray-800">{formatMoneyUsd(tokenMetrics.totals.costEstimatedUsd)}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Latência média</div>
                <div className="text-lg font-black text-gray-800">{tokenMetrics.avgLatencyMs} ms</div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest">Por conversa</div>
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white sticky top-0 z-10">
                      <tr className="text-[10px] text-gray-400 uppercase tracking-widest">
                        <th className="px-3 py-2 font-black">Conversa</th>
                        <th className="px-3 py-2 font-black">Tokens</th>
                        <th className="px-3 py-2 font-black">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenMetrics.byConversation.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-gray-400">Sem telemetria de tokens ainda.</td>
                        </tr>
                      )}
                      {tokenMetrics.byConversation.map((row) => (
                        <tr key={row.sessionId} className="border-t border-gray-50">
                          <td className="px-3 py-2 text-gray-700 font-semibold truncate max-w-[220px]" title={row.title}>{row.title}</td>
                          <td className="px-3 py-2 text-gray-700">{Math.round(row.totalTokens).toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-2 text-gray-700">{formatMoneyUsd(row.costEstimatedUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest">Por agente</div>
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white sticky top-0 z-10">
                      <tr className="text-[10px] text-gray-400 uppercase tracking-widest">
                        <th className="px-3 py-2 font-black">Agente</th>
                        <th className="px-3 py-2 font-black">Tokens</th>
                        <th className="px-3 py-2 font-black">Resp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenMetrics.byAgent.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-gray-400">Sem telemetria por agente.</td>
                        </tr>
                      )}
                      {tokenMetrics.byAgent.map((row) => (
                        <tr key={row.agent} className="border-t border-gray-50">
                          <td className="px-3 py-2 text-gray-700 font-semibold truncate max-w-[220px]" title={row.agent}>{row.agent}</td>
                          <td className="px-3 py-2 text-gray-700">{Math.round(row.totalTokens).toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-2 text-gray-700">{row.responses}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest">Por modelo</div>
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white sticky top-0 z-10">
                      <tr className="text-[10px] text-gray-400 uppercase tracking-widest">
                        <th className="px-3 py-2 font-black">Modelo</th>
                        <th className="px-3 py-2 font-black">Tokens</th>
                        <th className="px-3 py-2 font-black">Resp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenMetrics.byModel.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-gray-400">Sem telemetria por modelo.</td>
                        </tr>
                      )}
                      {tokenMetrics.byModel.map((row) => (
                        <tr key={row.model} className="border-t border-gray-50">
                          <td className="px-3 py-2 text-gray-700 font-semibold">{toLabel(row.model)}</td>
                          <td className="px-3 py-2 text-gray-700">{Math.round(row.totalTokens).toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-2 text-gray-700">{row.responses}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-widest">
            Últimos eventos
          </div>
          <div className="max-h-[52vh] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-white sticky top-0 z-10">
                <tr className="text-[10px] text-gray-400 uppercase tracking-widest">
                  <th className="px-4 py-3 font-black">Data</th>
                  <th className="px-4 py-3 font-black">Agente</th>
                  <th className="px-4 py-3 font-black">Evento</th>
                  <th className="px-4 py-3 font-black">Severidade</th>
                  <th className="px-4 py-3 font-black">Origem</th>
                </tr>
              </thead>
              <tbody>
                {recentQualityEvents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sem eventos registrados.</td>
                  </tr>
                )}
                {recentQualityEvents.map((event) => (
                  <tr key={event.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-gray-500">
                      {event.createdAt instanceof Date
                        ? event.createdAt.toLocaleString()
                        : new Date(event.createdAt as any).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-semibold">{event.agentName || event.agentId || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full font-black text-[10px] ${getEventBadge(String(event.eventType || ''))}`}>
                        {toLabel(String(event.eventType || ''))}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full font-black text-[10px] ${getSeverityBadge(String(event.severity || 'low'))}`}>
                        {toLabel(String(event.severity || 'low'))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{toLabel(String(event.detectedBy || 'system'))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualitySensorView;
