import { db, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc } from '../services/supabase';
import { Message, Sender } from '../types';

export const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

type AnyRecord = Record<string, any>;

interface SessionLookupParams {
  workspaceId?: string | null;
  agentId: string;
  buId?: string;
}

interface CreateSessionParams {
  workspaceId?: string | null;
  agentId: string;
  ownerUserId?: string | null;
  buId?: string;
  title: string;
  payload?: Record<string, any>;
}

interface AppendMessageParams {
  workspaceId?: string | null;
  sessionId: string;
  agentId: string;
  sender: Sender;
  text: string;
  buId?: string;
  participantName?: string;
  attachment?: any;
  isStreaming?: boolean;
}

interface ChatSessionRecord {
  id: string;
  workspaceId: string;
  agentId: string;
  ownerUserId?: string;
  title: string;
  status?: string;
  buId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  payload?: Record<string, any>;
}

const asDate = (value: any): Date => {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const asSender = (sender: any): Sender => {
  if (sender === Sender.User || sender === Sender.Bot || sender === Sender.System) return sender;
  if (sender === 'user' || sender === 'bot' || sender === 'system') return sender as Sender;
  return Sender.Bot;
};

export const resolveWorkspaceId = (workspaceId?: string | null): string => {
  return workspaceId && workspaceId.trim() ? workspaceId : DEFAULT_WORKSPACE_ID;
};

const runOnce = <T>(ref: any, mapper: (snapshot: any) => T, fallback: T): Promise<T> => {
  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(fallback);
    }, 7000);

    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(mapper(snapshot));
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(fallback);
      }
    );
  });
};

export const findLatestSession = async ({
  workspaceId,
  agentId,
  buId
}: SessionLookupParams): Promise<ChatSessionRecord | null> => {
  const scopedWorkspaceId = resolveWorkspaceId(workspaceId);
  const filters: any[] = [
    where('workspaceId', '==', scopedWorkspaceId),
    where('agentId', '==', agentId),
    orderBy('lastMessageAt', 'desc')
  ];
  if (buId) filters.push(where('buId', '==', buId));

  const q = query(collection(db, 'chat_sessions'), ...filters);

  return runOnce(
    q,
    (snapshot) => {
      const first = snapshot.docs[0];
      if (!first) return null;
      const data = first.data() as AnyRecord;
      return {
        id: String(data.id || first.id),
        workspaceId: String(data.workspaceId || scopedWorkspaceId),
        agentId: String(data.agentId || agentId),
        ownerUserId: data.ownerUserId,
        title: String(data.title || 'Nova Conversa'),
        status: data.status,
        buId: data.buId,
        createdAt: asDate(data.createdAt),
        updatedAt: asDate(data.updatedAt),
        lastMessageAt: asDate(data.lastMessageAt),
        payload: data.payload
      };
    },
    null
  );
};

export const loadSessionMessages = async ({
  workspaceId,
  sessionId
}: {
  workspaceId?: string | null;
  sessionId: string;
}): Promise<Message[]> => {
  const scopedWorkspaceId = resolveWorkspaceId(workspaceId);
  const q = query(
    collection(db, 'chat_messages'),
    where('workspaceId', '==', scopedWorkspaceId),
    where('sessionId', '==', sessionId),
    orderBy('createdAt', 'asc')
  );

  return runOnce(
    q,
    (snapshot) =>
      snapshot.docs.map((row: any) => {
        const data = row.data() as AnyRecord;
        return {
          id: String(data.id || row.id),
          text: String(data.text || ''),
          sender: asSender(data.sender),
          timestamp: asDate(data.createdAt),
          buId: String(data.buId || ''),
          isStreaming: Boolean(data.payload?.isStreaming),
          participantName: data.participantName,
          attachment: data.attachment
        } as Message;
      }),
    []
  );
};

export const createSession = async ({
  workspaceId,
  agentId,
  ownerUserId,
  buId,
  title,
  payload
}: CreateSessionParams): Promise<string> => {
  const now = new Date();
  const sessionRef = await addDoc(collection(db, 'chat_sessions'), {
    workspaceId: resolveWorkspaceId(workspaceId),
    agentId,
    ownerUserId: ownerUserId || null,
    buId: buId || null,
    title,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    payload: payload || {}
  });
  return sessionRef.id;
};

export const appendMessage = async ({
  workspaceId,
  sessionId,
  agentId,
  sender,
  text,
  buId,
  participantName,
  attachment,
  isStreaming
}: AppendMessageParams) => {
  return addDoc(collection(db, 'chat_messages'), {
    workspaceId: resolveWorkspaceId(workspaceId),
    sessionId,
    agentId,
    sender,
    text,
    buId: buId || null,
    participantName: participantName || null,
    hasAttachment: Boolean(attachment),
    attachment: attachment || null,
    createdAt: new Date(),
    isStreaming: Boolean(isStreaming)
  });
};

export const updateMessage = async (messageId: string, payload: Record<string, any>) => {
  await updateDoc(doc(db, 'chat_messages', messageId), payload);
};

export const touchSession = async (sessionId: string) => {
  const now = new Date();
  await updateDoc(doc(db, 'chat_sessions', sessionId), {
    updatedAt: now,
    lastMessageAt: now
  });
};
