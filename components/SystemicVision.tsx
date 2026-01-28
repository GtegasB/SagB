
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Agent, Message, Sender, BusinessUnit, AgentTier, AgentStatus, Topic, PersonaConfig, UserProfile } from '../types';
import { startAgentSession, generateTitleOptions, transcribeAudio, generateTaskSuggestions, consolidateChatMemory } from '../services/gemini';
import { streamDeepSeekResponse, DeepSeekMessage } from '../services/deepseek';
import { retrieveRelevantContext, retrieveLearnedMemory, addDocumentToAgent, addLearningToAgent } from '../services/knowledge';
import { SendIcon, NewChatIcon, MicIcon, StopCircleIcon, BackIcon, FolderIcon, PlusIcon, FileTextIcon, CloudUploadIcon, PaperclipIcon, XIcon, BookIcon, BotIcon, PencilIcon, CheckIcon, TrashIcon } from './Icon';
import { Avatar } from './Avatar';
import ChatMessage from './ChatMessage';


interface SystemicVisionProps {
    dynamicAgents: Agent[];
    onUpdateAgents: (agents: Agent[]) => void;
    activeBU: BusinessUnit;
    onAddAgent?: (agent: Agent) => void;
    onApproveAgent?: (agentId: string) => void;
    onPlanAgent?: (agent: Agent) => void;
    onEnterRoom?: (buId: string) => void;
    businessUnits?: BusinessUnit[];
    totalGlobalAgents?: number;
    forcedAgent?: Agent | null;
    onBack?: () => void;
    onConvertToTopic?: (topic: Partial<Topic>) => void;
    viewMode?: 'bu' | 'global';
    userProfile?: UserProfile | null;
}

// Interface para Sessão
interface ChatSession {
    id: string;
    agentId: string;
    title: string;
    createdAt: number;
    lastMessageAt: number;
}

const SystemicVision: React.FC<SystemicVisionProps> = ({ dynamicAgents, onUpdateAgents, activeBU, onAddAgent, onApproveAgent, onPlanAgent, onEnterRoom, businessUnits = [], totalGlobalAgents = 0, forcedAgent, onBack, onConvertToTopic, viewMode = 'bu', userProfile }) => {

    const CURRENT_USER = useMemo(() => ({
        name: userProfile?.name || "Douglas Rodrigues",
        nickname: userProfile?.nickname || userProfile?.name?.split(' ')[0] || "Rodrigues",
        role: userProfile?.role || "Chairman",
        avatar: userProfile?.avatarUrl || "https://firebasestorage.googleapis.com/v0/b/sagb-grupob-v1.firebasestorage.app/o/Douglas%20Rodrigues%2FScreenshot_79.png?alt=media&token=1b6c2884-ae4d-49de-9d03-f0a38e0cfc27"
    }), [userProfile]);

    const HUMAN_GREETINGS = [
        `Fala ${CURRENT_USER.nickname}. Estou na escuta.`,
        `Opa, ${CURRENT_USER.nickname}. O que temos para agora?`,
        `Bora falar, ${CURRENT_USER.nickname}?`,
        `Na linha. Qual a pauta?`,
        `Pronto. O que manda?`,
        `E aí ${CURRENT_USER.nickname}. Pode falar.`
    ];
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

    // --- SESSION MANAGEMENT STATE ---
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [activeMessages, setActiveMessages] = useState<Message[]>([]);
    const [showHistorySidebar, setShowHistorySidebar] = useState(false);
    const [titleOptions, setTitleOptions] = useState<string[] | null>(null);
    const [taskSuggestions, setTaskSuggestions] = useState<string[] | null>(null);

    // --- MULTI-AGENT STATE ---
    const [activeParticipants, setActiveParticipants] = useState<Agent[]>([]);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    // --- EDITING STATE REMOVED (NOW LOCAL IN COMPONENT) ---
    // A lógica de edição agora é controlada diretamente pelo handleUpdateAndRegenerate

    // --- MODEL SELECTION STATE ---
    const [modelMode, setModelMode] = useState<'flash' | 'pro'>('flash');

    // --- KNOWLEDGE BASE STATE (SIDEBAR REMOVIDA - SÓ HISTÓRICO AGORA) ---
    const [isTraining, setIsTraining] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- CHAT ATTACHMENT & DRAG/DROP STATE ---
    const [attachment, setAttachment] = useState<{ data: string, mimeType: string, preview: string } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const chatAttachmentRef = useRef<HTMLInputElement>(null);

    // --- RESIZABLE SIDEBAR STATE ---
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const isResizing = useRef(false);

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [geminiSession, setGeminiSession] = useState<any>(null);

    // --- AUDIO RECORDING STATE ---
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // --- NEW: TASK MODAL STATE ---
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [taskForm, setTaskForm] = useState({
        title: '',
        assignee: '',
        date: new Date().toISOString().split('T')[0]
    });
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const stopStreamingRef = useRef(false);
    const hasSummonedRef = useRef(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // New Agent Modal State
    const [isAdding, setIsAdding] = useState(false);
    const [newAgentBU, setNewAgentBU] = useState(activeBU.id);

    // --- ECOSYSTEM HUD METRICS ---
    const totalCompanies = businessUnits.length;
    const totalAgents = dynamicAgents.length;

    // --- CALCULATED LISTS ---
    const agentsByBU = useMemo(() => {
        return dynamicAgents.reduce((acc, agent) => {
            const buKey = agent.buId || 'others';
            if (!acc[buKey]) acc[buKey] = [];
            acc[buKey].push(agent);
            return acc;
        }, {} as Record<string, Agent[]>);
    }, [dynamicAgents]);

    const sortAgents = (agents: Agent[]) => {
        const tierOrder: Record<string, number> = { 'ESTRATÉGICO': 0, 'TÁTICO': 1, 'OPERACIONAL': 2, 'CONTROLE': 3 };
        return agents.sort((a, b) => (tierOrder[a.tier || 'OPERACIONAL'] || 99) - (tierOrder[b.tier || 'OPERACIONAL'] || 99));
    };

    // --- EFFECTS ---

    useEffect(() => {
        // Scroll apenas se não estiver carregando, para evitar pulos durante stream
        if (!isLoading) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [activeMessages, isLoading]);

    useEffect(() => {
        setNewAgentBU(activeBU.id);
    }, [activeBU.id]);

    // Persist Messages when they change
    useEffect(() => {
        if (selectedAgent && currentSessionId && activeMessages.length > 0) {
            localStorage.setItem(`grupob_chat_${currentSessionId}`, JSON.stringify(activeMessages));
        }
    }, [activeMessages, currentSessionId, selectedAgent]);

    // Reset textarea height on input clear
    useEffect(() => {
        if (input === '' && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [input]);

    // --- AUTO-OPEN FORCED AGENT ---
    useEffect(() => {
        if (forcedAgent) {
            handleOpenAgent(forcedAgent);
        }
    }, [forcedAgent]);

    // --- RE-INIT SESSION ON MODEL CHANGE ---
    useEffect(() => {
        if (selectedAgent && selectedAgent.modelProvider !== 'deepseek') {
            initializeSession(selectedAgent);
        }
    }, [modelMode]);

    const initializeSession = (agent: Agent, history: any[] = []) => {
        const modelId = modelMode === 'flash' ? 'gemini-2.5-flash' : 'gemini-1.5-pro';
        // Busca memória de longo prazo
        const longTerm = retrieveLearnedMemory(agent);

        // INVENTÁRIO DE DOCUMENTOS (Para o agente saber o que tem)
        const docsInventory = agent.globalDocuments
            ? agent.globalDocuments.map(d => `- ${d.title}`).join('\n')
            : "Nenhum documento vinculado.";

        const gs = startAgentSession(
            agent.id,
            agent.fullPrompt,
            agent.knowledgeBase || [],
            modelId,
            history.length > 0 ? history : undefined,
            CURRENT_USER,
            undefined, // RAG context inicial vazio
            longTerm, // Memória consolidada
            docsInventory // Inventário para o prompt do sistema
        );
        setGeminiSession(gs);
        return gs;
    };

    // --- RESIZING LOGIC ---
    const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        isResizing.current = true;
        const startX = mouseDownEvent.clientX;
        const startWidth = sidebarWidth;

        const doDrag = (mouseMoveEvent: MouseEvent) => {
            if (isResizing.current) {
                const newWidth = startWidth + (mouseMoveEvent.clientX - startX);
                if (newWidth > 200 && newWidth < 600) {
                    setSidebarWidth(newWidth);
                }
            }
        };

        const stopDrag = () => {
            isResizing.current = false;
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
            document.body.style.cursor = 'default';
        };

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
        document.body.style.cursor = 'col-resize';
    }, [sidebarWidth]);

    // --- SESSION LOGIC ---
    const loadSessionsForAgent = (agentId: string) => {
        const stored = localStorage.getItem(`grupob_sessions_${agentId}`);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setSessions(parsed.sort((a: ChatSession, b: ChatSession) => b.lastMessageAt - a.lastMessageAt));
            } catch (e) { setSessions([]); }
        } else {
            setSessions([]);
        }
    };

    const createNewSession = (agent: Agent) => {
        const newSessionId = Date.now().toString();
        const newSession: ChatSession = {
            id: newSessionId,
            agentId: agent.id,
            title: "Nova Conversa",
            createdAt: Date.now(),
            lastMessageAt: Date.now()
        };

        const updatedSessions = [newSession, ...sessions];
        setSessions(updatedSessions);
        localStorage.setItem(`grupob_sessions_${agent.id}`, JSON.stringify(updatedSessions));

        setCurrentSessionId(newSessionId);

        // SAUDAÇÃO HUMANIZADA (Random Pick)
        const randomGreeting = HUMAN_GREETINGS[Math.floor(Math.random() * HUMAN_GREETINGS.length)];

        setActiveMessages([{
            id: 'init',
            text: randomGreeting,
            sender: Sender.Bot,
            timestamp: new Date(),
            buId: activeBU.id
        }]);

        setTitleOptions(null);
        setTaskSuggestions(null);
        setAttachment(null);
        setActiveParticipants([]);

        if (agent.modelProvider !== 'deepseek') {
            initializeSession(agent);
        } else {
            setGeminiSession(null);
        }
        setShowHistorySidebar(false);
    };

    const selectSession = (sessionId: string, agentContext?: Agent) => {
        const agent = agentContext || selectedAgent;

        setCurrentSessionId(sessionId);
        setTitleOptions(null);
        setTaskSuggestions(null);
        setAttachment(null);
        setActiveParticipants([]);

        const storedMsgs = localStorage.getItem(`grupob_chat_${sessionId}`);
        if (storedMsgs) {
            try {
                setActiveMessages(JSON.parse(storedMsgs).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
            } catch (e) { setActiveMessages([]); }
        } else {
            setActiveMessages([]);
        }
    };

    const handleManualSuggestTitle = async () => {
        if (activeMessages.length < 2) return;
        setIsLoading(true);
        const context = activeMessages.slice(-10).map(m => m.text).join('\n');
        try {
            const sug = await generateTitleOptions(context);
            setTitleOptions(sug);
        } catch (e) {
            console.error("Erro ao sugerir título:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteSession = (sessionId: string) => {
        if (!window.confirm("Deseja realmente excluir esta conversa?")) return;

        const updatedSessions = sessions.filter(s => s.id !== sessionId);
        setSessions(updatedSessions);
        if (selectedAgent) {
            localStorage.setItem(`grupob_sessions_${selectedAgent.id}`, JSON.stringify(updatedSessions));
        }
        localStorage.removeItem(`grupob_chat_${sessionId}`);

        if (currentSessionId === sessionId) {
            setCurrentSessionId(null);
            setActiveMessages([]);
        }
        setMenuOpenId(null);
    };

    const handleRenameSession = (sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId);
        const newTitle = window.prompt("Novo nome da conversa:", session?.title);
        if (newTitle && newTitle.trim()) {
            const updatedSessions = sessions.map(s => s.id === sessionId ? { ...s, title: newTitle.trim() } : s);
            setSessions(updatedSessions);
            if (selectedAgent) {
                localStorage.setItem(`grupob_sessions_${selectedAgent.id}`, JSON.stringify(updatedSessions));
            }
        }
        setMenuOpenId(null);
    };


    const handleOpenAgent = (agent: Agent) => {
        setSelectedAgent(agent);
        if (agent.status !== 'PLANNED') {
            loadSessionsForAgent(agent.id);
            const stored = localStorage.getItem(`grupob_sessions_${agent.id}`);
            if (!stored || JSON.parse(stored).length === 0) {
                setTimeout(() => createNewSession(agent), 50);
            } else {
                const recent = JSON.parse(stored).sort((a: ChatSession, b: ChatSession) => b.lastMessageAt - a.lastMessageAt)[0];
                selectSession(recent.id, agent);
            }
        }
    };

    // --- HANDLER FUNCTIONS ---

    const updateSessionMetadata = (sessionId: string) => {
        setSessions(prev => {
            const updated = prev.map(s => s.id === sessionId ? { ...s, lastMessageAt: Date.now() } : s);
            updated.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
            if (selectedAgent) {
                localStorage.setItem(`grupob_sessions_${selectedAgent.id}`, JSON.stringify(updated));
            }
            return updated;
        });
    };

    const handleCloseChat = () => {
        setSelectedAgent(null);
        setActiveParticipants([]);
        if (forcedAgent && onBack) {
            onBack();
        }
    };

    // --- CORE: LOGICA DE EDIÇÃO E REGENERAÇÃO ---
    const handleUpdateAndRegenerate = async (msg: Message, newText: string, newAttachment?: { data: string, mimeType: string, preview: string } | null) => {
        if (!selectedAgent) return;

        // 1. Encontrar o índice da mensagem editada
        const msgIndex = activeMessages.findIndex(m => m.id === msg.id);
        if (msgIndex === -1) return;

        // 2. Cortar o histórico: Manter tudo ATÉ a mensagem editada
        const truncatedMessages = activeMessages.slice(0, msgIndex + 1);

        // 3. Atualizar o texto e anexo da mensagem do usuário
        truncatedMessages[msgIndex] = {
            ...truncatedMessages[msgIndex],
            text: newAttachment ? (newText ? newText + " 📎 [Arquivo Anexado]" : "📎 [Arquivo Enviado]") : newText,
            attachment: newAttachment || undefined
        };

        // 4. Atualizar estado visual imediatamente
        setActiveMessages(truncatedMessages);
        setIsLoading(true);

        // 5. Preparar para regenerar a resposta
        const botMsgId = Date.now().toString() + '_bot_regen';
        setActiveMessages(prev => [...prev, {
            id: botMsgId,
            text: '',
            sender: Sender.Bot,
            timestamp: new Date(),
            buId: activeBU.id,
            isStreaming: true
        }]);

        try {
            // --- LOGICA DE GERAÇÃO (Cópia da handleSendMessage adaptada) ---
            const ragContext = retrieveRelevantContext(selectedAgent, newText);

            if (selectedAgent.modelProvider === 'deepseek') {
                const deepSeekHistory = truncatedMessages.map(m => ({
                    role: m.sender === Sender.User ? 'user' : 'assistant',
                    content: m.text
                })) as DeepSeekMessage[];

                if (ragContext) {
                    deepSeekHistory.push({ role: 'system', content: ragContext });
                }

                const stream = streamDeepSeekResponse(deepSeekHistory, selectedAgent.fullPrompt);
                let fullText = "";

                for await (const chunk of stream) {
                    fullText += chunk.text;
                    setActiveMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: fullText } : m));
                }
                setActiveMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false } : m));

            } else {
                // GEMINI: Precisamos reiniciar a sessão com o histórico cortado para garantir consistência
                // Convertendo histórico para formato Gemini
                const geminiHistory = truncatedMessages.slice(0, -1).map(m => ({ // Remove a última (que é o prompt atual)
                    role: m.sender === Sender.User ? 'user' : 'model',
                    parts: [{ text: m.text }]
                }));

                // Reinicializa sessão com histórico limpo
                initializeSession(selectedAgent, geminiHistory);
                await new Promise(r => setTimeout(r, 500)); // Breve delay para garantir init

                let messagePayload: any = newText;
                if (ragContext) {
                    messagePayload = `${ragContext}\n\n[MENSAGEM DO USUÁRIO]:\n${newText}`;
                }
                if (activeParticipants.length > 0) {
                    messagePayload = `[MESA: ${activeParticipants.map(p => p.name).join(', ')}]\n${messagePayload}`;
                }

                const result = await geminiSession?.sendMessageStream({ message: messagePayload });
                let fullText = '';

                for await (const chunk of result) {
                    const text = (chunk as any).text || '';
                    fullText += text;
                    setActiveMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: fullText } : m));
                }
                setActiveMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false } : m));
            }

            if (currentSessionId) {
                updateSessionMetadata(currentSessionId);
            }

        } catch (error) {
            console.error(error);
            setActiveMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: "Erro na regeneração.", isStreaming: false } : m));
        } finally {
            setIsLoading(false);
        }
    };

    const handleInviteAgent = (agent: Agent, manual: boolean = true) => {
        if (activeParticipants.some(p => p.id === agent.id)) return;
        setActiveParticipants(prev => [...prev, agent]);
        if (manual) {
            setIsInviteModalOpen(false);
            setActiveMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: `SYSTEM: ${agent.name} entrou na sala.`,
                sender: Sender.System,
                timestamp: new Date(),
                buId: activeBU.id
            }]);
        }
    };

    const handleConsolidateLearning = async () => {
        if (!selectedAgent || activeMessages.length < 5) return;
        setIsTraining(true);
        const historyText = activeMessages.map(m => `${m.sender}: ${m.text}`).join('\n');
        const learnings = await consolidateChatMemory(historyText);

        if (learnings && learnings !== "Nenhum aprendizado novo") {
            const updatedAgent = addLearningToAgent(selectedAgent, learnings);
            onUpdateAgents(dynamicAgents.map(a => a.id === updatedAgent.id ? updatedAgent : a));
            setSelectedAgent(updatedAgent);
            alert("Memória consolidada com sucesso!");
        } else {
            alert("Nada de novo para aprender nesta conversa.");
        }
        setIsTraining(false);
    };

    const openTaskModal = () => setIsTaskModalOpen(true);

    const handleSaveTaskFromModal = () => {
        if (!taskForm.title) return;
        if (onConvertToTopic) {
            onConvertToTopic({
                title: taskForm.title,
                priority: 'Média',
                assignee: taskForm.assignee,
                dueDate: taskForm.date
            });
        }
        setIsTaskModalOpen(false);
        setTaskForm({ title: '', assignee: '', date: new Date().toISOString().split('T')[0] });
    };

    const handleApplyTitle = (title: string) => {
        if (!currentSessionId) return;
        setSessions(prev => {
            const updated = prev.map(s => s.id === currentSessionId ? { ...s, title } : s);
            localStorage.setItem(`grupob_sessions_${selectedAgent?.id}`, JSON.stringify(updated));
            return updated;
        });
        setTitleOptions(null);
    };

    const handleSuggestionClick = (suggestion: string) => {
        if (onConvertToTopic) {
            onConvertToTopic({ title: suggestion, priority: 'Média', assignee: selectedAgent?.name });
            setTaskSuggestions(null);
        } else {
            setInput(suggestion);
        }
    };

    // --- AUDIO & FILES & DRAG DROP ---

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

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    setIsTranscribing(true);
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = async () => {
                        try {
                            const base64String = (reader.result as string).split(',')[1];
                            const transcription = await transcribeAudio(base64String, 'audio/webm');
                            if (transcription) {
                                setInput(prev => prev ? `${prev} ${transcription}` : transcription);
                                setTimeout(() => {
                                    if (textareaRef.current) {
                                        textareaRef.current.style.height = 'auto';
                                        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
                                    }
                                }, 10);
                            }
                        } catch (e) {
                            console.error("Transcription Failed", e);
                            setInput(prev => `${prev} (Erro na transcrição de áudio)`);
                        } finally {
                            setIsTranscribing(false);
                            stream.getTracks().forEach(track => track.stop());
                        }
                    };
                };

                mediaRecorder.start();
                setIsRecording(true);
            } catch (err) {
                console.error("Mic Access Error", err);
                alert("Permissão de microfone negada. Verifique as configurações do navegador.");
            }
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleChatAttachmentSelect(e);
    };

    const handleChatAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                setAttachment({
                    data: (ev.target.result as string).split(',')[1],
                    mimeType: file.type,
                    preview: ev.target.result as string
                });
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleRemoveAttachment = () => setAttachment(null);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setAttachment({
                        data: (ev.target.result as string).split(',')[1],
                        mimeType: file.type,
                        preview: ev.target.result as string
                    });
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGlobalDragOver = (e: React.DragEvent) => {
        if (selectedAgent) e.preventDefault();
    };

    const handleGlobalDrop = (e: React.DragEvent) => {
        if (selectedAgent) {
            e.preventDefault();
            handleDrop(e);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        if (ev.target?.result) {
                            setAttachment({
                                data: (ev.target.result as string).split(',')[1],
                                mimeType: blob.type,
                                preview: ev.target.result as string
                            });
                        }
                    };
                    reader.readAsDataURL(blob);
                }
            }
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!input.trim() && !attachment) || isLoading || !selectedAgent) return;

        const userText = input.trim();
        const currentAttachment = attachment;

        setInput('');
        setAttachment(null);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.focus();
        }

        const userMsg: Message = {
            id: Date.now().toString(),
            text: currentAttachment ? (userText ? userText + " 📎 [Arquivo Anexado]" : "📎 [Arquivo Enviado]") : userText,
            sender: Sender.User,
            timestamp: new Date(),
            buId: activeBU.id,
            attachment: currentAttachment ? {
                data: currentAttachment.data,
                mimeType: currentAttachment.mimeType,
                preview: currentAttachment.preview
            } : undefined
        };

        setActiveMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        const botMsgId = Date.now().toString() + '_bot';
        setActiveMessages(prev => [...prev, {
            id: botMsgId,
            text: '',
            sender: Sender.Bot,
            timestamp: new Date(),
            buId: activeBU.id,
            isStreaming: true
        }]);

        try {
            // RAG & CONTEXT RETRIEVAL (BUSCA DE CONTEÚDO)
            const ragContext = retrieveRelevantContext(selectedAgent, userText);

            // LÓGICA MULTI-MODELO (CÉREBRO)
            if (selectedAgent.modelProvider === 'deepseek') {
                const deepSeekHistory = activeMessages.concat(userMsg).map(m => ({
                    role: m.sender === Sender.User ? 'user' : 'assistant',
                    content: m.text
                })) as DeepSeekMessage[];

                // INJEÇÃO RAG PARA DEEPSEEK (Anexa ao histórico como sistema)
                if (ragContext) {
                    deepSeekHistory.push({ role: 'system', content: ragContext });
                }

                const stream = streamDeepSeekResponse(deepSeekHistory, selectedAgent.fullPrompt);
                let fullText = "";

                for await (const chunk of stream) {
                    fullText += chunk.text;
                    setActiveMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: fullText } : m));
                }
                setActiveMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false } : m));

            } else {
                // GEMINI (DEFAULT)
                let currentSession = geminiSession;
                if (!currentSession) {
                    currentSession = initializeSession(selectedAgent);
                }

                let messagePayload: any = userText;

                // INJEÇÃO RAG PARA GEMINI (Anexa à mensagem)
                if (ragContext) {
                    messagePayload = `${ragContext}\n\n[MENSAGEM DO USUÁRIO]:\n${userText}`;
                }

                if (activeParticipants.length > 0) {
                    messagePayload = `[MESA: ${activeParticipants.map(p => p.name).join(', ')}]\n${messagePayload}`;
                }

                if (currentAttachment) {
                    messagePayload = [
                        { text: typeof messagePayload === 'string' ? messagePayload : userText },
                        { inlineData: { mimeType: currentAttachment.mimeType, data: currentAttachment.data } }
                    ];
                }

                const result = await currentSession?.sendMessageStream({ message: messagePayload });
                let fullText = '';

                for await (const chunk of result) {
                    const text = (chunk as any).text || '';
                    fullText += text;

                    if (!hasSummonedRef.current && fullText.includes('<<<CALL:')) {
                        const match = fullText.match(/<<<CALL: (.*?)>>>/);
                        if (match) {
                            const agentName = match[1];
                            const agentToCall = dynamicAgents.find(a => a.name.includes(agentName) || agentName.includes(a.name));
                            if (agentToCall && !activeParticipants.some(p => p.id === agentToCall.id)) {
                                handleInviteAgent(agentToCall, false);
                                hasSummonedRef.current = true;
                            }
                        }
                    }

                    setActiveMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: fullText } : m));
                }
                setActiveMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false } : m));
                hasSummonedRef.current = false;
            }

            if (currentSessionId) {
                updateSessionMetadata(currentSessionId);
            }

        } catch (error: any) {
            console.error("Neural Connection Error Detail:", error);
            const technicalMsg = error.message || "Conexão Instável";

            // TENTATIVA DE FALLBACK AUTOMÁTICO PARA DEEPSEEK SE O GEMINI FALHAR
            if (technicalMsg.includes("403") || technicalMsg.includes("PERMISSION_DENIED") || technicalMsg.includes("blocked")) {
                console.warn("⚠️ Gemini Bloqueado. Ativando Protocolo de Emergência (DeepSeek Fallback)...");
                try {
                    const deepSeekHistory = activeMessages.concat(userMsg).map(m => ({
                        role: m.sender === Sender.User ? 'user' : 'assistant',
                        content: m.text
                    })) as DeepSeekMessage[];

                    const stream = streamDeepSeekResponse(deepSeekHistory, selectedAgent.fullPrompt);
                    let fullText = "⚠️ [MODO DE EMERGÊNCIA ATIVADO: Gemini bloqueado. Usando DeepSeek.]\n\n";

                    for await (const chunk of stream) {
                        fullText += chunk.text;
                        setActiveMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: fullText } : m));
                    }
                    setActiveMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false } : m));
                    return; // Sucesso no Fallback
                } catch (dsError: any) {
                    console.error("DeepSeek Fallback also failed:", dsError);
                }
            }

            setActiveMessages(prev => prev.map(m => m.id === botMsgId ? {
                ...m,
                text: `Erro na conexão neural (${technicalMsg}). Newton, crie uma NOVA CHAVE DE API e verifique as restrições de serviço no Google Cloud.`,
                isStreaming: false
            } : m));
        } finally {
            setIsLoading(false);
        }
    };

    const directorsList: PersonaConfig[] = [
        {
            id: selectedAgent?.id || 'main',
            name: selectedAgent?.name || '',
            baseRole: selectedAgent?.officialRole || '',
            tier: 'ESTRATÉGICO',
            contextInfo: '',
            tone: '',
            welcomeMessage: '',
            avatarColor: '',
            imageUrl: selectedAgent?.avatarUrl
        },
        ...activeParticipants.map(p => ({
            id: p.id,
            name: p.name,
            baseRole: p.officialRole,
            tier: 'ESTRATÉGICO' as AgentTier,
            contextInfo: '',
            tone: '',
            welcomeMessage: '',
            avatarColor: '',
            imageUrl: p.avatarUrl
        }))
    ];

    return (
        <div
            className="flex-1 h-full bg-[#FAFAFA] overflow-hidden flex flex-col relative font-nunito"
            onDragOver={handleGlobalDragOver}
            onDrop={handleGlobalDrop}
        >
            <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.md,.json,.csv,.js,.ts,.tsx,.py,.html,.css,.xml,.env,.yml,.yaml" onChange={handleFileSelect} />
            <input type="file" ref={chatAttachmentRef} className="hidden" accept="image/*,application/pdf,.txt,.md" onChange={handleChatAttachmentSelect} />

            {!forcedAgent && (
                <div className="px-6 md:px-12 py-6 border-b border-gray-100 flex justify-between items-end shrink-0 bg-white z-10">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-bitrix-nav tracking-tighter uppercase">{viewMode === 'global' ? 'Equipe Global' : 'Cluster View'}</h1>
                        <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.4em] mt-1 text-gray-400">{viewMode === 'global' ? 'Todos os Agentes do Ecossistema' : 'Visão Sistêmica'}</p>
                    </div>

                    <div className="flex items-center gap-6">
                        {onAddAgent && (
                            <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-bitrix-nav text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl shadow-lg hover:scale-105 transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M12 4v16m8-8H4" /></svg>
                                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest hidden md:inline">Novo Ativo</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {!forcedAgent && (
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50">
                    <div className="px-6 md:px-12 py-6 md:py-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                            <div className="relative overflow-hidden bg-gradient-to-br from-white to-slate-50 border border-white/80 rounded-[20px] p-5 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Estrutura</p>
                                        <h3 className="text-3xl font-black text-indigo-900 tracking-tighter">{totalCompanies}</h3>
                                        <p className="text-[8px] font-bold text-gray-400 mt-1 uppercase tracking-wide">{totalAgents} Headcount</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 256 256"><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H216V200ZM80,148a12,12,0,1,1,12,12A12,12,0,0,1,80,148Zm0-60a12,12,0,1,1,12,12A12,12,0,0,1,80,88Zm60,60a12,12,0,1,1,12,12A12,12,0,0,1,140,148Zm0-60a12,12,0,1,1,12,12A12,12,0,0,1,140,88Zm60,60a12,12,0,1,1,12,12A12,12,0,0,1,200,148Zm0-60a12,12,0,1,1,12,12A12,12,0,1,1,12,12A12,12,0,0,1,200,88Z"></path></svg>
                                    </div>
                                </div>
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 md:p-12 pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                            {Object.entries(agentsByBU).map(([buId, rawAgents]) => {
                                const agents = rawAgents as Agent[];
                                const sortedAgents = sortAgents([...agents]);
                                const buName = sortedAgents[0]?.company || buId.toUpperCase();

                                return (
                                    <div key={buId} className="bg-white rounded-[1.5rem] p-4 border border-gray-100 shadow-sm flex flex-col gap-3 hover:shadow-lg transition-all animate-msg relative group">
                                        <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                                            <div>
                                                <h3 className="text-sm font-black text-bitrix-nav uppercase tracking-tight">{buName}</h3>
                                                <span className="text-[8px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase">{agents.length} Agentes</span>
                                            </div>
                                            <button onClick={() => onEnterRoom && onEnterRoom(buId)} className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-bitrix-nav hover:text-white transition-all shadow-sm">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                                            </button>
                                        </div>
                                        <div className="space-y-1">
                                            {sortedAgents.map(agent => {
                                                const isPlanned = agent.status === 'PLANNED';
                                                const isStaging = agent.status === 'STAGING';
                                                const isDeepSeek = agent.modelProvider === 'deepseek';

                                                return (
                                                    <button
                                                        key={agent.id}
                                                        onClick={() => handleOpenAgent(agent)}
                                                        className={`flex items-center w-full bg-white border border-gray-100 rounded-lg p-2 hover:border-gray-300 hover:shadow-sm transition-all duration-200 cursor-pointer mb-1 group ${isPlanned ? 'opacity-60 border-dashed bg-gray-50' : ''}`}
                                                    >
                                                        <div className="relative mr-3 shrink-0">
                                                            <Avatar name={agent.name} url={agent.avatarUrl} className="w-8 h-8 rounded-full object-cover border border-gray-100" />
                                                            <span className={`absolute bottom-0 right-0 w-2 h-2 border-2 border-white rounded-full ${isPlanned ? 'bg-gray-300' : isStaging ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></span>
                                                        </div>
                                                        <div className="flex-1 min-w-0 text-left">
                                                            <h4 className={`text-xs font-semibold truncate ${isPlanned ? 'text-gray-500' : 'text-gray-900'}`}>{agent.name}</h4>
                                                            <div className="flex items-center gap-1.5">
                                                                <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wider truncate">{agent.officialRole}</p>
                                                                {isStaging && <span className="text-[7px] font-bold text-yellow-600 bg-yellow-50 px-1 rounded uppercase">Beta</span>}
                                                                {isDeepSeek && <span className="text-[6px] font-black text-white bg-blue-600 px-1 rounded uppercase ml-auto">DeepSeek</span>}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {selectedAgent && (
                <div className={`
            fixed inset-0 z-[100] bg-bitrix-nav/60 backdrop-blur-xl flex justify-center overflow-hidden animate-msg
            ${forcedAgent ? 'p-0 bg-white' : 'p-0 md:p-10'}
        `}>
                    <div className={`
              relative bg-white w-full h-full shadow-2xl overflow-hidden flex
              ${forcedAgent ? 'rounded-none max-w-full' : 'max-w-6xl rounded-none md:rounded-[3rem]'}
          `}>

                        <div
                            ref={sidebarRef}
                            style={{ width: sidebarWidth }}
                            className={`
                    flex-shrink-0 relative bg-gray-50 border-r border-gray-100 z-20 flex flex-col transition-all duration-75
                    ${showHistorySidebar ? 'absolute inset-y-0 left-0 shadow-xl' : 'hidden md:flex'}
                `}
                        >
                            <div
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-bitrix-accent/50 z-50 transition-colors"
                                onMouseDown={startResizing}
                            />

                            <div className="p-4 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex gap-4">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-bitrix-nav border-b-2 border-bitrix-nav pb-1">
                                            Histórico
                                        </span>
                                    </div>
                                    <button onClick={() => setShowHistorySidebar(false)} className="md:hidden text-gray-400">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0 pr-1">
                                    {sessions.length === 0 && <p className="text-center text-[9px] text-gray-300 mt-10">Nenhum histórico.</p>}
                                    {sessions.map(session => (
                                        <div key={session.id} className="relative group/session mb-1">
                                            <button
                                                onClick={() => selectSession(session.id, selectedAgent)}
                                                className={`w-full text-left py-2.5 pl-3 pr-10 rounded-lg transition-all border ${currentSessionId === session.id
                                                    ? 'bg-white border-gray-100 shadow-sm'
                                                    : 'border-transparent hover:bg-white/50 text-gray-500'
                                                    }`}
                                            >
                                                <div className="w-full min-w-0">
                                                    <h4 className={`text-[11px] font-bold truncate ${currentSessionId === session.id ? 'text-bitrix-nav' : 'text-gray-600'
                                                        }`}>
                                                        {session.title}
                                                    </h4>
                                                </div>
                                            </button>

                                            <div className="absolute right-2 top-2 opacity-0 group-hover/session:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === session.id ? null : session.id); }}
                                                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                                                </button>

                                                {menuOpenId === session.id && (
                                                    <div className="absolute right-0 top-7 w-32 bg-white border border-gray-100 rounded-xl shadow-xl z-[100] py-1 animate-msg">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRenameSession(session.id); }}
                                                            className="w-full text-left px-4 py-2 text-[10px] font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                                                        >
                                                            <PencilIcon className="w-3 h-3" /> Renomear
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                                                            className="w-full text-left px-4 py-2 text-[10px] font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"
                                                        >
                                                            <TrashIcon className="w-3 h-3" /> Excluir
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => createNewSession(selectedAgent)}
                                        className="flex items-center justify-center gap-2 w-full p-3 bg-bitrix-nav text-white rounded-xl shadow-lg hover:bg-black transition-all group"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-white">Nova Conversa</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col bg-white h-full relative w-full min-w-0">
                            <header className={`px-6 md:px-12 py-4 border-b border-gray-50 flex justify-between items-center shrink-0 ${selectedAgent.status === 'STAGING' ? 'bg-yellow-50' : ''}`}>
                                <div className="flex items-center gap-6">
                                    <button onClick={() => setShowHistorySidebar(true)} className="md:hidden p-2 -ml-2 text-gray-400 hover:text-bitrix-nav">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7" /></svg>
                                    </button>

                                    <div className="flex items-center">
                                        <div className="relative z-10">
                                            <Avatar name={selectedAgent.name} url={selectedAgent.avatarUrl} className="w-16 h-16 md:w-20 md:h-20 rounded-2xl shadow-xl border-4 border-white" />
                                        </div>
                                        {activeParticipants.map((p, idx) => (
                                            <div key={p.id} className="relative -ml-6 z-0 hover:z-20 transition-all hover:scale-110">
                                                <Avatar name={p.name} url={p.avatarUrl} className="w-12 h-12 md:w-14 md:h-14 rounded-2xl shadow-lg border-2 border-white grayscale opacity-90 hover:grayscale-0 hover:opacity-100" />
                                            </div>
                                        ))}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-xl md:text-2xl font-black text-bitrix-nav uppercase tracking-tighter leading-none">
                                                {activeParticipants.length > 0 ? 'Mesa de Reunião' : selectedAgent.name}
                                            </h2>
                                            {selectedAgent.modelProvider !== 'deepseek' ? (
                                                <div className="flex items-center bg-gray-100 rounded-full p-0.5 ml-2">
                                                    <button
                                                        onClick={() => setModelMode('flash')}
                                                        className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1 transition-all ${modelMode === 'flash'
                                                            ? 'bg-white text-gray-800 shadow-sm'
                                                            : 'text-gray-400 hover:text-gray-600'
                                                            }`}
                                                    >
                                                        <span>⚡</span> Flash
                                                    </button>
                                                    <button
                                                        onClick={() => setModelMode('pro')}
                                                        className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1 transition-all ${modelMode === 'pro'
                                                            ? 'bg-bitrix-accent text-white shadow-sm'
                                                            : 'text-gray-400 hover:text-gray-600'
                                                            }`}
                                                    >
                                                        <span>🧠</span> Pro
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center bg-blue-100 rounded-full px-2 py-0.5 ml-2">
                                                    <span className="text-[8px] font-black text-blue-700 uppercase tracking-widest">🧠 DeepSeek V3 (Reasoning)</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2 items-center mt-1">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400 truncate max-w-[200px] md:max-w-none">
                                                {activeParticipants.length > 0 ? `${activeParticipants.length + 1} Especialistas na Mesa` : selectedAgent.officialRole}
                                            </p>
                                            {selectedAgent.status === 'STAGING' && <span className="text-[8px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded font-black uppercase tracking-widest animate-pulse">Homologação</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 md:gap-3">
                                    <button
                                        onClick={() => setIsInviteModalOpen(true)}
                                        className="h-10 px-4 rounded-xl bg-gray-100 text-gray-500 hover:bg-bitrix-nav hover:text-white transition-all flex items-center gap-2 shadow-sm border border-gray-200"
                                        title="Convocar Agente para a Sala"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Participantes</span>
                                    </button>

                                    <button
                                        onClick={handleManualSuggestTitle}
                                        className="h-10 px-4 bg-white border border-gray-200 text-gray-600 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest hover:border-bitrix-nav hover:text-bitrix-nav transition-all shadow-sm flex items-center gap-2"
                                    >
                                        <BotIcon className="w-3.5 h-3.5" />
                                        <span className="hidden md:inline">Sugerir Título</span>
                                    </button>

                                    {onConvertToTopic && (
                                        <button
                                            onClick={() => openTaskModal()}
                                            className="h-10 px-4 bg-white border border-gray-200 text-gray-600 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest hover:border-bitrix-nav hover:text-bitrix-nav transition-all shadow-sm flex items-center gap-2"
                                        >
                                            <BookIcon className="w-3.5 h-3.5" />
                                            <span className="hidden md:inline">Gerar Pauta</span>
                                        </button>
                                    )}

                                    <button
                                        onClick={handleCloseChat}
                                        className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl border border-red-100 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                    >
                                        {forcedAgent ? (
                                            <>
                                                <BackIcon className="w-3 h-3" />
                                                <span className="text-[8px] font-black uppercase tracking-widest hidden md:inline">Voltar</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-[8px] font-black uppercase tracking-widest hidden md:inline">Encerrar</span>
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </header>

                            <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
                                {isInviteModalOpen && (
                                    <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center animate-msg p-10">
                                        <div className="bg-white w-full max-w-2xl h-[500px] shadow-2xl rounded-[2.5rem] border border-gray-100 overflow-hidden flex flex-col">
                                            <header className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                                <div>
                                                    <h3 className="text-lg font-black text-bitrix-nav uppercase tracking-tight">Convocar Especialista</h3>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Adicionar inteligência à sessão atual</p>
                                                </div>
                                                <button onClick={() => setIsInviteModalOpen(false)} className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            </header>
                                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {dynamicAgents
                                                        .filter(a => a.id !== selectedAgent.id && !activeParticipants.some(p => p.id === a.id) && a.status === 'ACTIVE')
                                                        .map(agent => (
                                                            <button
                                                                key={agent.id}
                                                                onClick={() => handleInviteAgent(agent, true)}
                                                                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-bitrix-nav hover:bg-gray-50 transition-all text-left group"
                                                            >
                                                                <Avatar name={agent.name} url={agent.avatarUrl} className="w-10 h-10 rounded-lg grayscale group-hover:grayscale-0" />
                                                                <div className="min-w-0">
                                                                    <h4 className="text-xs font-bold text-gray-700 truncate">{agent.name}</h4>
                                                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider truncate">{agent.officialRole}</p>
                                                                </div>
                                                                <div className="ml-auto opacity-0 group-hover:opacity-100">
                                                                    <PlusIcon className="w-4 h-4 text-bitrix-nav" />
                                                                </div>
                                                            </button>
                                                        ))}
                                                </div>
                                                {dynamicAgents.filter(a => a.status === 'ACTIVE').length <= 1 && (
                                                    <p className="text-center text-gray-400 text-xs mt-10">Nenhum outro agente ativo disponível.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isTaskModalOpen && (
                                    <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-white p-6 rounded-[2rem] shadow-2xl border border-gray-100 w-[320px] md:w-[400px] z-50 animate-msg">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-sm font-black uppercase tracking-tight text-bitrix-nav">Nova Pauta</h3>
                                            <button onClick={() => setIsTaskModalOpen(false)} className="text-gray-400 hover:text-red-500"><XIcon className="w-4 h-4" /></button>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nome da Tarefa</label>
                                                <input
                                                    autoFocus
                                                    value={taskForm.title}
                                                    onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-bitrix-nav"
                                                    placeholder="Ex: Revisar contrato..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Responsável</label>
                                                <select
                                                    value={taskForm.assignee}
                                                    onChange={e => setTaskForm({ ...taskForm, assignee: e.target.value })}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-bitrix-nav"
                                                >
                                                    <option value={selectedAgent?.name}>{selectedAgent?.name}</option>
                                                    <option value="Douglas Rodrigues">Douglas Rodrigues</option>
                                                    <option value="Pietro Carboni">Pietro Carboni</option>
                                                    {dynamicAgents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Data</label>
                                                <input
                                                    type="date"
                                                    value={taskForm.date}
                                                    onChange={e => setTaskForm({ ...taskForm, date: e.target.value })}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-bitrix-nav"
                                                />
                                            </div>
                                            <button
                                                onClick={handleSaveTaskFromModal}
                                                className="w-full py-3 bg-bitrix-nav text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all mt-2"
                                            >
                                                Criar Tarefa
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-0 custom-scrollbar">
                                    {activeMessages.map(msg => (
                                        <ChatMessage
                                            key={msg.id}
                                            message={msg}
                                            directors={directorsList}
                                            agentContext={selectedAgent ? { name: selectedAgent.name, avatarUrl: selectedAgent.avatarUrl } : undefined}
                                            onEdit={handleUpdateAndRegenerate}
                                        />
                                    ))}

                                    {titleOptions && (
                                        <div className="flex flex-col items-center gap-4 animate-msg pt-6 pb-6 border-t border-dashed border-gray-200 mt-6">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rodrigues, qual destas opções define melhor esta pauta?</p>
                                            <div className="flex flex-wrap justify-center gap-3">
                                                {titleOptions.map((title, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleApplyTitle(title)}
                                                        className="px-6 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-bitrix-nav hover:text-bitrix-nav hover:shadow-md transition-all shadow-sm"
                                                    >
                                                        {title}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {taskSuggestions && (
                                        <div className="flex flex-col items-center gap-4 animate-msg pt-4 pb-6 mt-4">
                                            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-3 py-1 rounded-full border border-green-100">Sugestão de Tarefa</p>
                                            <div className="flex flex-wrap justify-center gap-3">
                                                {taskSuggestions.map((title, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleSuggestionClick(title)}
                                                        className="px-5 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-green-500 hover:text-green-600 hover:shadow-md transition-all shadow-sm flex items-center gap-2"
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                        {title}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div ref={chatEndRef} />
                                </div>

                                <div className="p-4 md:p-8 bg-white border-t border-gray-50">
                                    {attachment && (
                                        <div className="max-w-4xl mx-auto mb-3 flex items-start animate-msg">
                                            <div className="relative group">
                                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 shadow-sm flex items-center justify-center">
                                                    {attachment.mimeType.startsWith('image/') ? (
                                                        <img src={attachment.preview} alt="Upload Preview" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <FileTextIcon className="w-6 h-6 text-gray-400" />
                                                    )}
                                                </div>
                                                <button
                                                    onClick={handleRemoveAttachment}
                                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                                                >
                                                    <XIcon className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div
                                        className={`max-w-4xl mx-auto flex items-end gap-2 md:gap-4 p-2 rounded-[2rem] relative transition-all duration-300 bg-white ${isDragging ? 'shadow-xl ring-2 ring-blue-100' : ''}`}
                                        style={{ boxShadow: isDragging ? 'none' : '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03)' }}
                                        onDragOver={handleDragOver}
                                        onDragEnter={handleDragEnter}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        {isDragging && (
                                            <div className="absolute inset-0 bg-white/95 rounded-[2rem] flex flex-col items-center justify-center z-50 animate-msg backdrop-blur-sm pointer-events-none">
                                                <CloudUploadIcon className="w-8 h-8 text-emerald-600 mb-2" />
                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Solte o arquivo aqui</p>
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => chatAttachmentRef.current?.click()}
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 transition-all shrink-0 mb-1"
                                            title="Anexar arquivo ou imagem"
                                        >
                                            <PaperclipIcon className="w-5 h-5" />
                                        </button>

                                        <textarea
                                            ref={textareaRef}
                                            value={input}
                                            onChange={e => {
                                                setInput(e.target.value);
                                                e.target.style.height = 'auto';
                                                e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage(e);
                                                }
                                            }}
                                            onPaste={handlePaste}
                                            rows={1}
                                            placeholder={isLoading ? "Gerando resposta..." : isTranscribing ? "Transcrevendo áudio..." : "Pode digitar aqui..."}
                                            className="flex-1 bg-transparent px-2 md:px-4 py-3 md:py-3.5 text-[13px] md:text-[14px] font-medium outline-none disabled:opacity-50 text-gray-700 placeholder:text-gray-300 resize-none max-h-[150px] overflow-y-auto"
                                            disabled={isLoading || isTranscribing}
                                        />

                                        <div className="flex flex-col items-center shrink-0">
                                            <button
                                                type="button"
                                                onClick={handleToggleRecording}
                                                disabled={isLoading || isTranscribing}
                                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isRecording
                                                    ? 'text-red-600 bg-red-50 ring-4 ring-red-100 animate-pulse scale-110'
                                                    : 'text-gray-300 hover:text-gray-500'
                                                    } disabled:opacity-30`}
                                                title={isRecording ? "Parar Gravação" : "Gravar Áudio"}
                                            >
                                                {isRecording ? <StopCircleIcon className="w-6 h-6" /> : <MicIcon className="w-5 h-5" />}
                                            </button>
                                            {isRecording && (
                                                <span className="text-[7px] font-black text-red-500 uppercase tracking-widest mt-0.5 animate-pulse">Gravando...</span>
                                            )}
                                        </div>

                                        {isLoading ? (
                                            <div className="w-10 h-10 flex items-center justify-center mb-1">
                                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleSendMessage}
                                                className="w-10 h-10 flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50 disabled:scale-100 shrink-0 text-emerald-600 mb-1 hover:text-emerald-700"
                                                disabled={(!input.trim() && !attachment) || isTranscribing}
                                            >
                                                <SendIcon className="w-6 h-6" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemicVision;
