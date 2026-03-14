import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ContinuousMemoryChunk,
  ContinuousMemoryChunkLabel,
  ContinuousMemoryExtractedItem,
  ContinuousMemoryFile,
  ContinuousMemoryJob,
  ContinuousMemoryLabel,
  ContinuousMemoryLink,
  ContinuousMemoryOutput,
  ContinuousMemorySession,
  UserProfile,
  Venture
} from '../types';
import { BackIcon, FileTextIcon, MicIcon, SearchIcon, StopCircleIcon } from './Icon';
import { collection, db, onSnapshot, orderBy, query, where } from '../services/supabase';
import { resolveWorkspaceId } from '../utils/supabaseChat';
import {
  compactContinuousMemoryLocalAudio,
  DEFAULT_CHUNK_MINUTES,
  ingestContinuousMemoryChunk,
  loadContinuousMemoryAudioUrl,
  loadContinuousMemoryLocalState,
  retryContinuousMemoryChunk,
  startContinuousMemorySession,
  updateContinuousMemorySession,
  type ContinuousMemoryPersistenceMode
} from '../services/continuousMemory';

type ContinuousMemoryTab = 'line' | 'organization' | 'summaries' | 'extractions' | 'intelligence';

interface ContinuousMemoryViewProps {
  workspaceId?: string | null;
  ownerUserId?: string | null;
  userProfile?: UserProfile | null;
  ventures?: Venture[];
  onBack?: () => void;
}

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';
const LOCAL_WHISPER_HEALTH_URL = (() => {
  const rawUrl = String(import.meta.env.VITE_LOCAL_WHISPER_URL || '').trim();
  if (!rawUrl) return '';
  return `${rawUrl.replace(/\/+$/, '')}/health`;
})();

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const sameDay = (a: Date, b: Date) => (
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()
);

const fmtTime = (value?: Date | null) => value ? value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
const fmtDateTime = (value?: Date | null) => value ? value.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
const fmtDuration = (seconds?: number | null) => {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
};

const formatChunkDurationLabel = (minutes?: number | null) => {
  const numeric = Number(minutes || 0);
  if (!numeric) return '0 min';
  if (numeric < 1) return `${Math.round(numeric * 60)}s`;
  if (Number.isInteger(numeric)) return `${numeric} min`;
  return `${numeric.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} min`;
};

type ExecutionFlowState = 'idle' | 'active' | 'success' | 'warning' | 'error';

const executionFlowTone = (state: ExecutionFlowState) => {
  if (state === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (state === 'active') return 'border-cyan-200 bg-cyan-50 text-cyan-800';
  if (state === 'warning') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (state === 'error') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-slate-200 bg-white text-slate-500';
};

const deriveFileExtension = (mimeType?: string | null, storagePath?: string | null) => {
  const namedExt = String(storagePath || '').split('.').pop();
  if (namedExt && /^[a-z0-9]{2,5}$/i.test(namedExt)) return namedExt.toLowerCase();
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('mp4')) return 'm4a';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('ogg')) return 'ogg';
  return 'webm';
};

const sessionStatusLabel = (value: string) => {
  const map: Record<string, string> = {
    draft: 'Rascunho',
    live: 'Ativa',
    paused: 'Pausada',
    ended: 'Encerrada',
    processing: 'Processando',
    completed: 'Concluida',
    error: 'Erro'
  };
  return map[String(value || '').toLowerCase()] || 'Ativa';
};

const chunkStatusLabel = (value: string) => {
  const map: Record<string, string> = {
    queued: 'Na fila',
    capturing: 'Captando',
    captured: 'Captado',
    uploading: 'Salvando audio',
    stored: 'Audio salvo',
    transcribing: 'Transcrevendo',
    classified: 'Classificado',
    completed: 'Pronto',
    completed_warning: 'Concluido com aviso',
    error: 'Erro',
    retrying: 'Reprocessando'
  };
  return map[String(value || '').toLowerCase()] || 'Pronto';
};

const jobStatusLabel = (value: string) => {
  const map: Record<string, string> = {
    queued: 'Na fila',
    running: 'Executando',
    completed: 'Concluido',
    completed_warning: 'Concluido com aviso',
    error: 'Erro',
    cancelled: 'Cancelado',
    retrying: 'Reprocessando'
  };
  return map[String(value || '').toLowerCase()] || 'Executando';
};

const statusBadge = (value: string) => {
  const normalized = String(value || '').toLowerCase();
  if (['completed', 'stored'].includes(normalized)) return 'bg-emerald-100 text-emerald-700';
  if (['completed_warning'].includes(normalized)) return 'bg-amber-100 text-amber-800';
  if (['live', 'transcribing', 'capturing', 'processing', 'retrying', 'running'].includes(normalized)) return 'bg-cyan-100 text-cyan-800';
  if (['paused', 'queued', 'draft'].includes(normalized)) return 'bg-amber-100 text-amber-800';
  if (['error', 'cancelled'].includes(normalized)) return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-700';
};

const chunkVisualStatus = (chunk?: ContinuousMemoryChunk | null) => {
  if (!chunk) return 'queued';
  if (String(chunk.status) === 'completed' && String(chunk.transcriptStatus) === 'error') return 'completed_warning';
  return String(chunk.status || 'queued');
};

const transcriptStatusLabel = (value: string) => {
  const map: Record<string, string> = {
    pending: 'Pendente',
    processing: 'Processando',
    completed: 'Concluida',
    error: 'Erro',
    retrying: 'Reprocessando'
  };
  return map[String(value || '').toLowerCase()] || 'Pendente';
};

const renderMetric = (label: string, value: string | number, tone: string) => (
  <div className={`rounded-[28px] border ${tone} p-5`}>
    <span className="text-[10px] uppercase tracking-[0.35em] font-black opacity-70 block mb-3">{label}</span>
    <strong className="text-3xl font-black tracking-tight">{value}</strong>
  </div>
);

const MicPulse: React.FC<{ active: boolean }> = ({ active }) => (
  <span className="relative inline-flex w-3.5 h-3.5 items-center justify-center">
    {active && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/45 animate-ping" />}
    <span className={`relative inline-flex h-3 w-3 rounded-full ${active ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]' : 'bg-slate-300'}`} />
  </span>
);

const groupCount = (values: string[]) => {
  const map = new Map<string, number>();
  values.forEach((value) => {
    const key = String(value || 'sem grupo').trim() || 'sem grupo';
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
};

const buildSummary = (title: string, chunks: ContinuousMemoryChunk[], items: ContinuousMemoryExtractedItem[]) => {
  if (chunks.length === 0) return `${title}: sem material captado ainda.`;
  const transcripts = chunks
    .map((chunk) => String(chunk.transcriptText || '').trim())
    .filter(Boolean)
    .slice(0, 4);
  const extracted = items.slice(0, 4).map((item) => `${item.itemType}: ${item.title}`);
  const transcriptText = transcripts.length > 0 ? transcripts.join(' ') : 'Sem transcricao consolidada.';
  return `${title}: ${transcriptText.slice(0, 280)}${transcriptText.length > 280 ? '...' : ''}${extracted.length > 0 ? ` | Extrações: ${extracted.join(' | ')}` : ''}`;
};

const ContinuousMemoryView: React.FC<ContinuousMemoryViewProps> = ({
  workspaceId,
  ownerUserId,
  userProfile,
  ventures = [],
  onBack
}) => {
  const scopedWorkspaceId = resolveWorkspaceId(workspaceId || DEFAULT_WORKSPACE_ID);
  const [activeTab, setActiveTab] = useState<ContinuousMemoryTab>('line');
  const [persistenceMode, setPersistenceMode] = useState<ContinuousMemoryPersistenceMode>('remote');
  const [tableMissing, setTableMissing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [ventureFilter, setVentureFilter] = useState('all');
  const [labelFilter, setLabelFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [chunkMinutes, setChunkMinutes] = useState(DEFAULT_CHUNK_MINUTES);
  const [allowAgentReading, setAllowAgentReading] = useState(true);
  const [sensitivityLevel, setSensitivityLevel] = useState('restricted');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [localWhisperOnline, setLocalWhisperOnline] = useState<boolean | null>(null);
  const [currentChunkElapsedMs, setCurrentChunkElapsedMs] = useState(0);

  const [sessions, setSessions] = useState<ContinuousMemorySession[]>([]);
  const [chunks, setChunks] = useState<ContinuousMemoryChunk[]>([]);
  const [files, setFiles] = useState<ContinuousMemoryFile[]>([]);
  const [jobs, setJobs] = useState<ContinuousMemoryJob[]>([]);
  const [outputs, setOutputs] = useState<ContinuousMemoryOutput[]>([]);
  const [labels, setLabels] = useState<ContinuousMemoryLabel[]>([]);
  const [chunkLabels, setChunkLabels] = useState<ContinuousMemoryChunkLabel[]>([]);
  const [extractedItems, setExtractedItems] = useState<ContinuousMemoryExtractedItem[]>([]);
  const [links, setLinks] = useState<ContinuousMemoryLink[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkWindowStartedAtRef = useRef<Date | null>(null);
  const chunkIndexRef = useRef<number>(1);
  const activeSessionRef = useRef<ContinuousMemorySession | null>(null);
  const objectUrlRef = useRef<string>('');
  const chunkStopTimeoutRef = useRef<number | null>(null);
  const recordingContinuationRef = useRef(false);
  const chunkDurationMs = Math.max(15_000, Math.round(Number(chunkMinutes || DEFAULT_CHUNK_MINUTES) * 60 * 1000));

  const applyLocalStore = async () => {
    await compactContinuousMemoryLocalAudio(scopedWorkspaceId).catch(() => false);
    const store = loadContinuousMemoryLocalState(scopedWorkspaceId);
    setSessions(store.sessions);
    setChunks(store.chunks);
    setFiles(store.files);
    setJobs(store.jobs);
    setOutputs(store.outputs);
    setLabels(store.labels);
    setChunkLabels(store.chunkLabels);
    setExtractedItems(store.extractedItems);
    setLinks(store.links);
  };

  useEffect(() => {
    if (persistenceMode === 'local') {
      void applyLocalStore();
      return;
    }

    let disabled = false;
    const unsubs = [
      onSnapshot(
        query(collection(db, 'continuous_memory_sessions'), where('workspaceId', '==', scopedWorkspaceId), orderBy('createdAt', 'desc')),
        (snapshot) => {
          if (disabled) return;
          setSessions(snapshot.docs.map((row: any) => row.data() as ContinuousMemorySession));
        },
        (error: any) => {
          const message = String(error?.details?.message || error?.message || '');
          if (/Could not find the table 'public\.continuous_memory_sessions'/i.test(message)) {
            disabled = true;
            setPersistenceMode('local');
            setTableMissing(true);
            setFeedback('Base oficial ainda nao aplicada. Operando em modo local seguro.');
            void applyLocalStore();
            return;
          }
          console.error('Erro ao carregar continuous_memory_sessions:', error);
        }
      ),
      onSnapshot(query(collection(db, 'continuous_memory_chunks'), where('workspaceId', '==', scopedWorkspaceId), orderBy('createdAt', 'desc')), (snapshot) => {
        if (disabled) return;
        setChunks(snapshot.docs.map((row: any) => row.data() as ContinuousMemoryChunk));
      }),
      onSnapshot(query(collection(db, 'continuous_memory_files'), where('workspaceId', '==', scopedWorkspaceId), orderBy('createdAt', 'desc')), (snapshot) => {
        if (disabled) return;
        setFiles(snapshot.docs.map((row: any) => row.data() as ContinuousMemoryFile));
      }),
      onSnapshot(query(collection(db, 'continuous_memory_jobs'), where('workspaceId', '==', scopedWorkspaceId), orderBy('createdAt', 'desc')), (snapshot) => {
        if (disabled) return;
        setJobs(snapshot.docs.map((row: any) => row.data() as ContinuousMemoryJob));
      }),
      onSnapshot(query(collection(db, 'continuous_memory_outputs'), where('workspaceId', '==', scopedWorkspaceId), orderBy('createdAt', 'desc')), (snapshot) => {
        if (disabled) return;
        setOutputs(snapshot.docs.map((row: any) => row.data() as ContinuousMemoryOutput));
      }),
      onSnapshot(query(collection(db, 'continuous_memory_chunk_labels'), where('workspaceId', '==', scopedWorkspaceId), orderBy('createdAt', 'desc')), (snapshot) => {
        if (disabled) return;
        setChunkLabels(snapshot.docs.map((row: any) => row.data() as ContinuousMemoryChunkLabel));
      }),
      onSnapshot(query(collection(db, 'continuous_memory_extracted_items'), where('workspaceId', '==', scopedWorkspaceId), orderBy('createdAt', 'desc')), (snapshot) => {
        if (disabled) return;
        setExtractedItems(snapshot.docs.map((row: any) => row.data() as ContinuousMemoryExtractedItem));
      }),
      onSnapshot(query(collection(db, 'continuous_memory_links'), where('workspaceId', '==', scopedWorkspaceId), orderBy('createdAt', 'desc')), (snapshot) => {
        if (disabled) return;
        setLinks(snapshot.docs.map((row: any) => row.data() as ContinuousMemoryLink));
      }),
      onSnapshot(query(collection(db, 'continuous_memory_labels'), orderBy('name', 'asc')), (snapshot) => {
        if (disabled) return;
        const rows = snapshot.docs
          .map((row: any) => row.data() as ContinuousMemoryLabel)
          .filter((row) => !row.workspaceId || row.workspaceId === scopedWorkspaceId);
        setLabels(rows);
      })
    ];

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [persistenceMode, scopedWorkspaceId]);

  const today = useMemo(() => new Date(), []);
  const todaySessions = useMemo(
    () => sessions.filter((session) => sameDay(toDate(session.sessionDate), today)).sort((a, b) => toDate(b.startedAt || b.createdAt).getTime() - toDate(a.startedAt || a.createdAt).getTime()),
    [sessions, today]
  );

  const activeSession = useMemo(() => {
    const explicit = sessions.find((session) => session.id === currentSessionId);
    if (explicit) return explicit;
    return todaySessions.find((session) => ['live', 'paused', 'processing'].includes(String(session.status))) || todaySessions[0] || null;
  }, [sessions, todaySessions, currentSessionId]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
    if (activeSession) {
      setCurrentSessionId(activeSession.id);
      chunkIndexRef.current = Math.max(1, Number(activeSession.totalChunks || 0) + 1);
    }
  }, [activeSession]);

  const todayChunks = useMemo(
    () => chunks.filter((chunk) => sameDay(toDate(chunk.createdAt), today)).sort((a, b) => toDate(a.startedAt || a.createdAt).getTime() - toDate(b.startedAt || b.createdAt).getTime()),
    [chunks, today]
  );

  useEffect(() => {
    if (!selectedChunkId && todayChunks[0]) setSelectedChunkId(todayChunks[0].id);
  }, [selectedChunkId, todayChunks]);

  const selectedChunk = useMemo(
    () => chunks.find((chunk) => chunk.id === selectedChunkId) || todayChunks[todayChunks.length - 1] || null,
    [chunks, selectedChunkId, todayChunks]
  );

  const selectedFile = useMemo(
    () => files.find((file) => file.chunkId === selectedChunk?.id && file.fileRole === 'chunk_audio_original') || null,
    [files, selectedChunk]
  );

  useEffect(() => {
    let cancelled = false;

    const loadAudio = async () => {
      if (!selectedFile) {
        setAudioUrl('');
        return;
      }
      try {
        const nextUrl = await loadContinuousMemoryAudioUrl(persistenceMode, selectedFile);
        if (cancelled) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = nextUrl;
        setAudioUrl(nextUrl);
      } catch {
        setAudioUrl('');
      }
    };

    loadAudio();
    return () => {
      cancelled = true;
    };
  }, [selectedFile, persistenceMode]);

  useEffect(() => {
    return () => {
      recordingContinuationRef.current = false;
      if (chunkStopTimeoutRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(chunkStopTimeoutRef.current);
        chunkStopTimeoutRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // noop
        }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!LOCAL_WHISPER_HEALTH_URL) {
      setLocalWhisperOnline(null);
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;

    const pingLocalWhisper = async () => {
      try {
        const response = await fetch(LOCAL_WHISPER_HEALTH_URL, { method: 'GET' });
        if (!cancelled) setLocalWhisperOnline(response.ok);
      } catch {
        if (!cancelled) setLocalWhisperOnline(false);
      }
    };

    pingLocalWhisper();
    if (typeof window !== 'undefined') {
      intervalId = window.setInterval(pingLocalWhisper, 15000);
    }

    return () => {
      cancelled = true;
      if (intervalId !== null && typeof window !== 'undefined') {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  useEffect(() => {
    if (!isRecording) {
      setCurrentChunkElapsedMs(0);
      return;
    }

    const updateElapsed = () => {
      const startedAt = chunkWindowStartedAtRef.current;
      if (!startedAt) {
        setCurrentChunkElapsedMs(0);
        return;
      }
      setCurrentChunkElapsedMs(Math.max(0, Date.now() - startedAt.getTime()));
    };

    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [isRecording, chunkDurationMs]);

  const labelLookup = useMemo(() => {
    const out: Record<string, string> = {};
    labels.forEach((label) => { out[label.name] = label.id; });
    return out;
  }, [labels]);

  const labelNameById = useMemo(() => {
    const out: Record<string, string> = {};
    labels.forEach((label) => { out[label.id] = label.name; });
    return out;
  }, [labels]);

  const selectedChunkLabels = useMemo(
    () => chunkLabels.filter((row) => row.chunkId === selectedChunk?.id),
    [chunkLabels, selectedChunk]
  );

  const selectedChunkItems = useMemo(
    () => extractedItems.filter((row) => row.chunkId === selectedChunk?.id),
    [extractedItems, selectedChunk]
  );

  const selectedChunkJobs = useMemo(
    () => jobs.filter((row) => row.chunkId === selectedChunk?.id),
    [jobs, selectedChunk]
  );

  const selectedChunkLinks = useMemo(
    () => links.filter((row) => row.chunkId === selectedChunk?.id),
    [links, selectedChunk]
  );

  const clearChunkTimer = () => {
    if (chunkStopTimeoutRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(chunkStopTimeoutRef.current);
      chunkStopTimeoutRef.current = null;
    }
  };

  const stopActiveStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const syncSessionRollupAfterCapture = async (session: ContinuousMemorySession, durationSeconds: number) => {
    const baseSession = activeSessionRef.current?.id === session.id ? activeSessionRef.current : session;
    const nextSession: ContinuousMemorySession = {
      ...baseSession,
      totalChunks: Number(baseSession.totalChunks || 0) + 1,
      totalDurationSeconds: Number(baseSession.totalDurationSeconds || 0) + durationSeconds,
      updatedAt: new Date()
    };
    activeSessionRef.current = nextSession;

    try {
      await updateContinuousMemorySession({
        mode: persistenceMode,
        workspaceId: scopedWorkspaceId,
        sessionId: session.id,
        patch: {
          totalChunks: nextSession.totalChunks,
          totalDurationSeconds: nextSession.totalDurationSeconds,
          updatedAt: nextSession.updatedAt
        }
      });
      if (persistenceMode === 'local') void applyLocalStore();
    } catch (error) {
      console.error('Falha ao sincronizar rollup da sessão.', error);
    }
  };

  const processCapturedChunk = async (
    sessionSnapshot: ContinuousMemorySession,
    chunkIndex: number,
    startedAt: Date,
    endedAt: Date,
    audioBlob: Blob,
    mimeType: string
  ) => {
    try {
      setFeedback(`Processando bloco ${chunkIndex}...`);
      await ingestContinuousMemoryChunk({
        mode: persistenceMode,
        workspaceId: scopedWorkspaceId,
        session: sessionSnapshot,
        chunkIndex,
        startedAt,
        endedAt,
        audioBlob,
        mimeType,
        labelLookup,
        skipSessionRollup: true
      });

      if (persistenceMode === 'local') void applyLocalStore();
      setFeedback(`Bloco ${chunkIndex} captado, transcrito e organizado.`);
    } catch (error: any) {
      if (persistenceMode === 'local') void applyLocalStore();
      setFeedback(String(error?.message || `Falha ao processar bloco ${chunkIndex}.`));
    }
  };

  const startChunkRecorder = (session: ContinuousMemorySession, stream: MediaStream, preferredMime: string) => {
    const recorder = preferredMime
      ? new MediaRecorder(stream, { mimeType: preferredMime })
      : new MediaRecorder(stream);
    const chunkStartedAt = new Date();
    const chunkIndex = chunkIndexRef.current;
    const parts: Blob[] = [];

    mediaRecorderRef.current = recorder;
    chunkWindowStartedAtRef.current = chunkStartedAt;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) parts.push(event.data);
    };

    recorder.onerror = (event: any) => {
      const message = String(event?.error?.message || 'Falha no MediaRecorder.');
      setFeedback(message);
    };

    recorder.onstop = () => {
      clearChunkTimer();

      const endedAt = new Date();
      const mimeType = parts[0]?.type || preferredMime || 'audio/webm';
      const audioBlob = parts.length > 0 ? new Blob(parts, { type: mimeType }) : null;
      const shouldContinue = recordingContinuationRef.current && stream.active && Boolean(activeSessionRef.current);

      if (audioBlob && audioBlob.size > 0) {
        const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - chunkStartedAt.getTime()) / 1000));
        const sessionSnapshot = activeSessionRef.current || session;
        chunkIndexRef.current = chunkIndex + 1;
        void syncSessionRollupAfterCapture(sessionSnapshot, durationSeconds);

        if (shouldContinue) {
          startChunkRecorder(activeSessionRef.current || sessionSnapshot, stream, preferredMime);
        } else {
          mediaRecorderRef.current = null;
          stopActiveStream();
        }

        void processCapturedChunk(sessionSnapshot, chunkIndex, chunkStartedAt, endedAt, audioBlob, mimeType);
        return;
      }

      if (shouldContinue) {
        startChunkRecorder(activeSessionRef.current || session, stream, preferredMime);
      } else {
        mediaRecorderRef.current = null;
        stopActiveStream();
      }
    };

    recorder.start();
    clearChunkTimer();
    if (typeof window !== 'undefined') {
      chunkStopTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, chunkDurationMs);
    }
    setIsRecording(true);
    setCurrentChunkElapsedMs(0);
  };

  const startRecorder = async (session: ContinuousMemorySession) => {
    recordingContinuationRef.current = true;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    streamRef.current = stream;

    const mimeCandidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'];
    const preferredMime = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';

    startChunkRecorder(session, stream, preferredMime);
    setFeedback(`Captação contínua ativa. Corte automático em ${formatChunkDurationLabel(chunkMinutes)}.`);
  };

  const handleStart = async () => {
    try {
      setIsBusy(true);
      if (activeSession && String(activeSession.status) === 'paused') {
        await updateContinuousMemorySession({
          mode: persistenceMode,
          workspaceId: scopedWorkspaceId,
          sessionId: activeSession.id,
          patch: { status: 'live', startedAt: activeSession.startedAt || new Date() }
        });
        if (persistenceMode === 'local') void applyLocalStore();
        await startRecorder({ ...activeSession, status: 'live' });
        return;
      }

      const newSession = await startContinuousMemorySession({
        mode: persistenceMode,
        workspaceId: scopedWorkspaceId,
        ventureId: ventureFilter !== 'all' ? ventureFilter : null,
        title: `Linha do Dia • ${new Date().toLocaleDateString('pt-BR')} • ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        sourceDevice: navigator.userAgent.slice(0, 120),
        captureMode: 'microphone',
        sensitivityLevel,
        allowAgentReading,
        createdBy: ownerUserId || userProfile?.uid || null,
        payload: {
          module: 'continuous-memory',
          intendedChunkMinutes: chunkMinutes
        }
      });

      setCurrentSessionId(newSession.id);
      activeSessionRef.current = newSession;
      chunkIndexRef.current = 1;
      if (persistenceMode === 'local') void applyLocalStore();
      await startRecorder(newSession);
    } catch (error: any) {
      setFeedback(String(error?.message || 'Nao foi possivel iniciar a sessao.'));
    } finally {
      setIsBusy(false);
    }
  };

  const stopRecorder = async (status: 'paused' | 'ended') => {
    const recorder = mediaRecorderRef.current;
    const session = activeSessionRef.current;
    if (!session) return;
    recordingContinuationRef.current = false;
    clearChunkTimer();

    try {
      await updateContinuousMemorySession({
        mode: persistenceMode,
        workspaceId: scopedWorkspaceId,
        sessionId: session.id,
        patch: {
          status,
          endedAt: status === 'ended' ? new Date() : null
        }
      });
      if (persistenceMode === 'local') void applyLocalStore();
    } catch (error: any) {
      setFeedback(String(error?.message || 'Nao foi possivel atualizar a sessao.'));
    }

    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else stopActiveStream();

    setIsRecording(false);
    setCurrentChunkElapsedMs(0);
    setFeedback(status === 'paused' ? 'Sessao pausada.' : 'Sessao encerrada.');
  };

  const handleRetryChunk = async () => {
    if (!selectedChunk || !activeSession) return;
    try {
      setIsBusy(true);
      setFeedback(`Reprocessando bloco ${selectedChunk.chunkIndex}...`);
      const transcriptVersions = outputs.filter((row) => row.chunkId === selectedChunk.id && row.outputType === 'transcript').length;
      await retryContinuousMemoryChunk({
        mode: persistenceMode,
        workspaceId: scopedWorkspaceId,
        session: activeSession,
        chunk: selectedChunk,
        file: selectedFile,
        labelLookup,
        currentTranscriptVersion: transcriptVersions
      });
      if (persistenceMode === 'local') void applyLocalStore();
      setFeedback(`Bloco ${selectedChunk.chunkIndex} reprocessado.`);
    } catch (error: any) {
      setFeedback(String(error?.message || 'Falha ao reprocessar bloco.'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownloadAudio = () => {
    if (!audioUrl || !selectedChunk || !selectedFile || typeof document === 'undefined') return;
    const anchor = document.createElement('a');
    const stamp = toDate(selectedChunk.startedAt || selectedChunk.createdAt).toISOString().replace(/[:.]/g, '-');
    const ext = deriveFileExtension(selectedFile.mimeType, selectedFile.storagePath);
    anchor.href = audioUrl;
    anchor.download = `memoria-continua-${stamp}-chunk-${selectedChunk.chunkIndex}.${ext}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const filteredChunks = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const filteredByVenture = ventureFilter === 'all'
      ? todayChunks
      : todayChunks.filter((chunk) => String(chunk.ventureId || '') === ventureFilter);
    return filteredByVenture.filter((chunk) => {
      const labelsForChunk = chunkLabels.filter((row) => row.chunkId === chunk.id).map((row) => labelNameById[row.labelId]);
      const itemsForChunk = extractedItems.filter((row) => row.chunkId === chunk.id);
      if (labelFilter !== 'all' && !labelsForChunk.includes(labelFilter)) return false;
      if (priorityFilter !== 'all' && !itemsForChunk.some((item) => String(item.priority || 'medium') === priorityFilter)) return false;
      if (!term) return true;
      return [
        chunk.transcriptText,
        labelsForChunk.join(' '),
        itemsForChunk.map((item) => item.title).join(' ')
      ].join(' ').toLowerCase().includes(term);
    });
  }, [todayChunks, ventureFilter, deferredSearch, labelFilter, priorityFilter, chunkLabels, labelNameById, extractedItems]);

  const minutesRecordedToday = useMemo(
    () => (todayChunks.reduce((sum, chunk) => sum + Number(chunk.durationSeconds || 0), 0) / 60).toFixed(1),
    [todayChunks]
  );

  const minutesTranscribedToday = useMemo(
    () => (todayChunks.filter((chunk) => chunk.transcriptStatus === 'completed').reduce((sum, chunk) => sum + Number(chunk.durationSeconds || 0), 0) / 60).toFixed(1),
    [todayChunks]
  );

  const jobsInFlight = useMemo(
    () => jobs.filter((job) => ['queued', 'running', 'retrying'].includes(String(job.jobStatus))).length,
    [jobs]
  );

  const organizationGroups = useMemo(
    () => groupCount(filteredChunks.map((chunk) => {
      const labelsForChunk = chunkLabels.filter((row) => row.chunkId === chunk.id).map((row) => labelNameById[row.labelId]).filter(Boolean);
      return labelsForChunk[0] || 'sem classificacao';
    })),
    [filteredChunks, chunkLabels, labelNameById]
  );

  const morningChunks = filteredChunks.filter((chunk) => toDate(chunk.startedAt || chunk.createdAt).getHours() < 12);
  const afternoonChunks = filteredChunks.filter((chunk) => toDate(chunk.startedAt || chunk.createdAt).getHours() >= 12);
  const sessionChunks = filteredChunks.filter((chunk) => chunk.sessionId === activeSession?.id);
  const filteredItems = extractedItems
    .filter((item) => filteredChunks.some((chunk) => chunk.id === item.chunkId))
    .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());

  const intelligenceThemeDistribution = useMemo(
    () => groupCount(chunkLabels.map((row) => labelNameById[row.labelId] || 'sem classificacao')),
    [chunkLabels, labelNameById]
  );

  const secondsUntilNextCut = Math.max(0, Math.ceil((chunkDurationMs - currentChunkElapsedMs) / 1000));
  const selectedUploadJob = selectedChunkJobs.find((job) => String(job.jobType || '').includes('upload'));
  const selectedTranscriptionJob = selectedChunkJobs.find((job) => String(job.jobType || '').includes('transcribe'));
  const chunkExecutionSteps = useMemo(() => {
    const captureState: ExecutionFlowState = isRecording ? 'active' : (selectedChunk ? 'success' : 'idle');
    const cutState: ExecutionFlowState = isRecording ? 'active' : (selectedChunk ? 'success' : 'idle');
    const uploadState: ExecutionFlowState = selectedFile
      ? 'success'
      : (selectedUploadJob?.jobStatus === 'error' ? 'error' : (selectedChunk ? 'warning' : 'idle'));

    const transcriptionState: ExecutionFlowState = (() => {
      if (!selectedChunk) return localWhisperOnline === false ? 'error' : 'idle';
      if (['processing', 'retrying'].includes(String(selectedChunk.transcriptStatus || '').toLowerCase())) return 'active';
      if (selectedTranscriptionJob?.jobStatus === 'running') return 'active';
      if (selectedChunk.transcriptText) return 'success';
      if (selectedTranscriptionJob?.jobStatus === 'completed_warning') return 'warning';
      if (String(selectedChunk.transcriptStatus || '').toLowerCase() === 'error' || selectedTranscriptionJob?.jobStatus === 'error') return 'error';
      return 'idle';
    })();

    const organizationState: ExecutionFlowState = selectedChunkItems.length > 0 || selectedChunkLabels.length > 0
      ? 'success'
      : (transcriptionState === 'warning' ? 'warning' : (transcriptionState === 'error' ? 'error' : (selectedChunk ? 'success' : 'idle')));

    return [
      {
        label: 'Captacao',
        state: captureState,
        detail: isRecording ? `Ouvindo agora • ${fmtDuration(currentChunkElapsedMs / 1000)}` : (selectedChunk ? 'Audio captado' : 'Aguardando')
      },
      {
        label: 'Corte',
        state: cutState,
        detail: isRecording ? `Proximo corte em ${fmtDuration(secondsUntilNextCut)}` : `Janela de ${formatChunkDurationLabel(chunkMinutes)}`
      },
      {
        label: 'Audio',
        state: uploadState,
        detail: selectedFile ? 'Arquivo salvo' : (selectedUploadJob?.statusNote || 'Sem audio salvo ainda')
      },
      {
        label: 'Transcricao',
        state: transcriptionState,
        detail: selectedChunk?.errorMessage || selectedTranscriptionJob?.statusNote || transcriptStatusLabel(String(selectedChunk?.transcriptStatus || 'pending'))
      },
      {
        label: 'Organizacao',
        state: organizationState,
        detail: `${selectedChunkLabels.length} labels • ${selectedChunkItems.length} itens`
      }
    ];
  }, [
    currentChunkElapsedMs,
    chunkMinutes,
    isRecording,
    localWhisperOnline,
    secondsUntilNextCut,
    selectedChunk,
    selectedChunkItems.length,
    selectedChunkLabels.length,
    selectedFile,
    selectedTranscriptionJob?.jobStatus,
    selectedTranscriptionJob?.statusNote,
    selectedUploadJob?.jobStatus,
    selectedUploadJob?.statusNote
  ]);

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#edf4ff_100%)] custom-scrollbar">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 py-8 space-y-8">
        <header className="rounded-[32px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(240,249,255,0.96)_48%,rgba(226,232,240,0.96))] text-slate-900 shadow-[0_30px_80px_rgba(15,23,42,0.12)] overflow-hidden">
          <div className="px-8 md:px-10 py-8 flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start gap-4">
                {onBack && (
                  <button onClick={onBack} className="w-11 h-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm">
                    <BackIcon className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <span className="text-[10px] uppercase tracking-[0.38em] font-black text-cyan-600 block mb-3">Modulo Oficial</span>
                  <h1 className="text-4xl md:text-5xl font-black tracking-[-0.04em]">Memoria Continua</h1>
                  <p className="text-slate-600 max-w-3xl mt-3">
                    Linha do Dia para captação contínua, blocos curtos, transcrição operacional e base viva pronta para extrações, resumos e leitura futura por agentes.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <div className={`px-4 py-3 rounded-2xl border border-slate-200 bg-white ${statusBadge(String(activeSession?.status || 'draft'))}`}>
                  <span className="text-[10px] uppercase tracking-[0.28em] font-black block mb-1 opacity-70">Sessao</span>
                  <strong className="text-sm">{sessionStatusLabel(String(activeSession?.status || 'draft'))}</strong>
                </div>
                <div className="px-4 py-3 rounded-2xl border border-slate-200 bg-white min-w-[122px]">
                  <span className="text-[10px] uppercase tracking-[0.28em] font-black block mb-1 text-slate-400">Microfone</span>
                  <strong className={`text-sm inline-flex items-center gap-2 ${isRecording ? 'text-emerald-600' : 'text-slate-500'}`}>
                    <MicPulse active={isRecording} />
                    {isRecording ? 'Gravando' : 'Inativo'}
                  </strong>
                </div>
                {LOCAL_WHISPER_HEALTH_URL && (
                  <div className="px-4 py-3 rounded-2xl border border-slate-200 bg-white min-w-[138px]">
                    <span className="text-[10px] uppercase tracking-[0.28em] font-black block mb-1 text-slate-400">Whisper local</span>
                    <strong className={`text-sm inline-flex items-center gap-2 ${localWhisperOnline === false ? 'text-rose-600' : 'text-emerald-600'}`}>
                      <MicPulse active={Boolean(localWhisperOnline)} />
                      {localWhisperOnline === false ? 'Offline' : (localWhisperOnline === true ? 'Online' : 'Verificando')}
                    </strong>
                  </div>
                )}
                <div className="px-4 py-3 rounded-2xl border border-slate-200 bg-white min-w-[138px]">
                  <span className="text-[10px] uppercase tracking-[0.28em] font-black block mb-1 text-slate-400">Corte automatico</span>
                  <strong className={`text-sm inline-flex items-center gap-2 ${isRecording ? 'text-emerald-600' : 'text-slate-500'}`}>
                    <MicPulse active={isRecording} />
                    {isRecording ? `Ligado • ${fmtDuration(secondsUntilNextCut)}` : `Pronto • ${formatChunkDurationLabel(chunkMinutes)}`}
                  </strong>
                </div>
                <div className="px-4 py-3 rounded-2xl border border-slate-200 bg-white min-w-[126px]">
                  <span className="text-[10px] uppercase tracking-[0.28em] font-black block mb-1 text-slate-400">Storage</span>
                  <strong className={`text-sm inline-flex items-center gap-2 ${persistenceMode === 'local' ? 'text-amber-700' : 'text-emerald-600'}`}>
                    <MicPulse active={persistenceMode !== 'local'} />
                    {persistenceMode === 'local' ? 'Local' : 'Supabase'}
                  </strong>
                </div>
                <button onClick={handleStart} disabled={isBusy || isRecording} className="px-5 py-3 rounded-2xl bg-cyan-500 text-white font-black tracking-tight shadow-[0_12px_24px_rgba(6,182,212,0.22)] disabled:opacity-50">
                  <span className="inline-flex items-center gap-2"><MicIcon className="w-4 h-4" /> Iniciar</span>
                </button>
                <button onClick={() => stopRecorder('paused')} disabled={!isRecording || isBusy} className="px-5 py-3 rounded-2xl bg-white text-slate-700 border border-slate-200 font-black tracking-tight disabled:opacity-50">
                  Pausar
                </button>
                <button onClick={() => stopRecorder('ended')} disabled={(!isRecording && !activeSession) || isBusy} className="px-5 py-3 rounded-2xl bg-rose-500 text-white font-black tracking-tight shadow-[0_12px_24px_rgba(244,63,94,0.2)] disabled:opacity-50">
                  <span className="inline-flex items-center gap-2"><StopCircleIcon className="w-4 h-4" /> Encerrar</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-center text-sm">
              <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 shadow-sm">Linha do Dia</span>
              <span className="px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-100 text-cyan-700">Chunks de {formatChunkDurationLabel(chunkMinutes)}</span>
              <span className="px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700">Retenção fria/morna/quente</span>
              <span className="px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100 text-violet-700">{allowAgentReading ? 'Leitura futura por agentes habilitada' : 'Leitura futura por agentes bloqueada'}</span>
            </div>
          </div>
        </header>

        {tableMissing && (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
            O schema oficial ainda nao foi aplicado no Supabase deste ambiente. A interface segue operando em modo local para validarmos a V1 sem perder a arquitetura final. Neste modo, o audio fica salvo localmente no navegador deste computador, nao no Supabase Storage.
          </div>
        )}

        {LOCAL_WHISPER_HEALTH_URL && localWhisperOnline === false && (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-rose-800">
            O transcritor local esta offline agora. A gravacao pode continuar salvando o audio, mas a transcricao vai falhar ate o servidor do Whisper voltar.
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          {renderMetric('Sessao Atual', activeSession ? chunkStatusLabel(String(activeSession.status)) : 'Sem sessao', 'border-slate-200 bg-white text-slate-900')}
          {renderMetric('Blocos Hoje', todayChunks.length, 'border-cyan-200 bg-cyan-50 text-cyan-900')}
          {renderMetric('Min Gravados', minutesRecordedToday, 'border-amber-200 bg-amber-50 text-amber-900')}
          {renderMetric('Min Transcritos', minutesTranscribedToday, 'border-emerald-200 bg-emerald-50 text-emerald-900')}
          {renderMetric('Itens Extraidos', filteredItems.length, 'border-violet-200 bg-violet-50 text-violet-900')}
          {renderMetric('Jobs em Fila', jobsInFlight, 'border-rose-200 bg-rose-50 text-rose-900')}
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
            <div>
              <span className="text-[10px] uppercase tracking-[0.35em] font-black text-slate-400 block mb-2">Pipeline visual de execucao</span>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">Fluxo do bloco em tempo real</h2>
              <p className="text-sm text-slate-500 mt-2">
                Esta trilha mostra a execução do processo, no estilo de um workflow em execução: captação, corte, salvamento, transcrição e organização.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 min-w-[280px]">
              <div className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-400 mb-2">Status atual</div>
              <div className="text-sm font-bold text-slate-800">{feedback || 'Sem execução em andamento.'}</div>
              <div className="text-xs text-slate-500 mt-2">
                {isRecording ? `Proximo corte em ${fmtDuration(secondsUntilNextCut)}.` : `Janela configurada: ${formatChunkDurationLabel(chunkMinutes)}.`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {chunkExecutionSteps.map((step, index) => (
              <div key={step.label} className={`rounded-[22px] border px-4 py-4 ${executionFlowTone(step.state)}`}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-[10px] uppercase tracking-[0.28em] font-black opacity-70">Etapa {index + 1}</span>
                  <span className={`inline-flex h-2.5 w-2.5 rounded-full ${step.state === 'active' ? 'bg-cyan-500 animate-pulse' : step.state === 'success' ? 'bg-emerald-500' : step.state === 'warning' ? 'bg-amber-500' : step.state === 'error' ? 'bg-rose-500' : 'bg-slate-300'}`}></span>
                </div>
                <div className="text-base font-black tracking-tight mb-2">{step.label}</div>
                <div className="text-xs leading-5">{step.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-white/80 bg-white/85 backdrop-blur-xl p-4 md:p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'line', label: 'Linha do Dia' },
                { id: 'organization', label: 'Organizacao' },
                { id: 'summaries', label: 'Resumos' },
                { id: 'extractions', label: 'Extracoes' },
                { id: 'intelligence', label: 'Inteligencia' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ContinuousMemoryTab)}
                  className={`px-4 py-2.5 rounded-2xl text-sm font-black tracking-tight transition-colors ${activeTab === tab.id ? 'bg-cyan-500 text-white shadow-[0_12px_24px_rgba(6,182,212,0.2)]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <label className="relative">
                <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar fala, tag ou item..." className="pl-10 pr-3 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm min-w-[260px]" />
              </label>
              <select value={ventureFilter} onChange={(event) => setVentureFilter(event.target.value)} className="px-3 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm">
                <option value="all">Todas ventures</option>
                {ventures.map((venture) => (
                  <option key={venture.id} value={venture.id}>{venture.name}</option>
                ))}
              </select>
              <select value={labelFilter} onChange={(event) => setLabelFilter(event.target.value)} className="px-3 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm">
                <option value="all">Todas classificacoes</option>
                {labels.map((label) => (
                  <option key={label.id} value={label.name}>{label.name}</option>
                ))}
              </select>
              <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="px-3 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm">
                <option value="all">Todas prioridades</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baixa</option>
              </select>
            </div>
          </div>

          {activeTab === 'line' && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_420px] gap-6">
              <div className="space-y-4">
                <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.96)_42%,rgba(14,165,233,0.9))] text-white px-5 py-4 grid grid-cols-1 md:grid-cols-4 gap-4 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.3em] font-black text-cyan-300 block mb-2">Sessao atual</span>
                    <strong className="text-lg font-black">{activeSession?.title || 'Sem sessao ativa'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-400 block mb-2">Corte automatico</span>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {[0.25, 0.5, 1, 2, 3, 5].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setChunkMinutes(preset)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-black tracking-tight border ${chunkMinutes === preset ? 'bg-cyan-400 text-slate-950 border-cyan-300' : 'bg-white/10 text-white border-white/10 hover:bg-white/20'}`}
                          >
                            {formatChunkDurationLabel(preset)}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0.25}
                          max={15}
                          step={0.25}
                          value={chunkMinutes}
                          onChange={(event) => setChunkMinutes(Math.min(15, Math.max(0.25, Number(event.target.value || DEFAULT_CHUNK_MINUTES))))}
                          className="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm w-full"
                        />
                        <span className="text-xs uppercase tracking-[0.18em] text-slate-300 font-black">min</span>
                      </div>
                      <div className="text-xs text-slate-300 leading-5">
                        Escolha livre: `0.25` = 15s, `0.5` = 30s, `1` = 1 min, `2` = 2 min, `3` = 3 min.
                        {isRecording ? ` Proximo corte em ${fmtDuration(secondsUntilNextCut)}.` : ` Proxima sessao vai cortar em ${formatChunkDurationLabel(chunkMinutes)}.`}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-400 block mb-2">Sensibilidade</span>
                    <select value={sensitivityLevel} onChange={(event) => setSensitivityLevel(event.target.value)} className="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm w-full">
                      <option value="internal">Internal</option>
                      <option value="restricted">Restricted</option>
                      <option value="confidential">Confidential</option>
                    </select>
                  </div>
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-400 block mb-1">Agentes</span>
                      <strong className="text-sm">Leitura futura</strong>
                    </div>
                    <input type="checkbox" checked={allowAgentReading} onChange={(event) => setAllowAgentReading(event.target.checked)} className="w-5 h-5" />
                  </label>
                </div>

                {filteredChunks.map((chunk) => {
                  const labelsForChunk = chunkLabels.filter((row) => row.chunkId === chunk.id).map((row) => labelNameById[row.labelId]).filter(Boolean);
                  const itemsForChunk = extractedItems.filter((row) => row.chunkId === chunk.id);
                  const visualStatus = chunkVisualStatus(chunk);
                  return (
                    <button key={chunk.id} onClick={() => setSelectedChunkId(chunk.id)} className={`w-full text-left rounded-[26px] border p-5 transition-all ${selectedChunk?.id === chunk.id ? 'border-cyan-200 bg-[linear-gradient(135deg,rgba(236,254,255,0.95),rgba(255,255,255,0.98))] text-slate-900 shadow-[0_20px_45px_rgba(6,182,212,0.14)]' : 'border-slate-200 bg-white hover:border-cyan-300 hover:shadow-[0_16px_30px_rgba(8,145,178,0.10)]'}`}>
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-[0.18em] ${selectedChunk?.id === chunk.id ? statusBadge(visualStatus) : statusBadge(visualStatus)}`}>{chunkStatusLabel(visualStatus)}</span>
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-[0.18em] ${selectedChunk?.id === chunk.id ? 'bg-white text-slate-700 border border-slate-200' : 'bg-slate-100 text-slate-700'}`}>{fmtTime(toDate(chunk.startedAt || chunk.createdAt))}</span>
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-[0.18em] ${selectedChunk?.id === chunk.id ? 'bg-cyan-100 text-cyan-700' : 'bg-cyan-50 text-cyan-700'}`}>{fmtDuration(chunk.durationSeconds)}</span>
                          </div>
                          <h3 className="text-lg font-black tracking-tight mb-2">Bloco #{chunk.chunkIndex}</h3>
                          <p className={`text-sm leading-6 ${selectedChunk?.id === chunk.id ? 'text-slate-600' : 'text-slate-600'}`}>
                            {String(chunk.transcriptText || 'Transcricao ainda nao disponivel.').slice(0, 220) || 'Transcricao ainda nao disponivel.'}
                          </p>
                        </div>
                        <div className="flex flex-col items-start md:items-end gap-3">
                          <div className="flex flex-wrap gap-2">
                            {labelsForChunk.slice(0, 4).map((label) => (
                              <span key={`${chunk.id}-${label}`} className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-[0.18em] ${selectedChunk?.id === chunk.id ? 'bg-white text-slate-600 border border-slate-200' : 'bg-slate-100 text-slate-600'}`}>{label}</span>
                            ))}
                          </div>
                          <div className="text-sm font-bold tracking-tight">
                            {chunk.importanceFlag ? 'Com importancia' : 'Normal'} • {itemsForChunk.length} extração(ões)
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <aside className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 space-y-5">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.35em] font-black text-slate-400 block mb-3">Detalhe do bloco</span>
                  <h3 className="text-2xl font-black tracking-tight">{selectedChunk ? `Bloco #${selectedChunk.chunkIndex}` : 'Selecione um bloco'}</h3>
                  <p className="text-sm text-slate-500 mt-2">{selectedChunk ? `${fmtDateTime(toDate(selectedChunk.startedAt || selectedChunk.createdAt))} • ${fmtDuration(selectedChunk.durationSeconds)}` : 'Abra um bloco na timeline para ver audio, transcricao, jobs e vinculos.'}</p>
                </div>

                {audioUrl && (
                  <div className="space-y-3">
                    <audio controls className="w-full" src={audioUrl} />
                    <button
                      onClick={handleDownloadAudio}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-black hover:bg-slate-50"
                    >
                      Baixar audio deste bloco
                    </button>
                  </div>
                )}

                {selectedChunk && (
                  <>
                    <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="text-sm font-black tracking-tight">Transcricao completa</span>
                        <button onClick={handleRetryChunk} disabled={isBusy} className="px-3 py-2 rounded-xl bg-slate-950 text-white text-sm font-black disabled:opacity-50">Reprocessar bloco</button>
                      </div>
                      {!!selectedChunk.errorMessage && (
                        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          <strong className="font-black uppercase tracking-[0.16em] text-[10px]">Aviso de transcricao</strong>
                          <p className="mt-1">{selectedChunk.errorMessage}</p>
                        </div>
                      )}
                      <p className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">{selectedChunk.transcriptText || 'Sem transcricao registrada.'}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <h4 className="text-sm font-black tracking-tight mb-3">Classificacoes</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedChunkLabels.length > 0 ? selectedChunkLabels.map((row) => (
                            <span key={row.id} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-[0.18em]">{labelNameById[row.labelId] || 'label'} • {(row.confidenceScore || 0).toFixed(2)}</span>
                          )) : <span className="text-sm text-slate-400">Sem classificacao ainda.</span>}
                        </div>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <h4 className="text-sm font-black tracking-tight mb-3">Itens extraidos</h4>
                        <div className="space-y-2">
                          {selectedChunkItems.length > 0 ? selectedChunkItems.map((item) => (
                            <div key={item.id} className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] font-black text-slate-400 mb-1">{item.itemType} • {item.priority || 'medium'}</div>
                              <div className="text-sm font-bold text-slate-800">{item.title}</div>
                            </div>
                          )) : <span className="text-sm text-slate-400">Nenhum item extraido.</span>}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                      <h4 className="text-sm font-black tracking-tight mb-3">Jobs e metadados</h4>
                      <div className="space-y-2 mb-4">
                        {selectedChunkJobs.length > 0 ? selectedChunkJobs.map((job) => (
                          <div key={job.id} className="rounded-xl border border-slate-200 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-slate-800">{job.jobType}</div>
                                <div className="text-xs text-slate-400">{job.processorName || 'processor'} • {fmtDateTime(job.startedAt)}</div>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-[0.18em] ${statusBadge(String(job.jobStatus))}`}>{jobStatusLabel(String(job.jobStatus))}</span>
                            </div>
                            {(job.statusNote || job.errorMessage) && (
                              <div className={`mt-2 text-xs ${job.errorMessage ? 'text-rose-600' : 'text-slate-500'}`}>
                                {job.errorMessage || job.statusNote}
                              </div>
                            )}
                          </div>
                        )) : <span className="text-sm text-slate-400">Sem jobs vinculados.</span>}
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <div>Status da transcricao: {transcriptStatusLabel(String(selectedChunk.transcriptStatus || 'pending'))}</div>
                        <div>Idioma: {selectedChunk.detectedLanguage || 'n/d'}</div>
                        <div>Confianca: {selectedChunk.transcriptConfidence ? selectedChunk.transcriptConfidence.toFixed(2) : 'n/d'}</div>
                        <div>Noise score: {selectedChunk.noiseScore ? selectedChunk.noiseScore.toFixed(2) : 'n/d'}</div>
                        <div>Persistencia: {persistenceMode === 'local' ? 'Navegador local' : 'Supabase Storage'}</div>
                        <div>Arquivo: {selectedFile?.storagePath || 'n/d'}</div>
                        <div>Vinculos: {selectedChunkLinks.length}</div>
                      </div>
                    </div>
                  </>
                )}

                <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-4">
                  <span className="text-[10px] uppercase tracking-[0.35em] font-black text-slate-400 block mb-3">Painel lateral</span>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div>Sessao atual: {activeSession?.title || 'Sem sessao'}</div>
                    <div>Chunk atual: {selectedChunk ? `#${selectedChunk.chunkIndex}` : '-'}</div>
                    <div>Persistencia: {persistenceMode === 'local' ? 'Navegador local' : 'Supabase'}</div>
                    <div>Fila de jobs: {jobsInFlight}</div>
                    <div>Ultimos erros: {jobs.filter((job) => job.jobStatus === 'error').slice(0, 2).length}</div>
                    <div>Ultimas extrações: {filteredItems.slice(0, 3).map((item) => item.title).join(' • ') || 'nenhuma'}</div>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {activeTab === 'organization' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-2xl font-black tracking-tight mb-4">Agrupamento por contexto</h3>
                <div className="space-y-3">
                  {organizationGroups.length > 0 ? organizationGroups.map(([group, count]) => (
                    <div key={group} className="flex items-center justify-between rounded-2xl bg-white border border-slate-200 px-4 py-3">
                      <span className="font-bold text-slate-800 uppercase tracking-[0.18em] text-xs">{group}</span>
                      <span className="text-lg font-black text-slate-900">{count}</span>
                    </div>
                  )) : <p className="text-sm text-slate-500">Sem material filtrado para organizar.</p>}
                </div>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <h3 className="text-2xl font-black tracking-tight mb-4">Leitura por venture / projeto / tema</h3>
                <div className="space-y-4 text-sm text-slate-600 leading-7">
                  <p>V2 já modelada para classificação automática por bloco, tags persistidas, resumos por período e filtros por venture, projeto, tema e prioridade.</p>
                  <p>Hoje a base já captura `venture_id`, `project_id`, labels, extracted items, jobs, outputs e links, deixando a navegação pronta para crescer sem refazer o banco.</p>
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    <div className="font-black text-slate-800 mb-2">Estrutura visual preparada</div>
                    <div>Filtros atuais: venture, classificação, prioridade e busca textual.</div>
                    <div>Próxima camada: agrupamento por projeto, área, tema semântica e sensibilidade.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'summaries' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {[ 
                { title: 'Manha', text: buildSummary('Resumo da manha', morningChunks, filteredItems.filter((item) => morningChunks.some((chunk) => chunk.id === item.chunkId))) },
                { title: 'Tarde', text: buildSummary('Resumo da tarde', afternoonChunks, filteredItems.filter((item) => afternoonChunks.some((chunk) => chunk.id === item.chunkId))) },
                { title: 'Dia', text: buildSummary('Resumo do dia', filteredChunks, filteredItems) },
                { title: 'Sessao', text: buildSummary('Resumo da sessao', sessionChunks, filteredItems.filter((item) => sessionChunks.some((chunk) => chunk.id === item.chunkId))) },
                { title: 'Tema', text: buildSummary('Resumo por tema dominante', filteredChunks.filter((chunk) => chunkLabels.some((row) => row.chunkId === chunk.id && (labelNameById[row.labelId] || '') === (organizationGroups[0]?.[0] || 'sem classificacao'))), filteredItems) }
              ].map((card) => (
                <div key={card.title} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-slate-950 text-white flex items-center justify-center">
                      <FileTextIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-400 block">Resumo</span>
                      <strong className="text-xl font-black tracking-tight">{card.title}</strong>
                    </div>
                  </div>
                  <p className="text-sm leading-7 text-slate-600">{card.text}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'extractions' && (
            <div className="space-y-4">
              {filteredItems.length > 0 ? filteredItems.map((item) => (
                <div key={item.id} className="rounded-[26px] border border-slate-200 bg-white p-5 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] uppercase tracking-[0.18em] font-black">{item.itemType}</span>
                      <span className="px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 text-[11px] uppercase tracking-[0.18em] font-black">{item.priority || 'medium'}</span>
                    </div>
                    <h3 className="text-xl font-black tracking-tight text-slate-900">{item.title}</h3>
                    <p className="text-sm leading-7 text-slate-600 mt-2">{item.content}</p>
                  </div>
                  <div className="text-sm text-slate-500 min-w-[220px]">
                    <div>Criado em: {fmtDateTime(item.createdAt)}</div>
                    <div>Status: {item.status || 'open'}</div>
                    <div>Sessao: {sessions.find((session) => session.id === item.sessionId)?.title || 'Linha do Dia'}</div>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-500">Nenhuma extração encontrada para o filtro atual.</p>}
            </div>
          )}

          {activeTab === 'intelligence' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-[28px] border border-slate-200 bg-slate-950 text-white p-6">
                <span className="text-[10px] uppercase tracking-[0.35em] font-black text-cyan-300 block mb-4">Camada futura</span>
                <h3 className="text-3xl font-black tracking-tight mb-4">Pronto para agentes, CID e Fluxo</h3>
                <div className="space-y-3 text-sm text-slate-300 leading-7">
                  <p>Os chunks relevantes já podem virar assets do CID, alimentar o Fluxo de Inteligência e servir como fonte de leitura operacional futura para agentes.</p>
                  <p>O módulo já grava trilha de jobs, outputs, extracted items e links, que são as peças que sustentam V2 e V3 sem retrabalho estrutural.</p>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6">
                <h3 className="text-2xl font-black tracking-tight mb-4">Padrões recorrentes</h3>
                <div className="space-y-3">
                  {intelligenceThemeDistribution.slice(0, 6).map(([group, count]) => (
                    <div key={group} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
                      <span className="font-black text-xs uppercase tracking-[0.18em] text-slate-500">{group}</span>
                      <span className="text-lg font-black text-slate-900">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 text-sm text-slate-600 leading-7">
                  <div>Distribuicao por venture: {groupCount(filteredChunks.map((chunk) => ventures.find((venture) => venture.id === chunk.ventureId)?.name || 'Sem venture')).slice(0, 3).map(([name, count]) => `${name} (${count})`).join(' • ') || 'sem dados'}</div>
                  <div>Links CID/Fluxo: {links.length}</div>
                  <div>Chunks com ancora: {chunks.filter((chunk) => chunk.anchorFlag).length}</div>
                </div>
              </div>
            </div>
          )}
        </section>

        {feedback && (
          <div className="rounded-[22px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContinuousMemoryView;
