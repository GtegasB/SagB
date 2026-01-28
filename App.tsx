
import React, { useState, useRef, useEffect } from 'react';
import { GenerateContentResponse } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { SendIcon, MicIcon, StopCircleIcon, PaperclipIcon, XIcon, FileTextIcon } from './components/Icon';
import Sidebar from './components/Sidebar';
import SystemicVision from './components/SystemicVision'; // RESTAURADO
import AgentFactory from './components/AgentFactory';
import BacklogView from './components/BacklogView';
import HubView from './components/HubView';
import DashboardHome from './components/DashboardHome'; // NEW IMPORT
import AlignmentView from './components/AlignmentView';
import ThreeForBView from './components/ThreeForBView';
import AudacusView from './components/AudacusView';
import StartyBView from './components/StartyBView'; // NEW MODULE
import ManagementView from './components/ManagementView';
import GovernanceView from './components/GovernanceView';
import UnitView from './components/UnitView';
import ConversationsView from './components/ConversationsView';
import Auth from './components/Auth'; // NOVA IMPORTAÇÃO
import { Message, Sender, PersonaConfig, TabId, Agent, Decision, Topic, BusinessUnit, BusinessBlueprint, AgentTier, AgentStatus, Task, UserProfile } from './types';
import {
  sendMessageStream,
  startMainSession,
  createPietroInstruction,
  createCassioInstruction,
  DEFAULT_PIETRO_PROMPT,
  DEFAULT_CASSIO_PROMPT,
  KLAUS_PROMPT,
  NEWTON_PROMPT,
  transcribeAudio
} from './services/gemini';
import { MASTER_AGENTS_LIST } from './data/agents';
import metadata from './metadata.json';
import { db, auth, onAuthStateChanged, signOut, User } from './services/firebase';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';

// --- CONFIGURAÇÃO DE VERSÃO E PERSISTÊNCIA ---
//const APP_VERSION = "1.8.1"; // VERSÃO FIXA (RESTORED)
const STORAGE_KEYS = {
  AGENTS: 'grupob_activated_agents_v11',
  CHAT: 'grupob_chat_history_v4',
  ALIGNMENT: 'grupob_align_history_v4',
  BLUEPRINTS: 'grupob_blueprints_v4',
  TOPICS: 'grupob_topics_v4',
  TASKS: 'grupob_tasks_v1',
  NAV_TAB: 'grupob_nav_active_tab_v1',
  NAV_BU: 'grupob_nav_active_bu_v1',
  CUSTOM_UNITS: 'grupob_custom_units_v1'
};

const generateId = () => Math.random().toString(36).substring(2, 15);

// IMAGENS ESTÁVEIS (ATUALIZADAS V5.3 - FIREBASE LINKS)
const PIETRO_IMAGE = "https://firebasestorage.googleapis.com/v0/b/sagb-grupob-v1.firebasestorage.app/o/Douglas%20Rodrigues%2FPietro%20Carboni%20Foto%20Avatar.png?alt=media&token=082e13ca-7cc8-4316-bd9e-24af3b08deb2";
const DOUGLAS_IMAGE = "https://firebasestorage.googleapis.com/v0/b/sagb-grupob-v1.firebasestorage.app/o/Douglas%20Rodrigues%2FScreenshot_79.png?alt=media&token=1b6c2884-ae4d-49de-9d03-f0a38e0cfc27";
const CASSIO_IMAGE = "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200&h=200";

const INITIAL_BUSINESS_UNITS: BusinessUnit[] = [
  // CORE - Paleta "Spectrum 600" (Clarificada e Moderna)
  { id: 'grupob', name: 'GrupoB', themeColor: '#006064', description: 'Holding e Governança Central', type: 'CORE', sigla: 'gpb' },
  {
    id: '3forb',
    name: '3forB',
    themeColor: '#ea580c',
    description: 'Performance e Estratégia de Vendas',
    type: 'CORE',
    sigla: '3fb'
  },
  {
    id: 'startyb',
    name: 'StartyB',
    themeColor: '#dc2626',
    description: 'Venture Builder e Tecnologia',
    type: 'CORE',
    sigla: 'stb'
  },
  {
    id: 'papob',
    name: 'PapoB',
    themeColor: '#ca8a04',
    description: 'Conteúdo e Comunicação',
    type: 'CORE',
    sigla: 'ppb'
  },
  {
    id: 'acadb',
    name: 'AcadB',
    themeColor: '#7c3aed',
    description: 'Educação Corporativa',
    type: 'CORE',
    sigla: 'adb'
  },
  {
    id: 'acelerab',
    name: 'AceleraB',
    themeColor: '#2563eb',
    description: 'Aceleração de Negócios',
    type: 'CORE',
    sigla: 'acb'
  },
  {
    id: 'institutob',
    name: 'InstitutoB',
    themeColor: '#16a34a',
    description: 'Impacto Social e Educação',
    type: 'CORE',
    sigla: 'itb'
  },

  // VENTURES
  { id: 'audacus', name: 'Audacus', themeColor: '#1E1B4B', description: 'Assessoria Jurídica Preventiva', type: 'VENTURY', sigla: 'aud' },
  { id: 'domusys', name: 'DomuSys', themeColor: '#334155', description: 'Automação e Engenharia Elétrica', type: 'VENTURY', sigla: 'dms' },
  { id: 'scaleodonto', name: 'Scale Odonto', themeColor: '#92400E', description: 'Aceleração para Odontologia', type: 'VENTURY', sigla: 'sco' },
  { id: 'tegas', name: 'Tegas', themeColor: '#64748B', description: 'Tecnologia Estratégica para Gestão', type: 'VENTURY', sigla: 'tgs' },
  { id: 'nuexus', name: 'Nuexus', themeColor: '#0F172A', description: 'Investimentos e Infra Estrutura', type: 'VENTURY', sigla: 'nux' },
  { id: 'zoggon', name: 'Zoggon', themeColor: '#1E293B', description: 'Inteligência em Obras', type: 'VENTURY', sigla: 'zog' },
  { id: 'domuse', name: 'Domusè', themeColor: '#0D9488', description: 'Curadoria Imobiliária', type: 'VENTURY', sigla: 'dse' },
  { id: 'ziplia', name: 'Ziplia', themeColor: '#8B5CF6', description: 'Plataforma Multi-IA', type: 'VENTURY', sigla: 'zip' },
  { id: 'seddore', name: 'Seddore', themeColor: '#475569', description: 'Ambientes de Alto Padrão', type: 'VENTURY', sigla: 'sed' },
  { id: 'piblo', name: 'Piblo', themeColor: '#0EA5E9', description: 'Hub de Negócios Multicategoria', type: 'VENTURY', sigla: 'pib' },
  { id: 'douglas-rodrigues', name: 'Douglas Rodrigues', themeColor: '#111827', description: 'Mentoria Estratégica de Crescimento', type: 'VENTURY', sigla: 'drg' },

  // METODOLOGIAS
  { id: 'gerac', name: 'GERAC', themeColor: '#800080', description: 'Gestão e Empreendedorismo Responsável', type: 'METHODOLOGY', sigla: 'grc' },
  { id: 'uau', name: 'Jornada U.A.U', themeColor: '#06B6D4', description: 'Ultra Atendimento Único', type: 'METHODOLOGY', sigla: 'uau' },
  { id: 'mav', name: 'M.A.V', themeColor: '#F43F5E', description: 'Ciclo de Receita Avançada', type: 'METHODOLOGY', sigla: 'mav' },
  { id: 'dr-metodo', name: 'Decisão & Resultado', themeColor: '#10B981', description: 'Metodologia de Performance', type: 'METHODOLOGY', sigla: 'drm' }
];

const PIETRO_PERSONA: PersonaConfig = {
  id: 'pietro',
  name: 'Pietro Carboni',
  baseRole: 'Diretor de Metodologias e Arquitetura Mental',
  tier: 'CONTROLE',
  contextInfo: 'Guardião da cultura e métodos GrupoB',
  tone: 'Estratégico, seco e focado em ROI',
  welcomeMessage: 'Na linha, Rodrigues. Qual a pauta?',
  avatarColor: '#800080',
  imageUrl: PIETRO_IMAGE
};

const CASSIO_PERSONA: PersonaConfig = {
  id: 'cassio',
  name: 'Cássio Mendes',
  baseRole: 'Arquiteto de Software Sênior',
  tier: 'TÁTICO',
  contextInfo: 'Especialista em React, Tailwind e Arquitetura Limpa',
  tone: 'Técnico, preciso e focado em excelência de código',
  welcomeMessage: 'Editor aberto, Rodrigues. Qual a stack de hoje?',
  avatarColor: '#0EA5E9',
  imageUrl: null
};

// --- MAPPING HELPERS ---
const UNIT_MAP: Record<string, string> = {
  'gpb': 'grupob',
  '3fb': '3forb',
  'stb': 'startyb',
  'aud': 'audacus',
  'tgs': 'tegas',
  'sco': 'scaleodonto',
  'zip': 'ziplia',
  'dms': 'domusys',
  'zog': 'zoggon',
  'dse': 'domuse',
  'sed': 'seddore',
  'pib': 'piblo',
  'nex': 'nuexus',
  'ddr': 'douglas-rodrigues',
  'ins': 'institutob',
  'acl': 'acelerab',
  'ppo': 'papob',
  'met': 'gerac'
};

const inferTier = (role: string): AgentTier => {
  const r = role.toLowerCase();
  if (r.includes('chairman') || r.includes('ceo') || r.includes('cfo') || r.includes('cro') || r.includes('conselheiro')) return 'ESTRATÉGICO';
  if (r.includes('diretor') || r.includes('head') || r.includes('gestor') || r.includes('sócio')) return 'TÁTICO';
  if (r.includes('mentor') || r.includes('auditor') || r.includes('treinador') || r.includes('controller') || r.includes('cdo') || r.includes('prompt')) return 'CONTROLE';
  return 'OPERACIONAL';
};

const App: React.FC = () => {
  const version = metadata.version;
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // State for Business Units (now dynamic)
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>(INITIAL_BUSINESS_UNITS);

  const [activeTab, setActiveTab] = useState<TabId>('home'); // DEFAULT: HOME
  const [activeBU, setActiveBU] = useState<BusinessUnit>(INITIAL_BUSINESS_UNITS[0]);

  // OFFLINE-FIRST: Inicializa com a Lista Mestre para garantir UI imediata
  const [activatedAgents, setActivatedAgents] = useState<Agent[]>(() => {
    return MASTER_AGENTS_LIST.map(seed => {
      let injectedPrompt = '';
      if (seed.id === 'ca006gpb') injectedPrompt = DEFAULT_PIETRO_PROMPT;
      if (seed.id === 'ca045tgs') injectedPrompt = DEFAULT_CASSIO_PROMPT;

      return {
        id: seed.id,
        universalId: seed.id,
        name: seed.name,
        officialRole: seed.role,
        buId: UNIT_MAP[seed.unit] || 'grupob',
        tier: inferTier(seed.role),
        active: seed.is_active,
        status: seed.is_active ? 'ACTIVE' : 'PLANNED',
        version: '1.0',
        company: 'GrupoB',
        fullPrompt: injectedPrompt,
        sector: seed.role.split(' ')[0],
        modelProvider: (seed as any).model_provider || 'gemini'
      } as Agent;
    });
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [alignmentMessages, setAlignmentMessages] = useState<Message[]>([]);
  const [blueprints, setBlueprints] = useState<Record<string, BusinessBlueprint>>({});
  const [topics, setTopics] = useState<Topic[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Audio & File Upload
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [attachment, setAttachment] = useState<{ data: string, mimeType: string, preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seleção de Agente para Onboarding (Vem do Ecossistema)
  const [agentToOnboard, setAgentToOnboard] = useState<Agent | null>(null);
  const [chatTargetAgent, setChatTargetAgent] = useState<Agent | null>(null); // Agente alvo para conversa

  // V1.7.8 - Governance Deep Link State
  const [governanceTargetId, setGovernanceTargetId] = useState<string | null>(null);

  // --- VERIFICAÇÃO DE LOGIN FIREBASE ---
  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeTopics: (() => void) | undefined;
    let unsubscribeTasks: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Buscar perfil no Firestore em tempo real
        unsubscribeProfile = onSnapshot(doc(db, "users", currentUser.uid), (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile(snapshot.data() as UserProfile);
          } else {
            setUserProfile(null);
          }
          setIsInitializing(false);
        });

        // V1.4.0 - Sincronização de Pautas (Topics)
        unsubscribeTopics = onSnapshot(
          query(collection(db, "topics"), orderBy("timestamp", "desc")),
          (snapshot) => {
            const loadedTopics = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                ...data,
                id: doc.id,
                timestamp: (data.timestamp as Timestamp).toDate()
              } as Topic;
            });
            setTopics(loadedTopics);
          }
        );

        // V1.4.0 - Sincronização de Tarefas (Tasks)
        unsubscribeTasks = onSnapshot(
          query(collection(db, "tasks"), orderBy("createdAt", "desc")),
          (snapshot) => {
            const loadedTasks = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                ...data,
                id: doc.id,
                createdAt: (data.createdAt as Timestamp).toDate(),
                dueDate: data.dueDate ? (data.dueDate as Timestamp).toDate() : undefined
              } as unknown as Task;
            });
            setTasks(loadedTasks);
          }
        );
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        if (unsubscribeTopics) unsubscribeTopics();
        if (unsubscribeTasks) unsubscribeTasks();
        setUserProfile(null);
        setTopics([]);
        setTasks([]);
        setIsInitializing(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeTopics) unsubscribeTopics();
      if (unsubscribeTasks) unsubscribeTasks();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('home');
    } catch (err) {
      console.error("Erro ao sair:", err);
    }
  };

  // --- PERSISTÊNCIA DE NAVEGAÇÃO E DADOS ---
  useEffect(() => {
    // 1. Load Custom Business Units
    const savedUnitsStr = localStorage.getItem(STORAGE_KEYS.CUSTOM_UNITS);
    let allUnits = [...INITIAL_BUSINESS_UNITS];
    if (savedUnitsStr) {
      try {
        const customUnits: BusinessUnit[] = JSON.parse(savedUnitsStr);
        // Merge sem duplicar (baseado em ID)
        customUnits.forEach(cu => {
          if (!allUnits.some(u => u.id === cu.id)) {
            allUnits.push(cu);
          }
        });
        setBusinessUnits(allUnits);
      } catch (e) { console.error("Error loading custom units", e); }
    }

    // 2. Restaurar estado de navegação
    const savedTab = localStorage.getItem(STORAGE_KEYS.NAV_TAB);
    const savedBUId = localStorage.getItem(STORAGE_KEYS.NAV_BU);

    if (savedBUId) {
      const foundBU = allUnits.find(b => b.id === savedBUId);
      if (foundBU) setActiveBU(foundBU);
    }

    // SAFEGUARD: Validação de Tab
    const validTabs: TabId[] = ['home', 'ecosystem', 'team', 'conversations', 'management', 'vault', 'fabrica-ca', 'governance', 'unit-room', 'chat-room', 'alignment', '3forb-home', 'audacus-home', 'startyb-home', 'redir', 'requests', 'hub'];

    if (savedTab) {
      const targetTab = savedTab === 'hub' ? 'ecosystem' : savedTab as TabId;
      if (validTabs.includes(targetTab)) {
        setActiveTab(targetTab);
      } else {
        setActiveTab('home'); // Fallback se a tab salva for inválida
      }
    } else {
      setActiveTab('home');
    }
  }, []);

  useEffect(() => {
    // Salvar estado ao navegar
    localStorage.setItem(STORAGE_KEYS.NAV_TAB, activeTab);
    localStorage.setItem(STORAGE_KEYS.NAV_BU, activeBU.id);
  }, [activeTab, activeBU]);

  const handleSelectBU = (bu: BusinessUnit) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveBU(bu);
      if (bu.id === '3forb') setActiveTab('3forb-home');
      else if (bu.id === 'audacus') setActiveTab('audacus-home');
      else if (bu.id === 'startyb') setActiveTab('startyb-home'); // ROTA PARA STARTYB
      else if (bu.id === 'grupob') setActiveTab('ecosystem');
      else setActiveTab('alignment');
      setIsTransitioning(false);
    }, 400);
  };

  // V4.0 - Navegação para Sala de Unidade Genérica
  const handleEnterRoom = (buId: string) => {
    const targetBU = businessUnits.find(b => b.id === buId);
    if (targetBU) {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveBU(targetBU);
        setActiveTab('unit-room');
        setIsTransitioning(false);
      }, 300);
    }
  };

  const handleReturnToHub = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveBU(businessUnits[0]); // Volta para GrupoB
      setActiveTab('home'); // Volta para Início (Dashboard)
      setIsTransitioning(false);
    }, 300);
  };

  // Helper para voltar ao Ecossistema/Hub
  const handleBackNavigation = () => {
    setActiveTab('ecosystem');
  }

  const handleAddTopic = async (title: string, priority: 'Alta' | 'Média' | 'Baixa', assignee?: string, dueDate?: string) => {
    try {
      const newTopic = {
        title: title,
        priority: priority,
        status: 'Pendente',
        timestamp: Timestamp.fromDate(new Date()),
        buId: activeBU.id,
        assignee: assignee || '',
        dueDate: dueDate || ''
      };
      await addDoc(collection(db, "topics"), newTopic);
    } catch (e) {
      console.error("Error adding topic:", e);
      alert("Erro ao salvar pauta no Firestore.");
    }
  };

  const handleRemoveTopic = async (id: string) => {
    try {
      await deleteDoc(doc(db, "topics", id));
    } catch (e) {
      console.error("Error removing topic:", e);
    }
  };

  const handleUpdateTopicStatus = async (id: string, s: 'Pendente' | 'Em Pauta' | 'Resolvido') => {
    try {
      await updateDoc(doc(db, "topics", id), { status: s });
    } catch (e) {
      console.error("Error updating topic status:", e);
    }
  };

  // Handler que vem do CHAT (SystemicVision)
  const handleCreateTopicFromChat = (partialTopic: Partial<Topic>) => {
    handleAddTopic(
      partialTopic.title || 'Nova Pauta',
      partialTopic.priority || 'Média',
      partialTopic.assignee,
      partialTopic.dueDate
    );
  };

  const handleAddAgent = (newAgent: Agent) => {
    setActivatedAgents(prev => [...prev, newAgent]);
  };

  const handleRemoveAgent = (agentId: string) => {
    setActivatedAgents(prev => prev.filter(a => a.id !== agentId));
  };

  const handleActivateAgent = (agentData: any) => {
    setActivatedAgents(prev => {
      const existingIndex = prev.findIndex(a => a.universalId === agentData.universalId);

      if (existingIndex >= 0) {
        // Hidratação (Update)
        const updatedAgents = [...prev];
        updatedAgents[existingIndex] = {
          ...updatedAgents[existingIndex],
          ...agentData,
          // Preserva status e ID originais se não forem sobrescritos explicitamente
          status: agentData.status || updatedAgents[existingIndex].status,
          active: true,
          id: updatedAgents[existingIndex].id
        };
        return updatedAgents;
      } else {
        // Criação Nova
        return [...prev, {
          ...agentData,
          id: generateId(),
          active: true,
          status: agentData.status || 'STAGING'
        }];
      }
    });
  };

  const handleApproveAgent = async (agentId: string) => {
    try {
      await updateDoc(doc(db, "agents", agentId), { status: 'ACTIVE' });
    } catch (e) {
      console.error("Error approving agent:", e);
    }
  };

  // V4.5 - Roteamento Inteligente de Agente
  const handleAgentInteraction = (agent: Agent) => {
    if (agent.status === 'PLANNED') {
      // Se planejado, vai para RH (Fábrica) para contratar
      setAgentToOnboard(agent);
      setActiveTab('fabrica-ca');
    } else {
      // Se ativo, vai para Chat (SystemicVision/SplitView)
      setChatTargetAgent(agent);
      setActiveTab('chat-room');
    }
  };

  // Nova função para atualizar agentes diretamente da Governança (DNA Editor)
  const handleUpdateAgentData = async (updatedAgent: Agent) => {
    try {
      const { id, ...data } = updatedAgent;
      // Sanitização básica antes de salvar
      const payload = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined && v !== null)
      );
      await updateDoc(doc(db, "agents", id), payload);
    } catch (e) {
      console.error("Error updating agent data:", e);
    }
  };

  // Função para criar novas Unidades (Ventures) via Importador
  const handleAddBusinessUnit = (newUnit: BusinessUnit) => {
    setBusinessUnits(prev => {
      const updated = [...prev, newUnit];
      // Persist Custom Units
      const customUnits = updated.filter(u => !INITIAL_BUSINESS_UNITS.some(init => init.id === u.id));
      localStorage.setItem(STORAGE_KEYS.CUSTOM_UNITS, JSON.stringify(customUnits));
      return updated;
    });
  };

  const handleAddTask = async (task: Task) => {
    try {
      const { id, ...data } = task;
      await addDoc(collection(db, "tasks"), {
        ...data,
        createdAt: Timestamp.fromDate(new Date()),
        dueDate: task.dueDate ? Timestamp.fromDate(task.dueDate) : null
      });
    } catch (e) {
      console.error("Error adding task:", e);
    }
  }

  const handleUpdateTaskStatus = async (taskId: string, status: Task['status']) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), { status });
    } catch (e) {
      console.error("Error updating task status:", e);
    }
  }

  // --- AUDIO & FILE HANDLERS ---
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
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
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
              if (transcription) setInput(prev => prev ? `${prev} ${transcription}` : transcription);
            } catch (e) {
              console.error("Transcription Failed", e);
            } finally {
              setIsTranscribing(false);
              stream.getTracks().forEach(track => track.stop());
            }
          };
        };
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) { alert("Permissão de microfone negada."); }
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

  useEffect(() => {
    // SAFEGUARD: Ensure activeBU is valid
    if (!activeBU) return;

    const isTechUnit = activeBU.id === 'startyb';
    const context = `Contexto: Unidade ${activeBU.name}. ${isTechUnit ? 'Desenvolvimento e Arquitetura' : 'Pietro auditando operação'}.`;

    try {
      // Troca o DNA do agente principal baseado na Unidade
      const instruction = isTechUnit ? createCassioInstruction() : createPietroInstruction();
      startMainSession(context, instruction);
    } catch (e) {
      console.error("Init Error:", e);
    }
  }, [activeBU]);

  // --- FIRESTORE SYNC (SUBSTITUI LOCALSTORAGE PARA AGENTES) ---
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'agents'), (snapshot) => {
      const firestoreAgents = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Agent[];
      console.log("DEBUG: Agentes vindos do Firestore:", firestoreAgents);

      // Merge Strategy: Master List (Defaults) + Firestore (Overrides & New)
      const finalList = MASTER_AGENTS_LIST.map(seed => {
        const remote = firestoreAgents.find(fa => fa.universalId === seed.id);
        if (remote) return remote;

        // Fallback to minimal seed object if not in DB yet
        return {
          id: seed.id,
          universalId: seed.id,
          name: seed.name,
          officialRole: seed.role,
          buId: UNIT_MAP[seed.unit] || 'grupob',
          tier: inferTier(seed.role),
          active: seed.is_active,
          status: seed.is_active ? 'ACTIVE' : 'PLANNED',
          version: '1.0',
          company: 'GrupoB',
          fullPrompt: '',
          sector: seed.role.split(' ')[0],
          modelProvider: (seed as any).model_provider || 'gemini'
        } as Agent;
      });

      // Add custom agents from Firestore that are NOT in Master List
      firestoreAgents.forEach(fa => {
        if (!finalList.find(i => i.universalId === fa.universalId)) {
          finalList.push(fa);
        }
      });

      setActivatedAgents(finalList);
    });

    return () => unsubscribe();
  }, []);

  // --- SAVE STATE ---
  // --- SAVE STATE (LOCALSTORAGE REMOVIDO PARA AGENTES - AGORA É FIRESTORE) ---
  // useEffect(() => { localStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(activatedAgents)); }, [activatedAgents]); 

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(messages)); }, [messages]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.ALIGNMENT, JSON.stringify(alignmentMessages)); }, [alignmentMessages]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics)); }, [topics]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks)); }, [tasks]);


  // CORREÇÃO CRÍTICA: Se estiver no GrupoB, mostra TODOS os agentes ativos no sistema
  // SAFEGUARD: Check activeBU before access
  const filteredAgents = activeBU && activeBU.id === 'grupob'
    ? activatedAgents
    : activatedAgents.filter(a => activeBU && a.buId === activeBU.id);

  const filteredMessages = messages.filter(m => activeBU && m.buId === activeBU.id);
  const filteredAlignMessages = alignmentMessages.filter(m => activeBU && m.buId === activeBU.id);
  const currentBlueprint = activeBU ? (blueprints[activeBU.id] || {}) : {};

  // Determina o "Diretor Ativo" para exibir o placeholder correto e avatar
  const activeDirector = activeBU && activeBU.id === 'startyb' ? CASSIO_PERSONA : PIETRO_PERSONA;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !attachment) || isLoading) return;
    const userText = input.trim();
    const currentAttachment = attachment;
    setInput('');
    setAttachment(null);

    const displayText = currentAttachment ? (userText ? userText + " 📎 [Arquivo Anexado]" : "📎 [Arquivo Enviado]") : userText;

    setMessages(prev => [...prev, { id: generateId(), text: displayText, sender: Sender.User, timestamp: new Date(), buId: activeBU.id }]);
    const botMsgId = generateId();
    setIsLoading(true);
    setMessages(prev => [...prev, { id: botMsgId, text: '', sender: Sender.Bot, timestamp: new Date(), buId: activeBU.id, isStreaming: true }]);

    try {
      const stream = await sendMessageStream(userText, `Direto com Rodrigues. Unidade: ${activeBU.name}.`);
      let fullText = '';

      for await (const chunk of stream) {
        // Handle Text
        const chunkText = (chunk as GenerateContentResponse).text || '';
        if (chunkText) {
          fullText += chunkText;
          setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, text: fullText } : msg));
        }
      }
      setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, isStreaming: false } : msg));
    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, text: "Falha de conexão com o Diretor (API Key Error).", isStreaming: false } : msg));
      setMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        text: "⚠️ **ERRO DE SISTEMA:** Não foi possível conectar ao Gemini API. Verifique as variáveis de ambiente.",
        sender: Sender.System,
        timestamp: new Date(),
        buId: activeBU.id
      }]);
    } finally { setIsLoading(false); }
  };

  const isImmersiveMode = activeBU && activeBU.id === 'audacus' && activeTab === 'audacus-home';

  const renderContent = () => {
    // SAFEGUARD: Early return if activeBU is undefined/null
    if (!activeBU) return null;

    if (isTransitioning) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-white">
          <div className="w-12 h-12 rounded-xl border-4 border-gray-100 border-t-bitrix-accent animate-spin mb-4"></div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">Sincronizando Ambiente...</p>
        </div>
      );
    }

    if (activeBU.id === '3forb' && activeTab === '3forb-home') return <ThreeForBView activeTab={activeTab} activeBU={activeBU} setActiveTab={setActiveTab} agents={activatedAgents} onAddTopic={handleAddTopic} />;

    if (activeBU.id === 'audacus' && activeTab === 'audacus-home') return <AudacusView activeBU={activeBU} onBack={handleReturnToHub} />;

    // ROTA STARTYB
    if (activeBU.id === 'startyb' && activeTab === 'startyb-home') return <StartyBView activeBU={activeBU} agents={activatedAgents} onBack={handleReturnToHub} />;

    switch (activeTab) {
      case 'home': return <DashboardHome agents={activatedAgents} tasks={tasks} businessUnits={businessUnits} onNavigate={setActiveTab} />;

      // FIX: HUB VIEW SEMPRE RECEBE LISTA COMPLETA DE AGENTES (activatedAgents)
      case 'ecosystem': return <HubView businessUnits={businessUnits} activeBU={activeBU} onSelectBU={handleSelectBU} onNavigate={setActiveTab} agents={activatedAgents} onSelectAgent={handleAgentInteraction} />;
      // Fallback for 'hub' key from localstorage if present
      case 'hub': return <HubView businessUnits={businessUnits} activeBU={activeBU} onSelectBU={handleSelectBU} onNavigate={setActiveTab} agents={activatedAgents} onSelectAgent={handleAgentInteraction} />;

      case 'management': return <ManagementView tasks={tasks} onAddTask={handleAddTask} onUpdateTaskStatus={handleUpdateTaskStatus} />;
      case 'unit-room': return <UnitView activeBU={activeBU} agents={activatedAgents} onBack={handleBackNavigation} />;

      // NOVA ROTA: CONVERSAS (HISTÓRICO)
      case 'conversations': return <ConversationsView agents={activatedAgents} onOpenChat={handleAgentInteraction} />;

      // NOVA LÓGICA V4.6 - Governance Deep Linking
      case 'governance': return (
        <GovernanceView
          onBack={() => setActiveTab('ecosystem')}
          agents={activatedAgents}
          onUpdateAgent={handleUpdateAgentData}
          businessUnits={businessUnits}
          onAddUnit={handleAddBusinessUnit}
          targetAgentId={governanceTargetId} // Prop de Direcionamento
          onClearTarget={() => setGovernanceTargetId(null)} // Limpeza após uso
        />
      );

      case 'alignment': return <AlignmentView activeBU={activeBU} messages={filteredAlignMessages} onAddMessage={(m) => setAlignmentMessages(p => [...p, m])} blueprint={currentBlueprint} onUpdateBlueprint={(bp) => setBlueprints(p => ({ ...p, [activeBU.id]: { ...p[activeBU.id], ...bp } }))} />;

      case 'fabrica-ca': return (
        <AgentFactory
          agents={activatedAgents}
          initialAgent={agentToOnboard}
          onNavigateToEcosystem={() => setActiveTab('ecosystem')}
          onActivate={handleActivateAgent}
          onRemove={handleRemoveAgent}
          activeBU={activeBU}
          businessUnits={businessUnits}
          onManageIntelligence={(agent) => {
            // NOVO HANDLER: Redireciona para Governança/Inteligência
            setGovernanceTargetId(agent.id);
            setActiveTab('governance');
          }}
        />
      );

      // NOVA ROTA: EQUIPE GLOBAL (VISÃO DE TODOS OS AGENTES PARA CHAT)
      case 'team': return <SystemicVision dynamicAgents={activatedAgents} onUpdateAgents={setActivatedAgents} activeBU={activeBU} businessUnits={businessUnits} forcedAgent={chatTargetAgent} onBack={handleBackNavigation} onConvertToTopic={handleCreateTopicFromChat} viewMode="global" userProfile={userProfile} />;

      // RESTORED: CHAT ROOM (Systemic Vision Logic) with onConvertToTopic prop
      case 'chat-room': return <SystemicVision dynamicAgents={activatedAgents} onUpdateAgents={setActivatedAgents} activeBU={activeBU} businessUnits={businessUnits} forcedAgent={chatTargetAgent} onBack={handleBackNavigation} onConvertToTopic={handleCreateTopicFromChat} userProfile={userProfile} />;

      case 'vault':
        return <BacklogView
          topics={topics.filter(t => t.buId === activeBU.id)}
          agents={filteredAgents}
          onAddTopic={(title, priority, assignee, dueDate) => handleAddTopic(title, priority, assignee, dueDate)}
          onRemoveTopic={handleRemoveTopic}
          onUpdateStatus={handleUpdateTopicStatus}
        />;
      case 'redir':
      case 'requests':
        return (
          <div className="h-full flex flex-col relative bg-[#F9FAFB] overflow-hidden">
            <header className="h-20 px-10 flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur z-20">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.4em]">
                Canal Direto: {activeBU.name}
                {activeBU.id === 'startyb' && <span className="text-blue-500 ml-2">(ARCHITECT MODE)</span>}
              </span>
            </header>

            {/* CHAT CONTAINER - Scroll Handling Fixed */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative" ref={chatContainerRef}>
              <div className="max-w-4xl mx-auto px-8 py-10 pb-48 space-y-8">
                {filteredMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === Sender.User ? 'flex-row-reverse' : 'flex-row'} items-start gap-4 animate-msg group`}>
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm shrink-0 border border-gray-200 bg-white flex items-center justify-center mt-2">
                      {msg.sender === Sender.User ? (
                        <img src={userProfile?.avatarUrl || DOUGLAS_IMAGE} className="w-full h-full object-cover" />
                      ) : (
                        activeDirector.imageUrl ? (
                          <img src={activeDirector.imageUrl} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-[10px] font-black uppercase text-white" style={{ color: activeDirector.avatarColor }}>
                            {activeDirector.name.substring(0, 2)}
                          </div>
                        )
                      )}
                    </div>

                    <div className={`flex flex-col ${msg.sender === Sender.User ? 'items-end' : 'items-start'} max-w-[85%]`}>
                      <div className="flex items-center gap-2 mb-1 px-1 opacity-60">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                          {msg.sender === Sender.User ? (userProfile?.name || 'Douglas Rodrigues') : activeDirector.name}
                        </span>
                      </div>

                      {msg.sender === Sender.System ? (
                        <div className="px-5 py-3 bg-white border border-gray-200 rounded-xl text-gray-500 text-[10px] font-black uppercase tracking-widest w-full text-center shadow-sm">
                          {msg.text}
                        </div>
                      ) : (
                        // BUBBLE: WHITE ON WHITE THEME (CLEAN)
                        <div className={`
                             px-6 py-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 
                             text-[12px] leading-relaxed font-medium transition-all duration-300
                             bg-white text-gray-700
                             ${msg.sender === Sender.User ? 'rounded-tr-sm' : 'rounded-tl-sm prose prose-sm max-w-none prose-p:text-gray-700 prose-strong:text-gray-900'}
                          `}>
                          {msg.sender === Sender.Bot ? <ReactMarkdown>{msg.text}</ReactMarkdown> : msg.text}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* INPUT AREA */}
            <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur pb-10 pt-4 z-30">
              {attachment && (
                <div className="max-w-3xl mx-auto mb-2 flex items-center justify-end px-6">
                  <div className="bg-white border border-gray-200 p-2 rounded-xl shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      {attachment.mimeType.startsWith('image/') ? (
                        <img src={attachment.preview} className="w-full h-full object-cover rounded-lg" />
                      ) : <FileTextIcon className="w-5 h-5 text-gray-400" />}
                    </div>
                    <button onClick={() => setAttachment(null)} className="text-gray-400 hover:text-red-500"><XIcon className="w-4 h-4" /></button>
                  </div>
                </div>
              )}

              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,application/pdf,.txt" />

              <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-6 relative flex items-center bg-white border border-gray-100 rounded-[2.5rem] p-2 shadow-2xl hover:shadow-[0_20px_40px_rgba(0,0,0,0.05)] transition-all">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all hover:bg-gray-50">
                  <PaperclipIcon className="w-5 h-5" />
                </button>
                <button type="button" onClick={handleToggleRecording} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:bg-gray-50 ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}>
                  {isRecording ? <StopCircleIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
                </button>

                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={isTranscribing ? "Transcrevendo..." : `Falar com ${activeDirector.name} sobre ${activeBU.name}...`}
                  className="flex-1 bg-transparent px-4 py-4 outline-none font-medium text-gray-600 placeholder:text-gray-300 text-sm"
                  disabled={isLoading || isTranscribing}
                />
                <button type="submit" disabled={(!input.trim() && !attachment) || isLoading || isTranscribing} className="w-12 h-12 rounded-full flex items-center justify-center text-bitrix-nav hover:text-bitrix-accent transition-all">
                  <SendIcon className="w-6 h-6" />
                </button>
              </form>
            </div>
          </div>
        );

      // DEFAULT FALLBACK: Sempre renderiza Home se a tab for desconhecida
      default: return <DashboardHome agents={activatedAgents} tasks={tasks} businessUnits={businessUnits} onNavigate={setActiveTab} />;
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-xl border-4 border-gray-100 border-t-black animate-spin mb-4"></div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">Iniciando Protocolos...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={() => { }} />;
  }

  const safeBU = activeBU || INITIAL_BUSINESS_UNITS[0];

  return (
    <div className="flex h-screen bg-white font-nunito text-bitrix-text overflow-hidden">
      {!isImmersiveMode && (
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          agentCount={filteredAgents.length}
          activeBU={safeBU}
          version={version}
          onReset={handleReturnToHub}
          onLogout={handleLogout}
          userProfile={userProfile}
        />
      )}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-[#F9FAFB]">{renderContent()}</main>
    </div>
  );
};

export default App;
