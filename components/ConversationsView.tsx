
import React, { useEffect, useState } from 'react';
import { Agent } from '../types';
import { Avatar } from './Avatar';
import { SearchIcon, ChevronRightIcon, BotIcon } from './Icon';

interface ConversationsViewProps {
  agents: Agent[];
  onOpenChat: (agent: Agent) => void;
}

interface ChatSessionSummary {
    sessionId: string;
    agentId: string;
    agentName: string;
    agentRole: string;
    agentAvatar?: string;
    lastMessageAt: number;
    title: string;
    preview: string;
}

const ConversationsView: React.FC<ConversationsViewProps> = ({ agents, onOpenChat }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);

  useEffect(() => {
    // 1. Varrer LocalStorage buscando todas as sessões de agentes
    const allSessions: ChatSessionSummary[] = [];

    agents.forEach(agent => {
        // Chave de sessões do agente
        const sessionsKey = `grupob_sessions_${agent.id}`;
        const storedSessions = localStorage.getItem(sessionsKey);

        if (storedSessions) {
            try {
                const parsedSessions = JSON.parse(storedSessions);
                parsedSessions.forEach((session: any) => {
                    // Pega a última mensagem para preview (se houver cache de chat)
                    let preview = "Nova conversa iniciada...";
                    const chatKey = `grupob_chat_${session.id}`;
                    const chatMsgs = localStorage.getItem(chatKey);
                    
                    if (chatMsgs) {
                        try {
                            const msgs = JSON.parse(chatMsgs);
                            if (msgs.length > 0) {
                                const lastMsg = msgs[msgs.length - 1];
                                preview = lastMsg.text.slice(0, 60) + (lastMsg.text.length > 60 ? '...' : '');
                            }
                        } catch(e) {}
                    }

                    allSessions.push({
                        sessionId: session.id,
                        agentId: agent.id,
                        agentName: agent.name,
                        agentRole: agent.officialRole,
                        agentAvatar: agent.avatarUrl,
                        lastMessageAt: session.lastMessageAt || session.createdAt,
                        title: session.title || "Conversa sem título",
                        preview: preview
                    });
                });
            } catch (e) {
                console.error("Erro ao processar sessões do agente " + agent.name, e);
            }
        }
    });

    // 2. Ordenar por data decrescente (mais recente primeiro)
    allSessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    setSessions(allSessions);
  }, [agents]);

  const filteredSessions = sessions.filter(s => 
      s.agentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (timestamp: number) => {
      const date = new Date(timestamp);
      const now = new Date();
      const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      
      if (isToday) {
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
          return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
      }
  };

  return (
    <div className="flex-1 h-full bg-[#FAFAFA] flex flex-col font-nunito overflow-hidden">
        {/* HEADER */}
        <header className="h-24 px-8 md:px-12 flex flex-col justify-center border-b border-gray-100 bg-white shrink-0">
            <h1 className="text-2xl font-black text-bitrix-nav uppercase tracking-tighter">Central de Mensagens</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mt-1">Histórico de Comunicação</p>
        </header>

        {/* SEARCH BAR */}
        <div className="px-8 md:px-12 py-6 shrink-0">
            <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm focus-within:border-bitrix-nav/30 focus-within:shadow-md transition-all">
                <SearchIcon className="w-5 h-5 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Pesquisar por nome ou assunto..." 
                    className="bg-transparent text-sm font-medium text-gray-700 outline-none w-full ml-3 placeholder:text-gray-300"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {/* LISTA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-8 pb-10">
            <div className="max-w-5xl mx-auto space-y-2">
                {filteredSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-40">
                        <BotIcon className="w-16 h-16 text-gray-300 mb-4" />
                        <p className="text-sm font-bold text-gray-400">Nenhuma conversa encontrada.</p>
                        <p className="text-xs text-gray-300 mt-1">Inicie um chat através do Ecossistema.</p>
                    </div>
                ) : (
                    filteredSessions.map(session => (
                        <div 
                            key={`${session.agentId}-${session.sessionId}`}
                            onClick={() => {
                                const agent = agents.find(a => a.id === session.agentId);
                                if (agent) onOpenChat(agent);
                            }}
                            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group flex items-center gap-4 animate-msg"
                        >
                            {/* Avatar */}
                            <div className="relative shrink-0">
                                <Avatar name={session.agentName} url={session.agentAvatar} className="w-12 h-12 rounded-xl" />
                                <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-white"></div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3 className="text-sm font-black text-gray-800 truncate group-hover:text-bitrix-nav transition-colors">{session.agentName}</h3>
                                    <span className="text-[10px] font-bold text-gray-400">{formatTime(session.lastMessageAt)}</span>
                                </div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 truncate">{session.title}</p>
                                <p className="text-xs text-gray-500 truncate leading-relaxed">{session.preview}</p>
                            </div>

                            {/* Arrow */}
                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-bitrix-nav group-hover:text-white transition-all shrink-0">
                                <ChevronRightIcon className="w-4 h-4" />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
  );
};

export default ConversationsView;
