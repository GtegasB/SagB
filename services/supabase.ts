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
    const entityType = String(
      pick(r, 'entityType', 'entity_type', 'type') ??
      pick(payload, 'entityType', 'entity_type', 'type') ??
      ''
    ).toUpperCase();
    const structuralStatus = String(
      pick(r, 'structuralStatus', 'structural_status') ??
      pick(payload, 'structuralStatus', 'structural_status') ??
      ''
    ).toUpperCase();
    const preferredModel =
      pick(r, 'preferredModel', 'preferred_model') ??
      pick(payload, 'preferredModel', 'preferred_model') ??
      pick(r, 'modelProvider', 'model_provider') ??
      pick(payload, 'modelProvider', 'model_provider');
    const rawAllowedStacks =
      pick(r, 'allowedStacks', 'allowed_stacks') ??
      pick(payload, 'allowedStacks', 'allowed_stacks');
    const allowedStacks = Array.isArray(rawAllowedStacks)
      ? rawAllowedStacks
      : typeof rawAllowedStacks === 'string'
        ? rawAllowedStacks.split(',').map((value) => value.trim()).filter(Boolean)
        : [];

    return {
      ...r,
      id: String(fallbackId),
      universalId: String(pick(r, 'universalId', 'universal_id') ?? pick(payload, 'universalId', 'universal_id') ?? fallbackId),
      name: name || 'Sem Nome',
      entityType: (entityType || 'AGENTE'),
      shortDescription: String(pick(r, 'shortDescription', 'short_description') ?? pick(payload, 'shortDescription', 'short_description') ?? ''),
      origin: String(pick(r, 'origin') ?? pick(payload, 'origin') ?? ''),
      officialRole: officialRole || officialRolePayload || 'Sem Cargo',
      company: String(pick(r, 'company') ?? pick(payload, 'company') ?? 'GrupoB'),
      buId: pick(r, 'buId', 'bu_id') ?? pick(payload, 'buId', 'bu_id') ?? undefined,
      ventureId: pick(r, 'ventureId', 'venture_id') ?? pick(payload, 'ventureId', 'venture_id') ?? undefined,
      unitName: String(pick(r, 'unitName', 'unit_name') ?? pick(payload, 'unitName', 'unit_name') ?? ''),
      area: String(pick(r, 'area') ?? pick(payload, 'area') ?? ''),
      functionName: String(pick(r, 'functionName', 'function_name') ?? pick(payload, 'functionName', 'function_name') ?? ''),
      baseRoleUniversal: String(pick(r, 'baseRoleUniversal', 'base_role_universal') ?? pick(payload, 'baseRoleUniversal', 'base_role_universal') ?? ''),
      tier: pick(r, 'tier') ?? pick(payload, 'tier') ?? 'OPERACIONAL',
      roleType: String(pick(r, 'roleType', 'role_type') ?? pick(payload, 'roleType', 'role_type') ?? ''),
      active: status !== 'PLANNED' && status !== 'BLOCKED',
      status,
      structuralStatus: structuralStatus || undefined,
      operationalActivation: String(pick(r, 'operationalActivation', 'operational_activation') ?? pick(payload, 'operationalActivation', 'operational_activation') ?? ''),
      dnaStatus: String(pick(r, 'dnaStatus', 'dna_status') ?? pick(payload, 'dnaStatus', 'dna_status') ?? ''),
      version: String(pick(r, 'version') ?? pick(payload, 'version') ?? '1.0'),
      fullPrompt: String(pick(r, 'fullPrompt', 'full_prompt') ?? pick(payload, 'fullPrompt', 'full_prompt') ?? ''),
      sector: String(pick(r, 'sector') ?? pick(payload, 'sector') ?? officialRole ?? officialRolePayload ?? ''),
      division: pick(r, 'division') ?? pick(payload, 'division') ?? undefined,
      collaboratorType: pick(r, 'collaboratorType', 'collaborator_type') ?? pick(payload, 'collaboratorType', 'collaborator_type') ?? undefined,
      operationalClass: String(pick(r, 'operationalClass', 'operational_class') ?? pick(payload, 'operationalClass', 'operational_class') ?? ''),
      allowedStacks,
      preferredModel: preferredModel ?? undefined,
      salary: pick(r, 'salary') ?? pick(payload, 'salary') ?? undefined,
      startDate: pick(r, 'startDate', 'start_date') ?? pick(payload, 'startDate', 'start_date') ?? undefined,
      docCount: Number(
        pick(r, 'docCount', 'doc_count') ??
        pick(payload, 'docCount', 'doc_count') ??
        (Array.isArray(globalDocuments) ? globalDocuments.length : 0)
      ),
      aiMentor: pick(r, 'aiMentor', 'ai_mentor') ?? pick(payload, 'aiMentor', 'ai_mentor') ?? undefined,
      humanOwner: pick(r, 'humanOwner', 'human_owner') ?? pick(payload, 'humanOwner', 'human_owner') ?? undefined,
      customFields: pick(r, 'customFields', 'custom_fields') ?? pick(payload, 'customFields', 'custom_fields') ?? undefined,
      avatarUrl: pick(r, 'avatarUrl', 'avatar_url') ?? pick(payload, 'avatarUrl', 'avatar_url') ?? undefined,
      ambientPhotoUrl: pick(r, 'ambientPhotoUrl', 'ambient_photo_url') ?? pick(payload, 'ambientPhotoUrl', 'ambient_photo_url') ?? undefined,
      modelProvider: preferredModel ?? pick(r, 'modelProvider', 'model_provider') ?? pick(payload, 'modelProvider', 'model_provider') ?? 'gemini',
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

  if (table === 'cid_assets') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      ventureId: r.venture_id ?? undefined,
      title: String(r.title ?? ''),
      materialType: r.material_type ?? 'other',
      area: r.area ?? undefined,
      project: r.project ?? undefined,
      sensitivity: r.sensitivity ?? 'internal',
      ownerUserId: r.owner_user_id ?? undefined,
      ownerName: r.owner_name ?? undefined,
      language: r.language ?? undefined,
      desiredAction: r.desired_action ?? 'store_only',
      sourceKind: r.source_kind ?? 'upload',
      sourceId: r.source_id ?? undefined,
      isConsultable: Boolean(r.is_consultable),
      status: r.status ?? 'received',
      progressPct: Number(r.progress_pct ?? 0),
      totalParts: Number(r.total_parts ?? 0),
      completedParts: Number(r.completed_parts ?? 0),
      pendingParts: Number(r.pending_parts ?? 0),
      processingStartedAt: asJsDate(pick(r, 'processing_started_at', 'processingStartedAt')),
      completedAt: asJsDate(pick(r, 'completed_at', 'completedAt')),
      failedAt: asJsDate(pick(r, 'failed_at', 'failedAt')),
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'cid_asset_files') {
    return {
      id: String(r.id),
      assetId: String(r.asset_id ?? ''),
      workspaceId: r.workspace_id,
      bucket: r.bucket ?? 'cid-assets',
      path: r.path ?? '',
      filename: r.filename ?? '',
      mimeType: r.mime_type ?? undefined,
      sizeBytes: r.size_bytes !== undefined && r.size_bytes !== null ? Number(r.size_bytes) : undefined,
      durationSec: r.duration_sec !== undefined && r.duration_sec !== null ? Number(r.duration_sec) : undefined,
      checksum: r.checksum ?? undefined,
      status: r.status ?? 'stored',
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'cid_batches') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      ventureId: r.venture_id ?? undefined,
      title: String(r.title ?? ''),
      source: r.source ?? undefined,
      status: r.status ?? 'open',
      totalItems: Number(r.total_items ?? 0),
      processedItems: Number(r.processed_items ?? 0),
      failedItems: Number(r.failed_items ?? 0),
      createdBy: r.created_by ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'cid_batch_items') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      batchId: String(r.batch_id ?? ''),
      assetId: String(r.asset_id ?? ''),
      status: r.status ?? 'queued',
      note: r.note ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'cid_processing_jobs') {
    return {
      id: String(r.id),
      assetId: String(r.asset_id ?? ''),
      workspaceId: r.workspace_id,
      batchId: r.batch_id ?? undefined,
      jobType: String(r.job_type ?? 'ingestion'),
      actionPlan: r.action_plan ?? undefined,
      queuePosition: r.queue_position ?? undefined,
      status: r.status ?? 'queued',
      progressPct: Number(r.progress_pct ?? 0),
      totalParts: Number(r.total_parts ?? 0),
      completedParts: Number(r.completed_parts ?? 0),
      pendingParts: Number(r.pending_parts ?? 0),
      retries: Number(r.retries ?? 0),
      maxRetries: Number(r.max_retries ?? 3),
      errorMessage: r.error_message ?? undefined,
      startedAt: asJsDate(pick(r, 'started_at', 'startedAt')),
      completedAt: asJsDate(pick(r, 'completed_at', 'completedAt')),
      failedAt: asJsDate(pick(r, 'failed_at', 'failedAt')),
      cancelledAt: asJsDate(pick(r, 'cancelled_at', 'cancelledAt')),
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'cid_chunks') {
    return {
      id: String(r.id),
      assetId: String(r.asset_id ?? ''),
      jobId: r.job_id ?? undefined,
      workspaceId: r.workspace_id,
      chunkIndex: Number(r.chunk_index ?? 0),
      chunkKind: String(r.chunk_kind ?? 'text_block'),
      charStart: r.char_start !== undefined && r.char_start !== null ? Number(r.char_start) : undefined,
      charEnd: r.char_end !== undefined && r.char_end !== null ? Number(r.char_end) : undefined,
      byteStart: r.byte_start !== undefined && r.byte_start !== null ? Number(r.byte_start) : undefined,
      byteEnd: r.byte_end !== undefined && r.byte_end !== null ? Number(r.byte_end) : undefined,
      timeStartSec: r.time_start_sec !== undefined && r.time_start_sec !== null ? Number(r.time_start_sec) : undefined,
      timeEndSec: r.time_end_sec !== undefined && r.time_end_sec !== null ? Number(r.time_end_sec) : undefined,
      textContent: r.text_content ?? undefined,
      status: r.status ?? 'queued',
      retries: Number(r.retries ?? 0),
      errorMessage: r.error_message ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'cid_outputs') {
    return {
      id: String(r.id),
      assetId: String(r.asset_id ?? ''),
      jobId: r.job_id ?? undefined,
      workspaceId: r.workspace_id,
      outputType: String(r.output_type ?? 'summary_short'),
      contentText: r.content_text ?? undefined,
      contentJson: r.content_json ?? undefined,
      language: r.language ?? undefined,
      version: Number(r.version ?? 1),
      status: String(r.status ?? 'ready'),
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'cid_tags') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      name: String(r.name ?? ''),
      color: r.color ?? undefined,
      status: r.status ?? 'active',
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'cid_asset_tags') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      assetId: String(r.asset_id ?? ''),
      tagId: String(r.tag_id ?? ''),
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'cid_links') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      assetId: String(r.asset_id ?? ''),
      linkType: String(r.link_type ?? ''),
      linkedId: r.linked_id ?? undefined,
      linkedLabel: r.linked_label ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'continuous_memory_sessions') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      ventureId: r.venture_id ?? undefined,
      projectId: r.project_id ?? undefined,
      areaId: r.area_id ?? undefined,
      sessionDate: asJsDate(pick(r, 'session_date', 'sessionDate')) ?? new Date(),
      title: String(r.title ?? ''),
      sourceDevice: r.source_device ?? undefined,
      captureMode: String(r.capture_mode ?? 'microphone'),
      status: String(r.status ?? 'draft'),
      sensitivityLevel: r.sensitivity_level ?? 'internal',
      allowAgentReading: Boolean(r.allow_agent_reading),
      startedAt: asJsDate(pick(r, 'started_at', 'startedAt')),
      endedAt: asJsDate(pick(r, 'ended_at', 'endedAt')),
      totalChunks: Number(r.total_chunks ?? 0),
      totalDurationSeconds: Number(r.total_duration_seconds ?? 0),
      createdBy: r.created_by ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'continuous_memory_chunks') {
    return {
      id: String(r.id),
      sessionId: String(r.session_id ?? ''),
      workspaceId: r.workspace_id,
      ventureId: r.venture_id ?? undefined,
      projectId: r.project_id ?? undefined,
      chunkIndex: Number(r.chunk_index ?? 0),
      startedAt: asJsDate(pick(r, 'started_at', 'startedAt')),
      endedAt: asJsDate(pick(r, 'ended_at', 'endedAt')),
      durationSeconds: Number(r.duration_seconds ?? 0),
      status: String(r.status ?? 'queued'),
      transcriptStatus: String(r.transcript_status ?? 'pending'),
      transcriptText: r.transcript_text ?? undefined,
      transcriptConfidence: r.transcript_confidence !== undefined && r.transcript_confidence !== null ? Number(r.transcript_confidence) : undefined,
      detectedLanguage: r.detected_language ?? undefined,
      noiseScore: r.noise_score !== undefined && r.noise_score !== null ? Number(r.noise_score) : undefined,
      importanceFlag: Boolean(r.importance_flag),
      anchorFlag: Boolean(r.anchor_flag),
      sourceContext: r.source_context ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      errorMessage: r.error_message ?? undefined,
      payload: r.payload ?? undefined
    };
  }

  if (table === 'continuous_memory_files') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      sessionId: String(r.session_id ?? ''),
      chunkId: r.chunk_id ?? undefined,
      fileRole: String(r.file_role ?? 'chunk_audio_original'),
      storageBucket: String(r.storage_bucket ?? 'continuous-memory'),
      storagePath: String(r.storage_path ?? ''),
      mimeType: r.mime_type ?? undefined,
      fileSizeBytes: r.file_size_bytes !== undefined && r.file_size_bytes !== null ? Number(r.file_size_bytes) : undefined,
      checksum: r.checksum ?? undefined,
      durationSeconds: r.duration_seconds !== undefined && r.duration_seconds !== null ? Number(r.duration_seconds) : undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'continuous_memory_jobs') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      sessionId: r.session_id ?? undefined,
      chunkId: r.chunk_id ?? undefined,
      jobType: String(r.job_type ?? 'transcribe_chunk'),
      jobStatus: String(r.job_status ?? 'queued'),
      processorType: r.processor_type ?? undefined,
      processorName: r.processor_name ?? undefined,
      priority: r.priority !== undefined && r.priority !== null ? Number(r.priority) : undefined,
      attemptCount: Number(r.attempt_count ?? 0),
      startedAt: asJsDate(pick(r, 'started_at', 'startedAt')),
      finishedAt: asJsDate(pick(r, 'finished_at', 'finishedAt')),
      latencyMs: r.latency_ms !== undefined && r.latency_ms !== null ? Number(r.latency_ms) : undefined,
      estimatedCost: r.estimated_cost !== undefined && r.estimated_cost !== null ? Number(r.estimated_cost) : undefined,
      tokensIn: r.tokens_in !== undefined && r.tokens_in !== null ? Number(r.tokens_in) : undefined,
      tokensOut: r.tokens_out !== undefined && r.tokens_out !== null ? Number(r.tokens_out) : undefined,
      workflowVersion: r.workflow_version ?? undefined,
      policyVersion: r.policy_version ?? undefined,
      statusNote: r.status_note ?? undefined,
      errorMessage: r.error_message ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'continuous_memory_outputs') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      sessionId: String(r.session_id ?? ''),
      chunkId: r.chunk_id ?? undefined,
      outputType: String(r.output_type ?? 'transcript'),
      content: String(r.content ?? ''),
      version: Number(r.version ?? 1),
      generatedBy: r.generated_by ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'continuous_memory_labels') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id ?? undefined,
      name: String(r.name ?? ''),
      description: r.description ?? undefined,
      color: r.color ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'continuous_memory_chunk_labels') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      chunkId: String(r.chunk_id ?? ''),
      labelId: String(r.label_id ?? ''),
      confidenceScore: r.confidence_score !== undefined && r.confidence_score !== null ? Number(r.confidence_score) : undefined,
      sourceType: String(r.source_type ?? 'system'),
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date()
    };
  }

  if (table === 'continuous_memory_extracted_items') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      sessionId: String(r.session_id ?? ''),
      chunkId: String(r.chunk_id ?? ''),
      itemType: String(r.item_type ?? 'idea'),
      title: String(r.title ?? ''),
      content: String(r.content ?? ''),
      priority: r.priority ?? undefined,
      status: r.status ?? undefined,
      suggestedVentureId: r.suggested_venture_id ?? undefined,
      suggestedProjectId: r.suggested_project_id ?? undefined,
      suggestedAgentId: r.suggested_agent_id ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      reviewedAt: asJsDate(pick(r, 'reviewed_at', 'reviewedAt')),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'continuous_memory_links') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      sessionId: String(r.session_id ?? ''),
      chunkId: r.chunk_id ?? undefined,
      extractedItemId: r.extracted_item_id ?? undefined,
      linkType: String(r.link_type ?? ''),
      linkedEntityId: r.linked_entity_id ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
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

  if (table === 'agent_quality_events') {
    return {
      id: String(r.id),
      eventId: String(pick(r, 'event_id', 'eventId') ?? r.id),
      workspaceId: r.workspace_id,
      ventureId: r.venture_id ?? undefined,
      conversationId: r.conversation_id ?? undefined,
      turnId: r.turn_id ?? undefined,
      agentId: r.agent_id ?? undefined,
      agentName: r.agent_name ?? undefined,
      eventType: r.event_type ?? 'quality_error',
      eventSubtype: r.event_subtype ?? undefined,
      severity: r.severity ?? 'medium',
      detectedBy: r.detected_by ?? 'system',
      messageRef: r.message_ref ?? undefined,
      excerpt: r.excerpt ?? undefined,
      correctionText: r.correction_text ?? undefined,
      modelUsed: r.model_used ?? undefined,
      workflowVersion: r.workflow_version ?? undefined,
      dnaVersion: r.dna_version ?? undefined,
      policyVersion: r.policy_version ?? undefined,
      status: r.status ?? 'open',
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      resolvedAt: asJsDate(pick(r, 'resolved_at', 'resolvedAt')) ?? undefined,
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

  if (table === 'intelligence_flows') {
    return {
      id: String(r.id),
      workspaceId: r.workspace_id,
      ventureId: r.venture_id ?? undefined,
      conversationId: r.conversation_id ?? undefined,
      turnId: r.turn_id ?? undefined,
      executionRunId: r.execution_run_id ?? undefined,
      flowType: r.flow_type ?? 'conversation',
      sourceKind: r.source_kind ?? 'conversation',
      sourceId: r.source_id ?? undefined,
      origin: String(r.origin ?? 'Fluxo'),
      finalAction: String(r.final_action ?? 'Em processamento'),
      status: r.status ?? 'pending',
      participants: Array.isArray(r.participants) ? r.participants : [],
      payload: r.payload ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date()
    };
  }

  if (table === 'intelligence_flow_steps') {
    return {
      id: String(r.id),
      flowId: String(r.flow_id ?? ''),
      workspaceId: String(r.workspace_id ?? ''),
      conversationId: r.conversation_id ?? undefined,
      turnId: r.turn_id ?? undefined,
      stepOrder: Number(r.step_order ?? 0),
      actorType: r.actor_type ?? 'system',
      actorId: r.actor_id ?? undefined,
      actorName: String(r.actor_name ?? 'Sistema'),
      actionType: r.action_type ?? 'analysis',
      status: r.status ?? 'pending',
      modelUsed: r.model_used ?? undefined,
      workflowVersion: r.workflow_version ?? undefined,
      policyVersion: r.policy_version ?? undefined,
      dnaVersion: r.dna_version ?? undefined,
      latencyMs: r.latency_ms !== undefined && r.latency_ms !== null ? Number(r.latency_ms) : undefined,
      estimatedCost: r.estimated_cost !== undefined && r.estimated_cost !== null ? Number(r.estimated_cost) : undefined,
      tokensIn: r.tokens_in !== undefined && r.tokens_in !== null ? Number(r.tokens_in) : undefined,
      tokensOut: r.tokens_out !== undefined && r.tokens_out !== null ? Number(r.tokens_out) : undefined,
      note: r.note ?? undefined,
      eventTime: asJsDate(pick(r, 'event_time', 'eventTime')) ?? new Date(),
      payload: r.payload ?? undefined,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date()
    };
  }

  if (table === 'agent_missions') {
    return {
      id: String(r.id),
      workspaceId: String(r.workspace_id ?? ''),
      title: String(r.title ?? 'Missao'),
      initialInput: String(r.initial_input ?? r.initialInput ?? ''),
      status: r.status ?? 'queued',
      currentStepIndex: Number(r.current_step_index ?? r.currentStepIndex ?? 1),
      createdBy: r.created_by ?? r.createdBy ?? null,
      startedAt: asJsDate(pick(r, 'started_at', 'startedAt')) ?? null,
      finishedAt: asJsDate(pick(r, 'finished_at', 'finishedAt')) ?? null,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'agent_mission_steps') {
    return {
      id: String(r.id),
      workspaceId: String(r.workspace_id ?? ''),
      missionId: String(r.mission_id ?? r.missionId ?? ''),
      stepIndex: Number(r.step_index ?? r.stepIndex ?? 0),
      agentId: r.agent_id ?? r.agentId ?? null,
      agentName: String(r.agent_name ?? r.agentName ?? 'Agente'),
      stepName: String(r.step_name ?? r.stepName ?? 'Etapa'),
      artifactType: String(r.artifact_type ?? r.artifactType ?? 'artifact'),
      status: r.status ?? 'pending',
      validationStatus: r.validation_status ?? r.validationStatus ?? null,
      retryCount: Number(r.retry_count ?? r.retryCount ?? 0),
      promptSnapshot: r.prompt_snapshot ?? r.promptSnapshot ?? null,
      contextSnapshot: r.context_snapshot ?? r.contextSnapshot ?? null,
      errorMessage: r.error_message ?? r.errorMessage ?? null,
      startedAt: asJsDate(pick(r, 'started_at', 'startedAt')) ?? null,
      finishedAt: asJsDate(pick(r, 'finished_at', 'finishedAt')) ?? null,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      updatedAt: asJsDate(pick(r, 'updated_at', 'updatedAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'agent_artifacts') {
    return {
      id: String(r.id),
      workspaceId: String(r.workspace_id ?? ''),
      missionId: String(r.mission_id ?? r.missionId ?? ''),
      stepId: String(r.step_id ?? r.stepId ?? ''),
      artifactType: String(r.artifact_type ?? r.artifactType ?? 'artifact'),
      status: r.status ?? 'created',
      version: Number(r.version ?? 1),
      contentJson: r.content_json ?? r.contentJson ?? null,
      contentText: r.content_text ?? r.contentText ?? null,
      createdByAgentId: r.created_by_agent_id ?? r.createdByAgentId ?? null,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      payload: r.payload ?? undefined
    };
  }

  if (table === 'agent_handoffs') {
    return {
      id: String(r.id),
      workspaceId: String(r.workspace_id ?? ''),
      missionId: String(r.mission_id ?? r.missionId ?? ''),
      fromStepId: String(r.from_step_id ?? r.fromStepId ?? ''),
      toStepId: r.to_step_id ?? r.toStepId ?? null,
      fromAgentId: r.from_agent_id ?? r.fromAgentId ?? null,
      toAgentId: r.to_agent_id ?? r.toAgentId ?? null,
      artifactId: r.artifact_id ?? r.artifactId ?? null,
      status: r.status ?? 'created',
      note: r.note ?? null,
      createdAt: asJsDate(pick(r, 'created_at', 'createdAt')) ?? new Date(),
      acceptedAt: asJsDate(pick(r, 'accepted_at', 'acceptedAt')) ?? null,
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
        'entity_type',
        'entityType',
        'type',
        'short_description',
        'shortDescription',
        'origin',
        'official_role',
        'officialRole',
        'company',
        'unit_name',
        'unitName',
        'area',
        'function_name',
        'functionName',
        'base_role_universal',
        'baseRoleUniversal',
        'tier',
        'role_type',
        'roleType',
        'structural_status',
        'structuralStatus',
        'operational_activation',
        'operationalActivation',
        'dna_status',
        'dnaStatus',
        'operational_class',
        'operationalClass',
        'allowed_stacks',
        'allowedStacks',
        'preferred_model',
        'preferredModel',
        'division',
        'sector',
        'salary',
        'collaborator_type',
        'collaboratorType',
        'ai_mentor',
        'aiMentor',
        'human_owner',
        'humanOwner',
        'custom_fields',
        'customFields',
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
      if (p.entityType !== undefined && p.entity_type === undefined) {
        p.entity_type = p.entityType;
        delete p.entityType;
      }
      if (p.shortDescription !== undefined && p.short_description === undefined) {
        p.short_description = p.shortDescription;
        delete p.shortDescription;
      }
      if (p.officialRole !== undefined && p.official_role === undefined) {
        p.official_role = p.officialRole;
        delete p.officialRole;
      }
      if (p.unitName !== undefined && p.unit_name === undefined) {
        p.unit_name = p.unitName;
        delete p.unitName;
      }
      if (p.functionName !== undefined && p.function_name === undefined) {
        p.function_name = p.functionName;
        delete p.functionName;
      }
      if (p.baseRoleUniversal !== undefined && p.base_role_universal === undefined) {
        p.base_role_universal = p.baseRoleUniversal;
        delete p.baseRoleUniversal;
      }
      if (p.roleType !== undefined && p.role_type === undefined) {
        p.role_type = p.roleType;
        delete p.roleType;
      }
      if (p.structuralStatus !== undefined && p.structural_status === undefined) {
        p.structural_status = p.structuralStatus;
        delete p.structuralStatus;
      }
      if (p.operationalActivation !== undefined && p.operational_activation === undefined) {
        p.operational_activation = p.operationalActivation;
        delete p.operationalActivation;
      }
      if (p.dnaStatus !== undefined && p.dna_status === undefined) {
        p.dna_status = p.dnaStatus;
        delete p.dnaStatus;
      }
      if (p.operationalClass !== undefined && p.operational_class === undefined) {
        p.operational_class = p.operationalClass;
        delete p.operationalClass;
      }
      if (p.allowedStacks !== undefined && p.allowed_stacks === undefined) {
        p.allowed_stacks = p.allowedStacks;
        delete p.allowedStacks;
      }
      if (p.preferredModel !== undefined && p.preferred_model === undefined) {
        p.preferred_model = p.preferredModel;
        delete p.preferredModel;
      }
      if (p.collaboratorType !== undefined && p.collaborator_type === undefined) {
        p.collaborator_type = p.collaboratorType;
        delete p.collaboratorType;
      }
      if (p.aiMentor !== undefined && p.ai_mentor === undefined) {
        p.ai_mentor = p.aiMentor;
        delete p.aiMentor;
      }
      if (p.humanOwner !== undefined && p.human_owner === undefined) {
        p.human_owner = p.humanOwner;
        delete p.humanOwner;
      }
      if (p.customFields !== undefined && p.custom_fields === undefined) {
        p.custom_fields = p.customFields;
        delete p.customFields;
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

  if (table === 'cid_assets') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.ventureId !== undefined) { p.venture_id = p.ventureId; delete p.ventureId; }
    if (p.materialType !== undefined) { p.material_type = p.materialType; delete p.materialType; }
    if (p.ownerUserId !== undefined) { p.owner_user_id = p.ownerUserId; delete p.ownerUserId; }
    if (p.ownerName !== undefined) { p.owner_name = p.ownerName; delete p.ownerName; }
    if (p.desiredAction !== undefined) { p.desired_action = p.desiredAction; delete p.desiredAction; }
    if (p.sourceKind !== undefined) { p.source_kind = p.sourceKind; delete p.sourceKind; }
    if (p.sourceId !== undefined) { p.source_id = p.sourceId; delete p.sourceId; }
    if (p.isConsultable !== undefined) { p.is_consultable = p.isConsultable; delete p.isConsultable; }
    if (p.progressPct !== undefined) { p.progress_pct = p.progressPct; delete p.progressPct; }
    if (p.totalParts !== undefined) { p.total_parts = p.totalParts; delete p.totalParts; }
    if (p.completedParts !== undefined) { p.completed_parts = p.completedParts; delete p.completedParts; }
    if (p.pendingParts !== undefined) { p.pending_parts = p.pendingParts; delete p.pendingParts; }
    if (p.processingStartedAt !== undefined) { p.processing_started_at = p.processingStartedAt; delete p.processingStartedAt; }
    if (p.completedAt !== undefined) { p.completed_at = p.completedAt; delete p.completedAt; }
    if (p.failedAt !== undefined) { p.failed_at = p.failedAt; delete p.failedAt; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'cid_asset_files') {
    if (p.assetId !== undefined) { p.asset_id = p.assetId; delete p.assetId; }
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.mimeType !== undefined) { p.mime_type = p.mimeType; delete p.mimeType; }
    if (p.sizeBytes !== undefined) { p.size_bytes = p.sizeBytes; delete p.sizeBytes; }
    if (p.durationSec !== undefined) { p.duration_sec = p.durationSec; delete p.durationSec; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'cid_batches') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.ventureId !== undefined) { p.venture_id = p.ventureId; delete p.ventureId; }
    if (p.totalItems !== undefined) { p.total_items = p.totalItems; delete p.totalItems; }
    if (p.processedItems !== undefined) { p.processed_items = p.processedItems; delete p.processedItems; }
    if (p.failedItems !== undefined) { p.failed_items = p.failedItems; delete p.failedItems; }
    if (p.createdBy !== undefined) { p.created_by = p.createdBy; delete p.createdBy; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'cid_batch_items') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.batchId !== undefined) { p.batch_id = p.batchId; delete p.batchId; }
    if (p.assetId !== undefined) { p.asset_id = p.assetId; delete p.assetId; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'cid_processing_jobs') {
    if (p.assetId !== undefined) { p.asset_id = p.assetId; delete p.assetId; }
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.batchId !== undefined) { p.batch_id = p.batchId; delete p.batchId; }
    if (p.jobType !== undefined) { p.job_type = p.jobType; delete p.jobType; }
    if (p.actionPlan !== undefined) { p.action_plan = p.actionPlan; delete p.actionPlan; }
    if (p.queuePosition !== undefined) { p.queue_position = p.queuePosition; delete p.queuePosition; }
    if (p.progressPct !== undefined) { p.progress_pct = p.progressPct; delete p.progressPct; }
    if (p.totalParts !== undefined) { p.total_parts = p.totalParts; delete p.totalParts; }
    if (p.completedParts !== undefined) { p.completed_parts = p.completedParts; delete p.completedParts; }
    if (p.pendingParts !== undefined) { p.pending_parts = p.pendingParts; delete p.pendingParts; }
    if (p.maxRetries !== undefined) { p.max_retries = p.maxRetries; delete p.maxRetries; }
    if (p.errorMessage !== undefined) { p.error_message = p.errorMessage; delete p.errorMessage; }
    if (p.startedAt !== undefined) { p.started_at = p.startedAt; delete p.startedAt; }
    if (p.completedAt !== undefined) { p.completed_at = p.completedAt; delete p.completedAt; }
    if (p.failedAt !== undefined) { p.failed_at = p.failedAt; delete p.failedAt; }
    if (p.cancelledAt !== undefined) { p.cancelled_at = p.cancelledAt; delete p.cancelledAt; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'cid_chunks') {
    if (p.assetId !== undefined) { p.asset_id = p.assetId; delete p.assetId; }
    if (p.jobId !== undefined) { p.job_id = p.jobId; delete p.jobId; }
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.chunkIndex !== undefined) { p.chunk_index = p.chunkIndex; delete p.chunkIndex; }
    if (p.chunkKind !== undefined) { p.chunk_kind = p.chunkKind; delete p.chunkKind; }
    if (p.charStart !== undefined) { p.char_start = p.charStart; delete p.charStart; }
    if (p.charEnd !== undefined) { p.char_end = p.charEnd; delete p.charEnd; }
    if (p.byteStart !== undefined) { p.byte_start = p.byteStart; delete p.byteStart; }
    if (p.byteEnd !== undefined) { p.byte_end = p.byteEnd; delete p.byteEnd; }
    if (p.timeStartSec !== undefined) { p.time_start_sec = p.timeStartSec; delete p.timeStartSec; }
    if (p.timeEndSec !== undefined) { p.time_end_sec = p.timeEndSec; delete p.timeEndSec; }
    if (p.textContent !== undefined) { p.text_content = p.textContent; delete p.textContent; }
    if (p.errorMessage !== undefined) { p.error_message = p.errorMessage; delete p.errorMessage; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'cid_outputs') {
    if (p.assetId !== undefined) { p.asset_id = p.assetId; delete p.assetId; }
    if (p.jobId !== undefined) { p.job_id = p.jobId; delete p.jobId; }
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.outputType !== undefined) { p.output_type = p.outputType; delete p.outputType; }
    if (p.contentText !== undefined) { p.content_text = p.contentText; delete p.contentText; }
    if (p.contentJson !== undefined) { p.content_json = p.contentJson; delete p.contentJson; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'cid_tags') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'cid_asset_tags') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.assetId !== undefined) { p.asset_id = p.assetId; delete p.assetId; }
    if (p.tagId !== undefined) { p.tag_id = p.tagId; delete p.tagId; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    delete p.createdAt;
  }

  if (table === 'cid_links') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.assetId !== undefined) { p.asset_id = p.assetId; delete p.assetId; }
    if (p.linkType !== undefined) { p.link_type = p.linkType; delete p.linkType; }
    if (p.linkedId !== undefined) { p.linked_id = p.linkedId; delete p.linkedId; }
    if (p.linkedLabel !== undefined) { p.linked_label = p.linkedLabel; delete p.linkedLabel; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    delete p.createdAt;
  }

  if (table === 'continuous_memory_sessions') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.ventureId !== undefined) { p.venture_id = p.ventureId; delete p.ventureId; }
    if (p.projectId !== undefined) { p.project_id = p.projectId; delete p.projectId; }
    if (p.areaId !== undefined) { p.area_id = p.areaId; delete p.areaId; }
    if (p.sessionDate !== undefined) { p.session_date = p.sessionDate; delete p.sessionDate; }
    if (p.sourceDevice !== undefined) { p.source_device = p.sourceDevice; delete p.sourceDevice; }
    if (p.captureMode !== undefined) { p.capture_mode = p.captureMode; delete p.captureMode; }
    if (p.sensitivityLevel !== undefined) { p.sensitivity_level = p.sensitivityLevel; delete p.sensitivityLevel; }
    if (p.allowAgentReading !== undefined) { p.allow_agent_reading = p.allowAgentReading; delete p.allowAgentReading; }
    if (p.startedAt !== undefined) { p.started_at = p.startedAt; delete p.startedAt; }
    if (p.endedAt !== undefined) { p.ended_at = p.endedAt; delete p.endedAt; }
    if (p.totalChunks !== undefined) { p.total_chunks = p.totalChunks; delete p.totalChunks; }
    if (p.totalDurationSeconds !== undefined) { p.total_duration_seconds = p.totalDurationSeconds; delete p.totalDurationSeconds; }
    if (p.createdBy !== undefined) { p.created_by = p.createdBy; delete p.createdBy; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'continuous_memory_chunks') {
    if (p.sessionId !== undefined) { p.session_id = p.sessionId; delete p.sessionId; }
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.ventureId !== undefined) { p.venture_id = p.ventureId; delete p.ventureId; }
    if (p.projectId !== undefined) { p.project_id = p.projectId; delete p.projectId; }
    if (p.chunkIndex !== undefined) { p.chunk_index = p.chunkIndex; delete p.chunkIndex; }
    if (p.startedAt !== undefined) { p.started_at = p.startedAt; delete p.startedAt; }
    if (p.endedAt !== undefined) { p.ended_at = p.endedAt; delete p.endedAt; }
    if (p.durationSeconds !== undefined) { p.duration_seconds = p.durationSeconds; delete p.durationSeconds; }
    if (p.transcriptStatus !== undefined) { p.transcript_status = p.transcriptStatus; delete p.transcriptStatus; }
    if (p.transcriptText !== undefined) { p.transcript_text = p.transcriptText; delete p.transcriptText; }
    if (p.transcriptConfidence !== undefined) { p.transcript_confidence = p.transcriptConfidence; delete p.transcriptConfidence; }
    if (p.detectedLanguage !== undefined) { p.detected_language = p.detectedLanguage; delete p.detectedLanguage; }
    if (p.noiseScore !== undefined) { p.noise_score = p.noiseScore; delete p.noiseScore; }
    if (p.importanceFlag !== undefined) { p.importance_flag = p.importanceFlag; delete p.importanceFlag; }
    if (p.anchorFlag !== undefined) { p.anchor_flag = p.anchorFlag; delete p.anchorFlag; }
    if (p.sourceContext !== undefined) { p.source_context = p.sourceContext; delete p.sourceContext; }
    if (p.errorMessage !== undefined) { p.error_message = p.errorMessage; delete p.errorMessage; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'continuous_memory_files') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.sessionId !== undefined) { p.session_id = p.sessionId; delete p.sessionId; }
    if (p.chunkId !== undefined) { p.chunk_id = p.chunkId; delete p.chunkId; }
    if (p.fileRole !== undefined) { p.file_role = p.fileRole; delete p.fileRole; }
    if (p.storageBucket !== undefined) { p.storage_bucket = p.storageBucket; delete p.storageBucket; }
    if (p.storagePath !== undefined) { p.storage_path = p.storagePath; delete p.storagePath; }
    if (p.mimeType !== undefined) { p.mime_type = p.mimeType; delete p.mimeType; }
    if (p.fileSizeBytes !== undefined) { p.file_size_bytes = p.fileSizeBytes; delete p.fileSizeBytes; }
    if (p.durationSeconds !== undefined) { p.duration_seconds = p.durationSeconds; delete p.durationSeconds; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    delete p.createdAt;
  }

  if (table === 'continuous_memory_jobs') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.sessionId !== undefined) { p.session_id = p.sessionId; delete p.sessionId; }
    if (p.chunkId !== undefined) { p.chunk_id = p.chunkId; delete p.chunkId; }
    if (p.jobType !== undefined) { p.job_type = p.jobType; delete p.jobType; }
    if (p.jobStatus !== undefined) { p.job_status = p.jobStatus; delete p.jobStatus; }
    if (p.processorType !== undefined) { p.processor_type = p.processorType; delete p.processorType; }
    if (p.processorName !== undefined) { p.processor_name = p.processorName; delete p.processorName; }
    if (p.attemptCount !== undefined) { p.attempt_count = p.attemptCount; delete p.attemptCount; }
    if (p.startedAt !== undefined) { p.started_at = p.startedAt; delete p.startedAt; }
    if (p.finishedAt !== undefined) { p.finished_at = p.finishedAt; delete p.finishedAt; }
    if (p.latencyMs !== undefined) { p.latency_ms = p.latencyMs; delete p.latencyMs; }
    if (p.estimatedCost !== undefined) { p.estimated_cost = p.estimatedCost; delete p.estimatedCost; }
    if (p.tokensIn !== undefined) { p.tokens_in = p.tokensIn; delete p.tokensIn; }
    if (p.tokensOut !== undefined) { p.tokens_out = p.tokensOut; delete p.tokensOut; }
    if (p.workflowVersion !== undefined) { p.workflow_version = p.workflowVersion; delete p.workflowVersion; }
    if (p.policyVersion !== undefined) { p.policy_version = p.policyVersion; delete p.policyVersion; }
    if (p.statusNote !== undefined) { p.status_note = p.statusNote; delete p.statusNote; }
    if (p.errorMessage !== undefined) { p.error_message = p.errorMessage; delete p.errorMessage; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'continuous_memory_outputs') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.sessionId !== undefined) { p.session_id = p.sessionId; delete p.sessionId; }
    if (p.chunkId !== undefined) { p.chunk_id = p.chunkId; delete p.chunkId; }
    if (p.outputType !== undefined) { p.output_type = p.outputType; delete p.outputType; }
    if (p.generatedBy !== undefined) { p.generated_by = p.generatedBy; delete p.generatedBy; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    delete p.createdAt;
  }

  if (table === 'continuous_memory_labels') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    delete p.createdAt;
  }

  if (table === 'continuous_memory_chunk_labels') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.chunkId !== undefined) { p.chunk_id = p.chunkId; delete p.chunkId; }
    if (p.labelId !== undefined) { p.label_id = p.labelId; delete p.labelId; }
    if (p.confidenceScore !== undefined) { p.confidence_score = p.confidenceScore; delete p.confidenceScore; }
    if (p.sourceType !== undefined) { p.source_type = p.sourceType; delete p.sourceType; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    delete p.createdAt;
  }

  if (table === 'continuous_memory_extracted_items') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.sessionId !== undefined) { p.session_id = p.sessionId; delete p.sessionId; }
    if (p.chunkId !== undefined) { p.chunk_id = p.chunkId; delete p.chunkId; }
    if (p.itemType !== undefined) { p.item_type = p.itemType; delete p.itemType; }
    if (p.suggestedVentureId !== undefined) { p.suggested_venture_id = p.suggestedVentureId; delete p.suggestedVentureId; }
    if (p.suggestedProjectId !== undefined) { p.suggested_project_id = p.suggestedProjectId; delete p.suggestedProjectId; }
    if (p.suggestedAgentId !== undefined) { p.suggested_agent_id = p.suggestedAgentId; delete p.suggestedAgentId; }
    if (p.reviewedAt !== undefined) { p.reviewed_at = p.reviewedAt; delete p.reviewedAt; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    delete p.createdAt;
  }

  if (table === 'continuous_memory_links') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.sessionId !== undefined) { p.session_id = p.sessionId; delete p.sessionId; }
    if (p.chunkId !== undefined) { p.chunk_id = p.chunkId; delete p.chunkId; }
    if (p.extractedItemId !== undefined) { p.extracted_item_id = p.extractedItemId; delete p.extractedItemId; }
    if (p.linkType !== undefined) { p.link_type = p.linkType; delete p.linkType; }
    if (p.linkedEntityId !== undefined) { p.linked_entity_id = p.linkedEntityId; delete p.linkedEntityId; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    delete p.createdAt;
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

  if (table === 'agent_quality_events') {
    if (p.eventId !== undefined) { p.event_id = p.eventId; delete p.eventId; }
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.ventureId !== undefined) { p.venture_id = p.ventureId; delete p.ventureId; }
    if (p.conversationId !== undefined) { p.conversation_id = p.conversationId; delete p.conversationId; }
    if (p.turnId !== undefined) { p.turn_id = p.turnId; delete p.turnId; }
    if (p.agentId !== undefined) { p.agent_id = p.agentId; delete p.agentId; }
    if (p.agentName !== undefined) { p.agent_name = p.agentName; delete p.agentName; }
    if (p.eventType !== undefined) { p.event_type = p.eventType; delete p.eventType; }
    if (p.eventSubtype !== undefined) { p.event_subtype = p.eventSubtype; delete p.eventSubtype; }
    if (p.detectedBy !== undefined) { p.detected_by = p.detectedBy; delete p.detectedBy; }
    if (p.messageRef !== undefined) { p.message_ref = p.messageRef; delete p.messageRef; }
    if (p.correctionText !== undefined) { p.correction_text = p.correctionText; delete p.correctionText; }
    if (p.modelUsed !== undefined) { p.model_used = p.modelUsed; delete p.modelUsed; }
    if (p.workflowVersion !== undefined) { p.workflow_version = p.workflowVersion; delete p.workflowVersion; }
    if (p.dnaVersion !== undefined) { p.dna_version = p.dnaVersion; delete p.dnaVersion; }
    if (p.policyVersion !== undefined) { p.policy_version = p.policyVersion; delete p.policyVersion; }
    if (p.resolvedAt !== undefined) { p.resolved_at = p.resolvedAt; delete p.resolvedAt; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    delete p.createdAt;
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

  if (table === 'intelligence_flows') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.ventureId !== undefined) { p.venture_id = p.ventureId; delete p.ventureId; }
    if (p.conversationId !== undefined) { p.conversation_id = p.conversationId; delete p.conversationId; }
    if (p.turnId !== undefined) { p.turn_id = p.turnId; delete p.turnId; }
    if (p.executionRunId !== undefined) { p.execution_run_id = p.executionRunId; delete p.executionRunId; }
    if (p.flowType !== undefined) { p.flow_type = p.flowType; delete p.flowType; }
    if (p.sourceKind !== undefined) { p.source_kind = p.sourceKind; delete p.sourceKind; }
    if (p.sourceId !== undefined) { p.source_id = p.sourceId; delete p.sourceId; }
    if (p.finalAction !== undefined) { p.final_action = p.finalAction; delete p.finalAction; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'intelligence_flow_steps') {
    if (p.flowId !== undefined) { p.flow_id = p.flowId; delete p.flowId; }
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.conversationId !== undefined) { p.conversation_id = p.conversationId; delete p.conversationId; }
    if (p.turnId !== undefined) { p.turn_id = p.turnId; delete p.turnId; }
    if (p.stepOrder !== undefined) { p.step_order = p.stepOrder; delete p.stepOrder; }
    if (p.actorType !== undefined) { p.actor_type = p.actorType; delete p.actorType; }
    if (p.actorId !== undefined) { p.actor_id = p.actorId; delete p.actorId; }
    if (p.actorName !== undefined) { p.actor_name = p.actorName; delete p.actorName; }
    if (p.actionType !== undefined) { p.action_type = p.actionType; delete p.actionType; }
    if (p.modelUsed !== undefined) { p.model_used = p.modelUsed; delete p.modelUsed; }
    if (p.workflowVersion !== undefined) { p.workflow_version = p.workflowVersion; delete p.workflowVersion; }
    if (p.policyVersion !== undefined) { p.policy_version = p.policyVersion; delete p.policyVersion; }
    if (p.dnaVersion !== undefined) { p.dna_version = p.dnaVersion; delete p.dnaVersion; }
    if (p.latencyMs !== undefined) { p.latency_ms = p.latencyMs; delete p.latencyMs; }
    if (p.estimatedCost !== undefined) { p.estimated_cost = p.estimatedCost; delete p.estimatedCost; }
    if (p.tokensIn !== undefined) { p.tokens_in = p.tokensIn; delete p.tokensIn; }
    if (p.tokensOut !== undefined) { p.tokens_out = p.tokensOut; delete p.tokensOut; }
    if (p.eventTime !== undefined) { p.event_time = p.eventTime; delete p.eventTime; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    delete p.createdAt;
  }

  if (table === 'agent_missions') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.initialInput !== undefined) { p.initial_input = p.initialInput; delete p.initialInput; }
    if (p.currentStepIndex !== undefined) { p.current_step_index = p.currentStepIndex; delete p.currentStepIndex; }
    if (p.createdBy !== undefined) { p.created_by = p.createdBy; delete p.createdBy; }
    if (p.startedAt !== undefined) { p.started_at = p.startedAt; delete p.startedAt; }
    if (p.finishedAt !== undefined) { p.finished_at = p.finishedAt; delete p.finishedAt; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'agent_mission_steps') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.missionId !== undefined) { p.mission_id = p.missionId; delete p.missionId; }
    if (p.stepIndex !== undefined) { p.step_index = p.stepIndex; delete p.stepIndex; }
    if (p.agentId !== undefined) { p.agent_id = p.agentId; delete p.agentId; }
    if (p.agentName !== undefined) { p.agent_name = p.agentName; delete p.agentName; }
    if (p.stepName !== undefined) { p.step_name = p.stepName; delete p.stepName; }
    if (p.artifactType !== undefined) { p.artifact_type = p.artifactType; delete p.artifactType; }
    if (p.validationStatus !== undefined) { p.validation_status = p.validationStatus; delete p.validationStatus; }
    if (p.retryCount !== undefined) { p.retry_count = p.retryCount; delete p.retryCount; }
    if (p.promptSnapshot !== undefined) { p.prompt_snapshot = p.promptSnapshot; delete p.promptSnapshot; }
    if (p.contextSnapshot !== undefined) { p.context_snapshot = p.contextSnapshot; delete p.contextSnapshot; }
    if (p.errorMessage !== undefined) { p.error_message = p.errorMessage; delete p.errorMessage; }
    if (p.startedAt !== undefined) { p.started_at = p.startedAt; delete p.startedAt; }
    if (p.finishedAt !== undefined) { p.finished_at = p.finishedAt; delete p.finishedAt; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    if (p.updatedAt !== undefined && p.updated_at === undefined) { p.updated_at = p.updatedAt; }
    delete p.createdAt;
    delete p.updatedAt;
  }

  if (table === 'agent_artifacts') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.missionId !== undefined) { p.mission_id = p.missionId; delete p.missionId; }
    if (p.stepId !== undefined) { p.step_id = p.stepId; delete p.stepId; }
    if (p.artifactType !== undefined) { p.artifact_type = p.artifactType; delete p.artifactType; }
    if (p.contentJson !== undefined) { p.content_json = p.contentJson; delete p.contentJson; }
    if (p.contentText !== undefined) { p.content_text = p.contentText; delete p.contentText; }
    if (p.createdByAgentId !== undefined) { p.created_by_agent_id = p.createdByAgentId; delete p.createdByAgentId; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    delete p.createdAt;
  }

  if (table === 'agent_handoffs') {
    if (p.workspaceId !== undefined) { p.workspace_id = p.workspaceId; delete p.workspaceId; }
    if (p.missionId !== undefined) { p.mission_id = p.missionId; delete p.missionId; }
    if (p.fromStepId !== undefined) { p.from_step_id = p.fromStepId; delete p.fromStepId; }
    if (p.toStepId !== undefined) { p.to_step_id = p.toStepId; delete p.toStepId; }
    if (p.fromAgentId !== undefined) { p.from_agent_id = p.fromAgentId; delete p.fromAgentId; }
    if (p.toAgentId !== undefined) { p.to_agent_id = p.toAgentId; delete p.toAgentId; }
    if (p.artifactId !== undefined) { p.artifact_id = p.artifactId; delete p.artifactId; }
    if (p.acceptedAt !== undefined) { p.accepted_at = p.acceptedAt; delete p.acceptedAt; }
    if (p.createdAt !== undefined && p.created_at === undefined) { p.created_at = p.createdAt; }
    delete p.createdAt;
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
  let payloadColumnUnavailable = false;
  const maxAttempts = Math.max(30, Object.keys(body).length + 15);
  let lastErrorMessage = '';

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await restFetch(table, { method: 'POST', body });
    } catch (error: any) {
      if (error?.status !== 400) throw error;
      lastErrorMessage = String(error?.details?.message || error?.message || '');

      const missingColumn = parseMissingColumn(error, table);
      if (!missingColumn || removed.has(missingColumn)) throw error;

      if (missingColumn === 'payload') {
        delete body.payload;
        payloadColumnUnavailable = true;
        removed.add(missingColumn);
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(body, missingColumn)) {
        const value = body[missingColumn];
        delete body[missingColumn];

        // Tenta preservar o valor em payload quando possível.
        if (!payloadColumnUnavailable) {
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
    message: `Falha ao inserir em ${table} após tentativas de compatibilidade de schema.${lastErrorMessage ? ` Detalhe: ${lastErrorMessage}` : ''}`
  });
};

const patchWithSchemaFallback = async (
  table: string,
  query: URLSearchParams,
  initialBody: Record<string, any>
) => {
  const body: Record<string, any> = { ...initialBody };
  const removed = new Set<string>();
  let payloadColumnUnavailable = false;
  const maxAttempts = Math.max(30, Object.keys(body).length + 15);
  let lastErrorMessage = '';

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await restFetch(table, { method: 'PATCH', query, body });
    } catch (error: any) {
      if (error?.status !== 400) throw error;
      lastErrorMessage = String(error?.details?.message || error?.message || '');

      const missingColumn = parseMissingColumn(error, table);
      const nonUpdatableColumn = parseNonUpdatableColumn(error);
      const targetColumn = missingColumn || nonUpdatableColumn;
      if (!targetColumn || removed.has(targetColumn)) throw error;

      if (targetColumn === 'payload' && missingColumn) {
        delete body.payload;
        payloadColumnUnavailable = true;
        removed.add(targetColumn);
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(body, targetColumn)) {
        const value = body[targetColumn];
        delete body[targetColumn];

        if (missingColumn && targetColumn !== 'payload' && !payloadColumnUnavailable) {
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
    message: `Falha ao atualizar ${table} após tentativas de compatibilidade de schema.${lastErrorMessage ? ` Detalhe: ${lastErrorMessage}` : ''}`
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
  if (table === 'agents' || table === 'workspace_members' || table === 'agent_configs' || table === 'agent_memories' || table === 'agent_quality_events') return 15000;
  if (
    table === 'governance_global_culture' ||
    table === 'governance_compliance_rules' ||
    table === 'vault_items' ||
    table === 'knowledge_nodes'
  ) return 20000;
  if (
    table === 'cid_assets' ||
    table === 'cid_processing_jobs' ||
    table === 'cid_outputs' ||
    table === 'cid_chunks' ||
    table === 'cid_batches' ||
    table === 'cid_batch_items'
  ) return 7000;
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
