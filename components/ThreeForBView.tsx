
import React, { useMemo, useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { TabId, BusinessUnit, Agent, Message, Sender, AgentStatus } from '../types';
import { startAgentSession } from '../services/gemini';
import { SendIcon, ChevronRightIcon, BackIcon } from './Icon';
import { Avatar } from './Avatar';
import {
  appendMessage,
  createSession,
  findLatestSession,
  loadSessionMessages,
  touchSession,
  updateMessage
} from '../utils/supabaseChat';

interface ThreeForBViewProps {
  activeTab: TabId;
  activeBU: BusinessUnit;
  setActiveTab: (tab: TabId) => void;
  agents?: Agent[];
  onAddTopic?: (title: string, priority: 'Alta' | 'Média' | 'Baixa', buId?: string) => void;
  activeWorkspaceId?: string | null;
  ownerUserId?: string | null;
}

interface TeamMember {
  name: string;
  role: string;
  sector: 'LIDERANÇA' | 'MARKETING' | 'VENDAS' | 'EXPANSÃO';
  isLeader?: boolean;
  isAi?: boolean;
  isRoom?: boolean; // New flag for War Room
  agentId?: string;
  fullPrompt?: string;
  status?: AgentStatus; // Adicionado Status para controle visual
  avatarUrl?: string; // NOVO: URL da imagem do agente
}

// --- DADOS DA TRIAGEM (PDF) ---

const TRIAGE_BLOCKS = [
  {
    id: 1,
    title: "Bloco 1. Perfil e Contexto",
    questions: [
      {
        id: 'q1',
        text: "1 Seu foco hoje é",
        options: [
          "A Crescer novas contas enterprise",
          "B Aumentar recorrência e expansão dentro da base",
          "C Melhorar previsibilidade do comercial"
        ]
      },
      {
        id: 'q2',
        text: "2 Quem normalmente decide com você",
        options: [
          "A Você decide direto",
          "B Comitê com RH e Compras",
          "C Comitê com RH, Compras e TI"
        ]
      },
      {
        id: 'q3',
        text: "3 Seu ciclo médio de venda hoje",
        options: [
          "A Até 30 dias",
          "B 30 a 90 dias",
          "C Acima de 90 dias"
        ]
      }
    ]
  },
  {
    id: 2,
    title: "Bloco 2. Marketing e Posicionamento",
    questions: [
      {
        id: 'q4',
        text: "4 O que mais falta hoje na comunicação",
        options: [
          "A Clareza de posicionamento, ficar impossível comparar com brinde comum",
          "B Prova e cases para diretoria decidir mais rápido",
          "C Oferta e narrativa por perfil de decisor"
        ]
      },
      {
        id: 'q5',
        text: "5 O canal que mais queremos fortalecer agora",
        options: [
          "A Indicação e network B2B",
          "B Conteúdo e autoridade do fundador e da marca",
          "C Campanhas e tráfego para demanda ativa"
        ]
      },
      {
        id: 'q6',
        text: "6 Seu maior desafio de aquisição hoje",
        options: [
          "A Pouco volume de oportunidades novas",
          "B Oportunidades entram, mas sem o perfil ideal",
          "C Volume existe, mas vira reunião devagar"
        ]
      }
    ]
  },
  {
    id: 3,
    title: "Bloco 3. Vendas e Processo",
    questions: [
      {
        id: 'q7',
        text: "7 Onde mais trava o avanço no comercial",
        options: [
          "A Chegar no decisor certo",
          "B Aprovação interna e travas de comitê",
          "C Justificar ROI e urgência para fechar"
        ]
      },
      {
        id: 'q8',
        text: "8 O que mais precisa de ajuste no processo",
        options: [
          "A Cadência e follow up",
          "B Qualificação e priorização",
          "C Proposta e condução de decisão"
        ]
      }
    ]
  },
  {
    id: 4,
    title: "Bloco 4. Expansão por Indicação",
    questions: [
      {
        id: 'q9',
        text: "9 Hoje existe programa de indicação e parcerias",
        options: [
          "A Não existe, é informal",
          "B Existe, mas sem rotina e meta",
          "C Existe e roda bem, queremos escalar"
        ]
      },
      {
        id: 'q10',
        text: "10 O que mais ajudaria a gerar mais indicações",
        options: [
          "A Melhor experiência e convite estruturado no pós venda",
          "B Ativo de autoridade para abrir portas",
          "C Benefício e modelo de parceria fácil de replicar"
        ]
      }
    ]
  },
  {
    id: 5,
    title: "Fechamento",
    questions: [
      {
        id: 'q11',
        text: "11 Escolha suas 3 prioridades para os próximos 90 dias",
        type: 'multi',
        limit: 3,
        options: [
          "Aquisição e posicionamento",
          "Processo comercial e previsibilidade",
          "Recorrência e expansão de conta",
          "Indicação e parcerias",
          "Autoridade do Gê e da Taline",
          "Cultura UAU e liderança do time"
        ]
      },
      {
        id: 'q12',
        text: "12 Qual resultado faria você dizer 'valeu a pena' em 90 dias? (Opcional)",
        type: 'text',
        options: []
      }
    ]
  }
];

const SECTOR_CONFIG = {
  'LIDERANÇA': { color: '#ea580c', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  'MARKETING': { color: '#db2777', bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
  'VENDAS': { color: '#374151', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
  'EXPANSÃO': { color: '#2563eb', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
};

const GERAC_SEAL = "https://static.wixstatic.com/media/64c3dc_6d0ef8c33da846cd9a3527cb01f6a1f7~mv2.png";
const TRIFORCE_LOGO = "https://static.wixstatic.com/media/64c3dc_2892da29671c4051a998d15089edd1c4~mv2.png";

const ThreeForBView: React.FC<ThreeForBViewProps> = ({ activeTab, activeBU, setActiveTab, agents = [], onAddTopic, activeWorkspaceId, ownerUserId }) => {
  const [viewMode, setViewMode] = useState<'dashboard' | 'triage' | 'client-room'>('dashboard');
  
  // Triage State
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [triageAnswers, setTriageAnswers] = useState<Record<string, any>>({});
  const [isSubmittingTriage, setIsSubmittingTriage] = useState(false);
  
  // Chat State
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [chatSession, setChatSession] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const selectionTokenRef = useRef(0);

  // --- TRIAGE LOGIC ---

  const handleTriageSelect = (questionId: string, value: string, type: string = 'single', limit: number = 1) => {
    setTriageAnswers(prev => {
      if (type === 'multi') {
        const currentList = prev[questionId] || [];
        if (currentList.includes(value)) {
          return { ...prev, [questionId]: currentList.filter((v: string) => v !== value) };
        } else {
          if (currentList.length >= limit) return prev;
          return { ...prev, [questionId]: [...currentList, value] };
        }
      }
      return { ...prev, [questionId]: value };
    });
  };

  const handleNextBlock = () => {
    if (currentBlockIndex < TRIAGE_BLOCKS.length - 1) {
      setCurrentBlockIndex(prev => prev + 1);
    } else {
      setIsSubmittingTriage(true);
      setTimeout(() => {
        setIsSubmittingTriage(false);
        setViewMode('client-room');
      }, 2000);
    }
  };

  const getProgress = () => {
    return ((currentBlockIndex + 1) / TRIAGE_BLOCKS.length) * 100;
  };

  const renderTriageView = () => {
    const block = TRIAGE_BLOCKS[currentBlockIndex];
    return (
      <div className="flex-1 flex flex-col h-full bg-white font-nunito animate-msg">
        <div className="h-20 border-b border-gray-100 flex items-center justify-between px-10 shrink-0">
          <div className="flex items-center gap-4">
             <button onClick={() => setViewMode('dashboard')} className="hover:bg-gray-50 p-2 rounded-xl transition-colors">
               <BackIcon className="w-6 h-6 text-gray-400" />
             </button>
             <div>
               <h2 className="text-xl font-black text-bitrix-nav uppercase tracking-tighter">Triagem Rápida 3forB</h2>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Jornada U.A.U Enterprise</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-bitrix-accent transition-all duration-500" style={{ width: `${getProgress()}%` }}></div>
             </div>
             <span className="text-[10px] font-black text-gray-400">{currentBlockIndex + 1}/{TRIAGE_BLOCKS.length}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-12 bg-gray-50">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-2xl font-black text-bitrix-nav uppercase tracking-tight mb-8 animate-msg">{block.title}</h3>
            
            <div className="space-y-10">
              {block.questions.map((q) => (
                <div key={q.id} className="animate-msg">
                  <p className="text-sm font-bold text-gray-700 mb-4">{q.text}</p>
                  
                  {q.type === 'text' ? (
                    <textarea 
                      className="w-full p-4 rounded-2xl border border-gray-200 outline-none focus:border-bitrix-accent transition-colors text-sm"
                      rows={3}
                      placeholder="Digite sua resposta..."
                      value={triageAnswers[q.id] || ''}
                      onChange={(e) => handleTriageSelect(q.id, e.target.value, 'single')}
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {q.options.map((opt) => {
                        const isSelected = q.type === 'multi' 
                          ? (triageAnswers[q.id] || []).includes(opt)
                          : triageAnswers[q.id] === opt;
                        
                        return (
                          <button
                            key={opt}
                            onClick={() => handleTriageSelect(q.id, opt, q.type, q.limit)}
                            className={`p-4 rounded-xl text-left text-xs font-medium border transition-all ${
                              isSelected 
                                ? 'bg-bitrix-nav text-white border-transparent shadow-lg transform scale-[1.01]' 
                                : 'bg-white text-gray-600 border-gray-200 hover:border-bitrix-nav/30'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {q.type === 'multi' && (
                    <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">
                      Selecionado: {(triageAnswers[q.id] || []).length} / {q.limit}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-12 pt-8 border-t border-gray-200 flex justify-end">
              <button 
                onClick={handleNextBlock}
                className="px-8 py-4 bg-bitrix-accent text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-all flex items-center gap-3"
              >
                {isSubmittingTriage ? 'Processando...' : (currentBlockIndex === TRIAGE_BLOCKS.length - 1 ? 'Enviar Triagem' : 'Próximo Bloco')}
                {!isSubmittingTriage && <ChevronRightIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderClientRoom = () => (
    <div className="flex-1 flex flex-col h-full bg-[#FAFAFA] font-nunito animate-msg overflow-hidden relative">
       <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-orange-100/50 to-transparent rounded-full blur-3xl pointer-events-none -mr-32 -mt-32"></div>

       <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col p-12 overflow-y-auto custom-scrollbar z-10">
          <div className="flex items-center justify-between mb-12">
             <div className="flex items-center gap-4">
               <img src={activeBU.logo || TRIFORCE_LOGO} className="h-12 w-auto object-contain" alt="Logo Cliente" />
               <div className="h-8 w-px bg-gray-200"></div>
               <div>
                 <h1 className="text-2xl font-black text-bitrix-nav uppercase tracking-tighter">Sala do Cliente</h1>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">Ambiente Exclusivo 3forB</p>
               </div>
             </div>
             <div className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
               Triagem Recebida
             </div>
          </div>

          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100 mb-8 relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-2 h-full bg-bitrix-nav"></div>
             <h2 className="text-3xl font-black text-bitrix-nav mb-4">Bem vindo.</h2>
             <p className="text-gray-600 leading-relaxed text-sm mb-6 max-w-2xl">
               A partir daqui a 3forB organiza o mapa do seu cenário e já prepara o plano de ataque em Marketing, Vendas e Expansão, com Jornada UAU, MAV e DR.
             </p>
             <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 inline-block">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Próximo Passo</p>
                <p className="text-bitrix-accent font-bold">Confirmar a reunião e alinhar os decisores.</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
             <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Prioridades Identificadas</h3>
                <ul className="space-y-3">
                   {(triageAnswers['q11'] || ["Aquisição", "Processo Comercial"]).map((p: string, i: number) => (
                     <li key={i} className="flex items-center gap-3 text-xs font-bold text-gray-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-bitrix-accent"></div>
                        {p}
                     </li>
                   ))}
                </ul>
             </div>
             <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600 mb-3">
                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-sm font-black text-gray-800 uppercase mb-1">CRM Atualizado</h3>
                <p className="text-[10px] text-gray-400 font-medium">Lead Enterprise Criado com Tag</p>
             </div>
          </div>

          <div className="flex gap-4">
             <button onClick={() => setViewMode('dashboard')} className="flex-1 py-4 bg-white border border-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 text-gray-400">
               Voltar ao Dashboard
             </button>
             <button onClick={() => window.open('https://wa.me/', '_blank')} className="flex-[2] py-4 bg-[#25D366] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:brightness-110 shadow-lg flex items-center justify-center gap-3">
               <span>Falar no WhatsApp Oficial</span>
             </button>
          </div>

       </div>
    </div>
  );

  // --- LOGICA ORIGINAL DO DASHBOARD ---

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, selectedMember]);

  const handleMemberClick = async (member: TeamMember) => {
    if (!member.isAi) {
        alert("Este membro é um perfil estático. Aguarde a implementação do DNA.");
        return;
    }
    
    // Se o status for PLANNED, não abre chat, talvez mostre modal de ativação? 
    // Por enquanto, vou permitir abrir mas pode estar "desligado" no chat.
    // Decisão: Permitir abrir para configurar/testar, mas visualmente no grid já estará cinza.
    
    selectionTokenRef.current += 1;
    const token = selectionTokenRef.current;
    setSelectedMember(member);
    setActiveSessionId(null);
    setChatMessages([]);

    if (member.agentId && member.fullPrompt) {
        const session = startAgentSession(member.agentId, member.fullPrompt);
        setChatSession(session);
    } else {
        setChatSession(null);
    }

    const memberAgentId = member.agentId || `3forb-room:${member.name.toLowerCase().replace(/\s+/g, '-')}`;
    const greeting = member.isRoom
      ? `**Sala de Guerra:** Olá. Estamos na sala de coordenação.\n\nQuem você deseja convocar para a reunião?`
      : `**${member.name}** online.`;

    try {
      const existingSession = await findLatestSession({
        workspaceId: activeWorkspaceId,
        agentId: memberAgentId,
        buId: activeBU.id
      });

      let sessionId = existingSession?.id || null;
      if (!sessionId) {
        sessionId = await createSession({
          workspaceId: activeWorkspaceId,
          agentId: memberAgentId,
          ownerUserId,
          buId: activeBU.id,
          title: `3forB • ${member.name}`,
          payload: { kind: '3forb-chat', memberName: member.name }
        });
        await appendMessage({
          workspaceId: activeWorkspaceId,
          sessionId,
          agentId: memberAgentId,
          sender: Sender.Bot,
          text: greeting,
          buId: activeBU.id,
          participantName: member.name
        });
      }

      const history = await loadSessionMessages({
        workspaceId: activeWorkspaceId,
        sessionId
      });
      if (selectionTokenRef.current !== token) return;
      setActiveSessionId(sessionId);
      setChatMessages(history);
    } catch (e) {
      console.error('Erro ao carregar histórico', e);
      if (selectionTokenRef.current !== token) return;
      setChatMessages([{
        id: 'init-fallback',
        text: greeting,
        sender: Sender.Bot,
        timestamp: new Date(),
        buId: activeBU.id,
        participantName: member.name
      }]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedMember || isLoading || !chatSession || !activeSessionId) return;
    const userText = input.trim();
    setInput('');
    const memberAgentId = selectedMember.agentId || `3forb-room:${selectedMember.name.toLowerCase().replace(/\s+/g, '-')}`;
    let persistedBotId = '';
    try {
      const savedUser = await appendMessage({
        workspaceId: activeWorkspaceId,
        sessionId: activeSessionId,
        agentId: memberAgentId,
        sender: Sender.User,
        text: userText,
        buId: activeBU.id
      });
      setChatMessages(prev => [...prev, { id: savedUser.id, text: userText, sender: Sender.User, timestamp: new Date(), buId: activeBU.id }]);
      setIsLoading(true);

      const savedBot = await appendMessage({
        workspaceId: activeWorkspaceId,
        sessionId: activeSessionId,
        agentId: memberAgentId,
        sender: Sender.Bot,
        text: '',
        buId: activeBU.id,
        participantName: selectedMember.name,
        isStreaming: true
      });
      persistedBotId = savedBot.id;
      setChatMessages(prev => [...prev, { id: persistedBotId, text: '', sender: Sender.Bot, timestamp: new Date(), buId: activeBU.id, isStreaming: true }]);

      const result = await chatSession.sendMessage({ message: userText });
      const reply = result.text || '';
      setChatMessages(prev => prev.map(msg => msg.id === persistedBotId ? { ...msg, text: reply, isStreaming: false } : msg));
      await updateMessage(persistedBotId, { text: reply, isStreaming: false, updatedAt: new Date() });
      await touchSession(activeSessionId);
    } catch (error) {
      if (persistedBotId) {
        setChatMessages(prev => prev.map(msg => msg.id === persistedBotId ? { ...msg, text: 'Falha na conexão neural.', isStreaming: false } : msg));
        await updateMessage(persistedBotId, { text: 'Falha na conexão neural.', isStreaming: false, updatedAt: new Date() }).catch(() => null);
      }
    } finally { setIsLoading(false); }
  };

  const handleCreateBacklogItem = () => {
    if (!onAddTopic || !selectedMember) return;
    const title = prompt("Nome da Pauta para o Cofre:", `Planejamento ${selectedMember.name}`);
    if (title) {
        onAddTopic(title, 'Alta', activeBU.id);
        alert("Pauta criada com sucesso no Cofre de Pautas.");
    }
  };

  const allMembers = useMemo(() => {
    const buAgents = agents.filter(a => a.buId === '3forb');
    const dynamicMembers: TeamMember[] = buAgents.map(agent => {
      let sector: TeamMember['sector'] = 'LIDERANÇA';
      const s = agent.sector?.toUpperCase() || '';
      if (s.includes('MARKET') || s.includes('TRÁFEGO') || s.includes('COPY')) sector = 'MARKETING';
      else if (s.includes('VENDA') || s.includes('COMERCIAL') || s.includes('SDR') || s.includes('CLOSER')) sector = 'VENDAS';
      else if (s.includes('EXPAN') || s.includes('FRANQUIA')) sector = 'EXPANSÃO';
      return {
        name: agent.name, role: agent.officialRole, sector: sector,
        isLeader: agent.tier === 'ESTRATÉGICO' || agent.tier === 'TÁTICO',
        isAi: true, agentId: agent.id, fullPrompt: agent.fullPrompt,
        status: agent.status, // MAPEANDO STATUS AQUI
        avatarUrl: agent.avatarUrl // MAPEANDO IMAGEM
      };
    });
    return dynamicMembers;
  }, [agents]);

  const MemberCard: React.FC<{ member: TeamMember }> = ({ member }) => {
    const config = SECTOR_CONFIG[member.sector];
    const isRoom = member.isRoom;
    // Lógica visual de inativo
    const isInactive = member.status === 'PLANNED' || member.status === 'MAINTENANCE';

    if (isRoom) {
        return (
            <div 
              onClick={() => handleMemberClick(member)}
              className="w-full col-span-full mb-6 p-6 bg-bitrix-nav rounded-[2rem] shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden group border border-bitrix-nav/50"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-white font-black text-2xl backdrop-blur-sm shadow-inner">
                       <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-2">{member.name}</h4>
                        <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest">{member.role}</p>
                        <div className="flex gap-2 mt-3">
                             <span className="px-2 py-0.5 bg-white/20 rounded text-[9px] font-bold text-white uppercase tracking-wider">Zara (Host)</span>
                             <span className="px-2 py-0.5 bg-white/10 rounded text-[9px] font-bold text-white/70 uppercase tracking-wider">Bernardo</span>
                             <span className="px-2 py-0.5 bg-white/10 rounded text-[9px] font-bold text-white/70 uppercase tracking-wider">Convocação Dinâmica</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
      <div 
        onClick={() => handleMemberClick(member)}
        className={`
            flex items-center gap-4 p-4 rounded-2xl border transition-all relative overflow-hidden group cursor-pointer
            ${isInactive 
                ? 'bg-gray-50 border-gray-200 border-dashed opacity-70 grayscale hover:opacity-100 hover:grayscale-0' 
                : `bg-white shadow-sm hover:shadow-lg hover:-translate-y-1 ${config.border}`
            }
        `}
      >
        {member.isAi && !isInactive && (
          <div className="absolute top-0 right-0 bg-bitrix-accent text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg z-10 shadow-sm">
            IA
          </div>
        )}
        {/* AVATAR RESTAURADO */}
        <Avatar 
            name={member.name} 
            url={member.avatarUrl} // USANDO URL OBRIGATÓRIA
            className={`
                w-12 h-12 rounded-xl shadow-sm border border-gray-100 
                ${member.isLeader && !isInactive ? 'ring-2 ring-offset-2 ring-gray-100' : ''}
            `} 
        />
        
        <div className="min-w-0">
          <h4 className={`text-sm font-black uppercase tracking-tight leading-none mb-1 truncate ${isInactive ? 'text-gray-400' : 'text-gray-800 group-hover:text-bitrix-nav transition-colors'}`}>
              {member.name}
          </h4>
          <p className={`text-[9px] font-bold uppercase tracking-widest truncate ${isInactive ? 'text-gray-300' : config.text}`}>
              {member.role}
          </p>
          {isInactive && <span className="text-[8px] font-black text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded mt-1 inline-block">OFF</span>}
        </div>
      </div>
    );
  };

  const SectorSection: React.FC<{ title: string, sectorKey: keyof typeof SECTOR_CONFIG, members: TeamMember[] }> = ({ title, sectorKey, members }) => {
    const config = SECTOR_CONFIG[sectorKey];
    const room = members.find(m => m.isRoom);
    const leader = members.find(m => m.isLeader && !m.isRoom);
    const staff = members.filter(m => m !== leader && m !== room);

    return (
      <div className={`p-8 rounded-[2.5rem] mb-8 animate-msg ${config.bg} border ${config.border}`}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-2 h-8 rounded-full" style={{ backgroundColor: config.color }}></div>
          <h3 className={`text-xl font-black uppercase tracking-tighter ${config.text}`}>{title}</h3>
        </div>
        <div className="flex flex-col gap-6">
          {room && <div className="mb-4"><MemberCard member={room} /></div>}
          {leader && (
            <div className="mb-2">
               <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-3 ml-1">Responsável</span>
               <div className="max-w-md"><MemberCard member={leader} /></div>
            </div>
          )}
          {staff.length > 0 && (
            <div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-3 ml-1">Especialistas</span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staff.map(member => <MemberCard key={member.name} member={member} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderHome = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-msg h-full bg-[#F1F1F1] overflow-hidden relative">
      <div className="absolute top-8 right-8 flex flex-col items-center opacity-60 hover:opacity-100 transition-opacity">
         <img src={GERAC_SEAL} alt="Selo GERAC" className="w-16 h-16 object-contain" />
         <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-2">Powered by GERAC</span>
      </div>
      <div className="max-w-4xl w-full">
        <div className="flex flex-col items-center mb-16">
          <div className="flex items-center justify-center mb-12">
             <img src={TRIFORCE_LOGO} alt="3forB Triforce" className="h-40 object-contain hover:scale-105 transition-transform duration-500" />
          </div>
          <p className="text-gray-400 font-bold tracking-[0.2em] text-xs uppercase max-w-xl mx-auto leading-relaxed">
            Estrutura Comercial & Marketing de Alta Performance
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 w-full px-8">
          {[
            { id: 'market', label: 'Marketing', desc: 'Atração & Branding', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
            { id: 'sales', label: 'Vendas', desc: 'Conversão & Receita', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            { id: 'expansion', label: 'Expansão', desc: 'Franquias & Growth', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
            { id: 'ecosystem', label: 'Organograma', desc: 'Visão Hierárquica', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
          ].map((pilar) => (
            <button key={pilar.id} onClick={() => setActiveTab(pilar.id as TabId)} className="bg-white border border-gray-100 p-8 rounded-[2rem] shadow-lg hover:shadow-2xl hover:border-[#ea580c]/30 hover:bg-orange-50/30 transition-all hover:-translate-y-1 group text-left flex items-center gap-5">
              <div className="w-12 h-12 flex items-center justify-center text-[#ea580c] shrink-0">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d={pilar.icon} strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-black text-bitrix-nav tracking-tight mb-1">{pilar.label}</h3>
                <p className="text-[9px] font-bold text-gray-400 tracking-wider uppercase">{pilar.desc}</p>
              </div>
            </button>
          ))}
          {/* BOTÃO DE TRIAGEM RÁPIDA (NOVO) */}
          <button 
             onClick={() => setViewMode('triage')} 
             className="col-span-2 bg-gradient-to-r from-bitrix-nav to-bitrix-nav/90 p-6 rounded-[2rem] shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all flex items-center justify-between group relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
             <div className="flex items-center gap-6 z-10">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white backdrop-blur-sm shadow-inner">
                   <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                </div>
                <div className="text-left">
                   <h3 className="text-xl font-black text-white uppercase tracking-tight">Nova Triagem Enterprise</h3>
                   <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">Iniciar Qualificação Rápida (3-5 min)</p>
                </div>
             </div>
             <div className="bg-white/10 p-3 rounded-full group-hover:bg-white group-hover:text-bitrix-nav text-white transition-colors">
                <ChevronRightIcon className="w-6 h-6" />
             </div>
          </button>
        </div>
      </div>
    </div>
  );

  const renderTeamView = (filterSector?: 'MARKETING' | 'VENDAS' | 'EXPANSÃO') => {
    return (
      <div className="flex-1 h-full bg-[#F1F1F1] overflow-y-auto custom-scrollbar p-10 font-nunito relative">
        <div className="absolute top-10 right-10 flex flex-col items-center opacity-60 hover:opacity-100 transition-opacity">
           <img src={GERAC_SEAL} alt="Selo GERAC" className="w-12 h-12 object-contain" />
        </div>
        <header className="mb-10 flex items-center justify-between">
           <div>
              <h2 className="text-3xl font-black text-bitrix-nav uppercase tracking-tighter">
                {filterSector ? filterSector : 'Estrutura Organizacional'}
              </h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mt-2">
                {filterSector ? 'Squad Especialista' : 'Visão Sistêmica 3forB'}
              </p>
           </div>
           <button onClick={() => setActiveTab('3forb-home')} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-bitrix-nav transition-colors mr-16">
              Voltar ao Menu
           </button>
        </header>
        <div className="max-w-5xl mx-auto pb-20">
          {!filterSector && <SectorSection title="Liderança Executiva" sectorKey="LIDERANÇA" members={allMembers.filter(m => m.sector === 'LIDERANÇA')} />}
          {(filterSector === 'MARKETING' || !filterSector) && <SectorSection title="Marketing & Tráfego" sectorKey="MARKETING" members={allMembers.filter(m => m.sector === 'MARKETING')} />}
          {(filterSector === 'VENDAS' || !filterSector) && <SectorSection title="Comercial & Vendas" sectorKey="VENDAS" members={allMembers.filter(m => m.sector === 'VENDAS')} />}
          {(filterSector === 'EXPANSÃO' || !filterSector) && <SectorSection title="Expansão & Franquias" sectorKey="EXPANSÃO" members={allMembers.filter(m => m.sector === 'EXPANSÃO')} />}
        </div>
      </div>
    );
  }

  // MODAL DE CHAT DO AGENTE (Mesma lógica)
  const renderAgentModal = () => {
    if (!selectedMember) return null;
    const config = SECTOR_CONFIG[selectedMember.sector];
    const isRoom = selectedMember.isRoom;

    return (
      <div className="fixed inset-0 z-50 bg-bitrix-nav/60 backdrop-blur-xl p-6 md:p-20 flex items-center justify-center animate-msg">
        <div className="bg-white w-full max-w-5xl h-full rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
          <header className={`px-12 py-8 border-b border-gray-50 flex justify-between items-center shrink-0 z-10 ${isRoom ? 'bg-bitrix-nav text-white' : 'bg-white'}`}>
            <div className="flex items-center gap-6">
              {/* SUBSTITUIÇÃO AQUI: USA AVATAR SE FOR UM AGENTE INDIVIDUAL */}
              {!isRoom ? (
                  <Avatar name={selectedMember.name} url={selectedMember.avatarUrl} className={`w-16 h-16 rounded-2xl shadow-lg border-2 border-white/50`} />
              ) : (
                  <div className={`w-14 h-14 rounded-3xl flex items-center justify-center font-black text-xl shadow-lg ${isRoom ? 'bg-white/10 text-white' : 'text-white'}`} style={{ backgroundColor: isRoom ? undefined : config.color }}>
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  </div>
              )}
              
              <div>
                <h2 className={`text-2xl font-black uppercase tracking-tighter leading-none ${isRoom ? 'text-white' : 'text-bitrix-nav'}`}>{selectedMember.name}</h2>
                <p className={`text-[10px] font-bold uppercase tracking-[0.3em] mt-2 ${isRoom ? 'text-white/60' : ''}`} style={{ color: isRoom ? undefined : config.color }}>{selectedMember.role}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               <button onClick={handleCreateBacklogItem} className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2 ${isRoom ? 'bg-white text-bitrix-nav hover:bg-gray-100' : 'bg-bitrix-nav text-white hover:bg-bitrix-accent'}`}>
                 <span>Transformar em Pauta</span>
               </button>
               <button onClick={() => { setSelectedMember(null); setChatSession(null); }} className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors ${isRoom ? 'text-white/40 hover:bg-white/10' : 'hover:bg-gray-100 text-gray-400'}`}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
            </div>
          </header>
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/30">
            <div className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === Sender.User ? 'flex-row-reverse' : 'flex-row'} items-start gap-6 animate-msg`}>
                  <div className={`max-w-[80%] flex flex-col ${msg.sender === Sender.User ? 'items-end' : 'items-start'}`}>
                    <div className={`px-8 py-6 rounded-[2.5rem] text-[15px] leading-relaxed shadow-sm border ${msg.sender === Sender.User ? 'bg-bitrix-accent text-white rounded-tr-none border-transparent' : 'bg-white border-gray-100 text-bitrix-text rounded-tl-none prose prose-sm'}`}>
                      {msg.sender === Sender.Bot ? <ReactMarkdown>{msg.text}</ReactMarkdown> : msg.text}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-10 bg-white border-t border-gray-50">
              <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-4 bg-gray-50 p-2 rounded-[2.5rem] border border-gray-100 shadow-sm">
                <input value={input} onChange={e => setInput(e.target.value)} placeholder={`Comando para ${selectedMember.name}...`} className="flex-1 bg-transparent px-8 py-4 text-[15px] font-medium outline-none" autoFocus />
                <button type="submit" disabled={isLoading} className="w-14 h-14 rounded-full text-white flex items-center justify-center shadow-lg transition-all hover:scale-105" style={{ backgroundColor: config.color }}>
                    <SendIcon className="w-6 h-6" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Main Render Switch
  if (viewMode === 'triage') return renderTriageView();
  if (viewMode === 'client-room') return renderClientRoom();

  // Dashboard Default
  return (
    <>
      {selectedMember ? renderAgentModal() : (
         (() => {
            switch (activeTab) {
                case 'market': return renderTeamView('MARKETING');
                case 'sales': return renderTeamView('VENDAS');
                case 'expansion': return renderTeamView('EXPANSÃO');
                case 'ecosystem': return renderTeamView();
                case '3forb-home': 
                default: return renderHome();
            }
         })()
      )}
    </>
  );
};

export default ThreeForBView;
