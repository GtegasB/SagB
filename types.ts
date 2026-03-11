
export enum Sender {
  User = 'user',
  Bot = 'bot',
  System = 'system'
}

export type AgentTier = 'ESTRATÉGICO' | 'TÁTICO' | 'OPERACIONAL' | 'CONTROLE';

export type AgentStatus = 'PLANNED' | 'STAGING' | 'ACTIVE' | 'MAINTENANCE' | 'BLOCKED';

export type ModelProvider = 'gemini' | 'deepseek' | 'llama_local' | 'openai' | 'claude' | 'qwen'; // Opções de Cérebro

// V4.2 - Adicionado 'home' como Dashboard Inicial
export type TabId = 'home' | 'ecosystem' | 'team' | 'conversations' | 'management' | 'redir' | 'vault' | 'fabrica-ca' | 'governance' | 'methodology' | 'hub' | 'alignment' | 'market' | 'sales' | 'expansion' | '3forb-home' | 'audacus-home' | 'startyb-home' | 'requests' | 'unit-room' | 'chat-room' | 'ventures';

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

export interface Venture {
  id: string;
  name: string;
  logo: string; // Obrigatório v1.5.0
  status: 'IDEIA' | 'DESENVOLVIMENTO' | 'APROVADO';
  type: 'Marca' | 'Projeto';
  statusLab: 'Pendente' | 'Validado' | 'Próximo Teste';
  niche?: string;
  segment?: string;
  sphere?: string;
  url?: string; // NOVO v1.5.1: Link para o sistema externo
  timestamp: Date;
}

export interface GovernanceCulture {
  id: string;
  workspaceId: string;
  title: string;
  summary?: string;
  contentMd: string;
  version: number;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  payload?: Record<string, any>;
}

export interface ComplianceRule {
  id: string;
  workspaceId: string;
  code: string;
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  scope: 'global' | 'product' | 'repo' | 'environment';
  subject?: string;
  ruleMd: string;
  version: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  payload?: Record<string, any>;
}

export interface VaultItem {
  id: string;
  workspaceId: string;
  name: string;
  provider: string;
  env: string;
  itemType: string;
  ownerEmail?: string;
  storagePath?: string;
  secretRef?: string;
  rotatePolicy?: string;
  lastRotatedAt?: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  payload?: Record<string, any>;
}

export interface KnowledgeNode {
  id: string;
  workspaceId: string;
  parentId?: string | null;
  nodeType: 'folder' | 'doc' | 'link';
  slug?: string;
  title: string;
  contentMd?: string;
  linkUrl?: string;
  orderIndex: number;
  version: number;
  visibility: 'internal' | 'restricted' | 'public';
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  payload?: Record<string, any>;
}

export interface KnowledgeAttachment {
  id: string;
  workspaceId: string;
  nodeId: string;
  bucket: string;
  path: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  version: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  payload?: Record<string, any>;
}

export interface AgentMemory {
  id: string;
  workspaceId: string;
  agentId: string;
  sessionId?: string | null;
  memoryType: 'learning' | 'fact' | 'preference' | 'constraint' | 'summary';
  content: string;
  confidence?: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  payload?: Record<string, any>;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'staff' | 'viewer';
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  payload?: Record<string, any>;
}

export interface Agent {

  id: string; // ID Local React (UUID)
  universalId?: string; // ID Oficial SAGB (ex: ca001gpb)
  name: string;
  version: string;
  company: string;
  buId?: string; // Tornando opcional na v1.5.0 (migração para Ventures)
  ventureId?: string; // Novo: Link com a Venture vinculada
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
  modelProvider?: ModelProvider; // 'gemini' | 'deepseek' | 'llama_local' | 'openai' | 'claude' | 'qwen'
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
  attachment?: { data: string, mimeType: string, preview: string, name?: string, sizeBytes?: number };
  attachments?: { data: string, mimeType: string, preview: string, name?: string, sizeBytes?: number }[];
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
  workspaceId?: string;
  avatarUrl?: string;
  tier: AgentTier;
  createdAt: Date;
}

