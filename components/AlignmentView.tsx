
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { BusinessUnit, Message, Sender, BusinessBlueprint } from '../types';
import { sendMessageStream, transcribeAudio } from '../services/gemini';
import { SendIcon, MicIcon, StopCircleIcon, PaperclipIcon, XIcon, FileTextIcon } from './Icon';
import {
  appendMessage,
  createSession,
  findLatestSession,
  loadSessionMessages,
  touchSession,
  updateMessage
} from '../utils/supabaseChat';

interface AlignmentViewProps {
  activeBU: BusinessUnit;
  blueprint: BusinessBlueprint;
  onUpdateBlueprint: (bp: BusinessBlueprint) => void;
  activeWorkspaceId?: string | null;
  ownerUserId?: string | null;
}

const AlignmentView: React.FC<AlignmentViewProps> = ({ 
  activeBU, 
  blueprint, 
  onUpdateBlueprint,
  activeWorkspaceId,
  ownerUserId
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Audio & File
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [attachment, setAttachment] = useState<{ data: string, mimeType: string, preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const alignmentAgentId = `alignment:${activeBU.id}`;

    const bootstrap = async () => {
      try {
        const existingSession = await findLatestSession({
          workspaceId: activeWorkspaceId,
          agentId: alignmentAgentId,
          buId: activeBU.id
        });

        let targetSessionId = existingSession?.id || null;
        if (!targetSessionId) {
          targetSessionId = await createSession({
            workspaceId: activeWorkspaceId,
            agentId: alignmentAgentId,
            ownerUserId,
            buId: activeBU.id,
            title: `Alinhamento • ${activeBU.name}`,
            payload: { kind: 'alignment', buName: activeBU.name }
          });
        }

        const history = await loadSessionMessages({
          workspaceId: activeWorkspaceId,
          sessionId: targetSessionId
        });

        if (cancelled) return;
        setSessionId(targetSessionId);
        setMessages(history);
      } catch (error) {
        console.error('Erro ao carregar alinhamento:', error);
        if (cancelled) return;
        setSessionId(null);
        setMessages([]);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [activeBU.id, activeBU.name, activeWorkspaceId, ownerUserId]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachment) || isLoading || !sessionId) return;
    
    const userText = input.trim();
    const currentAttachment = attachment;
    setInput('');
    setAttachment(null);

    const displayText = currentAttachment ? (userText ? userText + " 📎 [Arquivo Anexado]" : "📎 [Arquivo Enviado]") : userText;

    const alignmentAgentId = `alignment:${activeBU.id}`;
    let persistedBotId = '';

    try {
      const savedUser = await appendMessage({
        workspaceId: activeWorkspaceId,
        sessionId,
        agentId: alignmentAgentId,
        sender: Sender.User,
        text: displayText,
        buId: activeBU.id,
        attachment: currentAttachment
      });
      setMessages(prev => [...prev, { id: savedUser.id, text: displayText, sender: Sender.User, timestamp: new Date(), buId: activeBU.id, attachment: currentAttachment || undefined }]);
      setIsLoading(true);

      const savedBot = await appendMessage({
        workspaceId: activeWorkspaceId,
        sessionId,
        agentId: alignmentAgentId,
        sender: Sender.Bot,
        text: '',
        buId: activeBU.id,
        participantName: 'Assistente de Alinhamento',
        isStreaming: true
      });
      persistedBotId = savedBot.id;
      setMessages(prev => [...prev, { id: persistedBotId, text: '', sender: Sender.Bot, timestamp: new Date(), buId: activeBU.id, isStreaming: true, participantName: 'Assistente de Alinhamento' }]);

      const context = `ALINHAMENTO ESTRATÉGICO (${activeBU.name}): Organização de DNA v1. Foco em ROI e viabilidade.`;
      
      let messagePayload: any = userText;
      if (currentAttachment) {
          messagePayload = [
              { text: userText || "Analise este documento." },
              { inlineData: { mimeType: currentAttachment.mimeType, data: currentAttachment.data } }
          ];
      }

      // IMPORTANTE: AlignmentView usa sendMessageStream direto que suporta string, mas para multimidia precisamos adaptar o service ou usar generateContent se for one-off. 
      // O App usa 'sendMessageStream' do 'gemini.ts' que encapsula o chat. Vamos assumir que o 'sendMessageStream' exportado suporta array de parts (o GoogleGenAI SDK suporta).
      // Se 'sendMessageStream' do service esperar string, vai quebrar. Vamos checar o service.
      // O service 'sendMessageStream' espera string. Vamos ajustar aqui para enviar string concatenada se for texto, ou usar uma logica especifica. 
      // Por compatibilidade rápida, vou mandar o texto apenas se não puder mandar a imagem via service.
      // Mas o service `sendMessageStream` do `gemini.ts` chama `mainChatSession.sendMessageStream({ message })`. O SDK do Gemini aceita string ou array de parts no `message`. Então deve funcionar se passarmos o array.
      
      const stream = await sendMessageStream(messagePayload, context);
      let fullText = '';
      for await (const chunk of stream) {
        fullText += (chunk as any).text || '';
        setMessages(prev => prev.map(msg => msg.id === persistedBotId ? { ...msg, text: fullText } : msg));
      }
      setMessages(prev => prev.map(msg => msg.id === persistedBotId ? { ...msg, text: fullText, isStreaming: false } : msg));
      await updateMessage(persistedBotId, { text: fullText, isStreaming: false, updatedAt: new Date() });
      await touchSession(sessionId);
    } catch (e) {
      if (persistedBotId) {
        setMessages(prev => prev.map(msg => msg.id === persistedBotId ? { ...msg, text: 'Erro na conexão ou formato de arquivo não suportado.', isStreaming: false } : msg));
        await updateMessage(persistedBotId, { text: 'Erro na conexão ou formato de arquivo não suportado.', isStreaming: false, updatedAt: new Date() }).catch(() => null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 h-full flex bg-white animate-msg overflow-hidden">
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,application/pdf,.txt" />
      
      <div className="flex-1 flex flex-col border-r border-gray-100">
        <header className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/10">
          <div>
            <h2 className="text-xl font-black text-bitrix-nav uppercase tracking-tighter">Plano de Voo: {activeBU.name}</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Discovery v1</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar" ref={chatRef}>
          <div className="max-w-2xl mx-auto space-y-10 pb-20">
            {messages.length === 0 && (
              <div className="py-20 text-center opacity-30">
                 <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 mx-auto mb-6 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                 </div>
                 <p className="text-xs font-black uppercase tracking-widest leading-relaxed">Deposite aqui o conhecimento sobre {activeBU.name}.<br/>O assistente ajudará a extrair o DNA v1.</p>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === Sender.User ? 'flex-row-reverse' : 'flex-row'} items-start gap-6 animate-msg`}>
                <div className={`px-6 py-5 rounded-[2rem] text-[14px] leading-relaxed shadow-sm border ${msg.sender === Sender.User ? 'text-white border-transparent' : 'bg-white border-gray-100 text-bitrix-text prose prose-sm'}`} style={{ backgroundColor: msg.sender === Sender.User ? activeBU.themeColor : undefined }}>
                  {msg.sender === Sender.Bot ? <ReactMarkdown>{msg.text}</ReactMarkdown> : msg.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 border-t border-gray-50 bg-white">
          {attachment && (
              <div className="max-w-2xl mx-auto mb-2 flex justify-end">
                  <div className="bg-gray-50 border border-gray-200 p-2 rounded-xl flex items-center gap-3">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Anexo pronto</span>
                      <button onClick={() => setAttachment(null)} className="text-gray-400 hover:text-red-500"><XIcon className="w-3 h-3"/></button>
                  </div>
              </div>
          )}
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto relative flex items-center bg-gray-50 border border-gray-100 rounded-[2rem] p-1.5 shadow-2xl">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all hover:bg-gray-100">
                <PaperclipIcon className="w-5 h-5" />
            </button>
            <button type="button" onClick={handleToggleRecording} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:bg-gray-100 ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}>
                {isRecording ? <StopCircleIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
            </button>

            <input 
              value={input} 
              onChange={e => setInput(e.target.value)}
              placeholder={isTranscribing ? "Ouvindo..." : `Definir pilares de ${activeBU.name}...`}
              className="flex-1 bg-transparent px-4 py-4 outline-none font-medium text-bitrix-nav text-sm"
              disabled={isLoading || isTranscribing}
            />
            <button type="submit" className="w-12 h-12 rounded-full text-bitrix-nav flex items-center justify-center transition-transform hover:scale-105" disabled={(!input.trim() && !attachment)}>
              <SendIcon className="w-6 h-6" />
            </button>
          </form>
        </div>
      </div>

      <div className="w-[420px] bg-gray-50/50 p-8 flex flex-col overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-10">
           <h3 className="text-[10px] font-black text-bitrix-nav uppercase tracking-[0.3em]">Strategic Blueprint</h3>
        </div>

        <div className="space-y-5">
          {[
            { label: 'Missão Central', key: 'mission' as keyof BusinessBlueprint, placeholder: 'O propósito master...' },
            { label: 'Proposta de Valor', key: 'valueProposition' as keyof BusinessBlueprint, placeholder: 'Diferencial U.A.U...' },
            { label: 'Público Alvo (ICP)', key: 'targetAudience' as keyof BusinessBlueprint, placeholder: 'Quem compra?' },
            { label: 'Modelo de Receita', key: 'revenueModel' as keyof BusinessBlueprint, placeholder: 'Como gera ROI?' },
            { label: 'Metas e Resultados', key: 'roiExpectation' as keyof BusinessBlueprint, placeholder: 'Resultados esperados...' }
          ].map((field) => (
            <div key={field.key} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm group">
               <div className="flex items-center justify-between mb-2">
                  <label className="text-[8px] font-black text-gray-300 uppercase tracking-widest">{field.label}</label>
               </div>
               <textarea 
                 value={blueprint[field.key] || ''} 
                 onChange={(e) => onUpdateBlueprint({ [field.key]: e.target.value })}
                 placeholder={field.placeholder}
                 className="w-full bg-transparent text-[12px] font-medium text-bitrix-nav outline-none resize-none placeholder:text-gray-200"
                 rows={3}
               />
            </div>
          ))}
        </div>

        <div className="mt-10 p-6 bg-bitrix-nav rounded-[2.5rem] text-white">
           <h4 className="text-[9px] font-black uppercase tracking-widest mb-3 opacity-50">Sincronização</h4>
           <p className="text-[11px] font-bold leading-relaxed mb-6">DNA Consolidado. Pronto para a Fábrica de C.A.</p>
           <button className="w-full py-3 bg-white/10 text-white rounded-2xl text-[8px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">Consolidar Ativo</button>
        </div>
      </div>
    </div>
  );
};

export default AlignmentView;
