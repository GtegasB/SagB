
// 🔒 LOCKED MODULE - GOLDEN SEAL (Protocolo Newton)
// Esta tela foi aprovada como funcionalidade "ClickUp-Like". 
// Não alterar lógica de entrada sem permissão expressa de Douglas Rodrigues.

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Sender, Task } from '../types';
import { startKlausSession, transcribeAudio } from '../services/gemini';
import { SendIcon, MicIcon, StopCircleIcon, PaperclipIcon, XIcon, FileTextIcon } from './Icon';
import {
  appendMessage,
  createSession,
  findLatestSession,
  loadSessionMessages,
  touchSession,
  updateMessage
} from '../utils/supabaseChat';

interface ManagementViewProps {
  tasks: Task[];
  onAddTask: (task: Task) => void;
  onUpdateTaskStatus: (taskId: string, status: Task['status']) => void;
  activeWorkspaceId?: string | null;
  ownerUserId?: string | null;
}

const ManagementView: React.FC<ManagementViewProps> = ({ tasks, onAddTask, onUpdateTaskStatus, activeWorkspaceId, ownerUserId }) => {
  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Audio & File
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [attachment, setAttachment] = useState<{ data: string, mimeType: string, preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fast Track State (ClickUp Style)
  const [quickInput, setQuickInput] = useState('');
  const [targetDate, setTargetDate] = useState(''); // Novo state para data

  // Initialize Chat Session
  useEffect(() => {
    let cancelled = false;
    const klausAgentId = 'klaus-management';

    const bootstrap = async () => {
      const session = startKlausSession();
      setChatSession(session);

      try {
        const existing = await findLatestSession({
          workspaceId: activeWorkspaceId,
          agentId: klausAgentId,
          buId: 'grupob'
        });

        let targetSessionId = existing?.id || null;
        if (!targetSessionId) {
          targetSessionId = await createSession({
            workspaceId: activeWorkspaceId,
            agentId: klausAgentId,
            ownerUserId,
            buId: 'grupob',
            title: 'Klaus • Console de Estratégia',
            payload: { kind: 'management-chat' }
          });
          await appendMessage({
            workspaceId: activeWorkspaceId,
            sessionId: targetSessionId,
            agentId: klausAgentId,
            sender: Sender.Bot,
            text: 'Console de estratégia pronto. Traga o cenário e converto para execução.',
            buId: 'grupob',
            participantName: 'Klaus'
          });
        }

        const history = await loadSessionMessages({
          workspaceId: activeWorkspaceId,
          sessionId: targetSessionId
        });

        if (cancelled) return;
        setSessionId(targetSessionId);
        setMessages(history);
      } catch (e) {
        console.error('History error', e);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, ownerUserId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  // --- FAST TRACK ADD (CLICKUP STYLE) ---
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;

    const newTask: Task = {
        id: Date.now().toString(),
        title: quickInput.trim(),
        status: 'todo',
        createdAt: new Date(),
        dueDate: targetDate ? new Date(targetDate) : undefined,
        assignee: 'Klaus'
    };
    
    onAddTask(newTask);
    setQuickInput('');
    setTargetDate(''); // Reset data
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachment) || isLoading || !chatSession || !sessionId) return;
    
    const userText = input.trim();
    const currentAttachment = attachment;
    setInput('');
    setAttachment(null);

    const displayText = currentAttachment ? (userText ? userText + " 📎 [File]" : "📎 [File]") : userText;

    let persistedBotId = '';
    
    try {
      const savedUser = await appendMessage({
        workspaceId: activeWorkspaceId,
        sessionId,
        agentId: 'klaus-management',
        sender: Sender.User,
        text: displayText,
        buId: 'grupob',
        attachment: currentAttachment
      });
      const userMsg: Message = {
        id: savedUser.id,
        text: displayText,
        sender: Sender.User,
        timestamp: new Date(),
        buId: 'grupob',
        attachment: currentAttachment || undefined
      };
      setMessages(prev => [...prev, userMsg]);
      setIsLoading(true);

      let messagePayload: any = userText;
      if (currentAttachment) {
          messagePayload = [
              { text: userText || "Analise isto." },
              { inlineData: { mimeType: currentAttachment.mimeType, data: currentAttachment.data } }
          ];
      }

      const result = await chatSession.sendMessageStream({ message: messagePayload });
      let fullText = '';
      
      const savedBot = await appendMessage({
        workspaceId: activeWorkspaceId,
        sessionId,
        agentId: 'klaus-management',
        sender: Sender.Bot,
        text: '',
        buId: 'grupob',
        participantName: 'Klaus',
        isStreaming: true
      });
      persistedBotId = savedBot.id;
      setMessages(prev => [...prev, { id: persistedBotId, text: '', sender: Sender.Bot, timestamp: new Date(), buId: 'grupob', isStreaming: true }]);

      for await (const chunk of result) {
        const textChunk = (chunk as any).text || '';
        fullText += textChunk;
        const cleanText = fullText.replace(/<<<JSON_START>>>[\s\S]*?<<<JSON_END>>>/g, '');
        setMessages(prev => prev.map(m => m.id === persistedBotId ? { ...m, text: cleanText } : m));
      }

      // JSON Parsing for Tasks
      const jsonMatch = fullText.match(/<<<JSON_START>>>([\s\S]*?)<<<JSON_END>>>/);
      if (jsonMatch && jsonMatch[1]) {
         try {
            const command = JSON.parse(jsonMatch[1]);
            if (command.action === 'create_task') {
               const newTask: Task = {
                  id: Date.now().toString(),
                  title: command.title,
                  status: command.status || 'todo',
                  createdAt: new Date(),
                  assignee: 'Klaus'
               };
               onAddTask(newTask);
               const sysText = `✅ Tarefa criada via Chat: "${newTask.title}"`;
               const savedSystem = await appendMessage({
                 workspaceId: activeWorkspaceId,
                 sessionId,
                 agentId: 'klaus-management',
                 sender: Sender.System,
                 text: sysText,
                 buId: 'grupob',
                 participantName: 'Sistema'
               });
               setMessages(prev => [...prev, { 
                  id: savedSystem.id, 
                  text: sysText, 
                  sender: Sender.System, 
                  timestamp: new Date(), 
                  buId: 'grupob' 
               }]);
            }
         } catch (e) {
            console.error("Failed to parse Klaus JSON", e);
         }
      }
      
      setMessages(prev => prev.map(m => m.id === persistedBotId ? { ...m, isStreaming: false } : m));
      await updateMessage(persistedBotId, {
        text: fullText.replace(/<<<JSON_START>>>[\s\S]*?<<<JSON_END>>>/g, ''),
        isStreaming: false,
        updatedAt: new Date()
      });
      await touchSession(sessionId);

    } catch (error) {
      if (persistedBotId) {
        setMessages(prev => prev.map(m => m.id === persistedBotId ? { ...m, text: 'Erro de conexão com o Kernel.', isStreaming: false } : m));
        await updateMessage(persistedBotId, { text: 'Erro de conexão com o Kernel.', isStreaming: false, updatedAt: new Date() }).catch(() => null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- LIST VIEW COMPONENTS (CLICKUP STYLE) ---

  const TaskRow: React.FC<{ task: Task }> = ({ task }) => {
    const isDone = task.status === 'done';
    const dateDisplay = task.dueDate 
      ? new Date(task.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) 
      : null;

    return (
      <div className="group flex items-center gap-4 py-3 px-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-default bg-white last:border-0">
         <button 
            onClick={() => onUpdateTaskStatus(task.id, isDone ? 'todo' : 'done')}
            className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isDone ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-gray-400 bg-white'}`}
         >
            {isDone && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
         </button>

         <div className="flex-1 min-w-0 flex items-center gap-3">
            <span className={`text-xs font-medium truncate block ${isDone ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-700'}`}>
               {task.title}
            </span>
            
            {dateDisplay && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${isDone ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {dateDisplay}
                </span>
            )}
         </div>

         <div className="flex items-center gap-4 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider hidden md:block">{task.assignee || 'Klaus'}</span>
            
            <div className="relative group/status">
               <select 
                  value={task.status}
                  onChange={(e) => onUpdateTaskStatus(task.id, e.target.value as any)}
                  className={`appearance-none pl-3 pr-6 py-1 rounded text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer border transition-all ${
                     task.status === 'todo' ? 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200' :
                     task.status === 'doing' ? 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100' :
                     'bg-green-50 text-green-600 border-green-100 hover:bg-green-100'
                  }`}
               >
                  <option value="todo">A Fazer</option>
                  <option value="doing">Fazendo</option>
                  <option value="done">Pronto</option>
               </select>
               <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <div className={`w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] ${task.status === 'done' ? 'border-t-green-600' : task.status === 'doing' ? 'border-t-blue-600' : 'border-t-gray-500'}`}></div>
               </div>
            </div>
         </div>
      </div>
    );
  };

  const TaskGroup: React.FC<{ 
      status: Task['status'], 
      label: string, 
      color: string, 
      count: number,
      quickAddEnabled?: boolean 
  }> = ({ status, label, color, count, quickAddEnabled }) => {
     const groupTasks = tasks.filter(t => t.status === status);
     if (status !== 'todo' && groupTasks.length === 0) return null;

     return (
        <div className="mb-8 animate-msg">
           <div className="flex items-center gap-2 mb-3 px-1 sticky top-0 bg-[#FAFAFA] py-2 z-10">
              <span className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{label}</span>
              <span className="bg-gray-200 text-gray-500 text-[9px] font-bold px-1.5 rounded-sm">{count}</span>
           </div>
           <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {quickAddEnabled && (
                  <form onSubmit={handleQuickAdd} className="flex items-center gap-3 p-3 border-b border-gray-100 bg-gray-50/50">
                     <div className="w-5 h-5 rounded border border-gray-300 border-dashed flex items-center justify-center text-gray-400">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M12 4v16m8-8H4" /></svg>
                     </div>
                     <input 
                        value={quickInput}
                        onChange={(e) => setQuickInput(e.target.value)}
                        placeholder="+ Nova tarefa..."
                        className="flex-1 bg-transparent text-xs font-medium outline-none text-gray-700 placeholder:text-gray-400 h-full"
                     />
                     <input 
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className="bg-transparent text-[10px] text-gray-500 font-bold outline-none border border-gray-200 rounded px-2 py-1 hover:border-gray-400 transition-colors uppercase cursor-pointer"
                     />
                     <button type="submit" disabled={!quickInput.trim()} className="text-[9px] font-bold text-blue-600 uppercase tracking-wider hover:text-blue-800 disabled:opacity-0 transition-all">
                        Adicionar
                     </button>
                  </form>
              )}
              {groupTasks.length === 0 && status === 'todo' ? (
                  <div className="p-4 text-center text-[10px] text-gray-400 italic">Lista vazia. Adicione acima.</div>
              ) : (
                  groupTasks.map(task => <TaskRow key={task.id} task={task} />)
              )}
           </div>
        </div>
     );
  };

  const todoCount = tasks.filter(t => t.status === 'todo').length;
  const doingCount = tasks.filter(t => t.status === 'doing').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;

  return (
    <div className="flex h-full bg-white font-sans animate-msg overflow-hidden">
       <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,application/pdf,.txt,.json" />

       {/* LEFT: LIST VIEW (CLICKUP STYLE) (60%) */}
       <div className="flex-[3] flex flex-col border-r border-gray-100 bg-[#FAFAFA]">
          <header className="h-16 px-8 flex items-center justify-between border-b border-gray-100 bg-white">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-md">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M4 6h16M4 12h16M4 18h7" /></svg>
                </div>
                <div>
                   <h2 className="text-sm font-black text-gray-800 uppercase tracking-tight">Lista Mestre</h2>
                   <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Gestão de Backlog</p>
                </div>
             </div>
             
             <div className="flex items-center gap-3">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{Math.round((doneCount / (tasks.length || 1)) * 100)}% Concluído</span>
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                   <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(doneCount / (tasks.length || 1)) * 100}%` }}></div>
                </div>
             </div>
          </header>
          
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
             <div className="max-w-4xl mx-auto">
                <TaskGroup status="doing" label="Em Andamento (Foco)" color="text-blue-600" count={doingCount} />
                <TaskGroup status="todo" label="A Fazer (Pilha)" color="text-gray-500" count={todoCount} quickAddEnabled={true} />
                <TaskGroup status="done" label="Concluído" color="text-green-600" count={doneCount} />
             </div>
          </div>
       </div>

       {/* RIGHT: KLAUS CONSOLE (40%) */}
       <div className="flex-[2] flex flex-col bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.02)] z-10 border-l border-gray-100">
          <header className="h-16 px-6 flex items-center gap-4 border-b border-gray-100 bg-white">
             <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-xs border border-blue-200">
                K
             </div>
             <div>
                <h3 className="text-xs font-black text-gray-800 uppercase tracking-wide">Klaus (Architect)</h3>
                <p className="text-[9px] text-green-500 font-bold uppercase tracking-widest flex items-center gap-1">
                   <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                   Online
                </p>
             </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-gray-50/30">
             {messages.length === 0 && (
                 <div className="text-center mt-20 opacity-40">
                     <p className="text-[10px] uppercase font-bold text-gray-400">Console de Estratégia</p>
                     <p className="text-xs text-gray-500 mt-1">Use este chat para detalhar as tarefas criadas.</p>
                 </div>
             )}
             {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === Sender.User ? 'flex-row-reverse' : 'flex-row'} items-start gap-3 animate-msg`}>
                   <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-xs leading-relaxed shadow-sm border ${
                      msg.sender === Sender.User 
                         ? 'bg-blue-600 text-white rounded-tr-none border-blue-600' 
                         : msg.sender === Sender.System
                             ? 'bg-green-50 text-green-700 border-green-200 text-center w-full font-bold'
                             : 'bg-white text-gray-700 rounded-tl-none border-gray-200'
                   }`}>
                      {msg.sender === Sender.Bot ? <ReactMarkdown>{msg.text}</ReactMarkdown> : msg.text}
                   </div>
                </div>
             ))}
             <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-gray-100">
             {attachment && (
                <div className="flex justify-end mb-2 pr-2">
                    <div className="bg-gray-50 border border-gray-200 p-1.5 rounded-lg flex items-center gap-2">
                        <span className="text-[9px] uppercase font-bold text-gray-500">Anexo</span>
                        <button onClick={() => setAttachment(null)}><XIcon className="w-3 h-3 text-red-500"/></button>
                    </div>
                </div>
             )}
             <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-full border border-gray-200 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600">
                    <PaperclipIcon className="w-4 h-4" />
                </button>
                <button type="button" onClick={handleToggleRecording} className={`w-8 h-8 rounded-full flex items-center justify-center ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}>
                    {isRecording ? <StopCircleIcon className="w-4 h-4" /> : <MicIcon className="w-4 h-4" />}
                </button>
                <input 
                   value={input}
                   onChange={e => setInput(e.target.value)}
                   placeholder={isTranscribing ? "Ouvindo..." : "Debater estratégia com Klaus..."}
                   className="flex-1 bg-transparent px-4 py-2 text-xs font-medium outline-none text-gray-700"
                   disabled={isLoading || isTranscribing}
                />
                <button type="submit" disabled={(!input.trim() && !attachment) || isLoading} className="w-8 h-8 rounded-full text-blue-600 flex items-center justify-center hover:text-blue-800 transition-colors disabled:opacity-50">
                   <SendIcon className="w-4 h-4" />
                </button>
             </form>
          </div>
       </div>

    </div>
  );
};

export default ManagementView;
