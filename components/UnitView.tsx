
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { BusinessUnit, Agent, Message, Sender } from '../types';
import { sendMessageStream, transcribeAudio } from '../services/gemini';
import { SendIcon, BackIcon, MicIcon, StopCircleIcon, PaperclipIcon, XIcon, FileTextIcon } from './Icon';
import { Avatar } from './Avatar'; // Importar Avatar
import {
  appendMessage,
  createSession,
  findLatestSession,
  loadSessionMessages,
  touchSession,
  updateMessage
} from '../utils/supabaseChat';

interface UnitViewProps {
  activeBU: BusinessUnit;
  agents: Agent[];
  onBack?: () => void;
  activeWorkspaceId?: string | null;
  ownerUserId?: string | null;
}

const UnitView: React.FC<UnitViewProps> = ({ activeBU, agents, onBack, activeWorkspaceId, ownerUserId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Audio & File
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [attachment, setAttachment] = useState<{ data: string, mimeType: string, preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtrar agentes desta BU
  const unitAgents = agents.filter(a => a.buId === activeBU.id);

  useEffect(() => {
    let cancelled = false;
    const roomAgentId = `unit-room:${activeBU.id}`;

    const bootstrapRoom = async () => {
      try {
        const existingSession = await findLatestSession({
          workspaceId: activeWorkspaceId,
          agentId: roomAgentId,
          buId: activeBU.id
        });

        let targetSessionId = existingSession?.id || null;

        if (!targetSessionId) {
          targetSessionId = await createSession({
            workspaceId: activeWorkspaceId,
            agentId: roomAgentId,
            ownerUserId,
            buId: activeBU.id,
            title: `Sala de Guerra • ${activeBU.name}`,
            payload: { kind: 'unit-room', buName: activeBU.name }
          });

          await appendMessage({
            workspaceId: activeWorkspaceId,
            sessionId: targetSessionId,
            agentId: roomAgentId,
            sender: Sender.Bot,
            text: `Sala de Guerra **${activeBU.name}** iniciada.\n\nTodos os agentes da unidade estão ouvindo. Qual a ordem do dia?`,
            buId: activeBU.id,
            participantName: 'Sala de Guerra'
          });
        }

        const loadedMessages = await loadSessionMessages({
          workspaceId: activeWorkspaceId,
          sessionId: targetSessionId
        });

        if (cancelled) return;
        setSessionId(targetSessionId);
        setMessages(loadedMessages);
      } catch (error) {
        console.error('Falha ao carregar sala da unidade:', error);
        if (cancelled) return;
        setSessionId(null);
        setMessages([
          {
            id: 'init-fallback',
            text: `Sala de Guerra **${activeBU.name}** iniciada.\n\nTodos os agentes da unidade estão ouvindo. Qual a ordem do dia?`,
            sender: Sender.Bot,
            timestamp: new Date(),
            buId: activeBU.id
          }
        ]);
      }
    };

    bootstrapRoom();
    return () => {
      cancelled = true;
    };
  }, [activeBU.id, activeBU.name, activeWorkspaceId, ownerUserId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Audio Handlers
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
    if ((!input.trim() && !attachment) || isLoading || !sessionId) return;

    const userText = input.trim();
    const currentAttachment = attachment;
    setInput('');
    setAttachment(null);
    
    const displayText = currentAttachment ? (userText ? userText + " 📎 [Arquivo Anexado]" : "📎 [Arquivo Enviado]") : userText;

    let persistedBotId = '';

    try {
        const savedUser = await appendMessage({
            workspaceId: activeWorkspaceId,
            sessionId,
            agentId: `unit-room:${activeBU.id}`,
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
            sessionId,
            agentId: `unit-room:${activeBU.id}`,
            sender: Sender.Bot,
            text: '',
            buId: activeBU.id,
            participantName: 'Sala de Guerra',
            isStreaming: true
        });
        persistedBotId = savedBot.id;
        setMessages(prev => [
          ...prev,
          {
            id: persistedBotId,
            text: '',
            sender: Sender.Bot,
            timestamp: new Date(),
            buId: activeBU.id,
            isStreaming: true,
            participantName: 'Sala de Guerra'
          }
        ]);

        // Contexto específico da sala
        const teamContext = unitAgents.map(a => `- ${a.name} (${a.officialRole})`).join('\n');
        const context = `
[SALA DE GUERRA: ${activeBU.name}]
[MISSÃO]: ${activeBU.description}
[EQUIPE PRESENTE]:
${teamContext}

Você coordena esta sala. Responda como liderança da unidade ou delegue a fala para um dos agentes listados acima usando o formato "[NOME DO AGENTE]: Resposta".
`.trim();

        let messagePayload: any = userText;
        if (currentAttachment) {
            messagePayload = [
                { text: userText || "Analise este documento." },
                { inlineData: { mimeType: currentAttachment.mimeType, data: currentAttachment.data } }
            ];
        }

        const stream = await sendMessageStream(messagePayload, context);
        let fullText = '';
        
        for await (const chunk of stream) {
            const text = (chunk as any).text || '';
            fullText += text;
            setMessages(prev => prev.map(m => m.id === persistedBotId ? { ...m, text: fullText } : m));
        }
        
        setMessages(prev => prev.map(m => m.id === persistedBotId ? { ...m, isStreaming: false } : m));
        await updateMessage(persistedBotId, { text: fullText, isStreaming: false, updatedAt: new Date() });
        await touchSession(sessionId);

    } catch (error) {
        if (persistedBotId) {
          setMessages(prev => prev.map(m => m.id === persistedBotId ? { ...m, text: "Erro de conexão com a Sala de Guerra.", isStreaming: false } : m));
          await updateMessage(persistedBotId, { text: 'Erro de conexão com a Sala de Guerra.', isStreaming: false, updatedAt: new Date() }).catch(() => null);
        }
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-white font-nunito animate-msg overflow-hidden">
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,application/pdf,.txt" />

      {/* MAIN CHAT AREA (WAR ROOM) */}
      <div className="flex-1 flex flex-col relative">
        {/* Header Sala */}
        <header className="h-20 px-8 flex items-center gap-6 border-b border-gray-100 bg-white/80 backdrop-blur z-10">
           {onBack && (
             <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
               <BackIcon className="w-6 h-6 text-gray-400" />
             </button>
           )}
           <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shadow-md" style={{ backgroundColor: activeBU.themeColor }}>
              {activeBU.name.substring(0,2).toUpperCase()}
           </div>
           <div>
              <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight leading-none">{activeBU.name}</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">War Room Oficial</p>
           </div>
           <div className="ml-auto">
              <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                 Ao Vivo
              </span>
           </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar bg-[#FAFAFA]">
           {messages.map(msg => (
             <div key={msg.id} className={`flex ${msg.sender === Sender.User ? 'flex-row-reverse' : 'flex-row'} items-start gap-4 animate-msg`}>
                <div className={`max-w-[80%] px-6 py-4 rounded-[2rem] text-sm leading-relaxed shadow-sm border ${
                   msg.sender === Sender.User 
                     ? 'bg-gray-800 text-white rounded-tr-none border-transparent' 
                     : 'bg-white border-gray-100 text-gray-700 rounded-tl-none prose prose-sm'
                }`}>
                   {msg.sender === Sender.Bot ? <ReactMarkdown>{msg.text}</ReactMarkdown> : msg.text}
                </div>
             </div>
           ))}
           <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-6 bg-white border-t border-gray-100">
           {attachment && (
              <div className="flex justify-end mb-2 pr-4">
                  <div className="bg-gray-50 border border-gray-200 p-2 rounded-xl flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-gray-500">Anexo</span>
                      <button onClick={() => setAttachment(null)}><XIcon className="w-3 h-3 text-red-500"/></button>
                  </div>
              </div>
           )}
           <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-gray-50 p-2 rounded-full border border-gray-200 focus-within:ring-2 focus-within:ring-gray-200 transition-all">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200">
                  <PaperclipIcon className="w-5 h-5" />
              </button>
              <button type="button" onClick={handleToggleRecording} className={`w-10 h-10 rounded-full flex items-center justify-center ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}>
                  {isRecording ? <StopCircleIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
              </button>

              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={isTranscribing ? "Ouvindo..." : `Comandar equipe ${activeBU.name}...`}
                className="flex-1 bg-transparent px-4 py-3 text-sm font-medium outline-none text-gray-700 placeholder:text-gray-400"
                disabled={isLoading || isTranscribing}
              />
              <button type="submit" disabled={(!input.trim() && !attachment) || isLoading} className="w-10 h-10 rounded-full flex items-center justify-center text-bitrix-nav hover:text-bitrix-accent transition-all">
                 <SendIcon className="w-6 h-6" />
              </button>
           </form>
        </div>
      </div>

      {/* RIGHT SIDEBAR (THE TEAM) */}
      <div className="w-72 bg-white border-l border-gray-100 flex flex-col z-20 shadow-xl">
         <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Squad Ativo</h3>
            <p className="text-xs font-bold text-gray-700 mt-1">{unitAgents.length} Especialistas</p>
         </div>
         <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {unitAgents.length === 0 ? (
               <div className="text-center py-10 opacity-40">
                  <p className="text-[9px] uppercase font-bold text-gray-400">Nenhum agente alocado</p>
               </div>
            ) : (
               unitAgents.map(agent => (
                  <div key={agent.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all group cursor-default">
                     {/* AVATAR SUBSTITUINDO CAIXA DE LETRAS */}
                     <Avatar name={agent.name} url={agent.avatarUrl} className="w-8 h-8 rounded-lg shadow-sm" />
                     
                     <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-gray-700 truncate">{agent.name}</h4>
                        <p className="text-[9px] text-gray-400 truncate uppercase tracking-wide">{agent.officialRole}</p>
                     </div>
                     <div className={`w-1.5 h-1.5 rounded-full ${agent.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  </div>
               ))
            )}
         </div>
         <div className="p-6 bg-gray-50 border-t border-gray-100 text-center">
             <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Powered by GrupoB Kernel</p>
         </div>
      </div>

    </div>
  );
};

export default UnitView;
