/**
 * Supabase "shim" para manter a API parecida com Firebase/Firestore dentro do SagB,
 * enquanto migramos o storage para Postgres.
 *
 * Objetivos:
 * - Auth via Supabase Auth (email + password).
 * - Acesso a dados via PostgREST (/rest/v1).
 * - Manter assinaturas "onSnapshot" (aqui via polling simples) para não quebrar o app.
 * - Normalizar (snake_case <-> camelCase) nos pontos críticos (ventures, users, tasks, topics, agents).
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars ausentes: VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY');
}

const authListeners = new Set<(event: string, session: any) => void>();
const SESSION_STORAGE_KEY = 'sagb_supabase_session_v1';

const readSessionFromStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.access_token && parsed.user) return parsed;
  } catch {
    // noop
  }
  return null;
};

let inMemorySession: any | null = readSessionFromStorage();

const getStoredSession = () => {
  return inMemorySession;
};

const setStoredSession = (session: any | null) => {
  inMemorySession = session;
  if (typeof window !== 'undefined') {
    try {
      if (!session) window.localStorage.removeItem(SESSION_STORAGE_KEY);
      else window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // noop
    }
  }
};

const emitAuth = (event: string, session: any) => {
  authListeners.forEach((listener) => listener(event, session));
};

const forceSignOut = () => {
  setStoredSession(null);
  emitAuth('SIGNED_OUT', null);
};

const safeJsonParse = (text: string) => {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
};

type ShimError = Error & {
  code: string;
  status?: number;
  details?: any;
};

const createShimError = (params: { code: string; message: string; status?: number; details?: any }): ShimError => {
  const error = new Error(params.message) as ShimError;
  error.code = params.code;
  error.status = params.status;
  error.details = params.details;
  return error;
};

const pickErrorMessage = (data: any, fallback: string) => {
  return data?.msg || data?.message || data?.error_description || data?.error || fallback;
};

const resolveAuthErrorCode = (path: string, status: number, data: any) => {
  const msg = String(pickErrorMessage(data, '')).toLowerCase();
  if (path.includes('/token') && (status === 400 || status === 401)) return 'auth/invalid-credentials';
  if (path.includes('/signup')) {
    if (msg.includes('already') || msg.includes('registered')) return 'auth/email-already-in-use';
    if (msg.includes('password') && (msg.includes('least') || msg.includes('weak'))) return 'auth/weak-password';
    if (msg.includes('email')) return 'auth/invalid-email';
  }
  if (msg.includes('invalid login credentials')) return 'auth/invalid-credentials';
  if (msg.includes('email')) return 'auth/invalid-email';
  return `auth/http-${status}`;
};

const supabaseAuthFetch = async (path: string, body?: any, accessToken?: string) => {
  const res = await fetch(`${supabaseUrl}/auth/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const json = await res.json().catch(() => ({}));

  // Token inválido: derruba sessão local pra forçar login
  if (res.status === 401) {
    forceSignOut();
  }

  if (!res.ok) {
    throw createShimError({
      code: resolveAuthErrorCode(path, res.status, json),
      message: pickErrorMessage(json, `Supabase auth request failed (${res.status}).`),
      status: res.status,
      details: json
    });
  }

  return json;
};

const restFetch = async (
  table: string,
  options: { method?: string; query?: URLSearchParams; body?: any; headers?: Record<string, string> } = {},
  accessToken?: string
) => {
  const session = getStoredSession();
  const token = accessToken || session?.access_token;
  const queryString = options.query ? `?${options.query.toString()}` : '';

  const res = await fetch(`${supabaseUrl}/rest/v1/${table}${queryString}`, {
    method: options.method || 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token || supabaseAnonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await res.text();
  const data = safeJsonParse(text);

  if (res.status === 401 && session?.access_token) {
    forceSignOut();
  }

  if (!res.ok) {
    throw createShimError({
      code: `supabase/http-${res.status}`,
      message: pickErrorMessage(data, `Supabase request failed (${res.status}) on table ${table}.`),
      status: res.status,
      details: data
    });
  }

  return data;
};

export const auth = {
  get currentUser() {
    const session = getStoredSession();
    return session?.user ?? null;
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const data = await supabaseAuthFetch('/token?grant_type=password', { email, password });
      if (!data?.access_token || !data?.user) {
        return {
          data: { user: null, session: null },
          error: createShimError({ code: 'auth/invalid-credentials', message: 'Credenciais inválidas.' })
        };
      }
      const session = { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
      setStoredSession(session);
      emitAuth('SIGNED_IN', session);
      return { data: { user: data.user, session }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error };
    }
  },

  async signUp({ email, password }: { email: string; password: string }) {
    try {
      const data = await supabaseAuthFetch('/signup', { email, password });
      const session = data.access_token ? { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user } : null;
      if (session) {
        setStoredSession(session);
        emitAuth('SIGNED_IN', session);
      }
      return { data: { user: data.user ?? null, session }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error };
    }
  },

  async signOut() {
    const session = getStoredSession();
    if (session?.access_token) {
      await fetch(`${supabaseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${session.access_token}` }
      }).catch(() => null);
    }
    forceSignOut();
    return { error: null };
  },

  async getUser() {
    const session = getStoredSession();
    if (!session?.access_token) return { data: { user: null }, error: null };
    try {
      const data = await supabaseAuthFetch('/user', undefined, session.access_token);
      return { data: { user: data }, error: null };
    } catch {
      // Se falhou o /user, considera sessão inválida e força login
      forceSignOut();
      return { data: { user: null }, error: null };
    }
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    authListeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => authListeners.delete(callback)
        }
      }
    };
  }
};

// Mantém "db" só como placeholder para a API Firestore-like
export const db = { provider: 'supabase-rest' };
export type User = Awaited<ReturnType<typeof auth.getUser>>['data']['user'];

type CollectionRef = { kind: 'collection'; table: string };
type DocRef = { kind: 'doc'; table: string; id: string };
type QueryRef = {
  kind: 'query';
  table: string;
  filters: Array<{ field: string; op: string; value: any }>;
  orders: Array<{ field: string; direction: 'asc' | 'desc' }>;
};

type AnyRef = CollectionRef | DocRef | QueryRef;

class Timestamp {
  private value: Date;
  constructor(value: Date) { this.value = value; }
  static now() { return new Timestamp(new Date()); }
  static fromDate(date: Date) { return new Timestamp(date); }
  toDate() { return this.value; }
  toJSON() { return this.value.toISOString(); }
}

/**
 * Converte valores de payload.
 * - Timestamp -> ISO
 * - remove undefined
 */
const normalizePayload = (payload: Record<string, any>) => {
  const normalized: Record<string, any> = {};
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined) return;
    if (value instanceof Timestamp) normalized[key] = value.toDate().toISOString();
    else if (value instanceof Date) normalized[key] = value.toISOString();
    else normalized[key] = value;
  });
  return normalized;
};

/**
 * Converte strings ISO em Timestamp para manter compatibilidade com o código legada.
 */
const convertTimestamps = (record: Record<string, any>) => {
  const out: Record<string, any> = { ...(record || {}) };
  Object.entries(out).forEach(([key, value]) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) out[key] = Timestamp.fromDate(date);
    }
  });
  return out;
};

const camelToSnake = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const asJsDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

// ---------------------------
// Normalização por tabela
// ---------------------------
const pick = (obj: Record<string, any>, ...keys: string[]) => {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
};

const normalizeRecordForTable = (table: string, record: Record<string, any>) => {
  const r: Record<string, any> = { ...(record || {}) };

  if (table === 'ventures') {
    // DB: brand_name / logo_url / initiative / lab_status / created_at
    r.name = pick(r, 'name', 'brandName', 'brand_name', 'brand') ?? '';
    r.logo = pick(r, 'logo', 'logoUrl', 'logo_url') ?? '';
    r.type = pick(r, 'type', 'initiative') ?? 'Marca';
    r.statusLab = pick(r, 'statusLab', 'labStatus', 'lab_status') ?? 'Pendente';
    r.status = pick(r, 'status') ?? 'DESENVOLVIMENTO';
    r.niche = pick(r, 'niche') ?? '';
    r.segment = pick(r, 'segment') ?? '';
    r.sphere = pick(r, 'sphere') ?? '';
    r.url = pick(r, 'url') ?? '';

    // timestamp no app: usa created_at como fonte
    const ts = pick(r, 'timestamp', 'created_at', 'createdAt', 'updated_at', 'updatedAt');
    r.timestamp = ts ?? Timestamp.fromDate(new Date());
  }

  if (table === 'users') {
    // DB: id, email, display_name, role, created_at
    const id = pick(r, 'uid', 'id', 'user_id') ?? '';
    r.uid = id;
    r.email = pick(r, 'email') ?? '';
    r.name = pick(r, 'name', 'display_name', 'displayName') ?? '';
    r.nickname = pick(r, 'nickname') ?? '';
    r.role = pick(r, 'role') ?? 'member';
    r.company = pick(r, 'company') ?? 'GrupoB';
    r.tier = pick(r, 'tier') ?? 'TÁTICO';
    r.workspaceId = pick(r, 'workspaceId', 'workspace_id') ?? null;
    const created = pick(r, 'createdAt', 'created_at');
    r.createdAt = asJsDate(created) ?? new Date();
    const updated = pick(r, 'updatedAt', 'updated_at');
    r.updatedAt = updated ? asJsDate(updated) : undefined;
    r.payload = (r.payload && typeof r.payload === 'object') ? r.payload : {};
  }

  if (table === 'tasks') {
    const created = pick(r, 'createdAt', 'created_at');
    r.createdAt = asJsDate(created) ?? new Date();
    const due = pick(r, 'dueDate', 'due_date', 'due_date_at', 'due_at');
    r.dueDate = due ? asJsDate(due) : undefined;
  }

  if (table === 'topics') {
    const ts = pick(r, 'timestamp', 'created_at', 'createdAt');
    r.timestamp = asJsDate(ts) ?? new Date();
    const due = pick(r, 'dueDate', 'due_date', 'due_date_at', 'due_at');
    const dueDate = asJsDate(due);
    r.dueDate = dueDate ? dueDate.toISOString().slice(0, 10) : (typeof due === 'string' ? due : undefined);
  }

  if (table === 'agents') {
    const payload = (r.payload && typeof r.payload === 'object') ? (r.payload as Record<string, any>) : {};
    const status = String(pick(r, 'status') ?? pick(payload, 'status') ?? 'ACTIVE').toUpperCase();
    const name = String(pick(r, 'name') ?? pick(payload, 'name') ?? '').trim();
    const officialRole = String(
      pick(
        r,
        'officialRole',
        'official_role',
        'description'
      ) ?? ''
    ).trim();
    const officialRolePayload = String(pick(payload, 'officialRole', 'official_role', 'description') ?? '').trim();
    const globalDocuments = pick(r, 'globalDocuments', 'global_documents') ?? pick(payload, 'globalDocuments', 'global_documents');
    const fallbackId = pick(r, 'id') ?? pick(payload, 'id') ?? '';

    return {
      ...r,
      id: String(fallbackId),
      universalId: String(pick(r, 'universalId', 'universal_id') ?? pick(payload, 'universalId', 'universal_id') ?? fallbackId),
      name: name || 'Sem Nome',
      officialRole: officialRole || officialRolePayload || 'Sem Cargo',
      company: String(pick(r, 'company') ?? pick(payload, 'company') ?? 'GrupoB'),
      buId: pick(r, 'buId', 'bu_id') ?? pick(payload, 'buId', 'bu_id') ?? undefined,
      ventureId: pick(r, 'ventureId', 'venture_id') ?? pick(payload, 'ventureId', 'venture_id') ?? undefined,
      tier: pick(r, 'tier') ?? pick(payload, 'tier') ?? 'OPERACIONAL',
      active: status !== 'PLANNED' && status !== 'BLOCKED',
      status,
      version: String(pick(r, 'version') ?? pick(payload, 'version') ?? '1.0'),
      fullPrompt: String(pick(r, 'fullPrompt', 'full_prompt') ?? pick(payload, 'fullPrompt', 'full_prompt') ?? ''),
      sector: String(pick(r, 'sector') ?? pick(payload, 'sector') ?? officialRole ?? officialRolePayload ?? ''),
      division: pick(r, 'division') ?? pick(payload, 'division') ?? undefined,
      collaboratorType: pick(r, 'collaboratorType', 'collaborator_type') ?? pick(payload, 'collaboratorType', 'collaborator_type') ?? undefined,
      salary: pick(r, 'salary') ?? pick(payload, 'salary') ?? undefined,
      startDate: pick(r, 'startDate', 'start_date') ?? pick(payload, 'startDate', 'start_date') ?? undefined,
      docCount: Number(
        pick(r, 'docCount', 'doc_count') ??
        pick(payload, 'docCount', 'doc_count') ??
        (Array.isArray(globalDocuments) ? globalDocuments.length : 0)
      ),
      avatarUrl: pick(r, 'avatarUrl', 'avatar_url') ?? pick(payload, 'avatarUrl', 'avatar_url') ?? undefined,
      ambientPhotoUrl: pick(r, 'ambientPhotoUrl', 'ambient_photo_url') ?? pick(payload, 'ambientPhotoUrl', 'ambient_photo_url') ?? undefined,
      modelProvider: pick(r, 'modelProvider', 'model_provider') ?? pick(payload, 'modelProvider', 'model_provider') ?? 'gemini',
      globalDocuments: Array.isArray(globalDocuments) ? globalDocuments : []
    };
  }

  if (table === 'governance_global_culture') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      title: r.title,
      summary: r.summary ?? undefined,
      contentMd: r.content_md ?? '',
      version: r.version ?? 1,
      effectiveFrom: asJsDate(pick(r, 'effective_from', 'effectiveFrom')),
      effectiveTo: asJsDate(pick(r, 'effective_to', 'effectiveTo')),
      status: r.status ?? 'active',
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      createdBy: r.created_by ?? undefined,
      updatedBy: r.updated_by ?? undefined,
      payload: r.payload ?? undefined
    };
  }

  if (table === 'governance_compliance_rules') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      code: r.code,
      title: r.title,
      description: r.description ?? undefined,
      severity: (r.severity ?? 'medium') as any,
      scope: (r.scope ?? 'global') as any,
      subject: r.subject ?? undefined,
      ruleMd: r.rule_md ?? '',
      version: r.version ?? 1,
      status: r.status ?? 'active',
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      createdBy: r.created_by ?? undefined,
      updatedBy: r.updated_by ?? undefined,
      payload: r.payload ?? undefined
    };
  }

  if (table === 'vault_items') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      name: r.name,
      provider: r.provider,
      env: r.env,
      itemType: r.item_type,
      ownerEmail: r.owner_email ?? undefined,
      storagePath: r.storage_path ?? undefined,
      secretRef: r.secret_ref ?? undefined,
      rotatePolicy: r.rotate_policy ?? undefined,
      lastRotatedAt: asJsDate(r.last_rotated_at ?? r.lastRotatedAt),
      status: r.status ?? 'active',
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      createdBy: r.created_by ?? undefined,
      updatedBy: r.updated_by ?? undefined,
      payload: r.payload ?? undefined
    };
  }

  if (table === 'knowledge_nodes') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      parentId: r.parent_id ?? null,
      nodeType: r.node_type,
      slug: r.slug ?? undefined,
      title: r.title,
      contentMd: r.content_md ?? undefined,
      linkUrl: r.link_url ?? undefined,
      orderIndex: Number(r.order_index ?? 0),
      version: Number(r.version ?? 1),
      visibility: (r.visibility ?? 'internal') as any,
      status: r.status ?? 'active',
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      createdBy: r.created_by ?? undefined,
      updatedBy: r.updated_by ?? undefined,
      payload: r.payload ?? undefined
    };
  }

  if (table === 'knowledge_attachments') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      nodeId: r.node_id,
      bucket: r.bucket,
      path: r.path,
      filename: r.filename,
      mimeType: r.mime_type ?? undefined,
      sizeBytes: r.size_bytes ? Number(r.size_bytes) : undefined,
      checksum: r.checksum ?? undefined,
      version: Number(r.version ?? 1),
      status: r.status ?? 'active',
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      createdBy: r.created_by ?? undefined,
      updatedBy: r.updated_by ?? undefined,
      payload: r.payload ?? undefined
    };
  }

  if (table === 'audit_events') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      actorType: r.actor_type,
      actorId: r.actor_id ?? undefined,
      actorLabel: r.actor_label ?? undefined,
      diff: r.diff ?? null,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'workspace_members') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      userId: r.user_id,
      role: r.role ?? 'viewer',
      status: r.status ?? 'active',
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      createdBy: r.created_by ?? undefined,
      updatedBy: r.updated_by ?? undefined,
      payload: r.payload ?? undefined
    };
  }

  if (table === 'agent_configs') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      agentId: String(r.agent_id ?? ''),
      fullPrompt: r.full_prompt ?? '',
      globalDocuments: r.global_documents ?? [],
      docCount: Number(r.doc_count ?? 0),
      version: Number(r.version ?? 1),
      status: r.status ?? 'active',
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      createdBy: r.created_by ?? undefined,
      updatedBy: r.updated_by ?? undefined,
      payload: r.payload ?? undefined
    };
  }

  if (table === 'agent_memories') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      agentId: String(r.agent_id ?? ''),
      sessionId: r.session_id ?? null,
      memoryType: r.memory_type ?? 'learning',
      content: String(r.content ?? ''),
      confidence: r.confidence !== undefined && r.confidence !== null ? Number(r.confidence) : undefined,
      status: r.status ?? 'active',
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      createdBy: r.created_by ?? undefined,
      updatedBy: r.updated_by ?? undefined,
      payload: r.payload ?? undefined
    };
  }

  if (table === 'chat_sessions') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      agentId: String(r.agent_id ?? ''),
      ownerUserId: r.owner_user_id ?? undefined,
      title: String(r.title ?? 'Nova Conversa'),
      status: r.status ?? 'active',
      buId: r.bu_id ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      lastMessageAt: asJsDate(pick(r, 'last_message_at', 'lastMessageAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'chat_messages') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      sessionId: String(r.session_id ?? ''),
      agentId: String(r.agent_id ?? ''),
      sender: String(r.sender ?? 'bot'),
      text: String(r.text ?? ''),
      buId: r.bu_id ?? undefined,
      participantName: r.participant_name ?? undefined,
      hasAttachment: Boolean(r.has_attachment),
      attachment: r.attachment ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  return r;
};

const normalizePayloadForTable = (table: string, payload: Record<string, any>) => {
  const p: Record<string, any> = normalizePayload(payload);

  // remove campos que nunca podem ir direto pro SQL
  delete p.id;

  if (table === 'ventures') {
    // UI -> DB columns
    if (p.name !== undefined) { p.brand_name = p.name; delete p.name; }
    if (p.logo !== undefined) { p.logo_url = p.logo; delete p.logo; }
    if (p.type !== undefined) { p.initiative = p.type; delete p.type; }
    if (p.statusLab !== undefined) { p.lab_status = p.statusLab; delete p.statusLab; }

    // App usa timestamp. DB usa created_at default now(). Então não mandamos timestamp.
    delete p.timestamp;
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'users') {
    // Perfil "public.users"
    if (p.uid !== undefined) { p.id = p.uid; delete p.uid; }
    if (p.name !== undefined) { p.display_name = p.name; delete p.name; }
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  // Para tasks/topics/agents: se existir coluna payload no DB, empacota o extra lá dentro (mais robusto).
  if (table === 'tasks' || table === 'topics' || table === 'agents') {
    const knownKeys = new Set<string>([
      'id',
      'title',
      'status',
      'assignee',
      'priority',
      'description',
      'created_at',
      'updated_at',
      'due_date',
      'createdAt',
      'updatedAt',
      'dueDate'
    ]);

    if (table === 'tasks' || table === 'topics') {
      knownKeys.add('venture_id');
      knownKeys.add('ventureId');
      knownKeys.add('bu_id');
      knownKeys.add('buId');
    }

    if (table === 'agents') {
      [
        'name',
        'official_role',
        'officialRole',
        'company',
        'tier',
        'division',
        'sector',
        'salary',
        'collaborator_type',
        'collaboratorType',
        'model_provider',
        'modelProvider',
        'avatar_url',
        'avatarUrl',
        'ambient_photo_url',
        'ambientPhotoUrl',
        'universal_id',
        'universalId',
        'full_prompt',
        'fullPrompt',
        'version',
        'active',
        'workspace_id',
        'workspaceId',
        'venture_id',
        'ventureId',
        'bu_id',
        'buId',
        'created_by',
        'createdBy',
        'updated_by',
        'updatedBy',
        'start_date',
        'startDate',
        'doc_count',
        'docCount'
      ].forEach((k) => knownKeys.add(k));
    }
    // Converte campos de relacionamento apenas para tabelas que suportam esse schema.
    if ((table === 'tasks' || table === 'topics') && p.ventureId !== undefined && p.venture_id === undefined) {
      p.venture_id = p.ventureId;
      delete p.ventureId;
    }
    if ((table === 'tasks' || table === 'topics') && p.buId !== undefined && p.bu_id === undefined) {
      p.bu_id = p.buId;
      delete p.buId;
    }

    // Em agents, preserva em payload para evitar erro de coluna inexistente (ex.: bu_id).
    if (table === 'agents') {
      if (p.officialRole !== undefined && p.official_role === undefined) {
        p.official_role = p.officialRole;
        delete p.officialRole;
      }
      if (p.collaboratorType !== undefined && p.collaborator_type === undefined) {
        p.collaborator_type = p.collaboratorType;
        delete p.collaboratorType;
      }
      if (p.modelProvider !== undefined && p.model_provider === undefined) {
        p.model_provider = p.modelProvider;
        delete p.modelProvider;
      }
      if (p.avatarUrl !== undefined && p.avatar_url === undefined) {
        p.avatar_url = p.avatarUrl;
        delete p.avatarUrl;
      }
      if (p.ambientPhotoUrl !== undefined && p.ambient_photo_url === undefined) {
        p.ambient_photo_url = p.ambientPhotoUrl;
        delete p.ambientPhotoUrl;
      }
      if (p.universalId !== undefined && p.universal_id === undefined) {
        p.universal_id = p.universalId;
        delete p.universalId;
      }
      if (p.fullPrompt !== undefined && p.full_prompt === undefined) {
        p.full_prompt = p.fullPrompt;
        delete p.fullPrompt;
      }
      if (p.workspaceId !== undefined && p.workspace_id === undefined) {
        p.workspace_id = p.workspaceId;
        delete p.workspaceId;
      }
      if (p.ventureId !== undefined) {
        if (p.venture_id === undefined) p.venture_id = p.ventureId;
        delete p.ventureId;
      }
      if (p.buId !== undefined && p.bu_id === undefined) {
        p.bu_id = p.buId;
        delete p.buId;
      }
      if (p.createdBy !== undefined && p.created_by === undefined) {
        p.created_by = p.createdBy;
        delete p.createdBy;
      }
      if (p.updatedBy !== undefined && p.updated_by === undefined) {
        p.updated_by = p.updatedBy;
        delete p.updatedBy;
      }
      if (p.startDate !== undefined && p.start_date === undefined) {
        p.start_date = p.startDate;
        delete p.startDate;
      }
      if (p.docCount !== undefined && p.doc_count === undefined) {
        p.doc_count = p.docCount;
        delete p.docCount;
      }
    }
    if ((table === 'tasks' || table === 'topics') && p.dueDate !== undefined && p.due_date === undefined) {
      p.due_date = p.dueDate;
    }
    if (table === 'topics' && p.timestamp !== undefined && p.created_at === undefined) {
      p.created_at = p.timestamp;
    }

    const extra: Record<string, any> = {};
    Object.keys(p).forEach((k) => {
      if (!knownKeys.has(k) && k !== 'payload') {
        extra[k] = p[k];
        delete p[k];
      }
    });

    if (Object.keys(extra).length) {
      p.payload = { ...(p.payload || {}), ...extra };
    }

    // Data fields (se estiverem em camelCase, guarda no payload, mas não derruba insert)
    delete p.createdAt;
    delete p.updatedAt;
    delete p.timestamp;
    delete p.dueDate;
  }

  if (table === 'governance_global_culture') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.contentMd !== undefined) { p.content_md = p.contentMd; delete p.contentMd; }
    if (p.effectiveFrom !== undefined) { p.effective_from = p.effectiveFrom; delete p.effectiveFrom; }
    if (p.effectiveTo !== undefined) { p.effective_to = p.effectiveTo; delete p.effectiveTo; }
    if (p.createdBy !== undefined) { p.created_by = p.createdBy; delete p.createdBy; }
    if (p.updatedBy !== undefined) { p.updated_by = p.updatedBy; delete p.updatedBy; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'governance_compliance_rules') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.ruleMd !== undefined) { p.rule_md = p.ruleMd; delete p.ruleMd; }
    if (p.createdBy !== undefined) { p.created_by = p.createdBy; delete p.createdBy; }
    if (p.updatedBy !== undefined) { p.updated_by = p.updatedBy; delete p.updatedBy; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'vault_items') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.itemType !== undefined) { p.item_type = p.itemType; delete p.itemType; }
    if (p.ownerEmail !== undefined) { p.owner_email = p.ownerEmail; delete p.ownerEmail; }
    if (p.storagePath !== undefined) { p.storage_path = p.storagePath; delete p.storagePath; }
    if (p.secretRef !== undefined) { p.secret_ref = p.secretRef; delete p.secretRef; }
    if (p.rotatePolicy !== undefined) { p.rotate_policy = p.rotatePolicy; delete p.rotatePolicy; }
    if (p.lastRotatedAt !== undefined) { p.last_rotated_at = p.lastRotatedAt; delete p.lastRotatedAt; }
    if (p.createdBy !== undefined) { p.created_by = p.createdBy; delete p.createdBy; }
    if (p.updatedBy !== undefined) { p.updated_by = p.updatedBy; delete p.updatedBy; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'knowledge_nodes') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.parentId !== undefined) { p.parent_id = p.parentId; delete p.parentId; }
    if (p.nodeType !== undefined) { p.node_type = p.nodeType; delete p.nodeType; }
    if (p.contentMd !== undefined) { p.content_md = p.contentMd; delete p.contentMd; }
    if (p.linkUrl !== undefined) { p.link_url = p.linkUrl; delete p.linkUrl; }
    if (p.orderIndex !== undefined) { p.order_index = p.orderIndex; delete p.orderIndex; }
    if (p.createdBy !== undefined) { p.created_by = p.createdBy; delete p.createdBy; }
    if (p.updatedBy !== undefined) { p.updated_by = p.updatedBy; delete p.updatedBy; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'knowledge_attachments') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.nodeId !== undefined) { p.node_id = p.nodeId; delete p.nodeId; }
    if (p.mimeType !== undefined) { p.mime_type = p.mimeType; delete p.mimeType; }
    if (p.sizeBytes !== undefined) { p.size_bytes = p.sizeBytes; delete p.sizeBytes; }
    if (p.createdBy !== undefined) { p.created_by = p.createdBy; delete p.createdBy; }
    if (p.updatedBy !== undefined) { p.updated_by = p.updatedBy; delete p.updatedBy; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'audit_events') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.entityType !== undefined) { p.entity_type = p.entityType; delete p.entityType; }
    if (p.entityId !== undefined) { p.entity_id = p.entityId; delete p.entityId; }
    if (p.actorType !== undefined) { p.actor_type = p.actorType; delete p.actorType; }
    if (p.actorId !== undefined) { p.actor_id = p.actorId; delete p.actorId; }
    if (p.actorLabel !== undefined) { p.actor_label = p.actorLabel; delete p.actorLabel; }
    if (p.createdBy !== undefined) { p.created_by = p.createdBy; delete p.createdBy; }
    if (p.updatedBy !== undefined) { p.updated_by = p.updatedBy; delete p.updatedBy; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'workspace_members') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.userId !== undefined) { p.user_id = p.userId; delete p.userId; }
    if (p.createdBy !== undefined) { p.created_by = p.createdBy; delete p.createdBy; }
    if (p.updatedBy !== undefined) { p.updated_by = p.updatedBy; delete p.updatedBy; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'agent_configs') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.agentId !== undefined) { p.agent_id = p.agentId; delete p.agentId; }
    if (p.fullPrompt !== undefined) { p.full_prompt = p.fullPrompt; delete p.fullPrompt; }
    if (p.globalDocuments !== undefined) { p.global_documents = p.globalDocuments; delete p.globalDocuments; }
    if (p.docCount !== undefined) { p.doc_count = p.docCount; delete p.docCount; }
    if (p.createdBy !== undefined) { p.created_by = p.createdBy; delete p.createdBy; }
    if (p.updatedBy !== undefined) { p.updated_by = p.updatedBy; delete p.updatedBy; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'agent_memories') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.agentId !== undefined) { p.agent_id = p.agentId; delete p.agentId; }
    if (p.sessionId !== undefined) { p.session_id = p.sessionId; delete p.sessionId; }
    if (p.memoryType !== undefined) { p.memory_type = p.memoryType; delete p.memoryType; }
    if (p.createdBy !== undefined) { p.created_by = p.createdBy; delete p.createdBy; }
    if (p.updatedBy !== undefined) { p.updated_by = p.updatedBy; delete p.updatedBy; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'chat_sessions') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.agentId !== undefined) { p.agent_id = p.agentId; delete p.agentId; }
    if (p.ownerUserId !== undefined) { p.owner_user_id = p.ownerUserId; delete p.ownerUserId; }
    if (p.lastMessageAt !== undefined) { p.last_message_at = p.lastMessageAt; delete p.lastMessageAt; }
    if (p.buId !== undefined) { p.bu_id = p.buId; delete p.buId; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'chat_messages') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.sessionId !== undefined) { p.session_id = p.sessionId; delete p.sessionId; }
    if (p.agentId !== undefined) { p.agent_id = p.agentId; delete p.agentId; }
    if (p.buId !== undefined) { p.bu_id = p.buId; delete p.buId; }
    if (p.participantName !== undefined) { p.participant_name = p.participantName; delete p.participantName; }
    if (p.hasAttachment !== undefined) { p.has_attachment = p.hasAttachment; delete p.hasAttachment; }
    if (p.isStreaming !== undefined) {
      p.payload = { ...(p.payload && typeof p.payload === 'object' ? p.payload : {}), isStreaming: p.isStreaming };
      delete p.isStreaming;
    }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  return p;
};

// ---------------------------
// API Firestore-like
// ---------------------------
export const collection = (_db: typeof db, table: string): CollectionRef => ({ kind: 'collection', table });

export const doc = (_dbOrCollection: typeof db | CollectionRef, tableOrId: string, id?: string): DocRef => {
  if (id) return { kind: 'doc', table: tableOrId, id };
  const collectionRef = _dbOrCollection as CollectionRef;
  return { kind: 'doc', table: collectionRef.table, id: tableOrId };
};

export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc') => ({ type: 'orderBy' as const, field, direction });
export const where = (field: string, op: string, value: any) => ({ type: 'where' as const, field, op, value });

export const query = (collectionRef: CollectionRef, ...constraints: Array<ReturnType<typeof orderBy> | ReturnType<typeof where>>): QueryRef => {
  const queryRef: QueryRef = { kind: 'query', table: collectionRef.table, filters: [], orders: [] };
  constraints.forEach((constraint) => {
    if (constraint.type === 'orderBy') queryRef.orders.push({ field: constraint.field, direction: constraint.direction });
    if (constraint.type === 'where') queryRef.filters.push({ field: constraint.field, op: constraint.op, value: constraint.value });
  });
  return queryRef;
};

// Map de nomes Firestore -> SQL (quando o app usa camelCase)
const mapFieldForTable = (table: string, field: string) => {
  if (table === 'tasks') {
    if (field === 'createdAt') return 'created_at';
    if (field === 'dueDate') return 'due_date';
  }
  if (table === 'topics') {
    if (field === 'timestamp') return 'created_at';
    if (field === 'dueDate') return 'due_date';
  }
  if (table === 'ventures') {
    if (field === 'timestamp') return 'created_at';
  }
  if (/[A-Z]/.test(field)) {
    return camelToSnake(field);
  }
  return field;
};

const runQuery = async (ref: CollectionRef | QueryRef) => {
  const params = new URLSearchParams();
  params.set('select', '*');

  if (ref.kind === 'query') {
    ref.filters.forEach((f) => {
      const opMap: Record<string, string> = { '==': 'eq', '!=': 'neq', '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte' };
      const col = mapFieldForTable(ref.table, f.field);
      params.set(col, `${opMap[f.op] || 'eq'}.${String(f.value)}`);
    });

    if (ref.orders.length > 0) {
      const orderValue = ref.orders
        .map((item) => `${mapFieldForTable(ref.table, item.field)}.${item.direction}`)
        .join(',');
      params.set('order', orderValue);
    }
  }

  return restFetch(ref.table, { method: 'GET', query: params });
};

const parseMissingColumn = (error: any, table: string): string | null => {
  const raw = String(error?.details?.message || error?.message || '');
  const m = raw.match(/Could not find the '([^']+)' column of '([^']+)'/i);
  if (!m) return null;
  if (m[2] && m[2] !== table) return null;
  return m[1] || null;
};

const parseNonUpdatableColumn = (error: any): string | null => {
  const raw = String(error?.details?.message || error?.message || '');
  const m = raw.match(/column ["']?([^"']+)["']? can only be updated to DEFAULT/i);
  return m ? (m[1] || null) : null;
};

const insertWithSchemaFallback = async (table: string, initialBody: Record<string, any>) => {
  const body: Record<string, any> = { ...initialBody };
  const removed = new Set<string>();

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      return await restFetch(table, { method: 'POST', body });
    } catch (error: any) {
      if (error?.status !== 400) throw error;

      const missingColumn = parseMissingColumn(error, table);
      if (!missingColumn || removed.has(missingColumn)) throw error;

      if (Object.prototype.hasOwnProperty.call(body, missingColumn)) {
        const value = body[missingColumn];
        delete body[missingColumn];

        // Tenta preservar o valor em payload quando possível.
        if (missingColumn !== 'payload') {
          body.payload = {
            ...(body.payload && typeof body.payload === 'object' ? body.payload : {}),
            [missingColumn]: value
          };
        }
        removed.add(missingColumn);
        continue;
      }

      // Se a coluna ausente não está no body atual, não há como remediar aqui.
      throw error;
    }
  }

  throw createShimError({
    code: 'supabase/http-400',
    message: `Falha ao inserir em ${table} após tentativas de compatibilidade de schema.`
  });
};

const patchWithSchemaFallback = async (
  table: string,
  query: URLSearchParams,
  initialBody: Record<string, any>
) => {
  const body: Record<string, any> = { ...initialBody };
  const removed = new Set<string>();

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      return await restFetch(table, { method: 'PATCH', query, body });
    } catch (error: any) {
      if (error?.status !== 400) throw error;

      const missingColumn = parseMissingColumn(error, table);
      const nonUpdatableColumn = parseNonUpdatableColumn(error);
      const targetColumn = missingColumn || nonUpdatableColumn;
      if (!targetColumn || removed.has(targetColumn)) throw error;

      if (Object.prototype.hasOwnProperty.call(body, targetColumn)) {
        const value = body[targetColumn];
        delete body[targetColumn];

        if (missingColumn && targetColumn !== 'payload') {
          body.payload = {
            ...(body.payload && typeof body.payload === 'object' ? body.payload : {}),
            [targetColumn]: value
          };
        }
        removed.add(targetColumn);
        continue;
      }

      throw error;
    }
  }

  throw createShimError({
    code: 'supabase/http-400',
    message: `Falha ao atualizar ${table} após tentativas de compatibilidade de schema.`
  });
};

const buildCollectionSnapshot = (records: any[], table: string) => ({
  docs: (records || []).map((record) => ({
    id: String(record.id),
    data: () => normalizeRecordForTable(table, convertTimestamps(record))
  }))
});

const buildDocSnapshot = (record: any | null, table: string) => ({
  exists: () => Boolean(record),
  data: () => (record ? normalizeRecordForTable(table, convertTimestamps(record)) : undefined)
});

const getBasePollingMs = (ref: AnyRef) => {
  const table = ref.table;
  if (table === 'chat_messages') return 2500;
  if (table === 'chat_sessions') return 4000;
  if (table === 'agents' || table === 'workspace_members' || table === 'agent_configs' || table === 'agent_memories') return 15000;
  if (
    table === 'governance_global_culture' ||
    table === 'governance_compliance_rules' ||
    table === 'vault_items' ||
    table === 'knowledge_nodes'
  ) return 20000;
  if (table === 'topics' || table === 'tasks' || table === 'ventures') return 8000;
  return ref.kind === 'doc' ? 7000 : 10000;
};

/**
 * onSnapshot aqui não é realtime (por enquanto).
 * Faz polling adaptativo para reduzir custo de rede sem quebrar a experiência.
 */
export const onSnapshot = (ref: AnyRef, callback: (snapshot: any) => void, onError?: (error: any) => void) => {
  let active = true;
  let inFlight = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const getPollingMs = () => {
    const baseMs = getBasePollingMs(ref);
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return Math.max(baseMs * 3, 30000);
    }
    return baseMs;
  };

  const emit = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      if (!active) return;

      if (ref.kind === 'doc') {
        const params = new URLSearchParams();
        params.set('select', '*');
        params.set('id', `eq.${ref.id}`);

        const rows = await restFetch(ref.table, { method: 'GET', query: params });
        callback(buildDocSnapshot(rows?.[0] || null, ref.table));
      } else {
        const rows = await runQuery(ref);
        callback(buildCollectionSnapshot(rows || [], ref.table));
      }
    } catch (error) {
      if (onError) onError(error);
      else console.error(error);
    } finally {
      inFlight = false;
    }
  };

  const schedule = () => {
    if (timer) clearInterval(timer);
    timer = setInterval(emit, getPollingMs());
  };

  const handleVisibilityChange = () => {
    if (!active) return;
    schedule();
  };

  emit();
  schedule();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  return () => {
    active = false;
    if (timer) clearInterval(timer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  };
};

export const addDoc = async (collectionRef: CollectionRef, payload: Record<string, any>) => {
  const body = normalizePayloadForTable(collectionRef.table, payload);

  // Se tentar inserir venture já sem logo/nome, dá erro. Melhor falhar cedo.
  if (collectionRef.table === 'ventures') {
    if (!body.brand_name) throw { code: 'validation/error', message: 'Venture sem nome (brand_name).' };
    if (!body.logo_url) throw { code: 'validation/error', message: 'Venture sem logo (logo_url).' };
  }

  if (collectionRef.table === 'agents') {
    const session = getStoredSession();
    const userId = session?.user?.id;
    if (userId && body.created_by === undefined && body.createdBy === undefined) {
      body.created_by = userId;
    }
    if (userId && body.updated_by === undefined && body.updatedBy === undefined) {
      body.updated_by = userId;
    }
  }

  const data = collectionRef.table === 'agents'
    ? await insertWithSchemaFallback(collectionRef.table, body)
    : await restFetch(collectionRef.table, { method: 'POST', body });
  const inserted = Array.isArray(data) ? data[0] : data;

  // Conveniência: ao criar venture, vincula user atual como admin em user_ventures (se existir).
  if (collectionRef.table === 'ventures') {
    const session = getStoredSession();
    const userId = session?.user?.id;
    if (userId && inserted?.id) {
      try {
        await restFetch('user_ventures', {
          method: 'POST',
          body: { user_id: userId, venture_id: inserted.id, role: 'admin' },
        });
      } catch (e) {
        console.warn('Falha ao vincular user à venture (user_ventures).', e);
      }
    }
  }

  return { ...doc(db, collectionRef.table, String(inserted.id)), id: String(inserted.id) };
};

export const updateDoc = async (docRef: DocRef, payload: Record<string, any>) => {
  const params = new URLSearchParams();
  params.set('id', `eq.${docRef.id}`);
  const body = normalizePayloadForTable(docRef.table, payload);
  await patchWithSchemaFallback(docRef.table, params, body);
};

export const setDoc = async (docRef: DocRef, payload: Record<string, any>, _options?: { merge?: boolean }) => {
  // UPSERT: precisa header Prefer resolution=merge-duplicates e coluna PK id
  const body = { id: docRef.id, ...normalizePayloadForTable(docRef.table, payload) };
  await restFetch(docRef.table, { method: 'POST', body, headers: { Prefer: 'resolution=merge-duplicates,return=representation' } });
};

export const deleteDoc = async (docRef: DocRef) => {
  const params = new URLSearchParams();
  params.set('id', `eq.${docRef.id}`);
  await restFetch(docRef.table, { method: 'DELETE', query: params });
};

// Compat Firebase Auth helpers (mantidos para o Auth.tsx)
export const signInWithEmailAndPassword = async (_auth: typeof auth, email: string, password: string) => {
  const { data, error } = await auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: data.user };
};

export const createUserWithEmailAndPassword = async (_auth: typeof auth, email: string, password: string) => {
  const { data, error } = await auth.signUp({ email, password });
  if (error) throw error;
  return { user: data.user };
};

export const signOut = async (_auth: typeof auth) => auth.signOut();

// Compat Firebase onAuthStateChanged
export const onAuthStateChanged = (_auth: typeof auth, callback: (user: User | null) => void) => {
  auth.getUser().then(({ data }) => callback(data.user ?? null));
  const { data } = auth.onAuthStateChange((_event, session) => callback(session?.user ?? null));
  return () => data.subscription.unsubscribe();
};

export { Timestamp };
