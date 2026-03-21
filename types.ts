
export enum Sender {
  User = 'user',
  Bot = 'bot',
  System = 'system'
}

export type AgentTier = 'ESTRATÉGICO' | 'TÁTICO' | 'OPERACIONAL' | 'CONTROLE';

export type AgentStatus = 'PLANNED' | 'STAGING' | 'ACTIVE' | 'MAINTENANCE' | 'BLOCKED';

export type ModelProvider = 'gemini' | 'deepseek' | 'llama_local' | 'openai' | 'claude' | 'qwen'; // Opções de Cérebro

// V4.2 - Adicionado 'home' como Dashboard Inicial
export type TabId = 'home' | 'ecosystem' | 'team' | 'conversations' | 'management' | 'programmers-room' | 'redir' | 'vault' | 'fabrica-ca' | 'governance' | 'missions' | 'nagi' | 'radar-connections' | 'cid' | 'quality' | 'intelligence-flow' | 'continuous-memory' | 'methodology' | 'hub' | 'alignment' | 'market' | 'sales' | 'expansion' | '3forb-home' | 'audacus-home' | 'startyb-home' | 'requests' | 'unit-room' | 'chat-room' | 'ventures';

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

export interface AgentDnaProfile {
  id: string;
  workspaceId: string;
  agentId: string;
  individualPrompt?: string;
  version: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  payload?: Record<string, any>;
}

export interface AgentDnaEffective {
  id: string;
  workspaceId: string;
  agentId: string;
  effectivePrompt: string;
  profileVersion?: number;
  status: string;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  payload?: Record<string, any>;
}

export type AgentQualityEventType =
  | 'understanding_error'
  | 'scope_error'
  | 'hierarchy_error'
  | 'handoff_error'
  | 'context_error'
  | 'governance_error'
  | 'model_error'
  | 'repetition_error'
  | 'quality_error'
  | 'execution_error'
  | 'correct_handoff'
  | 'correct_escalation'
  | 'strong_response'
  | 'approved_response'
  | 'successful_resolution';

export type AgentQualitySeverity = 'low' | 'medium' | 'high' | 'critical';
export type AgentQualityDetectedBy = 'user' | 'rule' | 'system' | 'auditor';

export interface AgentQualityEvent {
  id: string;
  eventId?: string;
  workspaceId: string;
  ventureId?: string | null;
  conversationId?: string | null;
  turnId?: number | null;
  agentId?: string | null;
  agentName?: string | null;
  eventType: AgentQualityEventType | string;
  eventSubtype?: string;
  severity: AgentQualitySeverity | string;
  detectedBy: AgentQualityDetectedBy | string;
  messageRef?: string;
  excerpt?: string;
  correctionText?: string;
  modelUsed?: string;
  workflowVersion?: string;
  dnaVersion?: string;
  policyVersion?: string;
  status: string;
  createdAt: Date;
  resolvedAt?: Date | null;
  payload?: Record<string, any>;
}

export type IntelligenceFlowType =
  | 'conversation'
  | 'handoff'
  | 'decision'
  | 'task_generation'
  | 'cid_processing'
  | 'agent_orchestration';

export type IntelligenceFlowSourceKind =
  | 'conversation'
  | 'operation'
  | 'quality'
  | 'governance'
  | 'cid'
  | 'n8n';

export type IntelligenceFlowActorType = 'user' | 'agent' | 'system' | 'cid' | 'governance';
export type IntelligenceFlowActionType =
  | 'question'
  | 'analysis'
  | 'response'
  | 'handoff'
  | 'synthesis'
  | 'task_created'
  | 'agenda_created'
  | 'decision_registered'
  | 'knowledge_saved'
  | 'error';
export type IntelligenceFlowStatus = 'pending' | 'running' | 'ok' | 'warning' | 'error' | 'cancelled';

export interface IntelligenceFlowStep {
  id: string;
  actorType: IntelligenceFlowActorType;
  actorName: string;
  actionType: IntelligenceFlowActionType;
  status: IntelligenceFlowStatus;
  timestamp: Date;
  modelUsed?: string;
  note?: string;
}

export interface IntelligenceFlow {
  id: string;
  workspaceId?: string;
  ventureId?: string | null;
  conversationId?: string | null;
  turnId?: number | null;
  executionRunId?: string | null;
  flowType: IntelligenceFlowType;
  origin: string;
  participants: string[];
  steps: IntelligenceFlowStep[];
  finalAction: string;
  status: IntelligenceFlowStatus;
  timestamp: Date;
  sourceKind: IntelligenceFlowSourceKind;
  sourceId?: string;
  payload?: Record<string, any>;
}

export interface IntelligenceFlowStepRow {
  id: string;
  flowId: string;
  workspaceId: string;
  conversationId?: string | null;
  turnId?: number | null;
  stepOrder: number;
  actorType: IntelligenceFlowActorType;
  actorId?: string | null;
  actorName: string;
  actionType: IntelligenceFlowActionType;
  status: IntelligenceFlowStatus;
  modelUsed?: string | null;
  workflowVersion?: string | null;
  policyVersion?: string | null;
  dnaVersion?: string | null;
  latencyMs?: number | null;
  estimatedCost?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  note?: string | null;
  eventTime: Date;
  payload?: Record<string, any>;
  createdAt?: Date;
}

export type AgentMissionStatus = 'queued' | 'running' | 'completed' | 'failed';
export type AgentMissionStepStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed';
export type AgentArtifactStatus = 'created' | 'validated' | 'rejected';
export type AgentHandoffStatus = 'created' | 'accepted' | 'failed';

export interface AgentMission {
  id: string;
  workspaceId: string;
  title: string;
  initialInput: string;
  status: AgentMissionStatus;
  currentStepIndex: number;
  createdBy?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  payload?: Record<string, any>;
}

export interface AgentMissionStep {
  id: string;
  workspaceId: string;
  missionId: string;
  stepIndex: number;
  agentId?: string | null;
  agentName: string;
  stepName: string;
  artifactType: string;
  status: AgentMissionStepStatus;
  validationStatus?: string | null;
  retryCount: number;
  promptSnapshot?: string | null;
  contextSnapshot?: Record<string, any> | null;
  errorMessage?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  payload?: Record<string, any>;
}

export interface AgentArtifact {
  id: string;
  workspaceId: string;
  missionId: string;
  stepId: string;
  artifactType: string;
  status: AgentArtifactStatus;
  version: number;
  contentJson?: Record<string, any> | null;
  contentText?: string | null;
  createdByAgentId?: string | null;
  createdAt: Date;
  payload?: Record<string, any>;
}

export interface AgentHandoff {
  id: string;
  workspaceId: string;
  missionId: string;
  fromStepId: string;
  toStepId?: string | null;
  fromAgentId?: string | null;
  toAgentId?: string | null;
  artifactId?: string | null;
  status: AgentHandoffStatus;
  note?: string | null;
  createdAt: Date;
  acceptedAt?: Date | null;
  payload?: Record<string, any>;
}

export type CidMaterialType = 'Pdf' | 'Doc' | 'Docx' | 'Txt' | 'Spreadsheet' | 'Image' | 'Audio' | 'Video' | 'Other';
export type CidDesiredAction = 'Store only' | 'Store + transcribe' | 'Store + summarize' | 'Store + transcribe + summarize' | 'Store + consolidate';
export type CidStatus = 'Received' | 'Queued' | 'Fragmenting' | 'Processing' | 'Transcribing' | 'Summarizing' | 'Consolidating' | 'Completed' | 'Completed warning' | 'Error' | 'Paused' | 'Cancelled';
export type CidOutputType = 'Extracted text' | 'Transcription' | 'Summary short' | 'Summary long' | 'Consolidation' | 'Keywords';

export interface CidAsset {
  id: string;
  workspaceId: string;
  ventureId?: string | null;
  title: string;
  materialType: CidMaterialType | string;
  area?: string | null;
  project?: string | null;
  sensitivity?: string | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  language?: string | null;
  desiredAction?: CidDesiredAction | string | null;
  sourceKind?: string | null;
  sourceId?: string | null;
  isConsultable?: boolean;
  status: CidStatus | string;
  progressPct?: number;
  totalParts?: number;
  completedParts?: number;
  pendingParts?: number;
  processingStartedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  payload?: Record<string, any>;
}

export interface CidAssetFile {
  id: string;
  assetId: string;
  workspaceId: string;
  bucket?: string;
  path?: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  durationSec?: number | null;
  checksum?: string | null;
  status?: string;
  createdAt: Date;
  updatedAt: Date;
  payload?: Record<string, any>;
}

export interface CidProcessingJob {
  id: string;
  assetId: string;
  workspaceId: string;
  batchId?: string | null;
  jobType: string;
  actionPlan?: Record<string, any>;
  queuePosition?: number | null;
  status: CidStatus | string;
  progressPct?: number;
  totalParts?: number;
  completedParts?: number;
  pendingParts?: number;
  retries?: number;
  maxRetries?: number;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  payload?: Record<string, any>;
}

export interface CidChunk {
  id: string;
  assetId: string;
  jobId?: string | null;
  workspaceId: string;
  chunkIndex: number;
  chunkKind: string;
  charStart?: number | null;
  charEnd?: number | null;
  byteStart?: number | null;
  byteEnd?: number | null;
  timeStartSec?: number | null;
  timeEndSec?: number | null;
  textContent?: string | null;
  status: CidStatus | string;
  retries?: number;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
  payload?: Record<string, any>;
}

export interface CidOutput {
  id: string;
  assetId: string;
  jobId?: string | null;
  workspaceId: string;
  outputType: CidOutputType | string;
  contentText?: string | null;
  contentJson?: Record<string, any> | null;
  language?: string | null;
  version?: number;
  status?: string;
  createdAt: Date;
  updatedAt: Date;
  payload?: Record<string, any>;
}

export interface CidTag {
  id: string;
  workspaceId: string;
  name: string;
  color?: string | null;
  status?: string;
  createdAt: Date;
  updatedAt: Date;
  payload?: Record<string, any>;
}

export interface CidAssetTag {
  id: string;
  workspaceId: string;
  assetId: string;
  tagId: string;
  createdAt: Date;
  payload?: Record<string, any>;
}

export interface CidLink {
  id: string;
  workspaceId: string;
  assetId: string;
  linkType: string;
  linkedId?: string | null;
  linkedLabel?: string | null;
  createdAt: Date;
  payload?: Record<string, any>;
}

export interface CidBatch {
  id: string;
  workspaceId: string;
  ventureId?: string | null;
  title: string;
  source?: string | null;
  status: string;
  totalItems?: number;
  processedItems?: number;
  failedItems?: number;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  payload?: Record<string, any>;
}

export interface CidBatchItem {
  id: string;
  workspaceId: string;
  batchId: string;
  assetId: string;
  status: string;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
  payload?: Record<string, any>;
}

export type ContinuousMemorySessionStatus =
  | 'draft'
  | 'live'
  | 'paused'
  | 'ended'
  | 'processing'
  | 'completed'
  | 'error';

export type ContinuousMemoryCaptureMode = 'microphone' | 'upload' | 'hybrid' | 'system';
export type ContinuousMemoryChunkStatus =
  | 'queued'
  | 'capturing'
  | 'captured'
  | 'uploading'
  | 'stored'
  | 'transcribing'
  | 'classified'
  | 'completed'
  | 'error'
  | 'retrying';
export type ContinuousMemoryTranscriptStatus = 'pending' | 'processing' | 'completed' | 'error' | 'retrying';
export type ContinuousMemoryJobStatus = 'queued' | 'running' | 'completed' | 'completed_warning' | 'error' | 'cancelled' | 'retrying';
export type ContinuousMemoryFileRole =
  | 'session_audio_master'
  | 'chunk_audio_original'
  | 'chunk_audio_cleaned'
  | 'chunk_waveform'
  | 'chunk_transcript_attachment';
export type ContinuousMemoryOutputType =
  | 'transcript'
  | 'summary_session'
  | 'summary_period'
  | 'classification'
  | 'extraction'
  | 'agent_brief'
  | 'timeline_note';
export type ContinuousMemorySourceType = 'system' | 'ai' | 'user' | 'rule';
export type ContinuousMemoryItemType =
  | 'idea'
  | 'task'
  | 'decision'
  | 'insight'
  | 'reminder'
  | 'meeting'
  | 'command'
  | 'observation'
  | 'personal'
  | 'noise'
  | 'objection'
  | 'follow_up'
  | 'question';

export interface ContinuousMemorySession {
  id: string;
  workspaceId: string;
  ventureId?: string | null;
  projectId?: string | null;
  areaId?: string | null;
  sessionDate: Date;
  title: string;
  sourceDevice?: string | null;
  captureMode: ContinuousMemoryCaptureMode | string;
  status: ContinuousMemorySessionStatus | string;
  sensitivityLevel?: string | null;
  allowAgentReading: boolean;
  startedAt?: Date | null;
  endedAt?: Date | null;
  totalChunks: number;
  totalDurationSeconds: number;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  payload?: Record<string, any>;
}

export interface ContinuousMemoryChunk {
  id: string;
  sessionId: string;
  workspaceId: string;
  ventureId?: string | null;
  projectId?: string | null;
  chunkIndex: number;
  startedAt?: Date | null;
  endedAt?: Date | null;
  durationSeconds: number;
  status: ContinuousMemoryChunkStatus | string;
  transcriptStatus: ContinuousMemoryTranscriptStatus | string;
  transcriptText?: string | null;
  transcriptConfidence?: number | null;
  detectedLanguage?: string | null;
  noiseScore?: number | null;
  importanceFlag?: boolean;
  anchorFlag?: boolean;
  sourceContext?: string | null;
  createdAt: Date;
  updatedAt: Date;
  errorMessage?: string | null;
  payload?: Record<string, any>;
}

export interface ContinuousMemoryFile {
  id: string;
  workspaceId: string;
  sessionId: string;
  chunkId?: string | null;
  fileRole: ContinuousMemoryFileRole | string;
  storageBucket: string;
  storagePath: string;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  checksum?: string | null;
  durationSeconds?: number | null;
  createdAt: Date;
  payload?: Record<string, any>;
}

export interface ContinuousMemoryJob {
  id: string;
  workspaceId: string;
  sessionId?: string | null;
  chunkId?: string | null;
  jobType: string;
  jobStatus: ContinuousMemoryJobStatus | string;
  processorType?: string | null;
  processorName?: string | null;
  priority?: number | null;
  attemptCount?: number;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  latencyMs?: number | null;
  estimatedCost?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  workflowVersion?: string | null;
  policyVersion?: string | null;
  statusNote?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
  payload?: Record<string, any>;
}

export interface ContinuousMemoryOutput {
  id: string;
  workspaceId: string;
  sessionId: string;
  chunkId?: string | null;
  outputType: ContinuousMemoryOutputType | string;
  content: string;
  version?: number;
  generatedBy?: string | null;
  createdAt: Date;
  payload?: Record<string, any>;
}

export interface ContinuousMemoryLabel {
  id: string;
  workspaceId?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  createdAt: Date;
  payload?: Record<string, any>;
}

export interface ContinuousMemoryChunkLabel {
  id: string;
  workspaceId: string;
  chunkId: string;
  labelId: string;
  confidenceScore?: number | null;
  sourceType: ContinuousMemorySourceType | string;
  createdAt: Date;
}

export interface ContinuousMemoryExtractedItem {
  id: string;
  workspaceId: string;
  sessionId: string;
  chunkId: string;
  itemType: ContinuousMemoryItemType | string;
  title: string;
  content: string;
  priority?: string | null;
  status?: string | null;
  suggestedVentureId?: string | null;
  suggestedProjectId?: string | null;
  suggestedAgentId?: string | null;
  createdAt: Date;
  reviewedAt?: Date | null;
  payload?: Record<string, any>;
}

export interface ContinuousMemoryLink {
  id: string;
  workspaceId: string;
  sessionId: string;
  chunkId?: string | null;
  extractedItemId?: string | null;
  linkType: string;
  linkedEntityId?: string | null;
  createdAt: Date;
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
  dnaIndividualPrompt?: string;
  effectivePrompt?: string;

  // Campos Estendidos (Visualização de Lista)
  division?: string;
  collaboratorType?: string;
  salary?: string;
  startDate?: string;
  docCount?: number;

  // Cadastro Estrutural (Quadro de Elite v2)
  entityType?: 'HUMANO' | 'AGENTE' | 'HIBRIDO';
  shortDescription?: string;
  origin?: string;
  unitName?: string;
  area?: string;
  functionName?: string;
  baseRoleUniversal?: string;
  roleType?: 'LIDERANCA' | 'CONSULTORIA' | 'AUDITORIA' | 'EXECUCAO' | 'MENTORIA' | 'APOIO';
  structuralStatus?: 'ESTRUTURAL' | 'EM_CONFIGURACAO' | 'HOMOLOGACAO' | 'ATIVO' | 'ARQUIVADO';
  operationalActivation?: 'ATIVO_NASCIMENTO' | 'PREVISTO_GATILHO' | 'RESERVADO_FUTURO' | 'COMPARTILHADO';
  dnaStatus?: 'SEM_DNA' | 'DNA_BASE' | 'DNA_PARCIAL' | 'DNA_COMPLETO' | 'REVISAR';
  operationalClass?: 'ECONOMICA' | 'BALANCEADA' | 'PREMIUM' | 'CRITICA';
  allowedStacks?: ModelProvider[];
  preferredModel?: ModelProvider;
  aiMentor?: string;
  humanOwner?: string;
  customFields?: Record<string, string>;

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

