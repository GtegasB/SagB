import {
  addDoc,
  collection,
  db,
  doc,
  updateDoc
} from './supabase';
import { transcribeAudio } from './gemini';
import {
  ContinuousMemoryChunk,
  ContinuousMemoryChunkLabel,
  ContinuousMemoryExtractedItem,
  ContinuousMemoryFile,
  ContinuousMemoryJob,
  ContinuousMemoryLabel,
  ContinuousMemoryLink,
  ContinuousMemoryOutput,
  ContinuousMemorySession
} from '../types';
import { resolveWorkspaceId } from '../utils/supabaseChat';

export type ContinuousMemoryPersistenceMode = 'remote' | 'local';

type ContinuousMemoryLocalStore = {
  sessions: ContinuousMemorySession[];
  chunks: ContinuousMemoryChunk[];
  files: ContinuousMemoryFile[];
  jobs: ContinuousMemoryJob[];
  outputs: ContinuousMemoryOutput[];
  labels: ContinuousMemoryLabel[];
  chunkLabels: ContinuousMemoryChunkLabel[];
  extractedItems: ContinuousMemoryExtractedItem[];
  links: ContinuousMemoryLink[];
};

type StartSessionParams = {
  mode: ContinuousMemoryPersistenceMode;
  workspaceId?: string | null;
  ventureId?: string | null;
  projectId?: string | null;
  areaId?: string | null;
  title: string;
  sourceDevice?: string | null;
  captureMode?: string;
  sensitivityLevel?: string;
  allowAgentReading?: boolean;
  createdBy?: string | null;
  payload?: Record<string, any>;
};

type UpdateSessionParams = {
  mode: ContinuousMemoryPersistenceMode;
  workspaceId?: string | null;
  sessionId: string;
  patch: Partial<ContinuousMemorySession>;
};

type IngestChunkParams = {
  mode: ContinuousMemoryPersistenceMode;
  workspaceId?: string | null;
  session: ContinuousMemorySession;
  chunkIndex: number;
  startedAt: Date;
  endedAt: Date;
  audioBlob: Blob;
  mimeType?: string;
  labelLookup?: Record<string, string>;
  skipSessionRollup?: boolean;
};

type RetryChunkParams = {
  mode: ContinuousMemoryPersistenceMode;
  workspaceId?: string | null;
  session: ContinuousMemorySession;
  chunk: ContinuousMemoryChunk;
  file?: ContinuousMemoryFile | null;
  labelLookup?: Record<string, string>;
  currentTranscriptVersion?: number;
};

type ChunkSignalItem = {
  itemType: string;
  title: string;
  content: string;
  priority: string;
};

type ChunkSignalAnalysis = {
  labels: Array<{ name: string; confidenceScore: number; sourceType: 'rule' | 'system' }>;
  items: ChunkSignalItem[];
  importanceFlag: boolean;
  anchorFlag: boolean;
  noiseScore: number;
};

const LOCAL_STORAGE_SESSION_KEY = 'sagb_supabase_session_v1';
const LOCAL_STORE_PREFIX = 'sagb_continuous_memory_v1';
const LOCAL_AUDIO_DB_NAME = 'sagb_continuous_memory_audio_v1';
const LOCAL_AUDIO_DB_VERSION = 1;
const LOCAL_AUDIO_STORE = 'audio_blobs';
const LOCAL_INLINE_AUDIO_MAX_BYTES = 350_000;
export const CONTINUOUS_MEMORY_BUCKET = 'continuous-memory';
export const DEFAULT_CHUNK_MINUTES = 3;
export const CONTINUOUS_MEMORY_LABEL_SEED: Array<Pick<ContinuousMemoryLabel, 'name' | 'description' | 'color'>> = [
  { name: 'idea', description: 'Ideia capturada na fala espontanea.', color: '#1d4ed8' },
  { name: 'task', description: 'Acao executavel ou encaminhamento.', color: '#047857' },
  { name: 'decision', description: 'Decisao tomada ou confirmada.', color: '#b45309' },
  { name: 'insight', description: 'Insight relevante para leitura futura.', color: '#7c3aed' },
  { name: 'reminder', description: 'Lembrete operacional.', color: '#0f766e' },
  { name: 'meeting', description: 'Trecho de reuniao ou alinhamento.', color: '#475569' },
  { name: 'command', description: 'Comando explicito.', color: '#be123c' },
  { name: 'observation', description: 'Observacao contextual.', color: '#4338ca' },
  { name: 'personal', description: 'Memoria pessoal ou subjetiva.', color: '#6b7280' },
  { name: 'noise', description: 'Ruido, silencio ou baixa relevancia.', color: '#9ca3af' },
  { name: 'objection', description: 'Objeção ou resistencia registrada.', color: '#dc2626' },
  { name: 'follow_up', description: 'Pendencia de acompanhamento.', color: '#0ea5e9' },
  { name: 'question', description: 'Pergunta aberta.', color: '#2563eb' }
];

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const makeId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const ensureArray = <T,>(value: any): T[] => Array.isArray(value) ? value as T[] : [];
const buildLocalStorageKey = (workspaceId?: string | null) => `${LOCAL_STORE_PREFIX}:${resolveWorkspaceId(workspaceId)}`;

const buildLabelSeedRows = (): ContinuousMemoryLabel[] => CONTINUOUS_MEMORY_LABEL_SEED.map((label) => ({
  id: makeId(),
  workspaceId: null,
  name: label.name,
  description: label.description,
  color: label.color,
  createdAt: new Date(),
  payload: { seed: true }
}));

const emptyStore = (): ContinuousMemoryLocalStore => ({
  sessions: [],
  chunks: [],
  files: [],
  jobs: [],
  outputs: [],
  labels: buildLabelSeedRows(),
  chunkLabels: [],
  extractedItems: [],
  links: []
});

const hydrateStore = (raw: any): ContinuousMemoryLocalStore => {
  const base = emptyStore();
  const store = raw && typeof raw === 'object' ? raw : {};
  return {
    sessions: ensureArray<any>(store.sessions).map((row) => ({
      ...row,
      sessionDate: toDate(row.sessionDate),
      startedAt: row.startedAt ? toDate(row.startedAt) : null,
      endedAt: row.endedAt ? toDate(row.endedAt) : null,
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt)
    })),
    chunks: ensureArray<any>(store.chunks).map((row) => ({
      ...row,
      startedAt: row.startedAt ? toDate(row.startedAt) : null,
      endedAt: row.endedAt ? toDate(row.endedAt) : null,
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt)
    })),
    files: ensureArray<any>(store.files).map((row) => ({ ...row, createdAt: toDate(row.createdAt) })),
    jobs: ensureArray<any>(store.jobs).map((row) => ({
      ...row,
      startedAt: row.startedAt ? toDate(row.startedAt) : null,
      finishedAt: row.finishedAt ? toDate(row.finishedAt) : null,
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt)
    })),
    outputs: ensureArray<any>(store.outputs).map((row) => ({ ...row, createdAt: toDate(row.createdAt) })),
    labels: (() => {
      const labels = ensureArray<any>(store.labels).map((row) => ({ ...row, createdAt: toDate(row.createdAt) }));
      return labels.length > 0 ? labels : base.labels;
    })(),
    chunkLabels: ensureArray<any>(store.chunkLabels).map((row) => ({ ...row, createdAt: toDate(row.createdAt) })),
    extractedItems: ensureArray<any>(store.extractedItems).map((row) => ({
      ...row,
      createdAt: toDate(row.createdAt),
      reviewedAt: row.reviewedAt ? toDate(row.reviewedAt) : null
    })),
    links: ensureArray<any>(store.links).map((row) => ({ ...row, createdAt: toDate(row.createdAt) }))
  };
};

const readLocalStore = (workspaceId?: string | null): ContinuousMemoryLocalStore => {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = window.localStorage.getItem(buildLocalStorageKey(workspaceId));
    if (!raw) return emptyStore();
    return hydrateStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
};

const writeLocalStore = (workspaceId: string, store: ContinuousMemoryLocalStore) => {
  if (typeof window === 'undefined') return;
  const key = buildLocalStorageKey(workspaceId);
  try {
    window.localStorage.setItem(key, JSON.stringify(store));
  } catch (error: any) {
    const compactedStore: ContinuousMemoryLocalStore = {
      ...store,
      files: store.files.map((file) => {
        const payload = file.payload && typeof file.payload === 'object' ? { ...file.payload } : {};
        if ('inlineBase64' in payload) {
          delete payload.inlineBase64;
          payload.storageWarning = String(payload.storageWarning || 'Audio inline removido para aliviar a cota local do navegador.');
          payload.storageMode = payload.localBlobKey ? 'browser_indexeddb' : (payload.storageMode || 'browser_compacted');
        }
        return { ...file, payload };
      })
    };

    window.localStorage.setItem(key, JSON.stringify(compactedStore));
    if (error?.name) {
      console.warn(`Local store compactado apos erro de quota (${error.name}).`);
    }
  }
};

const openLocalAudioDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    reject(new Error('IndexedDB indisponivel neste navegador.'));
    return;
  }

  const request = indexedDB.open(LOCAL_AUDIO_DB_NAME, LOCAL_AUDIO_DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(LOCAL_AUDIO_STORE)) {
      db.createObjectStore(LOCAL_AUDIO_STORE);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Falha ao abrir IndexedDB do audio local.'));
});

const persistLocalAudioBlob = async (key: string, blob: Blob) => {
  const db = await openLocalAudioDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LOCAL_AUDIO_STORE, 'readwrite');
    const store = tx.objectStore(LOCAL_AUDIO_STORE);
    const request = store.put(blob, key);

    request.onerror = () => reject(request.error || new Error('Falha ao salvar audio local no IndexedDB.'));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Falha ao concluir persistencia do audio local.'));
    tx.onabort = () => reject(tx.error || new Error('Persistencia do audio local abortada.'));
  }).finally(() => db.close());
};

const readLocalAudioBlob = async (key: string): Promise<Blob | null> => {
  const db = await openLocalAudioDb();
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(LOCAL_AUDIO_STORE, 'readonly');
    const store = tx.objectStore(LOCAL_AUDIO_STORE);
    const request = store.get(key);

    request.onsuccess = () => resolve((request.result as Blob | undefined) || null);
    request.onerror = () => reject(request.error || new Error('Falha ao ler audio local do IndexedDB.'));
    tx.oncomplete = () => db.close();
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error('Leitura do audio local abortada.'));
    };
  });
};

const mutateLocalStore = <T,>(workspaceId: string, mutator: (store: ContinuousMemoryLocalStore) => T): T => {
  const store = readLocalStore(workspaceId);
  const result = mutator(store);
  writeLocalStore(workspaceId, store);
  return result;
};

export const loadContinuousMemoryLocalState = (workspaceId?: string | null) => {
  const scopedWorkspaceId = resolveWorkspaceId(workspaceId);
  return readLocalStore(scopedWorkspaceId);
};

export const compactContinuousMemoryLocalAudio = async (workspaceId?: string | null) => {
  if (typeof window === 'undefined') return false;

  const scopedWorkspaceId = resolveWorkspaceId(workspaceId);
  const store = readLocalStore(scopedWorkspaceId);
  let mutated = false;

  const migratedFiles = await Promise.all(store.files.map(async (file) => {
    const payload = file.payload && typeof file.payload === 'object' ? { ...file.payload } : {};
    const inlineBase64 = String(payload.inlineBase64 || '');
    if (!inlineBase64) return file;

    const localBlobKey = String(payload.localBlobKey || file.storagePath || `legacy/${file.id}`);
    try {
      await persistLocalAudioBlob(localBlobKey, base64ToBlob(inlineBase64, String(file.mimeType || 'audio/webm')));
      delete payload.inlineBase64;
      payload.localBlobKey = localBlobKey;
      payload.storageMode = 'browser_indexeddb';
      payload.migratedFromInline = true;
      mutated = true;
      return { ...file, payload };
    } catch (error: any) {
      payload.storageWarning = String(error?.message || 'Falha ao migrar audio local legado para IndexedDB.');
      return { ...file, payload };
    }
  }));

  if (!mutated) return false;

  writeLocalStore(scopedWorkspaceId, {
    ...store,
    files: migratedFiles
  });
  return true;
};

const getAccessToken = () => {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return String(parsed?.access_token || '');
  } catch {
    return '';
  }
};

const deriveExtension = (mimeType?: string) => {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('mp4')) return 'mp4';
  if (normalized.includes('mpeg')) return 'mp3';
  if (normalized.includes('ogg')) return 'ogg';
  return 'webm';
};

const padChunkIndex = (value: number) => String(value).padStart(4, '0');

const sessionDatePath = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

export const buildContinuousMemoryStoragePath = (params: {
  workspaceId: string;
  sessionId: string;
  sessionDate: Date;
  chunkIndex: number;
  mimeType?: string;
}) => {
  const ext = deriveExtension(params.mimeType);
  return `${params.workspaceId}/${sessionDatePath(params.sessionDate)}/${params.sessionId}/audio/chunk-${padChunkIndex(params.chunkIndex)}-original.${ext}`;
};

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao converter audio.'));
    reader.readAsDataURL(blob);
  });
  return dataUrl.split(',')[1] || '';
};

const base64ToBlob = (base64Audio: string, mimeType: string) => {
  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || 'audio/webm' });
};

const sha256 = async (blob: Blob) => {
  const buffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash)).map((x) => x.toString(16).padStart(2, '0')).join('');
};

const buildStorageHeaders = (mimeType?: string) => {
  const token = getAccessToken();
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${token || supabaseAnonKey}`,
    'Content-Type': mimeType || 'application/octet-stream',
    'x-upsert': 'true'
  };
};

const uploadBlobToStorage = async (params: {
  bucket: string;
  path: string;
  blob: Blob;
  mimeType?: string;
}) => {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase storage indisponivel: variaveis de ambiente ausentes.');

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${params.bucket}/${params.path}`, {
    method: 'POST',
    headers: buildStorageHeaders(params.mimeType),
    body: params.blob
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Falha ao enviar audio para storage (${response.status}).`);
  }
};

const downloadBlobFromStorage = async (params: {
  bucket: string;
  path: string;
}) => {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase storage indisponivel: variaveis de ambiente ausentes.');

  const token = getAccessToken();
  const response = await fetch(`${supabaseUrl}/storage/v1/object/authenticated/${params.bucket}/${params.path}`, {
    method: 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token || supabaseAnonKey}`
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Falha ao baixar audio do storage (${response.status}).`);
  }

  return response.blob();
};

const splitSentences = (value: string) => {
  return String(value || '')
    .split(/[\n\r]+|(?<=[.!?;:])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 5);
};

const compactTitle = (value: string, max = 72) => {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3).trimEnd()}...`;
};

const inferSignals = (transcript: string): ChunkSignalAnalysis => {
  const text = String(transcript || '').trim();
  const sentences = splitSentences(text);
  const labels = new Map<string, { confidenceScore: number; sourceType: 'rule' | 'system' }>();
  const items: ChunkSignalItem[] = [];

  const addLabel = (name: string, confidenceScore: number, sourceType: 'rule' | 'system' = 'rule') => {
    const existing = labels.get(name);
    if (!existing || confidenceScore > existing.confidenceScore) labels.set(name, { confidenceScore, sourceType });
  };

  const pushItem = (itemType: string, content: string, priority = 'medium') => {
    if (!content || items.length >= 6) return;
    items.push({ itemType, title: compactTitle(content), content, priority });
  };

  if (!text) {
    addLabel('noise', 0.96);
    return { labels: Array.from(labels.entries()).map(([name, meta]) => ({ name, ...meta })), items, importanceFlag: false, anchorFlag: false, noiseScore: 0.98 };
  }

  if (text.length < 24 || sentences.length === 0) addLabel('noise', 0.64);
  if (/[?]/.test(text)) addLabel('question', 0.81);
  if (/(ideia|pensei|podemos criar|seria bom|talvez)/i.test(text)) addLabel('idea', 0.88);
  if (/(precisa|precisamos|fazer|enviar|ligar|agendar|executar|entregar|subir|publicar)/i.test(text)) addLabel('task', 0.86);
  if (/(decidimos|decis[aã]o|aprovado|vamos seguir|ficou combinado)/i.test(text)) addLabel('decision', 0.9);
  if (/(insight|percebi|aprendi|ficou claro|entendi melhor)/i.test(text)) addLabel('insight', 0.84);
  if (/(lembra|lembrar|nao esquecer|anota|recordar)/i.test(text)) addLabel('reminder', 0.8);
  if (/(reuni[aã]o|call|alinhamento|conversa com|com o time)/i.test(text)) addLabel('meeting', 0.71);
  if (/(fa[çc]a|rode|abra|manda|acione|registre)/i.test(text)) addLabel('command', 0.77);
  if (/(observei|observa[cç][aã]o|notei|aconteceu)/i.test(text)) addLabel('observation', 0.73);
  if (/(pessoal|meu|minha|eu sinto|eu preciso)/i.test(text)) addLabel('personal', 0.62);
  if (/(obje[cç][aã]o|discordo|resist[eê]ncia|barreira|impedimento)/i.test(text)) addLabel('objection', 0.79);
  if (/(follow-up|follow up|retomar|cobrar|acompanhar|voltar nisso)/i.test(text)) addLabel('follow_up', 0.82);

  sentences.forEach((sentence) => {
    if (/(ideia|pensei|podemos criar|seria bom|talvez)/i.test(sentence)) pushItem('idea', sentence, 'medium');
    if (/(precisa|precisamos|fazer|enviar|ligar|agendar|executar|entregar|subir|publicar)/i.test(sentence)) pushItem('task', sentence, 'high');
    if (/(decidimos|decis[aã]o|aprovado|vamos seguir|ficou combinado)/i.test(sentence)) pushItem('decision', sentence, 'high');
    if (/(insight|percebi|aprendi|ficou claro|entendi melhor)/i.test(sentence)) pushItem('insight', sentence, 'medium');
    if (/(follow-up|follow up|retomar|cobrar|acompanhar|voltar nisso)/i.test(sentence)) pushItem('follow_up', sentence, 'medium');
    if (/[?]/.test(sentence)) pushItem('question', sentence, 'medium');
    if (/(obje[cç][aã]o|discordo|resist[eê]ncia|barreira|impedimento)/i.test(sentence)) pushItem('objection', sentence, 'medium');
    if (/(lembra|lembrar|nao esquecer|anota|recordar)/i.test(sentence)) pushItem('reminder', sentence, 'medium');
  });

  if (labels.size === 0) addLabel('observation', 0.58, 'system');

  return {
    labels: Array.from(labels.entries()).map(([name, meta]) => ({ name, ...meta })),
    items,
    importanceFlag: /(decidimos|aprovado|precisa|urgente|prioridade|importante|estrat[eé]gico)/i.test(text),
    anchorFlag: /(decidimos|aprovado|follow-up|follow up|pr[oó]ximo passo|n[aã]o esquecer)/i.test(text),
    noiseScore: Math.max(0.02, Math.min(0.92, text.length < 30 ? 0.54 : labels.has('noise') ? 0.46 : 0.14))
  };
};

const persistLocalInsert = <T extends { id: string }>(
  workspaceId: string,
  key: keyof ContinuousMemoryLocalStore,
  row: T
) => mutateLocalStore(workspaceId, (store) => {
  const target = store[key] as T[];
  target.push(row);
  return row;
});

const persistLocalUpdate = <T extends { id: string }>(
  workspaceId: string,
  key: keyof ContinuousMemoryLocalStore,
  id: string,
  patch: Partial<T>
) => mutateLocalStore(workspaceId, (store) => {
  const target = store[key] as T[];
  const index = target.findIndex((item) => item.id === id);
  if (index >= 0) target[index] = { ...target[index], ...patch };
  return index >= 0 ? target[index] : null;
});

export const startContinuousMemorySession = async (params: StartSessionParams): Promise<ContinuousMemorySession> => {
  const workspaceId = resolveWorkspaceId(params.workspaceId);
  const now = new Date();
  const session: ContinuousMemorySession = {
    id: makeId(),
    workspaceId,
    ventureId: params.ventureId || null,
    projectId: params.projectId || null,
    areaId: params.areaId || null,
    sessionDate: now,
    title: params.title,
    sourceDevice: params.sourceDevice || null,
    captureMode: params.captureMode || 'microphone',
    status: 'live',
    sensitivityLevel: params.sensitivityLevel || 'internal',
    allowAgentReading: Boolean(params.allowAgentReading),
    startedAt: now,
    endedAt: null,
    totalChunks: 0,
    totalDurationSeconds: 0,
    createdBy: params.createdBy || null,
    createdAt: now,
    updatedAt: now,
    payload: params.payload || {}
  };

  if (params.mode === 'remote') {
    const ref = await addDoc(collection(db, 'continuous_memory_sessions'), session);
    return { ...session, id: ref.id };
  }

  return persistLocalInsert<ContinuousMemorySession>(workspaceId, 'sessions', session);
};

export const updateContinuousMemorySession = async (params: UpdateSessionParams) => {
  const workspaceId = resolveWorkspaceId(params.workspaceId);
  const payload: Partial<ContinuousMemorySession> = {
    ...params.patch,
    updatedAt: params.patch.updatedAt || new Date()
  };

  if (params.mode === 'remote') {
    await updateDoc(doc(db, 'continuous_memory_sessions', params.sessionId), payload);
    return;
  }

  persistLocalUpdate<ContinuousMemorySession>(workspaceId, 'sessions', params.sessionId, payload);
};

const createJobRecord = (input: Partial<ContinuousMemoryJob> & Pick<ContinuousMemoryJob, 'workspaceId' | 'jobType' | 'jobStatus' | 'createdAt' | 'updatedAt'>): ContinuousMemoryJob => ({
  id: makeId(),
  sessionId: input.sessionId || null,
  chunkId: input.chunkId || null,
  processorType: input.processorType || null,
  processorName: input.processorName || null,
  priority: input.priority ?? 50,
  attemptCount: input.attemptCount ?? 0,
  startedAt: input.startedAt || null,
  finishedAt: input.finishedAt || null,
  latencyMs: input.latencyMs ?? null,
  estimatedCost: input.estimatedCost ?? null,
  tokensIn: input.tokensIn ?? null,
  tokensOut: input.tokensOut ?? null,
  workflowVersion: input.workflowVersion || null,
  policyVersion: input.policyVersion || null,
  statusNote: input.statusNote || null,
  errorMessage: input.errorMessage || null,
  payload: input.payload || {},
  ...input
});

const saveJob = async (mode: ContinuousMemoryPersistenceMode, workspaceId: string, job: ContinuousMemoryJob) => {
  if (mode === 'remote') {
    const ref = await addDoc(collection(db, 'continuous_memory_jobs'), job);
    return { ...job, id: ref.id };
  }
  return persistLocalInsert<ContinuousMemoryJob>(workspaceId, 'jobs', job);
};

const updateJob = async (
  mode: ContinuousMemoryPersistenceMode,
  workspaceId: string,
  jobId: string,
  patch: Partial<ContinuousMemoryJob>
) => {
  if (mode === 'remote') {
    await updateDoc(doc(db, 'continuous_memory_jobs', jobId), { ...patch, updatedAt: patch.updatedAt || new Date() });
    return;
  }
  persistLocalUpdate<ContinuousMemoryJob>(workspaceId, 'jobs', jobId, { ...patch, updatedAt: patch.updatedAt || new Date() });
};

const saveChunk = async (mode: ContinuousMemoryPersistenceMode, workspaceId: string, row: ContinuousMemoryChunk) => {
  if (mode === 'remote') {
    const ref = await addDoc(collection(db, 'continuous_memory_chunks'), row);
    return { ...row, id: ref.id };
  }
  return persistLocalInsert<ContinuousMemoryChunk>(workspaceId, 'chunks', row);
};

const updateChunk = async (
  mode: ContinuousMemoryPersistenceMode,
  workspaceId: string,
  chunkId: string,
  patch: Partial<ContinuousMemoryChunk>
) => {
  if (mode === 'remote') {
    await updateDoc(doc(db, 'continuous_memory_chunks', chunkId), { ...patch, updatedAt: patch.updatedAt || new Date() });
    return;
  }
  persistLocalUpdate<ContinuousMemoryChunk>(workspaceId, 'chunks', chunkId, { ...patch, updatedAt: patch.updatedAt || new Date() });
};

const saveFile = async (mode: ContinuousMemoryPersistenceMode, workspaceId: string, row: ContinuousMemoryFile) => {
  if (mode === 'remote') {
    const ref = await addDoc(collection(db, 'continuous_memory_files'), row);
    return { ...row, id: ref.id };
  }
  return persistLocalInsert<ContinuousMemoryFile>(workspaceId, 'files', row);
};

const saveOutput = async (mode: ContinuousMemoryPersistenceMode, workspaceId: string, row: ContinuousMemoryOutput) => {
  if (mode === 'remote') {
    const ref = await addDoc(collection(db, 'continuous_memory_outputs'), row);
    return { ...row, id: ref.id };
  }
  return persistLocalInsert<ContinuousMemoryOutput>(workspaceId, 'outputs', row);
};

const saveChunkLabel = async (mode: ContinuousMemoryPersistenceMode, workspaceId: string, row: ContinuousMemoryChunkLabel) => {
  if (mode === 'remote') {
    const ref = await addDoc(collection(db, 'continuous_memory_chunk_labels'), row);
    return { ...row, id: ref.id };
  }
  return persistLocalInsert<ContinuousMemoryChunkLabel>(workspaceId, 'chunkLabels', row);
};

const saveExtractedItem = async (mode: ContinuousMemoryPersistenceMode, workspaceId: string, row: ContinuousMemoryExtractedItem) => {
  if (mode === 'remote') {
    const ref = await addDoc(collection(db, 'continuous_memory_extracted_items'), row);
    return { ...row, id: ref.id };
  }
  return persistLocalInsert<ContinuousMemoryExtractedItem>(workspaceId, 'extractedItems', row);
};

const saveLink = async (mode: ContinuousMemoryPersistenceMode, workspaceId: string, row: ContinuousMemoryLink) => {
  if (mode === 'remote') {
    const ref = await addDoc(collection(db, 'continuous_memory_links'), row);
    return { ...row, id: ref.id };
  }
  return persistLocalInsert<ContinuousMemoryLink>(workspaceId, 'links', row);
};

const loadBase64FromFileRecord = async (mode: ContinuousMemoryPersistenceMode, file?: ContinuousMemoryFile | null) => {
  if (!file) throw new Error('Audio do bloco nao encontrado.');
  const mimeType = String(file.mimeType || 'audio/webm');

  if (mode === 'local') {
    const localBlobKey = String(file.payload?.localBlobKey || '');
    if (localBlobKey) {
      const localBlob = await readLocalAudioBlob(localBlobKey);
      if (localBlob) {
        return {
          base64Audio: await blobToBase64(localBlob),
          mimeType: localBlob.type || mimeType
        };
      }
    }
    const inlineBase64 = String(file.payload?.inlineBase64 || '');
    if (!inlineBase64) throw new Error('Audio local nao disponivel para reprocessamento.');
    return { base64Audio: inlineBase64, mimeType };
  }

  const blob = await downloadBlobFromStorage({
    bucket: file.storageBucket || CONTINUOUS_MEMORY_BUCKET,
    path: file.storagePath
  });
  return {
    base64Audio: await blobToBase64(blob),
    mimeType: blob.type || mimeType
  };
};

export const loadContinuousMemoryAudioUrl = async (
  mode: ContinuousMemoryPersistenceMode,
  file?: ContinuousMemoryFile | null
) => {
  const { base64Audio, mimeType } = await loadBase64FromFileRecord(mode, file);
  const blob = base64ToBlob(base64Audio, mimeType);
  return URL.createObjectURL(blob);
};

const persistSessionRollup = async (
  mode: ContinuousMemoryPersistenceMode,
  workspaceId: string,
  session: ContinuousMemorySession,
  durationSeconds: number
) => {
  const patch: Partial<ContinuousMemorySession> = {
    totalChunks: Math.max(Number(session.totalChunks || 0), 0) + 1,
    totalDurationSeconds: Number(session.totalDurationSeconds || 0) + durationSeconds,
    updatedAt: new Date()
  };
  await updateContinuousMemorySession({
    mode,
    workspaceId,
    sessionId: session.id,
    patch
  });
  return patch;
};

export const ingestContinuousMemoryChunk = async (params: IngestChunkParams) => {
  const workspaceId = resolveWorkspaceId(params.workspaceId);
  const now = new Date();
  const processorName = String(import.meta.env.VITE_TRANSCRIBE_PROVIDER || 'gemini_or_local_whisper');
  const mimeType = params.mimeType || params.audioBlob.type || 'audio/webm';
  const durationSeconds = Math.max(1, Math.round((params.endedAt.getTime() - params.startedAt.getTime()) / 1000));
  const base64Audio = await blobToBase64(params.audioBlob);
  const checksum = await sha256(params.audioBlob);

  const chunk = await saveChunk(params.mode, workspaceId, {
    id: makeId(),
    sessionId: params.session.id,
    workspaceId,
    ventureId: params.session.ventureId || null,
    projectId: params.session.projectId || null,
    chunkIndex: params.chunkIndex,
    startedAt: params.startedAt,
    endedAt: params.endedAt,
    durationSeconds,
    status: 'captured',
    transcriptStatus: 'pending',
    transcriptText: '',
    transcriptConfidence: null,
    detectedLanguage: 'pt-BR',
    noiseScore: null,
    importanceFlag: false,
    anchorFlag: false,
    sourceContext: params.session.title,
    createdAt: now,
    updatedAt: now,
    errorMessage: null,
    payload: {
      retentionTemperature: {
        audio: 'cold',
        transcript: 'warm',
        extraction: 'hot'
      }
    }
  });

  const uploadJob = await saveJob(params.mode, workspaceId, createJobRecord({
    workspaceId,
    sessionId: params.session.id,
    chunkId: chunk.id,
    jobType: 'upload_audio',
    jobStatus: 'running',
    processorType: 'storage',
    processorName: 'supabase_storage',
    attemptCount: 1,
    startedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    workflowVersion: 'continuous-memory/v1',
    statusNote: 'Persistindo audio original do chunk.'
  }));

  let fileRecord: ContinuousMemoryFile;
  try {
    const storagePath = buildContinuousMemoryStoragePath({
      workspaceId,
      sessionId: params.session.id,
      sessionDate: toDate(params.session.sessionDate),
      chunkIndex: params.chunkIndex,
      mimeType
    });

    if (params.mode === 'remote') {
      await uploadBlobToStorage({
        bucket: CONTINUOUS_MEMORY_BUCKET,
        path: storagePath,
        blob: params.audioBlob,
        mimeType
      });
    }

    let localFilePayload: Record<string, any> | undefined;
    if (params.mode === 'local') {
      try {
        await persistLocalAudioBlob(storagePath, params.audioBlob);
        localFilePayload = { localBlobKey: storagePath, storageMode: 'browser_indexeddb' };
      } catch (storageError: any) {
        if (params.audioBlob.size <= LOCAL_INLINE_AUDIO_MAX_BYTES) {
          localFilePayload = {
            inlineBase64: base64Audio,
            storageMode: 'browser_local_inline',
            storageWarning: String(storageError?.message || 'IndexedDB indisponivel; usando fallback inline.')
          };
        } else {
          throw new Error(
            `Armazenamento local insuficiente para o audio deste bloco (${Math.round(params.audioBlob.size / 1024)} KB). ` +
            'Aplique o schema oficial no Supabase ou reduza o tempo do chunk.'
          );
        }
      }
    }

    fileRecord = await saveFile(params.mode, workspaceId, {
      id: makeId(),
      workspaceId,
      sessionId: params.session.id,
      chunkId: chunk.id,
      fileRole: 'chunk_audio_original',
      storageBucket: params.mode === 'remote' ? CONTINUOUS_MEMORY_BUCKET : 'browser-local',
      storagePath,
      mimeType,
      fileSizeBytes: params.audioBlob.size,
      checksum,
      durationSeconds,
      createdAt: new Date(),
      payload: params.mode === 'local'
        ? localFilePayload
        : { storageClass: 'cold' }
    });

    await updateChunk(params.mode, workspaceId, chunk.id, { status: 'stored', updatedAt: new Date() });
    await updateJob(params.mode, workspaceId, uploadJob.id, {
      jobStatus: 'completed',
      finishedAt: new Date(),
      updatedAt: new Date(),
      statusNote: 'Audio persistido com sucesso.'
    });
  } catch (error: any) {
    const message = String(error?.message || 'Falha ao persistir audio.');
    await updateChunk(params.mode, workspaceId, chunk.id, {
      status: 'error',
      transcriptStatus: 'error',
      errorMessage: message,
      updatedAt: new Date()
    });
    await updateJob(params.mode, workspaceId, uploadJob.id, {
      jobStatus: 'error',
      finishedAt: new Date(),
      errorMessage: message,
      updatedAt: new Date()
    });
    throw error;
  }

  const transcriptionJobStartedAt = Date.now();
  const transcriptionJob = await saveJob(params.mode, workspaceId, createJobRecord({
    workspaceId,
    sessionId: params.session.id,
    chunkId: chunk.id,
    jobType: 'transcribe_chunk',
    jobStatus: 'running',
    processorType: 'speech_to_text',
    processorName,
    attemptCount: 1,
    startedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    workflowVersion: 'continuous-memory/v1',
    statusNote: 'Transcrevendo chunk de audio.'
  }));

  try {
    await updateChunk(params.mode, workspaceId, chunk.id, {
      status: 'transcribing',
      transcriptStatus: 'processing',
      updatedAt: new Date()
    });

    const transcriptText = String(await transcribeAudio(base64Audio, mimeType, fileRecord.storagePath) || '').trim();
    const signals = inferSignals(transcriptText);
    const transcriptWarning = transcriptText ? null : `Transcricao vazia via ${processorName}. Verifique o audio captado e o Whisper local.`;

    await updateChunk(params.mode, workspaceId, chunk.id, {
      status: 'completed',
      transcriptStatus: transcriptText ? 'completed' : 'error',
      transcriptText,
      transcriptConfidence: transcriptText ? 0.82 : 0.18,
      detectedLanguage: transcriptText ? 'pt-BR' : null,
      noiseScore: signals.noiseScore,
      importanceFlag: signals.importanceFlag,
      anchorFlag: signals.anchorFlag,
      errorMessage: transcriptWarning,
      updatedAt: new Date()
    });

    if (transcriptText) {
      await saveOutput(params.mode, workspaceId, {
        id: makeId(),
        workspaceId,
        sessionId: params.session.id,
        chunkId: chunk.id,
        outputType: 'transcript',
        content: transcriptText,
        version: 1,
        generatedBy: 'continuous_memory.v1.transcribe',
        createdAt: new Date(),
        payload: { detectedLanguage: 'pt-BR', storageTemperature: 'warm' }
      });
    }

    if (signals.labels.length > 0) {
      await saveOutput(params.mode, workspaceId, {
        id: makeId(),
        workspaceId,
        sessionId: params.session.id,
        chunkId: chunk.id,
        outputType: 'classification',
        content: signals.labels.map((item) => `${item.name} (${item.confidenceScore.toFixed(2)})`).join(', '),
        version: 1,
        generatedBy: 'continuous_memory.v1.classification',
        createdAt: new Date(),
        payload: { labels: signals.labels }
      });
    }

    if (signals.items.length > 0) {
      await saveOutput(params.mode, workspaceId, {
        id: makeId(),
        workspaceId,
        sessionId: params.session.id,
        chunkId: chunk.id,
        outputType: 'extraction',
        content: signals.items.map((item) => `${item.itemType}: ${item.title}`).join('\n'),
        version: 1,
        generatedBy: 'continuous_memory.v1.extract',
        createdAt: new Date(),
        payload: { items: signals.items }
      });
    }

    for (const label of signals.labels) {
      const labelId = params.labelLookup?.[label.name];
      if (!labelId) continue;
      await saveChunkLabel(params.mode, workspaceId, {
        id: makeId(),
        workspaceId,
        chunkId: chunk.id,
        labelId,
        confidenceScore: label.confidenceScore,
        sourceType: label.sourceType,
        createdAt: new Date()
      });
    }

    for (const item of signals.items) {
      const extractedItem = await saveExtractedItem(params.mode, workspaceId, {
        id: makeId(),
        workspaceId,
        sessionId: params.session.id,
        chunkId: chunk.id,
        itemType: item.itemType as any,
        title: item.title,
        content: item.content,
        priority: item.priority,
        status: 'open',
        suggestedVentureId: params.session.ventureId || null,
        suggestedProjectId: params.session.projectId || null,
        suggestedAgentId: null,
        createdAt: new Date(),
        reviewedAt: null,
        payload: { storageTemperature: 'hot' }
      });

      if (['task', 'decision', 'follow_up', 'insight'].includes(item.itemType)) {
        await saveLink(params.mode, workspaceId, {
          id: makeId(),
          workspaceId,
          sessionId: params.session.id,
          chunkId: chunk.id,
          extractedItemId: extractedItem.id,
          linkType: item.itemType === 'insight' ? 'cid_candidate' : 'intelligence_flow_candidate',
          linkedEntityId: null,
          createdAt: new Date(),
          payload: { targetModule: item.itemType === 'insight' ? 'cid' : 'intelligence-flow' }
        });
      }
    }

    await updateJob(params.mode, workspaceId, transcriptionJob.id, {
      jobStatus: transcriptText ? 'completed' : 'completed_warning',
      finishedAt: new Date(),
      latencyMs: Date.now() - transcriptionJobStartedAt,
      updatedAt: new Date(),
      statusNote: transcriptText ? 'Transcricao concluida.' : (transcriptWarning || 'Chunk finalizado com transcricao vazia.')
    });

    const sessionPatch = params.skipSessionRollup
      ? null
      : await persistSessionRollup(params.mode, workspaceId, params.session, durationSeconds);
    return { chunkId: chunk.id, fileId: fileRecord.id, sessionPatch };
  } catch (error: any) {
    const message = String(error?.message || 'Falha ao transcrever chunk.');
    await updateChunk(params.mode, workspaceId, chunk.id, {
      status: 'error',
      transcriptStatus: 'error',
      errorMessage: message,
      updatedAt: new Date()
    });
    await updateJob(params.mode, workspaceId, transcriptionJob.id, {
      jobStatus: 'error',
      finishedAt: new Date(),
      latencyMs: Date.now() - transcriptionJobStartedAt,
      errorMessage: message,
      updatedAt: new Date()
    });
    if (!params.skipSessionRollup) {
      await persistSessionRollup(params.mode, workspaceId, params.session, durationSeconds);
    }
    throw error;
  }
};

export const retryContinuousMemoryChunk = async (params: RetryChunkParams) => {
  const workspaceId = resolveWorkspaceId(params.workspaceId);
  const retryStartedAt = Date.now();
  const processorName = String(import.meta.env.VITE_TRANSCRIBE_PROVIDER || 'gemini_or_local_whisper');
  const transcriptionJob = await saveJob(params.mode, workspaceId, createJobRecord({
    workspaceId,
    sessionId: params.session.id,
    chunkId: params.chunk.id,
    jobType: 'retry_transcribe_chunk',
    jobStatus: 'running',
    processorType: 'speech_to_text',
    processorName,
    attemptCount: 1,
    startedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    workflowVersion: 'continuous-memory/v1',
    statusNote: 'Reprocessando transcricao do chunk.'
  }));

  try {
    await updateChunk(params.mode, workspaceId, params.chunk.id, {
      status: 'retrying',
      transcriptStatus: 'retrying',
      errorMessage: null,
      updatedAt: new Date()
    });

    const { base64Audio, mimeType } = await loadBase64FromFileRecord(params.mode, params.file);
    const transcriptText = String(await transcribeAudio(base64Audio, mimeType, params.file.storagePath) || '').trim();
    const signals = inferSignals(transcriptText);
    const transcriptWarning = transcriptText ? null : `Transcricao vazia via ${processorName} apos retry. Verifique o audio captado e o Whisper local.`;

    await updateChunk(params.mode, workspaceId, params.chunk.id, {
      status: 'completed',
      transcriptStatus: transcriptText ? 'completed' : 'error',
      transcriptText,
      transcriptConfidence: transcriptText ? 0.84 : 0.2,
      detectedLanguage: transcriptText ? 'pt-BR' : null,
      noiseScore: signals.noiseScore,
      importanceFlag: signals.importanceFlag,
      anchorFlag: signals.anchorFlag,
      errorMessage: transcriptWarning,
      updatedAt: new Date()
    });

    if (transcriptText) {
      await saveOutput(params.mode, workspaceId, {
        id: makeId(),
        workspaceId,
        sessionId: params.session.id,
        chunkId: params.chunk.id,
        outputType: 'transcript',
        content: transcriptText,
        version: Math.max(1, Number(params.currentTranscriptVersion || 1) + 1),
        generatedBy: 'continuous_memory.v1.retry',
        createdAt: new Date(),
        payload: { retried: true, storageTemperature: 'warm' }
      });
    }

    await updateJob(params.mode, workspaceId, transcriptionJob.id, {
      jobStatus: transcriptText ? 'completed' : 'completed_warning',
      finishedAt: new Date(),
      latencyMs: Date.now() - retryStartedAt,
      updatedAt: new Date(),
      statusNote: transcriptText ? 'Retry concluido.' : (transcriptWarning || 'Retry concluiu com transcricao vazia.')
    });
  } catch (error: any) {
    const message = String(error?.message || 'Falha ao reprocessar chunk.');
    await updateChunk(params.mode, workspaceId, params.chunk.id, {
      status: 'error',
      transcriptStatus: 'error',
      errorMessage: message,
      updatedAt: new Date()
    });
    await updateJob(params.mode, workspaceId, transcriptionJob.id, {
      jobStatus: 'error',
      finishedAt: new Date(),
      latencyMs: Date.now() - retryStartedAt,
      errorMessage: message,
      updatedAt: new Date()
    });
    throw error;
  }
};
