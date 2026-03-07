
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { BusinessUnit, Agent, Message, Sender } from '../types';
import { startAgentSession, transcribeAudio } from '../services/gemini';
import { SendIcon, BackIcon, BotIcon, MicIcon, StopCircleIcon, PaperclipIcon, XIcon, FileTextIcon } from './Icon';
import { Avatar } from './Avatar';
import {
  appendMessage,
  createSession,
  findLatestSession,
  loadSessionMessages,
  touchSession,
  updateMessage
} from '../utils/supabaseChat';

interface StartyBViewProps {
  activeBU: BusinessUnit;
  agents: Agent[];
  onBack?: () => void;
  activeWorkspaceId?: string | null;
  ownerUserId?: string | null;
}

// --- MOCK DATA PARA PROJETOS ---
// Em produção, isso viria de um estado global de projetos
const ACTIVE_PROJECTS = [
    { id: 1, name: 'SaaS Tegas', status: 'Em Desenvolvimento', progress: 65, tech: 'React/Python' },
    { id: 'audacus', name: 'Gateway Audacus', status: 'Homologação', progress: 90, tech: 'Integration' },
    { id: 'scale', name: 'Scale Odonto App', status: 'Planejamento', progress: 15, tech: 'Mobile' },
];

const StartyBView: React.FC<StartyBViewProps> = ({ activeBU, agents, onBack, activeWorkspaceId, ownerUserId }) => {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const selectionTokenRef = useRef(0);

  // Audio & File
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [attachment, setAttachment] = useState<{ data: string, mimeType: string, preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtrar agentes da StartyB (stb) e da Tegas (tgs) pois são do mesmo ecossistema técnico
  const techAgents = agents.filter(a => ['stb', 'startyb', 'tgs', 'tegas'].includes(a.buId) || a.buId === 'startyb');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAgentClick = async (agent: Agent) => {
      selectionTokenRef.current += 1;
      const token = selectionTokenRef.current;
      setSelectedAgent(agent);
      setMessages([]);
      setActiveSessionId(null);
      
      // Inicia sessão Gemini
      if (agent.fullPrompt) {
          const session = startAgentSession(agent.id, agent.fullPrompt, agent.knowledgeBase || []);
          setChatSession(session);
      }

      try {
        const existingSession = await findLatestSession({
          workspaceId: activeWorkspaceId,
          agentId: agent.id,
          buId: activeBU.id
        });

        let sessionId = existingSession?.id || null;
        if (!sessionId) {
          sessionId = await createSession({
            workspaceId: activeWorkspaceId,
            agentId: agent.id,
            ownerUserId,
            buId: activeBU.id,
            title: `StartyB • ${agent.name}`,
            payload: { kind: 'startyb-chat', agentName: agent.name }
          });
          await appendMessage({
            workspaceId: activeWorkspaceId,
            sessionId,
            agentId: agent.id,
            sender: Sender.Bot,
            text: `Terminal conectado. Agente **${agent.name}** (${agent.officialRole}) online.\n\nAguardando instruções de engenharia.`,
            buId: activeBU.id,
            participantName: agent.name
          });
        }

        const history = await loadSessionMessages({
          workspaceId: activeWorkspaceId,
          sessionId
        });

        if (selectionTokenRef.current !== token) return;
        setActiveSessionId(sessionId);
        setMessages(history);
      } catch (error) {
        console.error('Erro ao carregar chat StartyB:', error);
        if (selectionTokenRef.current !== token) return;
        setMessages([{
          id: 'init-fallback',
          text: `Terminal conectado. Agente **${agent.name}** (${agent.officialRole}) online.\n\nAguardando instruções de engenharia.`,
          sender: Sender.Bot,
          timestamp: new Date(),
          buId: activeBU.id,
          participantName: agent.name
        }]);
      }
  };

  const handleToggleRecording = async () => {
      if (isRecording) {
          mediaRecorderRef.current?.stop();
          setIsRecording(false);
      } else {
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const mediaRecorder = new MediaRecorder(stream);
              mediaRecorderRef.current = mediaRecorder;
              audioChunksRef.current = [];
              mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
              mediaRecorder.onstop = async () => {
                  setIsTranscribing(true);
                  const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                  const reader = new FileReader();
                  reader.readAsDataURL(audioBlob);
                  reader.onloadend = async () => {
                      try {
                          const base64String = (reader.result as string).split(',')[1];
                          const transcription = await transcribeAudio(base64String, 'audio/webm');
                          if (transcription) setInput(prev => prev ? `${prev} ${transcription}` : transcription);
                      } catch (e) { console.error("Transcribe error", e); } finally { setIsTranscribing(false); stream.getTracks().forEach(track => track.stop()); }
                  };
              };
              mediaRecorder.start();
              setIsRecording(true);
          } catch (err) { alert("Microfone bloqueado."); }
      }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          const result = e.target?.result as string;
          const base64String = result.split(',')[1];
          setAttachment({ data: base64String, mimeType: file.type, preview: result });
      };
      reader.readAsDataURL(file);
      event.target.value = '';
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
      if ((!input.trim() && !attachment) || !selectedAgent || !activeSessionId || isLoading || !chatSession) return;

      const userText = input.trim();
      const currentAttachment = attachment;
      setInput('');
      setAttachment(null);
      
      const displayText = currentAttachment ? (userText ? userText + " 📎 [File]" : "📎 [File]") : userText;

      let persistedBotId = '';

      try {
          const savedUser = await appendMessage({
              workspaceId: activeWorkspaceId,
              sessionId: activeSessionId,
              agentId: selectedAgent.id,
              sender: Sender.User,
              text: displayText,
              buId: activeBU.id,
              attachment: currentAttachment
          });
          const userMsg: Message = {
            id: savedUser.id,
            text: displayText,
            sender: Sender.User,
            timestamp: new Date(),
            buId: activeBU.id,
            attachment: currentAttachment || undefined
          };
          setMessages(prev => [...prev, userMsg]);
          setIsLoading(true);

          const savedBot = await appendMessage({
              workspaceId: activeWorkspaceId,
              sessionId: activeSessionId,
              agentId: selectedAgent.id,
              sender: Sender.Bot,
              text: '',
              buId: activeBU.id,
              participantName: selectedAgent.name,
              isStreaming: true
          });
          persistedBotId = savedBot.id;
          setMessages(prev => [...prev, {
            id: persistedBotId,
            text: '',
            sender: Sender.Bot,
            timestamp: new Date(),
            buId: activeBU.id,
            isStreaming: true,
            participantName: selectedAgent.name
          }]);

          let messagePayload: any = userText;
          if (currentAttachment) {
              messagePayload = [
                  { text: userText || "Process file data." },
                  { inlineData: { mimeType: currentAttachment.mimeType, data: currentAttachment.data } }
              ];
          }

          const result = await chatSession.sendMessageStream({ message: messagePayload });
          let fullText = '';
          for await (const chunk of result) {
              const text = (chunk as any).text || '';
              fullText += text;
              setMessages(prev => prev.map(m => m.id === persistedBotId ? { ...m, text: fullText } : m));
          }
          setMessages(prev => prev.map(m => m.id === persistedBotId ? { ...m, isStreaming: false } : m));
          await updateMessage(persistedBotId, { text: fullText, isStreaming: false, updatedAt: new Date() });
          await touchSession(activeSessionId);

      } catch (error) {
          if (persistedBotId) {
            setMessages(prev => prev.map(m => m.id === persistedBotId ? { ...m, text: 'Erro de compilação na resposta.', isStreaming: false } : m));
            await updateMessage(persistedBotId, { text: 'Erro de compilação na resposta.', isStreaming: false, updatedAt: new Date() }).catch(() => null);
          }
      } finally {
          setIsLoading(false);
      }
  };

  // --- SUB-COMPONENT: CHAT MODAL ---
  const renderChatModal = () => {
      if (!selectedAgent) return null;

      return (
        <div className="fixed inset-0 z-50 bg-gray-900/90 backdrop-blur-sm flex items-center justify-center p-6 animate-msg font-mono">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,application/pdf,.txt,.json,.js,.ts" />
            <div className="bg-[#0D1117] w-full max-w-5xl h-[85vh] rounded-lg shadow-2xl border border-gray-700 flex flex-col overflow-hidden relative">
                
                {/* Header Técnico */}
                <div className="h-16 bg-[#161B22] border-b border-gray-700 flex justify-between items-center px-6">
                    <div className="flex items-center gap-4">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">{selectedAgent.name}</h3>
                            <p className="text-[10px] text-gray-500 uppercase">{selectedAgent.officialRole} // <span className="text-green-500">ONLINE</span></p>
                        </div>
                    </div>
                    <button onClick={() => setSelectedAgent(null)} className="text-gray-500 hover:text-white transition-colors">
                        <span className="text-2xl">×</span>
                    </button>
                </div>

                {/* Área de Mensagens (Terminal Style) */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-[#0D1117]">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender === Sender.User ? 'justify-end' : 'justify-start'} animate-msg`}>
                            <div className={`max-w-[85%] p-4 rounded-md border text-sm leading-relaxed font-mono ${
                                msg.sender === Sender.User 
                                ? 'bg-gray-800 border-gray-600 text-white' 
                                : 'bg-[#161B22] border-gray-700 text-gray-300'
                            }`}>
                                <span className="text-[9px] font-bold block mb-2 opacity-50 uppercase tracking-widest">
                                    {msg.sender === Sender.User ? 'User@Host' : `Root@${selectedAgent.name}`}
                                </span>
                                {msg.sender === Sender.Bot ? <ReactMarkdown>{msg.text}</ReactMarkdown> : msg.text}
                            </div>
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 bg-[#161B22] border-t border-gray-700">
                    {attachment && (
                        <div className="flex justify-end mb-2">
                            <span className="text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded border border-green-500/30 flex items-center gap-2">
                                FILE LOADED <button onClick={() => setAttachment(null)} className="hover:text-white">x</button>
                            </span>
                        </div>
                    )}
                    <form onSubmit={handleSendMessage} className="flex gap-4 items-center">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-white"><PaperclipIcon className="w-4 h-4"/></button>
                        <button type="button" onClick={handleToggleRecording} className={`${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:text-white'}`}>
                            {isRecording ? <StopCircleIcon className="w-4 h-4" /> : <MicIcon className="w-4 h-4" />}
                        </button>
                        <span className="text-green-500 font-mono">{'>'}</span>
                        <input 
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            className="flex-1 bg-transparent text-white font-mono outline-none py-3 placeholder:text-gray-600"
                            placeholder={isTranscribing ? "Transcribing..." : "Input command..."}
                            autoFocus
                            disabled={isLoading || isTranscribing}
                        />
                        <button type="submit" disabled={isLoading} className="text-green-500 hover:text-green-400 uppercase text-xs font-bold tracking-widest">
                            <SendIcon className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="flex-1 h-full bg-[#FAFAFA] font-nunito flex flex-col relative overflow-hidden">
      {renderChatModal()}

      {/* HEADER DE ENGENHARIA */}
      <header className="h-24 bg-[#111827] flex items-center justify-between px-10 shrink-0 shadow-lg z-10">
         <div className="flex items-center gap-6">
             {onBack && (
                 <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg transition-colors group">
                     <BackIcon className="w-5 h-5 text-gray-500 group-hover:text-white" />
                 </button>
             )}
             <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                 S
             </div>
             <div>
                 <h1 className="text-2xl font-black text-white uppercase tracking-tight">StartyB</h1>
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.4em]">Venture Builder & Tech Factory</p>
             </div>
         </div>
         <div className="flex gap-6">
             <div className="text-right">
                 <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Sprint Ativa</p>
                 <p className="text-white font-mono font-bold">#42-Alpha</p>
             </div>
             <div className="h-8 w-px bg-gray-700"></div>
             <div className="text-right">
                 <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Headcount</p>
                 <p className="text-white font-mono font-bold">{techAgents.length} Eng</p>
             </div>
         </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* COLUNA 1: PROJETOS (KANBAN STYLE) */}
              <div className="lg:col-span-2 space-y-8">
                  <div className="flex items-center gap-3 mb-2">
                      <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Projetos em Execução</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ACTIVE_PROJECTS.map(project => (
                          <div key={project.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all group cursor-pointer hover:border-red-100">
                              <div className="flex justify-between items-start mb-4">
                                  <h4 className="text-lg font-black text-gray-800">{project.name}</h4>
                                  <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded uppercase">{project.tech}</span>
                              </div>
                              
                              <div className="mb-2 flex justify-between items-end">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{project.status}</span>
                                  <span className="text-sm font-bold text-red-600 font-mono">{project.progress}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-red-600 transition-all duration-1000" style={{ width: `${project.progress}%` }}></div>
                              </div>
                          </div>
                      ))}
                      
                      {/* Placeholder Add Project */}
                      <button className="border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center p-6 hover:bg-gray-50 transition-all group">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:text-red-500 transition-colors mb-2">
                              <span className="text-xl font-bold">+</span>
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Novo Projeto</span>
                      </button>
                  </div>

                  {/* STATUS REPORT SECTION */}
                  <div className="bg-[#111827] rounded-[2rem] p-8 text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                      
                      <h3 className="text-xl font-black uppercase tracking-tight mb-4 relative z-10">Status Report Geral</h3>
                      <div className="grid grid-cols-2 gap-8 relative z-10">
                          <div>
                              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Deploy Success Rate</p>
                              <p className="text-3xl font-mono font-bold text-green-500">98.4%</p>
                          </div>
                          <div>
                              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Open Issues</p>
                              <p className="text-3xl font-mono font-bold text-yellow-500">12</p>
                          </div>
                      </div>
                  </div>
              </div>

              {/* COLUNA 2: SQUAD TÉCNICO */}
              <div className="lg:col-span-1">
                  <div className="flex items-center gap-3 mb-4">
                      <div className="w-1.5 h-1.5 bg-gray-800 rounded-full"></div>
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Squad de Engenharia</h3>
                  </div>

                  <div className="bg-white rounded-[2rem] border border-gray-100 p-2 shadow-sm">
                      <div className="flex flex-col gap-1 max-h-[600px] overflow-y-auto custom-scrollbar p-2">
                          {techAgents.length === 0 ? (
                              <p className="text-center text-xs text-gray-400 py-10">Nenhum engenheiro alocado.</p>
                          ) : (
                              techAgents.map(agent => (
                                  <div 
                                    key={agent.id}
                                    onClick={() => handleAgentClick(agent)}
                                    className={`
                                        flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border border-transparent
                                        ${agent.status === 'ACTIVE' 
                                            ? 'hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm' 
                                            : 'opacity-60 grayscale cursor-not-allowed'
                                        }
                                    `}
                                  >
                                      <div className="relative">
                                          <Avatar name={agent.name} url={agent.avatarUrl} className="w-10 h-10 rounded-lg" />
                                          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${agent.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <h4 className="text-xs font-bold text-gray-900 truncate">{agent.name}</h4>
                                          <p className="text-[9px] font-bold text-gray-400 uppercase truncate">{agent.officialRole}</p>
                                      </div>
                                      <div className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                                          <BotIcon className="w-4 h-4" />
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                      <div className="p-4 border-t border-gray-50 text-center">
                          <button onClick={() => onBack && onBack()} className="text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-red-600 transition-colors">
                              Gerenciar Equipe no RH
                          </button>
                      </div>
                  </div>
              </div>

          </div>
      </div>
    </div>
  );
};

export default StartyBView;
