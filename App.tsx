import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { SendIcon, MicIcon, StopCircleIcon, PaperclipIcon, XIcon, FileTextIcon } from './components/Icon';
import Sidebar from './components/Sidebar';
import SystemicVision from './components/SystemicVision'; // RESTAURADO
import AgentFactory from './components/AgentFactory';
import BacklogView from './components/BacklogView';
import HubView from './components/HubView';
import DashboardHome from './components/DashboardHome'; // NEW IMPORT
import VenturesView from './components/VenturesView'; // NEW MODULE v1.5.0
import AlignmentView from './components/AlignmentView';
import ThreeForBView from './components/ThreeForBView';
import AudacusView from './components/AudacusView';
import StartyBView from './components/StartyBView'; // NEW MODULE
import ManagementView from './components/ManagementView';
import ProgrammersRoomView from './components/ProgrammersRoomView';
import GovernanceView from './components/GovernanceView';
import QualitySensorView from './components/QualitySensorView';
import IntelligenceFlowView from './components/IntelligenceFlowView';
import AgentMissionsView from './components/AgentMissionsView';
import CIDView from './components/CIDView';
import ContinuousMemoryView from './components/ContinuousMemoryView';
import NAGIView from './components/NAGIView';
import RadarConnectionsView from './components/RadarConnectionsView';
import UnitView from './components/UnitView';
import ConversationsView from './components/ConversationsView';
import Auth from './components/Auth'; // NOVA IMPORTAÇÃO
import { Message, Sender, TabId, Agent, Topic, Venture, BusinessUnit, BusinessBlueprint, Task, UserProfile, GovernanceCulture, ComplianceRule, VaultItem, KnowledgeNode, WorkspaceMember, AgentQualityEvent, AgentDnaProfile, AgentDnaEffective } from './types';
import {
  sendMessageStream,
  startMainSession,
  setRuntimeAiContext,
  getRuntimeAiContext,
  transcribeAudio
} from './services/gemini';
import { composeEffectivePrompt, resolveAgentBasePrompt } from './services/agentDna';
import metadata from './metadata.json';
import { db, auth, onAuthStateChanged, signOut, User } from './services/supabase';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, setDoc, query, where, orderBy, Timestamp } from './services/supabase';
import { appendMessage, createSession, findLatestSession, loadSessionMessages, touchSession, updateMessage } from './utils/supabaseChat';

// --- CONFIGURAÇÃO DE VERSÃO E PERSISTÊNCIA ---
//const APP_VERSION = "1.8.1"; // VERSÃO FIXA (RESTORED)
type AppUiPrefs = {
  navTab?: TabId;
  navBuId?: string;
  customUnits?: BusinessUnit[];
  audacusGatewayByBu?: Record<string, string>;
};

const generateId = () => Math.random().toString(36).substring(2, 15);
// O projeto usa IDs "uuid-like" sintéticos em alguns workspaces legados.
// Aqui aceitamos o formato 8-4-4-4-12 sem exigir versão/variant RFC.
const isUuid = (value: any) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const normalizeStatus = (value: any) => String(value || '').trim().toLowerCase();

// IMAGENS ESTÁVEIS (ATUALIZADAS V5.3 - CDN LINKS)
const USER_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&q=80&w=200&h=200";
const ASSISTANT_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&q=80&w=200&h=200";

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
  { id: 'mentoria-estrategica', name: 'Mentoria Estratégica', themeColor: '#111827', description: 'Mentoria Estratégica de Crescimento', type: 'VENTURY', sigla: 'mec' },

  // METODOLOGIAS
  { id: 'gerac', name: 'GERAC', themeColor: '#800080', description: 'Gestão e Empreendedorismo Responsável', type: 'METHODOLOGY', sigla: 'grc' },
  { id: 'uau', name: 'Jornada U.A.U', themeColor: '#06B6D4', description: 'Ultra Atendimento Único', type: 'METHODOLOGY', sigla: 'uau' },
  { id: 'mav', name: 'M.A.V', themeColor: '#F43F5E', description: 'Ciclo de Receita Avançada', type: 'METHODOLOGY', sigla: 'mav' },
  { id: 'dr-metodo', name: 'Decisão & Resultado', themeColor: '#10B981', description: 'Metodologia de Performance', type: 'METHODOLOGY', sigla: 'drm' }
];

const DIRECT_CHANNEL_FALLBACK_PROMPT = `
Você é um assistente estratégico do ecossistema.
Atue com clareza, objetividade e foco em execução.
Quando houver dúvidas, proponha próximos passos práticos.
`.trim();

const getTierRank = (tier?: string | null) => {
  const normalized = String(tier || '').toUpperCase();
  if (normalized === 'CONTROLE') return 0;
  if (normalized === 'ESTRATÉGICO') return 1;
  if (normalized === 'TÁTICO') return 2;
  if (normalized === 'OPERACIONAL') return 3;
  return 99;
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

  const [activatedAgents, setActivatedAgents] = useState<Agent[]>([]);
  const [agentConfigsByAgentId, setAgentConfigsByAgentId] = useState<Record<string, { fullPrompt?: string; globalDocuments?: Agent['globalDocuments']; docCount?: number }>>({});
  const [agentDnaProfilesByAgentId, setAgentDnaProfilesByAgentId] = useState<Record<string, AgentDnaProfile>>({});
  const [agentDnaEffectiveByAgentId, setAgentDnaEffectiveByAgentId] = useState<Record<string, AgentDnaEffective>>({});
  const [agentMemoriesByAgentId, setAgentMemoriesByAgentId] = useState<Record<string, string[]>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [mainChatSessionId, setMainChatSessionId] = useState<string | null>(null);
  const [blueprints, setBlueprints] = useState<Record<string, BusinessBlueprint>>({});
  const [topics, setTopics] = useState<Topic[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ventures, setVentures] = useState<Venture[]>([]); // NEW STATE v1.5.0
  const [cultureEntries, setCultureEntries] = useState<GovernanceCulture[]>([]);
  const [complianceRules, setComplianceRules] = useState<ComplianceRule[]>([]);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [knowledgeNodes, setKnowledgeNodes] = useState<KnowledgeNode[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [agentQualityEvents, setAgentQualityEvents] = useState<AgentQualityEvent[]>([]);
  const [input, setInput] = useState('');

  const filteredCultureEntries = useMemo(
    () => cultureEntries.filter(entry => normalizeStatus(entry.status) !== 'deleted'),
    [cultureEntries]
  );

  const latestCultureEntry = useMemo(() => {
    if (filteredCultureEntries.length === 0) return null;
    return [...filteredCultureEntries].sort((a, b) => {
      const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : new Date(a.updatedAt).getTime();
      const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : new Date(b.updatedAt).getTime();
      return bTime - aTime;
    })[0];
  }, [filteredCultureEntries]);

  const GLOBAL_COMPLIANCE_CODE = 'GOVERNANCE.GLOBAL.DEFAULT';
  const activeComplianceRule = useMemo(() => {
    const nonDeletedRules = complianceRules.filter(rule => normalizeStatus(rule.status) !== 'deleted');
    if (nonDeletedRules.length === 0) return null;
    const preferredByCode = nonDeletedRules.filter(rule => rule.code === GLOBAL_COMPLIANCE_CODE);
    const sourceRules = preferredByCode.length > 0 ? preferredByCode : nonDeletedRules;
    return [...sourceRules].sort((a, b) => {
      const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : new Date(a.updatedAt).getTime();
      const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : new Date(b.updatedAt).getTime();
      return bTime - aTime;
    })[0];
  }, [complianceRules]);

  const activeVaultEntries = useMemo(
    () => vaultItems.filter(item => {
      const status = normalizeStatus(item.status);
      return status !== 'deleted' && status !== 'archived';
    }),
    [vaultItems]
  );

  const visibleKnowledgeNodes = useMemo(
    () => knowledgeNodes.filter(node => {
      const status = normalizeStatus(node.status);
      return status !== 'archived' && status !== 'deleted';
    }),
    [knowledgeNodes]
  );
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
  const [uiPrefsHydrated, setUiPrefsHydrated] = useState(false);
  const uiPrefsHydratedUserRef = useRef<string | null>(null);

  const userPayload = useMemo<Record<string, any>>(() => {
    const payload = (userProfile as any)?.payload;
    return payload && typeof payload === 'object' ? payload : {};
  }, [userProfile]);

  const uiPrefs = useMemo<AppUiPrefs>(() => {
    const raw = userPayload.uiPrefs;
    return raw && typeof raw === 'object' ? raw as AppUiPrefs : {};
  }, [userPayload]);

  const memberWorkspaceIds = useMemo(
    () => workspaceMembers.map(member => member.workspaceId).filter(isUuid),
    [workspaceMembers]
  );

  const preferredWorkspaceId = userProfile?.workspaceId || null;
  const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';
  const activeWorkspaceId = useMemo(() => {
    if (isUuid(preferredWorkspaceId)) {
      if (memberWorkspaceIds.length === 0 || memberWorkspaceIds.includes(preferredWorkspaceId)) {
        return preferredWorkspaceId;
      }
    }
    if (memberWorkspaceIds.length > 0) return memberWorkspaceIds[0];
    return null;
  }, [preferredWorkspaceId, memberWorkspaceIds]);

  const resolveWorkspaceIdForWrites = useMemo(() => {
    const candidates = [
      activeWorkspaceId,
      latestCultureEntry?.workspaceId,
      activeComplianceRule?.workspaceId,
      activeVaultEntries[0]?.workspaceId,
      visibleKnowledgeNodes[0]?.workspaceId,
      memberWorkspaceIds[0],
      DEFAULT_WORKSPACE_ID
    ];
    return candidates.find(isUuid) || DEFAULT_WORKSPACE_ID;
  }, [
    activeWorkspaceId,
    latestCultureEntry,
    activeComplianceRule,
    activeVaultEntries,
    visibleKnowledgeNodes,
    memberWorkspaceIds,
    DEFAULT_WORKSPACE_ID
  ]);

  const scopeGovernanceRowsByWorkspace = <T extends { workspaceId?: string | null }>(rows: T[]): T[] => {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    if (!isUuid(activeWorkspaceId)) return rows;

    const exact = rows.filter(row => row.workspaceId === activeWorkspaceId);
    if (exact.length > 0) return exact;

    if (memberWorkspaceIds.length > 0) {
      const validWorkspaces = new Set(memberWorkspaceIds);
      const memberScoped = rows.filter(row => !!row.workspaceId && validWorkspaces.has(row.workspaceId));
      if (memberScoped.length > 0) return memberScoped;
    }

    return rows;
  };

  useEffect(() => {
    const uid = userProfile?.uid || (user as any)?.id || (user as any)?.uid;
    if (!uid || !activeWorkspaceId) return;
    if (userProfile?.workspaceId === activeWorkspaceId) return;

    updateDoc(doc(db, "users", uid), {
      workspaceId: activeWorkspaceId,
      updatedAt: new Date()
    }).catch((error) => {
      console.error('Erro ao persistir workspace ativo no perfil:', error);
    });
  }, [activeWorkspaceId, userProfile, user]);

  useEffect(() => {
    if (!userProfile || userProfile.workspaceId || workspaceMembers.length === 0) return;
    const derivedWorkspace = workspaceMembers[0].workspaceId;
    if (derivedWorkspace) {
      setUserProfile(prev => prev ? { ...prev, workspaceId: derivedWorkspace } : prev);
    }
  }, [userProfile, workspaceMembers]);

  // Seleção de Agente para Onboarding (Vem do Ecossistema)
  const [agentToOnboard, setAgentToOnboard] = useState<Agent | null>(null);
  const [chatTargetAgent, setChatTargetAgent] = useState<Agent | null>(null); // Agente alvo para conversa
  const [chatTargetSessionId, setChatTargetSessionId] = useState<string | null>(null);

  // V1.7.8 - Governance Deep Link State
  const [governanceTargetId, setGovernanceTargetId] = useState<string | null>(null);

  // --- VERIFICAÇÃO DE LOGIN SUPABASE ---
  useEffect(() => {

// Helpers locais para migração Firebase -> Supabase
const getUserId = (u: any): string | null => (u && ((u as any).id || (u as any).uid)) || null;
const asDate = (v: any): Date | undefined => {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
};

    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeTopics: (() => void) | undefined;
    let unsubscribeTasks: (() => void) | undefined;
    let unsubscribeVentures: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
// Buscar perfil no banco de dados (public.users). Se não existir ainda, seguimos com um fallback.
const userId = getUserId(currentUser);
if (userId) {
  unsubscribeProfile = onSnapshot(
    doc(db, "users", userId),
    (snapshot) => {
      if (snapshot.exists()) {
        setUserProfile(snapshot.data() as UserProfile);
      } else {
        // Perfil ainda não criado em public.users
        setUserProfile({
          uid: userId,
          email: (currentUser as any)?.email || '',
          name: '',
          nickname: '',
          role: 'member',
          avatarUrl: '',
          company: 'GrupoB',
          tier: 'TÁTICO',
          createdAt: new Date()
        } as any);
      }
      setIsInitializing(false);
    },
    (err) => {
      console.error("Erro ao carregar perfil (public.users):", err);
      setUserProfile({
        uid: userId,
        email: (currentUser as any)?.email || '',
        name: '',
        nickname: '',
        role: 'member',
        avatarUrl: '',
        company: 'GrupoB',
        tier: 'TÁTICO',
        createdAt: new Date()
      } as any);
      setIsInitializing(false);
    }
  );
} else {
  setUserProfile(null);
  setIsInitializing(false);
}// V1.4.0 - Sincronização de Pautas (Topics)
        unsubscribeTopics = onSnapshot(
          query(collection(db, "topics"), orderBy("timestamp", "desc")),
          (snapshot) => {
            const loadedTopics = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                ...data,
                id: doc.id,
                timestamp: asDate(data.timestamp) || new Date()
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
                createdAt: asDate(data.createdAt) || new Date(),
                dueDate: asDate(data.dueDate)
              } as unknown as Task;
            });
            setTasks(loadedTasks);
          }
        );

        // V1.5.0 - Sincronização de Ventures
        unsubscribeVentures = onSnapshot(
          collection(db, "ventures"),
          (snapshot) => {
            const loadedVentures = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                ...data,
                id: doc.id,
                timestamp: asDate(data.timestamp) || new Date()
              } as unknown as Venture;
            });
            setVentures(loadedVentures);
          }
        );
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        if (unsubscribeTopics) unsubscribeTopics();
        if (unsubscribeTasks) unsubscribeTasks();
        if (unsubscribeVentures) unsubscribeVentures();
        setUserProfile(null);
        setTopics([]);
        setTasks([]);
        setVentures([]);
        setIsInitializing(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeTopics) unsubscribeTopics();
      if (unsubscribeTasks) unsubscribeTasks();
      if (unsubscribeVentures) unsubscribeVentures();
    };
  }, []);

  useEffect(() => {
    const uid = (user as any)?.id || (user as any)?.uid;
    if (!uid) {
      setWorkspaceMembers([]);
      return;
    }

    const workspaceQuery = query(
      collection(db, "workspace_members"),
      where('userId', '==', uid)
    );

    const unsubscribe = onSnapshot(workspaceQuery, (snapshot) => {
      const memberships = snapshot.docs.map(doc => {
        const data = doc.data() as WorkspaceMember;
        return { ...data, id: doc.id };
      });
      setWorkspaceMembers(memberships);
    }, (error) => console.error('Erro ao carregar workspace members:', error));

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('home');
    } catch (err) {
      console.error("Erro ao sair:", err);
    }
  };

  // --- PREFERÊNCIAS DE UI VIA SUPABASE (users.payload.uiPrefs) ---
  useEffect(() => {
    const uid = userProfile?.uid || (user as any)?.id || (user as any)?.uid;
    if (!uid) {
      uiPrefsHydratedUserRef.current = null;
      setUiPrefsHydrated(false);
      return;
    }
    if (uiPrefsHydrated && uiPrefsHydratedUserRef.current === uid) return;

    let allUnits = [...INITIAL_BUSINESS_UNITS];
    const customUnits = Array.isArray(uiPrefs.customUnits) ? uiPrefs.customUnits : [];
    customUnits.forEach((unit) => {
      if (!allUnits.some((base) => base.id === unit.id)) allUnits.push(unit);
    });
    setBusinessUnits(allUnits);

    const savedBUId = uiPrefs.navBuId;
    if (savedBUId) {
      const found = allUnits.find((bu) => bu.id === savedBUId);
      if (found) setActiveBU(found);
    }

    // Não restaura navTab automaticamente para evitar corrida de navegação
    // que pode tirar o usuário do chat durante a sessão.

    uiPrefsHydratedUserRef.current = uid;
    setUiPrefsHydrated(true);
  }, [user, userProfile?.uid, uiPrefs, uiPrefsHydrated]);

  useEffect(() => {
    if (activeTab !== 'chat-room' && chatTargetAgent) {
      setChatTargetAgent(null);
      setChatTargetSessionId(null);
    }
  }, [activeTab, chatTargetAgent]);

  const saveUiPrefs = useCallback(async (updates: Partial<AppUiPrefs>) => {
    const uid = userProfile?.uid || (user as any)?.id || (user as any)?.uid;
    if (!uid) return;

    const payloadBase = (userProfile as any)?.payload && typeof (userProfile as any).payload === 'object'
      ? (userProfile as any).payload
      : {};
    const currentUiPrefs = payloadBase.uiPrefs && typeof payloadBase.uiPrefs === 'object'
      ? payloadBase.uiPrefs as AppUiPrefs
      : {};

    const mergedUiPrefs: AppUiPrefs = {
      ...currentUiPrefs,
      ...updates
    };

    const mergedPayload = {
      ...payloadBase,
      uiPrefs: mergedUiPrefs
    };

    await updateDoc(doc(db, "users", uid), {
      payload: mergedPayload
    });
  }, [userProfile, user]);

  useEffect(() => {
    if (!uiPrefsHydrated || !user) return;

    const customUnits = businessUnits.filter(unit => !INITIAL_BUSINESS_UNITS.some(base => base.id === unit.id));
    const nextPrefs: AppUiPrefs = {
      navTab: activeTab,
      navBuId: activeBU.id,
      customUnits
    };
    const currentPrefs = uiPrefs && typeof uiPrefs === 'object' ? uiPrefs : {};
    if (JSON.stringify(currentPrefs) === JSON.stringify({ ...currentPrefs, ...nextPrefs })) return;

    const timeout = setTimeout(() => {
      saveUiPrefs(nextPrefs).catch((error) => {
        console.error('Erro ao salvar preferências de UI no Supabase:', error);
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [uiPrefsHydrated, user, activeTab, activeBU.id, businessUnits, saveUiPrefs, uiPrefs]);

  useEffect(() => {
    if (!user) {
      setCultureEntries([]);
      setComplianceRules([]);
      setVaultItems([]);
      setKnowledgeNodes([]);
      setAgentConfigsByAgentId({});
      setAgentDnaProfilesByAgentId({});
      setAgentDnaEffectiveByAgentId({});
      setAgentMemoriesByAgentId({});
      setAgentQualityEvents([]);
      return;
    }

    const cultureQuery = query(collection(db, 'governance_global_culture'), orderBy('updatedAt', 'desc'));

    const complianceQuery = query(collection(db, 'governance_compliance_rules'), orderBy('updatedAt', 'desc'));

    const vaultQuery = query(collection(db, 'vault_items'), orderBy('createdAt', 'desc'));

    const knowledgeQuery = query(
      collection(db, 'knowledge_nodes'),
      orderBy('parentId', 'asc'),
      orderBy('orderIndex', 'asc')
    );

    const agentConfigsQuery = query(collection(db, 'agent_configs'), orderBy('updatedAt', 'desc'));
    const agentDnaProfilesQuery = query(collection(db, 'agent_dna_profiles'), orderBy('updatedAt', 'desc'));
    const agentDnaEffectiveQuery = query(collection(db, 'agent_dna_effective'), orderBy('updatedAt', 'desc'));
    const agentMemoriesQuery = query(collection(db, 'agent_memories'), orderBy('createdAt', 'desc'));
    const qualityEventsQuery = query(collection(db, 'agent_quality_events'), orderBy('createdAt', 'desc'));

    const unsubscribeCulture = onSnapshot(cultureQuery, (snapshot) => {
      const rows = snapshot.docs.map(doc => doc.data() as GovernanceCulture);
      setCultureEntries(scopeGovernanceRowsByWorkspace(rows));
    }, (error) => console.error('Erro ao carregar cultura global:', error));

    const unsubscribeCompliance = onSnapshot(complianceQuery, (snapshot) => {
      const rows = snapshot.docs.map(doc => doc.data() as ComplianceRule);
      setComplianceRules(scopeGovernanceRowsByWorkspace(rows));
    }, (error) => console.error('Erro ao carregar compliance:', error));

    const unsubscribeVault = onSnapshot(vaultQuery, (snapshot) => {
      const rows = snapshot.docs.map(doc => doc.data() as VaultItem);
      setVaultItems(scopeGovernanceRowsByWorkspace(rows));
    }, (error) => console.error('Erro ao carregar vault:', error));

    const unsubscribeKnowledge = onSnapshot(knowledgeQuery, (snapshot) => {
      const rows = snapshot.docs.map(doc => ({ ...(doc.data() as KnowledgeNode), id: doc.id }));
      setKnowledgeNodes(scopeGovernanceRowsByWorkspace(rows));
    }, (error) => console.error('Erro ao carregar knowledge nodes:', error));

    const unsubscribeAgentConfigs = onSnapshot(agentConfigsQuery, (snapshot) => {
      const rows = scopeGovernanceRowsByWorkspace(snapshot.docs.map(doc => doc.data() as any));
      const mapped: Record<string, { fullPrompt?: string; globalDocuments?: Agent['globalDocuments']; docCount?: number }> = {};
      rows.forEach((row) => {
        const targetAgentId = String(row.agentId || row.agent_id || '').trim();
        if (!targetAgentId) return;
        mapped[targetAgentId] = {
          fullPrompt: row.fullPrompt || row.full_prompt || '',
          globalDocuments: row.globalDocuments || row.global_documents || [],
          docCount: Number(row.docCount ?? row.doc_count ?? 0)
        };
      });
      setAgentConfigsByAgentId(mapped);
    }, (error) => console.error('Erro ao carregar agent_configs:', error));

    let unsubscribeAgentDnaProfiles: () => void = () => {};
    let agentDnaProfilesSubscriptionDisabled = false;
    unsubscribeAgentDnaProfiles = onSnapshot(agentDnaProfilesQuery, (snapshot) => {
      if (agentDnaProfilesSubscriptionDisabled) return;
      const rows = scopeGovernanceRowsByWorkspace(snapshot.docs.map(doc => doc.data() as AgentDnaProfile));
      const mapped: Record<string, AgentDnaProfile> = {};
      rows.forEach((row) => {
        const targetAgentId = String(row.agentId || '').trim();
        if (!targetAgentId) return;
        mapped[targetAgentId] = row;
      });
      setAgentDnaProfilesByAgentId(mapped);
    }, (error) => {
      const rawMessage = String((error as any)?.details?.message || (error as any)?.message || error || '');
      if (/Could not find the table 'public\.agent_dna_profiles'/i.test(rawMessage)) {
        agentDnaProfilesSubscriptionDisabled = true;
        setAgentDnaProfilesByAgentId({});
        console.warn('Tabela public.agent_dna_profiles ainda nao existe no Supabase. Assinatura de DNA individual desativada ate aplicar migration.');
        unsubscribeAgentDnaProfiles();
        return;
      }
      console.error('Erro ao carregar agent_dna_profiles:', error);
    });

    let unsubscribeAgentDnaEffective: () => void = () => {};
    let agentDnaEffectiveSubscriptionDisabled = false;
    unsubscribeAgentDnaEffective = onSnapshot(agentDnaEffectiveQuery, (snapshot) => {
      if (agentDnaEffectiveSubscriptionDisabled) return;
      const rows = scopeGovernanceRowsByWorkspace(snapshot.docs.map(doc => doc.data() as AgentDnaEffective));
      const mapped: Record<string, AgentDnaEffective> = {};
      rows.forEach((row) => {
        const targetAgentId = String(row.agentId || '').trim();
        if (!targetAgentId) return;
        mapped[targetAgentId] = row;
      });
      setAgentDnaEffectiveByAgentId(mapped);
    }, (error) => {
      const rawMessage = String((error as any)?.details?.message || (error as any)?.message || error || '');
      if (/Could not find the table 'public\.agent_dna_effective'/i.test(rawMessage)) {
        agentDnaEffectiveSubscriptionDisabled = true;
        setAgentDnaEffectiveByAgentId({});
        console.warn('Tabela public.agent_dna_effective ainda nao existe no Supabase. Assinatura de DNA efetivo desativada ate aplicar migration.');
        unsubscribeAgentDnaEffective();
        return;
      }
      console.error('Erro ao carregar agent_dna_effective:', error);
    });

    let unsubscribeAgentMemories: () => void = () => {};
    let agentMemoriesSubscriptionDisabled = false;
    unsubscribeAgentMemories = onSnapshot(agentMemoriesQuery, (snapshot) => {
      if (agentMemoriesSubscriptionDisabled) return;
      const rows = scopeGovernanceRowsByWorkspace(snapshot.docs.map(doc => doc.data() as any));
      const mapped: Record<string, string[]> = {};
      rows.forEach((row) => {
        const targetAgentId = String(row.agentId || row.agent_id || '').trim();
        const content = String(row.content || '').trim();
        const status = normalizeStatus(row.status);
        if (!targetAgentId || !content) return;
        if (status === 'archived' || status === 'deleted') return;
        if (!mapped[targetAgentId]) mapped[targetAgentId] = [];
        if (!mapped[targetAgentId].includes(content)) {
          mapped[targetAgentId].push(content);
        }
      });
      setAgentMemoriesByAgentId(mapped);
    }, (error) => {
      const rawMessage = String((error as any)?.details?.message || (error as any)?.message || error || '');
      if (/Could not find the table 'public\.agent_memories'/i.test(rawMessage)) {
        agentMemoriesSubscriptionDisabled = true;
        setAgentMemoriesByAgentId({});
        console.warn('Tabela public.agent_memories ainda nao existe no Supabase. Assinatura de memorias desativada ate aplicar migration.');
        unsubscribeAgentMemories();
        return;
      }
      console.error('Erro ao carregar agent_memories:', error);
    });

    let unsubscribeQualityEvents: () => void = () => {};
    let qualityEventsSubscriptionDisabled = false;
    unsubscribeQualityEvents = onSnapshot(qualityEventsQuery, (snapshot) => {
      if (qualityEventsSubscriptionDisabled) return;
      const rows = scopeGovernanceRowsByWorkspace(snapshot.docs.map(doc => doc.data() as AgentQualityEvent));
      setAgentQualityEvents(rows);
    }, (error) => {
      const rawMessage = String((error as any)?.details?.message || (error as any)?.message || error || '');
      if (/Could not find the table 'public\.agent_quality_events'/i.test(rawMessage)) {
        qualityEventsSubscriptionDisabled = true;
        setAgentQualityEvents([]);
        console.warn('Tabela public.agent_quality_events ainda nao existe no Supabase. Assinatura de qualidade desativada ate aplicar migration.');
        unsubscribeQualityEvents();
        return;
      }
      console.error('Erro ao carregar agent_quality_events:', error);
    });

    return () => {
      unsubscribeCulture();
      unsubscribeCompliance();
      unsubscribeVault();
      unsubscribeKnowledge();
      unsubscribeAgentConfigs();
      unsubscribeAgentDnaProfiles();
      unsubscribeAgentDnaEffective();
      unsubscribeAgentMemories();
      unsubscribeQualityEvents();
    };
  }, [user, activeWorkspaceId, memberWorkspaceIds]);

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
        workspaceId: activeWorkspaceId || userProfile?.workspaceId || null,
        assignee: assignee || '',
        dueDate: dueDate || '',
        createdBy: userProfile?.uid || null
      };
      await addDoc(collection(db, "topics"), newTopic);
    } catch (e) {
      console.error("Error adding topic:", e);
      alert("Erro ao salvar pauta no banco de dados.");
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
    const title = partialTopic.title || 'Nova Pauta';
    const priority = partialTopic.priority || 'Média';
    const assignee = partialTopic.assignee || '';
    const dueDate = partialTopic.dueDate;

    void handleAddTopic(title, priority, assignee, dueDate);

    const normalizedDueDate = dueDate ? new Date(dueDate) : undefined;
    const taskFromChat: Task = {
      id: generateId(),
      title,
      description: partialTopic.description || '',
      status: 'todo',
      assignee,
      createdAt: new Date(),
      dueDate: normalizedDueDate && !Number.isNaN(normalizedDueDate.getTime()) ? normalizedDueDate : undefined
    };

    void handleAddTask(taskFromChat);
  };

  const handleRemoveVenture = async (id: string) => {
    if (confirm("Deseja realmente remover esta Venture?")) {
      try {
        await deleteDoc(doc(db, "ventures", id));
      } catch (e) {
        console.error("Error removing venture:", e);
      }
    }
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
      setChatTargetSessionId(null);
      setActiveTab('chat-room');
    }
  };

  const handleOpenAgentSession = (agent: Agent, sessionId: string) => {
    if (agent.status === 'PLANNED') {
      setAgentToOnboard(agent);
      setActiveTab('fabrica-ca');
      return;
    }
    setChatTargetAgent(agent);
    setChatTargetSessionId(sessionId);
    setActiveTab('chat-room');
  };

  // Nova função para atualizar agentes diretamente da Governança (DNA Editor)
  const handleUpdateAgentData = async (updatedAgent: Agent) => {
    const workspaceIdForSave =
      (isUuid(activeWorkspaceId) ? activeWorkspaceId : null) ||
      resolveWorkspaceIdForWrites ||
      (isUuid(updatedAgent.ventureId) ? updatedAgent.ventureId : null) ||
      DEFAULT_WORKSPACE_ID;

    const { id, fullPrompt, globalDocuments, docCount } = updatedAgent;
    const currentUserId = userProfile?.uid || user?.id || null;
    const normalizedGlobalDocuments = globalDocuments || [];
    const normalizedDocCount = docCount ?? normalizedGlobalDocuments.length;
    const governanceForComposition = {
      constitution: latestCultureEntry?.contentMd || getRuntimeAiContext().constitution,
      context: latestCultureEntry?.summary || getRuntimeAiContext().context,
      compliance: activeComplianceRule?.ruleMd || getRuntimeAiContext().compliance
    };
    const effectivePrompt = composeEffectivePrompt(fullPrompt || '', governanceForComposition);

    // Atualização do cadastro-base do agente é best-effort para não bloquear o salvamento do DNA.
    // Tabelas em produção podem variar de schema e rejeitar colunas extras.
    const minimalAgentPatch: Record<string, any> = {
      name: updatedAgent.name,
      description: updatedAgent.officialRole || updatedAgent.description || null,
      status: updatedAgent.status
    };
    if (updatedAgent.ventureId) {
      minimalAgentPatch.ventureId = updatedAgent.ventureId;
    }

    try {
      await updateDoc(doc(db, "agents", id), minimalAgentPatch);
    } catch (e) {
      console.warn("Aviso: falha ao atualizar dados-base em agents. Prosseguindo com agent_configs.", e);
    }

    try {
      await setDoc(doc(db, "agent_configs", id), {
        workspaceId: workspaceIdForSave,
        agentId: id,
        fullPrompt: fullPrompt || '',
        globalDocuments: normalizedGlobalDocuments,
        docCount: normalizedDocCount,
        status: 'active',
        updatedBy: currentUserId,
        updatedAt: new Date()
      }, { merge: true });
    } catch (e: any) {
      console.error("Erro ao salvar agent_configs:", e);
      throw new Error(`Falha ao salvar DNA do agente no Supabase: ${String(e?.message || e)}`);
    }

    try {
      await setDoc(doc(db, 'agent_dna_profiles', id), {
        workspaceId: workspaceIdForSave,
        agentId: id,
        individualPrompt: fullPrompt || '',
        status: 'active',
        updatedBy: currentUserId,
        updatedAt: new Date()
      }, { merge: true });

      await setDoc(doc(db, 'agent_dna_effective', id), {
        workspaceId: workspaceIdForSave,
        agentId: id,
        effectivePrompt,
        status: 'active',
        syncedAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });
    } catch (e: any) {
      console.error('Erro ao salvar DNA em camadas:', e);
      throw new Error(`Falha ao sincronizar DNA em camadas: ${String(e?.message || e)}`);
    }
  };

  // Função para criar novas Unidades (Ventures) via Importador
  const handleAddBusinessUnit = (newUnit: BusinessUnit) => {
    setBusinessUnits(prev => {
      if (prev.some(unit => unit.id === newUnit.id)) return prev;
      return [...prev, newUnit];
    });
  };

  const handleAddTask = async (task: Task) => {
    try {
      const { id, ...data } = task;
      await addDoc(collection(db, "tasks"), {
        ...data,
        workspaceId: activeWorkspaceId || userProfile?.workspaceId || null,
        buId: activeBU.id,
        createdBy: userProfile?.uid || null,
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

  const handleSaveCultureEntry = async ({ contentMd, title, summary }: { contentMd: string; title?: string; summary?: string; }) => {
    const workspaceForWrite = resolveWorkspaceIdForWrites || DEFAULT_WORKSPACE_ID;
    const now = new Date();
    try {
      if (latestCultureEntry) {
        await updateDoc(doc(db, "governance_global_culture", latestCultureEntry.id), {
          contentMd,
          title: title ?? latestCultureEntry.title,
          summary: summary ?? latestCultureEntry.summary ?? '',
          version: (latestCultureEntry.version ?? 1) + 1,
          updatedBy: userProfile?.uid || null,
          updated_at: now
        });
      } else {
        await addDoc(collection(db, "governance_global_culture"), {
          workspaceId: workspaceForWrite,
          title: title || 'Cultura Global',
          summary: summary || '',
          contentMd,
          version: 1,
          status: 'active',
          createdBy: userProfile?.uid || null,
          updatedBy: userProfile?.uid || null,
          created_at: now,
          updated_at: now
        });
      }
    } catch (error) {
      console.error('Erro ao salvar Cultura Global:', error);
      alert('Falha ao salvar Cultura Global.');
    }
  };

  const handleSaveComplianceMarkdown = async (markdown: string) => {
    const workspaceForWrite = resolveWorkspaceIdForWrites || DEFAULT_WORKSPACE_ID;
    const now = new Date();
    try {
      if (activeComplianceRule) {
        await updateDoc(doc(db, "governance_compliance_rules", activeComplianceRule.id), {
          ruleMd: markdown,
          version: (activeComplianceRule.version ?? 1) + 1,
          updatedBy: userProfile?.uid || null,
          updated_at: now
        });
      } else {
        await addDoc(collection(db, "governance_compliance_rules"), {
          workspaceId: workspaceForWrite,
          code: GLOBAL_COMPLIANCE_CODE,
          title: 'Diretrizes & Compliance',
          description: 'Regras e protocolos globais do ecossistema GrupoB.',
          severity: 'medium',
          scope: 'global',
          ruleMd: markdown,
          version: 1,
          status: 'active',
          createdBy: userProfile?.uid || null,
          updatedBy: userProfile?.uid || null,
          created_at: now,
          updated_at: now
        });
      }
    } catch (error) {
      console.error('Erro ao salvar Compliance:', error);
      alert('Falha ao salvar Diretrizes & Compliance.');
    }
  };

  const handleCreateVaultRecord = async (item: { name: string; provider: string; env: string; itemType: string; ownerEmail?: string; storagePath?: string; secretRef?: string; rotatePolicy?: string; payload?: Record<string, any>; }) => {
    const workspaceForWrite = resolveWorkspaceIdForWrites || DEFAULT_WORKSPACE_ID;
    const now = new Date();
    try {
      await addDoc(collection(db, "vault_items"), {
        workspaceId: workspaceForWrite,
        name: item.name,
        provider: item.provider,
        env: item.env,
        itemType: item.itemType,
        ownerEmail: item.ownerEmail || '',
        storagePath: item.storagePath || '',
        secretRef: item.secretRef || '',
        rotatePolicy: item.rotatePolicy || '',
        payload: item.payload || {},
        status: 'active',
        createdBy: userProfile?.uid || null,
        updatedBy: userProfile?.uid || null,
        created_at: now,
        updated_at: now
      });
    } catch (error) {
      console.error('Erro ao registrar item no cofre:', error);
      alert('Falha ao salvar item no Cofre Black.');
    }
  };

  const handleDeleteVaultRecord = async (id: string) => {
    try {
      await updateDoc(doc(db, "vault_items", id), {
        status: 'deleted',
        updatedBy: userProfile?.uid || null,
        updated_at: new Date()
      });
    } catch (error) {
      console.error('Erro ao remover item do cofre:', error);
      alert('Falha ao remover item do Cofre Black.');
    }
  };

  const handleCreateKnowledgeNode = async ({ title, nodeType, parentId = null, contentMd = '', linkUrl }: { title: string; nodeType: KnowledgeNode['nodeType']; parentId?: string | null; contentMd?: string; linkUrl?: string; }) => {
    const workspaceForWrite = resolveWorkspaceIdForWrites || DEFAULT_WORKSPACE_ID;
    const now = new Date();
    const siblings = visibleKnowledgeNodes.filter(node => (node.parentId ?? null) === (parentId ?? null));
    const nextOrderIndex = siblings.length > 0 ? Math.max(...siblings.map(node => node.orderIndex ?? 0)) + 1 : 1;
    try {
      const docRef = await addDoc(collection(db, "knowledge_nodes"), {
        workspaceId: workspaceForWrite,
        parentId: parentId ?? null,
        nodeType,
        title,
        contentMd,
        linkUrl: linkUrl || null,
        orderIndex: nextOrderIndex,
        version: 1,
        visibility: 'internal',
        status: 'active',
        createdBy: userProfile?.uid || null,
        updatedBy: userProfile?.uid || null,
        created_at: now,
        updated_at: now
      });
      return docRef.id;
    } catch (error) {
      console.error('Erro ao criar nó de conhecimento:', error);
      alert('Falha ao criar novo item na base de conhecimento.');
    }
  };

  const handleUpdateKnowledgeNode = async (id: string, updates: Partial<KnowledgeNode>) => {
    try {
      const payload: Record<string, any> = {
        updatedBy: userProfile?.uid || null,
        updated_at: new Date()
      };
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.contentMd !== undefined) payload.contentMd = updates.contentMd;
      if (updates.linkUrl !== undefined) payload.linkUrl = updates.linkUrl;
      if (updates.orderIndex !== undefined) payload.orderIndex = updates.orderIndex;
      if (updates.visibility !== undefined) payload.visibility = updates.visibility;
      if (updates.parentId !== undefined) payload.parentId = updates.parentId;
      await updateDoc(doc(db, "knowledge_nodes", id), payload);
    } catch (error) {
      console.error('Erro ao atualizar nó de conhecimento:', error);
      alert('Falha ao atualizar página/metodologia.');
    }
  };

  const handleDeleteKnowledgeNode = async (id: string) => {
    try {
      await updateDoc(doc(db, "knowledge_nodes", id), {
        status: 'archived',
        updatedBy: userProfile?.uid || null,
        updated_at: new Date()
      });
    } catch (error) {
      console.error('Erro ao arquivar nó de conhecimento:', error);
      alert('Falha ao arquivar item da base de conhecimento.');
    }
  };

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

  // --- DATABASE SYNC (SUBSTITUI LOCALSTORAGE PARA AGENTES) ---
  useEffect(() => {
    if (!user) return;

    // Carrega agentes SOMENTE do banco de dados (Fonte da Verdade)
    const unsubscribe = onSnapshot(collection(db, 'agents'), (snapshot) => {
      const remoteAgents = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Agent[];

      const hydratedAgents = remoteAgents.map((agent) => {
        const config = agentConfigsByAgentId[agent.id] || (agent.universalId ? agentConfigsByAgentId[agent.universalId] : undefined);
        const dnaProfile = agentDnaProfilesByAgentId[agent.id] || (agent.universalId ? agentDnaProfilesByAgentId[agent.universalId] : undefined);
        const dnaEffective = agentDnaEffectiveByAgentId[agent.id] || (agent.universalId ? agentDnaEffectiveByAgentId[agent.universalId] : undefined);
        const memories = agentMemoriesByAgentId[agent.id]
          || (agent.universalId ? agentMemoriesByAgentId[agent.universalId] : undefined)
          || agent.learnedMemory
          || [];
        const basePrompt = dnaProfile?.individualPrompt || config?.fullPrompt || agent.fullPrompt || '';
        const fallbackEffective = composeEffectivePrompt(basePrompt, {
          constitution: latestCultureEntry?.contentMd,
          context: latestCultureEntry?.summary,
          compliance: activeComplianceRule?.ruleMd
        });
        return {
          ...agent,
          fullPrompt: config?.fullPrompt ?? agent.fullPrompt ?? '',
          dnaIndividualPrompt: dnaProfile?.individualPrompt ?? basePrompt,
          effectivePrompt: dnaEffective?.effectivePrompt ?? fallbackEffective,
          globalDocuments: config?.globalDocuments ?? agent.globalDocuments,
          docCount: config?.docCount ?? agent.docCount,
          learnedMemory: Array.from(new Set(memories.filter(Boolean)))
        };
      });

      setActivatedAgents(hydratedAgents);
    }, (error) => {
      console.error("Erro ao conectar no banco de dados:", error);
    });

    return () => unsubscribe();
  }, [
    user,
    agentConfigsByAgentId,
    agentDnaProfilesByAgentId,
    agentDnaEffectiveByAgentId,
    agentMemoriesByAgentId,
    latestCultureEntry,
    activeComplianceRule
  ]);

  // --- SAVE STATE ---


  // CORREÇÃO CRÍTICA: Se estiver no GrupoB, mostra TODOS os agentes ativos no sistema
  // SAFEGUARD: Check activeBU before access
  const filteredAgents = activeBU && activeBU.id === 'grupob'
    ? activatedAgents
    : activatedAgents.filter(a => activeBU && a.buId === activeBU.id);

  const filteredMessages = messages.filter(m => activeBU && m.buId === activeBU.id);
  const currentBlueprint = activeBU ? (blueprints[activeBU.id] || {}) : {};
  const ownerUserId = userProfile?.uid || (user as any)?.id || (user as any)?.uid || null;
  const currentUserDisplayName = userProfile?.name || userProfile?.nickname || 'Usuário';
  const audacusGatewayByBu = (uiPrefs.audacusGatewayByBu && typeof uiPrefs.audacusGatewayByBu === 'object')
    ? uiPrefs.audacusGatewayByBu
    : {};

  const directChannelAgent = useMemo(() => {
    const buScoped = activatedAgents.filter((agent) =>
      agent?.status === 'ACTIVE' && (agent?.buId === activeBU.id || activeBU.id === 'grupob')
    );
    if (buScoped.length === 0) return null;

    return [...buScoped].sort((a, b) => {
      const tierDiff = getTierRank(a.tier) - getTierRank(b.tier);
      if (tierDiff !== 0) return tierDiff;
      return String(a.name || '').localeCompare(String(b.name || ''));
    })[0] || null;
  }, [activatedAgents, activeBU.id]);

  const directChannelProfile = useMemo(() => {
    if (directChannelAgent) {
      const resolvedInstruction = resolveAgentBasePrompt(directChannelAgent);
      return {
        name: directChannelAgent.name,
        avatarColor: directChannelAgent.avatarColor || '#0EA5E9',
        imageUrl: directChannelAgent.avatarUrl || ASSISTANT_FALLBACK_IMAGE,
        instruction: resolvedInstruction || DIRECT_CHANNEL_FALLBACK_PROMPT
      };
    }

    return {
      name: 'Assistente da Unidade',
      avatarColor: '#0EA5E9',
      imageUrl: ASSISTANT_FALLBACK_IMAGE,
      instruction: DIRECT_CHANNEL_FALLBACK_PROMPT
    };
  }, [directChannelAgent]);

  useEffect(() => {
    // SAFEGUARD: Ensure activeBU is valid
    if (!activeBU) return;

    const context = `Contexto: Unidade ${activeBU.name}. Canal direto com foco em estratégia e execução.`;

    try {
      startMainSession(context, directChannelProfile.instruction);
    } catch (e) {
      console.error("Init Error:", e);
    }
  }, [activeBU, directChannelProfile.instruction]);

  useEffect(() => {
    const agentIdentityByKey = activatedAgents.reduce((acc, agent) => {
      const resolved = resolveAgentBasePrompt(agent);
      if (resolved) {
        acc[agent.id] = resolved;
        if (agent.universalId) acc[agent.universalId] = resolved;
      }
      return acc;
    }, {} as Record<string, string>);

    setRuntimeAiContext({
      constitution: latestCultureEntry?.contentMd || undefined,
      context: latestCultureEntry?.summary || undefined,
      compliance: activeComplianceRule?.ruleMd || undefined,
      agentIdentityByKey
    });
  }, [activatedAgents, latestCultureEntry, activeComplianceRule]);

  const handleSaveGatewayUrl = useCallback(async (buId: string, url: string) => {
    const next = {
      ...audacusGatewayByBu,
      [buId]: url
    };
    await saveUiPrefs({ audacusGatewayByBu: next });
  }, [audacusGatewayByBu, saveUiPrefs]);

  useEffect(() => {
    let cancelled = false;
    const bootstrapMainChat = async () => {
      const agentId = `redir:${activeBU.id}`;
      try {
        const existingSession = await findLatestSession({
          workspaceId: activeWorkspaceId,
          agentId,
          buId: activeBU.id
        });

        let targetSessionId = existingSession?.id || null;
        if (!targetSessionId) {
          targetSessionId = await createSession({
            workspaceId: activeWorkspaceId,
            agentId,
            ownerUserId,
            buId: activeBU.id,
            title: `Canal Direto • ${activeBU.name}`,
            payload: { kind: 'direct-channel', buName: activeBU.name }
          });
        }

        const loadedMessages = await loadSessionMessages({
          workspaceId: activeWorkspaceId,
          sessionId: targetSessionId
        });

        if (cancelled) return;
        setMainChatSessionId(targetSessionId);
        setMessages(loadedMessages);
      } catch (error) {
        console.error('Erro ao carregar canal direto:', error);
        if (cancelled) return;
        setMainChatSessionId(null);
        setMessages([]);
      }
    };

    bootstrapMainChat();
    return () => {
      cancelled = true;
    };
  }, [activeBU.id, activeBU.name, activeWorkspaceId, ownerUserId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !attachment) || isLoading || !mainChatSessionId) return;
    const userText = input.trim();
    const currentAttachment = attachment;
    setInput('');
    setAttachment(null);

    const displayText = currentAttachment ? (userText ? userText + " 📎 [Arquivo Anexado]" : "📎 [Arquivo Enviado]") : userText;
    const channelAgentId = `redir:${activeBU.id}`;
    let persistedBotId = '';

    try {
      const savedUser = await appendMessage({
        workspaceId: activeWorkspaceId,
        sessionId: mainChatSessionId,
        agentId: channelAgentId,
        sender: Sender.User,
        text: displayText,
        buId: activeBU.id,
        attachment: currentAttachment
      });
      setMessages(prev => [...prev, { id: savedUser.id, text: displayText, sender: Sender.User, timestamp: new Date(), buId: activeBU.id, attachment: currentAttachment || undefined }]);

      const savedBot = await appendMessage({
        workspaceId: activeWorkspaceId,
        sessionId: mainChatSessionId,
        agentId: channelAgentId,
        sender: Sender.Bot,
        text: '',
        buId: activeBU.id,
        participantName: directChannelProfile.name,
        isStreaming: true
      });
      persistedBotId = savedBot.id;

      setIsLoading(true);
      setMessages(prev => [...prev, { id: persistedBotId, text: '', sender: Sender.Bot, timestamp: new Date(), buId: activeBU.id, isStreaming: true, participantName: directChannelProfile.name }]);

      let messagePayload: any = userText;
      if (currentAttachment) {
        messagePayload = [
          { text: userText || 'Analise o arquivo enviado.' },
          { inlineData: { mimeType: currentAttachment.mimeType, data: currentAttachment.data } }
        ];
      }
      const stream = await sendMessageStream(messagePayload, `Canal direto. Unidade: ${activeBU.name}. Interlocutor: ${currentUserDisplayName}.`);
      let fullText = '';

      for await (const chunk of stream) {
        // Handle Text
        const chunkText = (chunk as { text?: string }).text || '';
        if (chunkText) {
          fullText += chunkText;
          setMessages(prev => prev.map(msg => msg.id === persistedBotId ? { ...msg, text: fullText } : msg));
        }
      }
      setMessages(prev => prev.map(msg => msg.id === persistedBotId ? { ...msg, isStreaming: false } : msg));
      await updateMessage(persistedBotId, { text: fullText, isStreaming: false, updatedAt: new Date() });
      await touchSession(mainChatSessionId);
    } catch (error) {
      console.error(error);
      if (persistedBotId) {
        setMessages(prev => prev.map(msg => msg.id === persistedBotId ? { ...msg, text: "Falha de conexão com o assistente (API Key Error).", isStreaming: false } : msg));
        await updateMessage(persistedBotId, { text: "Falha de conexão com o assistente (API Key Error).", isStreaming: false, updatedAt: new Date() }).catch(() => null);
      }
      const sysText = "⚠️ **ERRO DE SISTEMA:** Não foi possível conectar ao Gemini API. Verifique as variáveis de ambiente.";
      const savedSystem = await appendMessage({
        workspaceId: activeWorkspaceId,
        sessionId: mainChatSessionId,
        agentId: channelAgentId,
        sender: Sender.System,
        text: sysText,
        buId: activeBU.id,
        participantName: 'Sistema'
      }).catch(() => null);
      setMessages(prev => [...prev, {
        id: savedSystem?.id || ('error-' + Date.now()),
        text: sysText,
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

    if (activeBU.id === '3forb' && activeTab === '3forb-home') return <ThreeForBView activeTab={activeTab} activeBU={activeBU} setActiveTab={setActiveTab} agents={activatedAgents} onAddTopic={handleAddTopic} activeWorkspaceId={activeWorkspaceId} ownerUserId={ownerUserId} />;

    if (activeBU.id === 'audacus' && activeTab === 'audacus-home') {
      return (
        <AudacusView
          activeBU={activeBU}
          onBack={handleReturnToHub}
          savedGatewayUrl={audacusGatewayByBu[activeBU.id]}
          onSaveGatewayUrl={(url) => handleSaveGatewayUrl(activeBU.id, url)}
        />
      );
    }

    // ROTA STARTYB
    if (activeBU.id === 'startyb' && activeTab === 'startyb-home') return <StartyBView activeBU={activeBU} agents={activatedAgents} onBack={handleReturnToHub} activeWorkspaceId={activeWorkspaceId} ownerUserId={ownerUserId} />;

    switch (activeTab) {
      case 'home': return <DashboardHome agents={activatedAgents} tasks={tasks} businessUnits={businessUnits} onNavigate={setActiveTab} activeWorkspaceId={activeWorkspaceId} />;

      // FIX: HUB VIEW SEMPRE RECEBE LISTA COMPLETA DE AGENTES (activatedAgents)
      case 'ecosystem': return <HubView businessUnits={businessUnits} activeBU={activeBU} onSelectBU={handleSelectBU} onNavigate={setActiveTab} agents={activatedAgents} onSelectAgent={handleAgentInteraction} />;
      // Fallback for 'hub' key from localstorage if present
      case 'hub': return <HubView businessUnits={businessUnits} activeBU={activeBU} onSelectBU={handleSelectBU} onNavigate={setActiveTab} agents={activatedAgents} onSelectAgent={handleAgentInteraction} />;

      case 'management': return <ManagementView tasks={tasks} onAddTask={handleAddTask} onUpdateTaskStatus={handleUpdateTaskStatus} activeWorkspaceId={activeWorkspaceId} ownerUserId={ownerUserId} />;
      case 'programmers-room':
        return <ProgrammersRoomView onBack={() => setActiveTab('ecosystem')} />;
      case 'unit-room': return <UnitView activeBU={activeBU} agents={activatedAgents} onBack={handleBackNavigation} activeWorkspaceId={activeWorkspaceId} ownerUserId={ownerUserId} />;

      // NOVA ROTA: CONVERSAS (HISTÓRICO)
      case 'conversations': return <ConversationsView agents={activatedAgents} onOpenChat={handleAgentInteraction} onOpenSession={handleOpenAgentSession} activeWorkspaceId={activeWorkspaceId} />;

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
          cultureEntry={latestCultureEntry}
          complianceMarkdown={activeComplianceRule?.ruleMd || ''}
          onSaveCulture={handleSaveCultureEntry}
          onSaveCompliance={handleSaveComplianceMarkdown}
          vaultItems={activeVaultEntries}
          onCreateVaultItem={handleCreateVaultRecord}
          onDeleteVaultItem={handleDeleteVaultRecord}
          knowledgeNodes={visibleKnowledgeNodes}
          onCreateKnowledgeNode={handleCreateKnowledgeNode}
          onUpdateKnowledgeNode={handleUpdateKnowledgeNode}
          onDeleteKnowledgeNode={handleDeleteKnowledgeNode}
        />
      );
      case 'quality':
        return (
          <QualitySensorView
            qualityEvents={agentQualityEvents}
            workspaceId={activeWorkspaceId}
            onBack={() => setActiveTab('ecosystem')}
          />
        );
      case 'intelligence-flow':
        return (
          <IntelligenceFlowView
            workspaceId={activeWorkspaceId}
            onBack={() => setActiveTab('ecosystem')}
          />
        );
      case 'missions':
        return (
          <AgentMissionsView
            workspaceId={activeWorkspaceId}
            ownerUserId={ownerUserId}
            agents={activatedAgents}
            onBack={() => setActiveTab('ecosystem')}
          />
        );
      case 'nagi':
        return (
          <NAGIView
            onBack={() => setActiveTab('ecosystem')}
            onOpenTab={(tab) => setActiveTab(tab)}
          />
        );
      case 'radar-connections':
        return <RadarConnectionsView onBack={() => setActiveTab('nagi')} />;
      case 'cid':
        return (
          <CIDView
            workspaceId={activeWorkspaceId}
            ownerUserId={ownerUserId}
            userProfile={userProfile}
            ventures={ventures}
            onBack={() => setActiveTab('ecosystem')}
          />
        );
      case 'continuous-memory':
        return (
          <ContinuousMemoryView
            workspaceId={activeWorkspaceId}
            ownerUserId={ownerUserId}
            userProfile={userProfile}
            ventures={ventures}
            onBack={() => setActiveTab('ecosystem')}
          />
        );

      case 'alignment': return <AlignmentView activeBU={activeBU} blueprint={currentBlueprint} onUpdateBlueprint={(bp) => setBlueprints(p => ({ ...p, [activeBU.id]: { ...p[activeBU.id], ...bp } }))} activeWorkspaceId={activeWorkspaceId} ownerUserId={ownerUserId} />;

      case 'fabrica-ca': return (
        <AgentFactory
          agents={activatedAgents}
          initialAgent={agentToOnboard}
          onNavigateToEcosystem={() => setActiveTab('ecosystem')}
          onActivate={handleActivateAgent}
          onRemove={handleRemoveAgent}
          activeBU={activeBU}
          activeWorkspaceId={activeWorkspaceId}
          businessUnits={businessUnits}
          ventures={ventures} // NOVO v1.5.0
          onManageIntelligence={(agent) => {
            // NOVO HANDLER: Redireciona para Governança/Inteligência
            setGovernanceTargetId(agent.id);
            setActiveTab('governance');
          }}
        />
      );

      // NOVA ROTA: EQUIPE GLOBAL (VISÃO DE TODOS OS AGENTES PARA CHAT)
      case 'team': return <SystemicVision dynamicAgents={activatedAgents} onUpdateAgents={setActivatedAgents} activeBU={activeBU} businessUnits={businessUnits} onBack={handleBackNavigation} onConvertToTopic={handleCreateTopicFromChat} viewMode="global" userProfile={userProfile} activeWorkspaceId={activeWorkspaceId} />;

      // RESTORED: CHAT ROOM (Systemic Vision Logic) with onConvertToTopic prop
      case 'chat-room': return <SystemicVision dynamicAgents={activatedAgents} onUpdateAgents={setActivatedAgents} activeBU={activeBU} businessUnits={businessUnits} forcedAgent={chatTargetAgent} forcedSessionId={chatTargetSessionId} onBack={handleBackNavigation} onConvertToTopic={handleCreateTopicFromChat} userProfile={userProfile} activeWorkspaceId={activeWorkspaceId} />;

      case 'vault':
        return <BacklogView
          topics={topics.filter(t => t.buId === activeBU.id)}
          agents={filteredAgents}
          onAddTopic={(title, priority, assignee, dueDate) => handleAddTopic(title, priority, assignee, dueDate)}
          onRemoveTopic={handleRemoveTopic}
          onUpdateStatus={handleUpdateTopicStatus}
        />;
      case 'ventures': // NEW HUB v1.5.0
        return <VenturesView
          ventures={ventures}
          agents={activatedAgents}
          onAddVenture={(v) => setVentures(prev => [v, ...prev])}
          onRemoveVenture={handleRemoveVenture}
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
                        <img src={userProfile?.avatarUrl || USER_FALLBACK_IMAGE} className="w-full h-full object-cover" />
                      ) : (
                        directChannelProfile.imageUrl ? (
                          <img src={directChannelProfile.imageUrl} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-[10px] font-black uppercase text-white" style={{ color: directChannelProfile.avatarColor }}>
                            {directChannelProfile.name.substring(0, 2)}
                          </div>
                        )
                      )}
                    </div>

                    <div className={`flex flex-col ${msg.sender === Sender.User ? 'items-end' : 'items-start'} max-w-[85%]`}>
                      <div className="flex items-center gap-2 mb-1 px-1 opacity-60">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                          {msg.sender === Sender.User ? (currentUserDisplayName || 'Usuário') : directChannelProfile.name}
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
                  placeholder={isTranscribing ? "Transcrevendo..." : `Falar com ${directChannelProfile.name} sobre ${activeBU.name}...`}
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
      default: return <DashboardHome agents={activatedAgents} tasks={tasks} businessUnits={businessUnits} onNavigate={setActiveTab} activeWorkspaceId={activeWorkspaceId} />;
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
    <div className="flex h-screen bg-violet-200 font-nunito text-bitrix-text overflow-hidden">
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
      <main className="flex-1 flex flex-col overflow-hidden relative bg-violet-100">{renderContent()}</main>
    </div>
  );
};

export default App;
