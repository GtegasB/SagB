const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars ausentes: VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY');
}

const AUTH_STORAGE_KEY = 'sagb_supabase_session';
const authListeners = new Set<(event: string, session: any) => void>();

const getStoredSession = () => {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

const setStoredSession = (session: any | null) => {
  if (typeof localStorage === 'undefined') return;
  if (!session) localStorage.removeItem(AUTH_STORAGE_KEY);
  else localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

const emitAuth = (event: string, session: any) => {
  authListeners.forEach((listener) => listener(event, session));
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
  if (!res.ok) {
    throw { code: json?.error_code || json?.error || 'auth/error', message: json?.msg || json?.error_description || 'Erro de autenticação' };
  }
  return json;
};

const restFetch = async (table: string, options: { method?: string; query?: URLSearchParams; body?: any } = {}, accessToken?: string) => {
  const session = getStoredSession();
  const token = accessToken || session?.access_token;
  const queryString = options.query ? `?${options.query.toString()}` : '';

  const res = await fetch(`${supabaseUrl}/rest/v1/${table}${queryString}`, {
    method: options.method || 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token || supabaseAnonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw data;
  return data;
};

export const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const data = await supabaseAuthFetch('/token?grant_type=password', { email, password });
    const session = { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
    setStoredSession(session);
    emitAuth('SIGNED_IN', session);
    return { data: { user: data.user, session }, error: null };
  },

  async signUp({ email, password }: { email: string; password: string }) {
    const data = await supabaseAuthFetch('/signup', { email, password });
    const session = data.access_token ? { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user } : null;
    if (session) {
      setStoredSession(session);
      emitAuth('SIGNED_IN', session);
    }
    return { data: { user: data.user, session }, error: null };
  },

  async signOut() {
    const session = getStoredSession();
    if (session?.access_token) {
      await fetch(`${supabaseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${session.access_token}` }
      }).catch(() => null);
    }
    setStoredSession(null);
    emitAuth('SIGNED_OUT', null);
    return { error: null };
  },

  async getUser() {
    const session = getStoredSession();
    if (!session?.access_token) return { data: { user: null }, error: null };
    try {
      const data = await supabaseAuthFetch('/user', undefined, session.access_token);
      return { data: { user: data }, error: null };
    } catch {
      return { data: { user: session.user || null }, error: null };
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

export const db = { provider: 'supabase-rest' };
export type User = Awaited<ReturnType<typeof auth.getUser>>['data']['user'];

type CollectionRef = { kind: 'collection'; table: string };
type DocRef = { kind: 'doc'; table: string; id: string };
type QueryRef = {
  kind: 'query';
  table: string;
  filters: Array<{ field: string; op: string; value: any }>;
  order?: { field: string; direction: 'asc' | 'desc' };
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

const normalizePayload = (payload: Record<string, any>) => {
  const normalized: Record<string, any> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) return;
    if (value instanceof Timestamp) normalized[key] = value.toDate().toISOString();
    else normalized[key] = value;
  });
  return normalized;
};

const convertTimestamps = (record: Record<string, any>) => {
  const out: Record<string, any> = { ...record };
  Object.entries(out).forEach(([key, value]) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) out[key] = Timestamp.fromDate(date);
    }
  });
  return out;
};
const normalizeRecordForTable = (table: string, record: Record<string, any>) => {
  const r: Record<string, any> = { ...record };

  // Common: tolerate snake_case vs camelCase and ensure frequently used string fields exist.
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null) return v;
    }
    return undefined;
  };

  if (table === 'ventures') {
    r.name = pick('name', 'brandName', 'brand_name', 'brand', 'title') ?? '';
    r.brandName = pick('brandName', 'brand_name', 'name') ?? r.name;

    // Logo
    r.logo = pick('logo', 'logoUrl', 'logo_url') ?? null;
    r.logoUrl = pick('logoUrl', 'logo_url', 'logo') ?? r.logo;

    // Initiative / Type
    r.type = pick('type', 'initiative') ?? 'Marca';
    r.initiative = pick('initiative', 'type') ?? r.type;

    // Lab status
    r.statusLab = pick('statusLab', 'labStatus', 'lab_status') ?? 'Pendente';
    r.labStatus = pick('labStatus', 'lab_status', 'statusLab') ?? r.statusLab;

    // Other fields
    r.status = pick('status') ?? 'DESENVOLVIMENTO';
    r.niche = pick('niche') ?? '';
    r.segment = pick('segment') ?? '';
    r.sphere = pick('sphere') ?? '';
    r.url = pick('url') ?? '';
  }

  if (table === 'agents') {
    r.name = pick('name', 'agentName', 'title') ?? '';
    r.officialRole = pick('officialRole', 'role', 'role_name') ?? '';
    r.role = pick('role', 'officialRole') ?? r.officialRole;
  }

  if (table === 'users') {
    r.email = pick('email') ?? '';
    r.displayName = pick('display_name', 'displayName', 'name') ?? '';
    r.role = pick('role') ?? 'member';
    r.roleName = pick('roleName', 'role_name', 'role') ?? r.role;
  }

  return r;
};

const normalizePayloadForTable = (table: string, payload: Record<string, any>) => {
  const p: Record<string, any> = normalizePayload(payload);

  const del = (...keys: string[]) => keys.forEach((k) => { if (k in p) delete p[k]; });

  // Remove Firestore-only or generated fields that cannot be inserted/updated directly in SQL tables
  del('id', 'createdAt', 'updatedAt', 'timestamp');

  if (table === 'ventures') {
    // Map UI keys to DB columns
    if (p.name !== undefined && p.brand_name === undefined) { p.brand_name = p.name; }
    if (p.logo !== undefined && p.logo_url === undefined) { p.logo_url = p.logo; }
    if (p.type !== undefined && p.initiative === undefined) { p.initiative = p.type; }
    if (p.statusLab !== undefined && p.lab_status === undefined) { p.lab_status = p.statusLab; }

    // Clean up UI-only keys that don't exist as columns
    del('name', 'brandName', 'logo', 'logoUrl', 'type', 'statusLab', 'labStatus');
  }

  if (table === 'users') {
    // Ensure profiles can be updated without touching auth.users
    if (p.displayName !== undefined && p.display_name === undefined) { p.display_name = p.displayName; }
    del('displayName');
  }

  return p;
};


export const collection = (_db: typeof db, table: string): CollectionRef => ({ kind: 'collection', table });
export const doc = (_dbOrCollection: typeof db | CollectionRef, tableOrId: string, id?: string): DocRef => {
  if (id) return { kind: 'doc', table: tableOrId, id };
  const collectionRef = _dbOrCollection as CollectionRef;
  return { kind: 'doc', table: collectionRef.table, id: tableOrId };
};

export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc') => ({ type: 'orderBy' as const, field, direction });
export const where = (field: string, op: string, value: any) => ({ type: 'where' as const, field, op, value });

export const query = (collectionRef: CollectionRef, ...constraints: Array<ReturnType<typeof orderBy> | ReturnType<typeof where>>): QueryRef => {
  const queryRef: QueryRef = { kind: 'query', table: collectionRef.table, filters: [] };
  constraints.forEach((constraint) => {
    if (constraint.type === 'orderBy') queryRef.order = { field: constraint.field, direction: constraint.direction };
    if (constraint.type === 'where') queryRef.filters.push({ field: constraint.field, op: constraint.op, value: constraint.value });
  });
  return queryRef;
};

const runQuery = async (ref: CollectionRef | QueryRef) => {
  const params = new URLSearchParams();
  params.set('select', '*');

  if (ref.kind === 'query') {
    ref.filters.forEach((f) => {
      const opMap: Record<string, string> = { '==': 'eq', '!=': 'neq', '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte' };
      params.set(f.field, `${opMap[f.op] || 'eq'}.${String(f.value)}`);
    });

    if (ref.order) params.set('order', `${ref.order.field}.${ref.order.direction}`);
  }

  return restFetch(ref.table, { method: 'GET', query: params });
};

const buildCollectionSnapshot = (records: any[], table?: string) => ({ docs: records.map((record) => ({ id: String(record.id), data: () => (table ? normalizeRecordForTable(table, convertTimestamps(record)) : convertTimestamps(record)) })) });
const buildDocSnapshot = (record: any | null, table?: string) => ({ exists: () => Boolean(record), data: () => (record ? (table ? normalizeRecordForTable(table, convertTimestamps(record)) : convertTimestamps(record)) : undefined) });

export const onSnapshot = (ref: AnyRef, callback: (snapshot: any) => void, onError?: (error: any) => void) => {
  let active = true;

  const emit = async () => {
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
    }
  };

  emit();
  const timer = setInterval(emit, 5000);

  return () => {
    active = false;
    clearInterval(timer);
  };
};

export const addDoc = async (collectionRef: CollectionRef, payload: Record<string, any>) => {
  const body = normalizePayloadForTable(collectionRef.table, payload);
  const data = await restFetch(collectionRef.table, { method: 'POST', body });
  const inserted = Array.isArray(data) ? data[0] : data;

  // Conveniência: ao criar uma venture, já vincula o usuário atual como admin nela
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
        console.warn('Falha ao vincular usuário à venture recém-criada (user_ventures).', e);
      }
    }
  }

  return { ...doc(db, collectionRef.table, String(inserted.id)), id: String(inserted.id) };
};

export const updateDoc = async (docRef: DocRef, payload: Record<string, any>) => {
  const params = new URLSearchParams();
  params.set('id', `eq.${docRef.id}`);
  await restFetch(docRef.table, { method: 'PATCH', query: params, body: normalizePayload(payload) });
};

export const setDoc = async (docRef: DocRef, payload: Record<string, any>, _options?: { merge?: boolean }) => {
  const body = { id: docRef.id, ...normalizePayload(payload) };
  await restFetch(docRef.table, { method: 'POST', body });
};

export const deleteDoc = async (docRef: DocRef) => {
  const params = new URLSearchParams();
  params.set('id', `eq.${docRef.id}`);
  await restFetch(docRef.table, { method: 'DELETE', query: params });
};

export const signInWithEmailAndPassword = async (_auth: typeof auth, email: string, password: string) => {
  const { data } = await auth.signInWithPassword({ email, password });
  return { user: data.user };
};

export const createUserWithEmailAndPassword = async (_auth: typeof auth, email: string, password: string) => {
  const { data } = await auth.signUp({ email, password });
  return { user: data.user };
};

export const signOut = async (_auth: typeof auth) => auth.signOut();

export const onAuthStateChanged = (_auth: typeof auth, callback: (user: User | null) => void) => {
  auth.getUser().then(({ data }) => callback(data.user ?? null));
  const { data } = auth.onAuthStateChange((_event, session) => callback(session?.user ?? null));
  return () => data.subscription.unsubscribe();
};

export default VenturesView;
