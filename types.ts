
export enum Sender {
  User = 'user',
  Bot = 'bot',
  System = 'system'
}

export type AgentTier = 'ESTRATÉGICO' | 'TÁTICO' | 'OPERACIONAL' | 'CONTROLE';

export type AgentStatus = 'PLANNED' | 'STAGING' | 'ACTIVE' | 'MAINTENANCE' | 'BLOCKED';

export type ModelProvider = 'gemini' | 'deepseek'; // NOVO: Opções de Cérebro

// V4.2 - Adicionado 'home' como Dashboard Inicial
export type TabId = 'home' | 'ecosystem' | 'team' | 'conversations' | 'management' | 'redir' | 'vault' | 'fabrica-ca' | 'governance' | 'methodology' | 'hub' | 'alignment' | 'market' | 'sales' | 'expansion' | '3forb-home' | 'audacus-home' | 'startyb-home' | 'requests' | 'unit-room' | 'chat-room';

export type BUType = 'CORE' | 'VENTURY' | 'PERSONAL' | 'METHODOLOGY';

export interface BusinessBlueprint {
  mission?: string;
  valueProposition?: string;
  targetAudience?: string;
  revenueModel?: string;
  roiExpectation?: string;
}

export interface BusinessUnit {
  id: string;
  name: string;
  logo?: string;
  themeColor: string;
  description: string;
  type: BUType;
  idNumber?: string;
  parentId?: string;
  sigla?: string;
}

export interface Decision {
  id: string;
  agentName: string;
  agentRole: string;
  text: string;
  timestamp: Date;
  buId: string;
}

export interface Topic {
  id: string;
  title: string;
  description?: string;
  status: 'Pendente' | 'Em Pauta' | 'Resolvido';
  priority: 'Alta' | 'Média' | 'Baixa';
  timestamp: Date;
  buId: string;
  assignee?: string; // Novo: Responsável
  dueDate?: string; // Novo: Prazo
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'doing' | 'done';
  assignee?: string;
  createdAt: Date;
  dueDate?: Date; // Novo campo para data de entrega
}

export interface Agent {
  id: string; // ID Local React (UUID)
  universalId?: string; // ID Oficial SAGB (ex: ca001gpb)
  name: string;
  version: string;
  company: string;
  buId: string;
  officialRole: string;
  fullPrompt: string;
  active: boolean; // Mantido para compatibilidade
  status: AgentStatus; // Fonte da verdade do ciclo de vida
  sector: string;
  tier: AgentTier;
  knowledgeBase?: string[]; // Memória de Sessão (Legado)

  // RAG & LEARNING (V1.8)
  globalDocuments?: { id: string, title: string, content: string, tags: string[] }[]; // Biblioteca do Agente
  learnedMemory?: string[]; // Fatos aprendidos e consolidados ao longo do tempo

  // Campos Estendidos (Visualização de Lista)
  division?: string;
  collaboratorType?: string;
  salary?: string;
  startDate?: string;
  docCount?: number;

  // V2.0 - IDENTIDADE VISUAL OBRIGATÓRIA
  avatarUrl?: string; // Base64 Image Data (Face/Rosto)
  ambientPhotoUrl?: string; // Base64 Image Data (Ambiente)

  // V2.1 - MULTI-MODELO (CÉREBRO)
  modelProvider?: ModelProvider; // 'gemini' | 'deepseek'
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
  buId: string;
  isStreaming?: boolean;
  isDecision?: boolean;
  participantName?: string;
  attachment?: { data: string, mimeType: string, preview: string };
}

export interface PersonaConfig {
  id: string;
  name: string;
  baseRole: string;
  tier: AgentTier;
  contextInfo: string;
  tone: string;
  welcomeMessage: string;
  avatarColor: string;
  imageUrl?: string;
}

export interface MeetingState {
  isActive: boolean;
  participants: (Agent | PersonaConfig)[];
  activeSpeakerId: string | null;
}

export interface UserProfile {
  uid: string;
  email: string; // Adicionado para referência
  name: string;
  nickname: string;
  role: string;
  company: string;
  avatarUrl?: string;
  tier: AgentTier;
  createdAt: Date;
}
