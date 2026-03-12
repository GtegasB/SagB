
import React, { useMemo, useState, useEffect } from 'react';
import { Agent, BusinessUnit, Task } from '../types';
import { db, collection, onSnapshot, orderBy, query, where } from '../services/supabase';
import { resolveWorkspaceId } from '../utils/supabaseChat';

interface DashboardHomeProps {
  agents: Agent[];
  tasks: Task[];
  businessUnits: BusinessUnit[];
  onNavigate: (tab: any) => void;
  activeWorkspaceId?: string | null;
}

const GERAC_SEAL = "https://static.wixstatic.com/media/64c3dc_6d0ef8c33da846cd9a3527cb01f6a1f7~mv2.png";

type CommandFlow = {
  id: string;
  flowType: string;
  status: string;
  origin: string;
  participants: string[];
  finalAction: string;
  createdAt: Date;
};

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
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

const formatFlowTypeLabel = (value: string) => {
  const map: Record<string, string> = {
    conversation: 'Conversa',
    handoff: 'Handoff',
    decision: 'Decisão',
    task_generation: 'Geração de tarefa',
    cid_processing: 'Processamento CID',
    error: 'Erro'
  };
  return map[String(value || '').toLowerCase()] || 'Conversa';
};

const formatFlowStatusLabel = (value: string) => {
  const map: Record<string, string> = {
    pending: 'Pendente',
    running: 'Executando',
    ok: 'Ok',
    warning: 'Atenção',
    error: 'Erro',
    cancelled: 'Cancelado'
  };
  return map[String(value || '').toLowerCase()] || 'Pendente';
};

const typeBadgeClass = (flowType: string) => {
  const normalized = String(flowType || '').toLowerCase();
  if (normalized === 'error') return 'bg-red-50 text-red-700 border-red-100';
  if (normalized === 'handoff') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
  if (normalized === 'task_generation') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (normalized === 'decision') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (normalized === 'cid_processing') return 'bg-purple-50 text-purple-700 border-purple-100';
  return 'bg-slate-50 text-slate-700 border-slate-100';
};

const statusBadgeClass = (status: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'error') return 'bg-red-100 text-red-700';
  if (normalized === 'ok') return 'bg-green-100 text-green-700';
  if (normalized === 'running') return 'bg-blue-100 text-blue-700';
  if (normalized === 'warning') return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-600';
};

const DashboardHome: React.FC<DashboardHomeProps> = ({ agents, tasks, businessUnits, onNavigate, activeWorkspaceId }) => {
  const [dailyStats, setDailyStats] = useState({ conversations: 0, messages: 0 });
  const [intelligenceFlowRows, setIntelligenceFlowRows] = useState<CommandFlow[]>([]);
  const [flowTableMissing, setFlowTableMissing] = useState(false);

  // --- CÁLCULO DE VOLUMETRIA EM TEMPO REAL ---
  useEffect(() => {
    const scopedWorkspaceId = resolveWorkspaceId(activeWorkspaceId);
    let sessionsCache: any[] = [];
    let messagesCache: any[] = [];

    const recalculate = () => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      const convCount = sessionsCache.filter((session: any) => {
        const createdAt = session.createdAt instanceof Date ? session.createdAt : new Date(session.createdAt || 0);
        return !Number.isNaN(createdAt.getTime()) && createdAt.getTime() >= startOfDay;
      }).length;

      const msgCount = messagesCache.filter((message: any) => {
        const createdAt = message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt || 0);
        return !Number.isNaN(createdAt.getTime()) && createdAt.getTime() >= startOfDay;
      }).length;

      setDailyStats({ conversations: convCount, messages: msgCount });
    };

    const sessionsQuery = query(
      collection(db, 'chat_sessions'),
      where('workspaceId', '==', scopedWorkspaceId)
    );
    const messagesQuery = query(
      collection(db, 'chat_messages'),
      where('workspaceId', '==', scopedWorkspaceId)
    );

    const unsubscribeSessions = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        sessionsCache = snapshot.docs.map((row: any) => row.data());
        recalculate();
      },
      (error) => console.error('Erro ao carregar métricas de sessões:', error)
    );

    const unsubscribeMessages = onSnapshot(
      messagesQuery,
      (snapshot) => {
        messagesCache = snapshot.docs.map((row: any) => row.data());
        recalculate();
      },
      (error) => console.error('Erro ao carregar métricas de mensagens:', error)
    );

    return () => {
      unsubscribeSessions();
      unsubscribeMessages();
    };
  }, [activeWorkspaceId]);

  useEffect(() => {
    const scopedWorkspaceId = resolveWorkspaceId(activeWorkspaceId);
    let flowDisabled = false;

    const intelligenceFlowQuery = query(
      collection(db, "intelligence_flows"),
      where("workspaceId", "==", scopedWorkspaceId),
      orderBy("createdAt", "desc")
    );

    const unsubscribeFlows = onSnapshot(intelligenceFlowQuery, (snapshot) => {
      if (flowDisabled) return;
      setFlowTableMissing(false);
      const rows = snapshot.docs.map((row: any) => {
        const raw = row.data() as any;
        return {
          id: String(raw.id || row.id),
          flowType: String(raw.flowType || 'conversation'),
          status: String(raw.status || 'pending'),
          origin: String(raw.origin || 'Fluxo de Inteligência'),
          participants: normalizeParticipants(raw.participants),
          finalAction: String(raw.finalAction || 'Sem ação final'),
          createdAt: toDate(raw.createdAt)
        } as CommandFlow;
      });
      setIntelligenceFlowRows(rows);
    }, (error: any) => {
      const rawMessage = String(error?.details?.message || error?.message || '');
      if (/Could not find the table 'public\.intelligence_flows'/i.test(rawMessage)) {
        flowDisabled = true;
        setFlowTableMissing(true);
        setIntelligenceFlowRows([]);
        return;
      }
      console.error('Erro ao carregar intelligence_flows no dashboard:', error);
    });

    return () => {
      unsubscribeFlows();
    };
  }, [activeWorkspaceId]);

  const latestIntelligenceFlows = useMemo(() => {
    return intelligenceFlowRows
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 3);
  }, [intelligenceFlowRows]);


  // --- CÁLCULOS DO BI (ESTÁTICO) ---

  // 1. Funil de Venture Builder (StartyB Flow)
  const totalIdeas = tasks.length;
  const totalBrands = businessUnits.length;
  const totalCompanies = businessUnits.filter(u => u.type === 'CORE' || u.type === 'VENTURY').length;
  
  // 2. Fábrica de Agentes (Produtividade)
  const trainingAgents = agents.filter(a => a.status === 'PLANNED' || a.status === 'STAGING').length;
  const activeAgents = agents.filter(a => a.status === 'ACTIVE').length;
  
  const newAgentsLast30Days = useMemo(() => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      return agents.filter(a => {
          const timestamp = parseInt(a.id);
          return !isNaN(timestamp) && timestamp > thirtyDaysAgo.getTime();
      }).length;
  }, [agents]);

  // 3. Capital Intelectual (Produtos)
  const methodologies = businessUnits.filter(u => u.type === 'METHODOLOGY').length;
  const frameworks = methodologies * 3;
  const courses = agents.filter(a => a.buId === 'acadb').length * 2;
  const mentorships = agents.filter(a => a.buId === 'douglas-rodrigues').length + 2;

  return (
    <div className="flex-1 h-full bg-[#F8FAFC] overflow-y-auto custom-scrollbar p-8 md:p-10 font-nunito animate-msg">
      
      {/* HEADER BI */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-end border-b border-gray-200 pb-6 gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-2">BI • Ecossistema</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.4em]">Business Intelligence GrupoB</p>
        </div>
        
        {/* PULSE DO DIA (VOLUMETRIA) */}
        <div className="flex gap-4">
             <div className="bg-white p-3 pr-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                </div>
                <div>
                    <span className="text-2xl font-black text-gray-800 leading-none block">{dailyStats.conversations}</span>
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Conversas Hoje</span>
                </div>
             </div>

             <div className="bg-white p-3 pr-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
                </div>
                <div>
                    <span className="text-2xl font-black text-gray-800 leading-none block">{dailyStats.messages}</span>
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Interações Hoje</span>
                </div>
             </div>
        </div>
      </header>

      {/* FLUXO DE INTELIGÊNCIA (CENTRO DE COMANDO) */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fluxo de Inteligência</h3>
          </div>
          <button
            onClick={() => onNavigate('intelligence-flow')}
            className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-[9px] font-black text-gray-500 uppercase tracking-widest hover:border-gray-300 transition-colors"
          >
            Abrir visão completa
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {flowTableMissing && (
            <div className="md:col-span-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-xs text-yellow-800">
              Tabela `public.intelligence_flows` não encontrada. Aplique a migration V2 do Fluxo de Inteligência.
            </div>
          )}

          {latestIntelligenceFlows.length === 0 && (
            <div className="md:col-span-3 rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-400">
              Sem fluxos recentes ainda. Inicie conversas e operações para popular a trilha.
            </div>
          )}

          {latestIntelligenceFlows.map((flow) => (
            <article key={flow.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${typeBadgeClass(flow.flowType)}`}>
                  {formatFlowTypeLabel(flow.flowType)}
                </span>
                <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusBadgeClass(flow.status)}`}>
                  {formatFlowStatusLabel(flow.status)}
                </span>
              </div>
              <h4 className="text-sm font-black text-gray-900 mb-2 truncate">{flow.origin}</h4>
              <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                {flow.participants.join(' -> ') || 'Sem participantes'}
              </p>
              <p className="text-xs font-semibold text-gray-600">
                Resultado: <span className="text-gray-800">{flow.finalAction}</span>
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* 1. STARTYB FLOW (FUNIL DE NEGÓCIOS) */}
      <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 bg-gray-900 rounded-full"></span>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Esteira de Negócios (StartyB)</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Ideias */}
              <div onClick={() => onNavigate('management')} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  </div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Ideias & Insights</p>
                  <h2 className="text-4xl font-black text-gray-800">{totalIdeas}</h2>
                  <div className="mt-4 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-yellow-400 h-full w-[40%]"></div>
                  </div>
                  <p className="text-[8px] text-gray-400 mt-2 font-bold uppercase">Taxa de Conversão: 15%</p>
              </div>

              {/* Marcas */}
              <div onClick={() => onNavigate('ecosystem')} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                  </div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Marcas Criadas</p>
                  <h2 className="text-4xl font-black text-gray-800">{totalBrands}</h2>
                  <div className="mt-4 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-orange-500 h-full w-[65%]"></div>
                  </div>
                  <p className="text-[8px] text-gray-400 mt-2 font-bold uppercase">Validadas pelo Mercado</p>
              </div>

              {/* Empresas */}
              <div onClick={() => onNavigate('ecosystem')} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5" /></svg>
                  </div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Empresas Ativas</p>
                  <h2 className="text-4xl font-black text-gray-800">{totalCompanies}</h2>
                  <div className="mt-4 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-green-600 h-full w-[85%]"></div>
                  </div>
                  <p className="text-[8px] text-gray-400 mt-2 font-bold uppercase">CNPJs Operacionais</p>
              </div>
          </div>
      </section>

      {/* 2. FÁBRICA DE AGENTES (WORKFORCE) */}
      <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fábrica de Inteligência (Headcount)</h3>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                  
                  {/* Metric 1 */}
                  <div className="flex flex-col items-center justify-center text-center p-2">
                      <span className="text-[3rem] font-black text-blue-600 leading-none mb-2">{newAgentsLast30Days}</span>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Criados (30 dias)</p>
                      <span className="text-[8px] text-green-500 font-bold bg-green-50 px-2 py-0.5 rounded-full mt-2">+ Velocidade</span>
                  </div>

                  {/* Metric 2 */}
                  <div className="flex flex-col items-center justify-center text-center p-2 pt-6 md:pt-2">
                      <span className="text-[3rem] font-black text-yellow-500 leading-none mb-2">{trainingAgents}</span>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Em Treinamento</p>
                      <p className="text-[8px] text-gray-400 mt-2">Planned & Staging</p>
                  </div>

                  {/* Metric 3 */}
                  <div className="flex flex-col items-center justify-center text-center p-2 pt-6 md:pt-2">
                      <span className="text-[3rem] font-black text-green-600 leading-none mb-2">{activeAgents}</span>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Homologados</p>
                      <p className="text-[8px] text-gray-400 mt-2">Prontos para Escalar</p>
                  </div>

                  {/* Metric 4 */}
                  <div className="flex flex-col items-center justify-center text-center p-2 pt-6 md:pt-2">
                      <span className="text-[3rem] font-black text-gray-800 leading-none mb-2">{agents.length}</span>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Geral</p>
                      <button onClick={() => onNavigate('fabrica-ca')} className="text-[8px] text-blue-500 font-bold hover:underline mt-2">Ir para Fábrica</button>
                  </div>

              </div>
          </div>
      </section>

      {/* 3. CAPITAL INTELECTUAL (PRODUTOS) */}
      <section>
          <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 bg-purple-600 rounded-full"></span>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Propriedade Intelectual & Produtos</h3>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Metodologias */}
              <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 flex flex-col justify-between h-32 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                      <img src={GERAC_SEAL} alt="GERAC Seal" className="w-16 h-16 object-contain" />
                  </div>
                  <div className="flex justify-between items-start z-10">
                      <img src={GERAC_SEAL} alt="Selo GERAC" className="w-8 h-8 object-contain" />
                      <span className="text-2xl font-black text-purple-900">{methodologies}</span>
                  </div>
                  <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest z-10">Metodologias Ativas</p>
              </div>

              {/* Frameworks */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 flex flex-col justify-between h-32 shadow-sm">
                  <div className="flex justify-between items-start">
                      <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
                      <span className="text-2xl font-black text-gray-800">{frameworks}</span>
                  </div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Frameworks Validados</p>
              </div>

              {/* Cursos */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 flex flex-col justify-between h-32 shadow-sm">
                  <div className="flex justify-between items-start">
                      <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                      <span className="text-2xl font-black text-gray-800">{courses}</span>
                  </div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Cursos Criados</p>
              </div>

              {/* Mentorias */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 flex flex-col justify-between h-32 shadow-sm">
                  <div className="flex justify-between items-start">
                      <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      <span className="text-2xl font-black text-gray-800">{mentorships}</span>
                  </div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mentorias Ativas</p>
              </div>
          </div>
      </section>

    </div>
  );
};

export default DashboardHome;
