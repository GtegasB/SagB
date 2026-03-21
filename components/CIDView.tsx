import React, { useEffect, useMemo, useState } from 'react';
import { BackIcon, CloudUploadIcon, SearchIcon } from './Icon';
import { CidAsset, CidAssetFile, CidChunk, CidOutput, CidProcessingJob, UserProfile, Venture } from '../types';
import { addDoc, collection, db, doc, onSnapshot, orderBy, query, updateDoc, where } from '../services/supabase';
import { buildCidStoragePath, uploadBlobToSupabaseStorage } from '../services/storage';

type CidTab = 'upload' | 'library' | 'processing' | 'intelligence';
type Material = 'pdf' | 'doc' | 'docx' | 'txt' | 'spreadsheet' | 'image' | 'audio' | 'video' | 'other';
type DesiredAction = 'store_only' | 'store_transcribe' | 'store_summarize' | 'store_transcribe_summarize' | 'store_consolidate';

type UploadFormState = {
  title: string;
  materialType: Material;
  ventureId: string;
  area: string;
  project: string;
  sensitivity: string;
  tags: string;
  ownerName: string;
  language: string;
  desiredAction: DesiredAction;
  isConsultable: boolean;
};

interface CIDViewProps {
  workspaceId?: string | null;
  ownerUserId?: string | null;
  userProfile?: UserProfile | null;
  ventures?: Venture[];
  onBack?: () => void;
}

const SESSION_STORAGE_KEY = 'sagb_supabase_session_v1';
const UUID_LIKE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CID_STORAGE_LIMIT_BYTES = 2147483648;
const INLINE_PREVIEW_MAX_BYTES = 2000000;

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const fmt = (value: any) => toDate(value).toLocaleString('pt-BR');
const formatBytes = (value?: number | null) => {
  if (value === undefined || value === null || !Number.isFinite(value)) return '-';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toLocaleString('pt-BR', { maximumFractionDigits: size >= 100 ? 0 : 1 })} ${units[unitIndex]}`;
};

const resolveAssetSizeBytes = (asset?: CidAsset | null, files: CidAssetFile[] = []) => {
  const fileSize = files.find((file) => Number(file.sizeBytes || 0) > 0)?.sizeBytes;
  if (fileSize !== undefined && fileSize !== null) return Number(fileSize);
  const payloadSize = asset?.payload?.originalSizeBytes;
  if (payloadSize !== undefined && payloadSize !== null && Number.isFinite(Number(payloadSize))) {
    return Number(payloadSize);
  }
  return null;
};
const CID_LABELS: Record<string, string> = {
  assets: 'Ativos',
  jobs: 'Processos',
  chunks: 'Partes',
  outputs: 'Saidas',
  completed: 'Concluido',
  completed_warning: 'Concluido com aviso',
  ready: 'Pronto',
  error: 'Erro',
  processing: 'Processando',
  fragmenting: 'Fragmentando',
  transcribing: 'Transcrevendo',
  summarizing: 'Resumindo',
  consolidating: 'Consolidando',
  queued: 'Na fila',
  received: 'Recebido',
  paused: 'Pausado',
  cancelled: 'Cancelado',
  extracted_text: 'Texto extraido',
  transcription: 'Transcricao',
  summary_short: 'Resumo curto',
  summary_long: 'Resumo longo',
  consolidation: 'Consolidacao',
  keywords: 'Palavras-chave'
};
const toLabel = (value: any) => {
  const raw = String(value || '').replace(/[_-]+/g, ' ').trim().toLowerCase();
  if (CID_LABELS[raw]) return CID_LABELS[raw];
  return raw ? raw[0].toUpperCase() + raw.slice(1) : '-';
};

const statusBadge = (value: any) => {
  const v = String(value || '').toLowerCase();
  if (v === 'completed' || v === 'ready') return 'bg-green-100 text-green-700';
  if (v === 'completed_warning') return 'bg-yellow-100 text-yellow-700';
  if (v === 'error') return 'bg-red-100 text-red-700';
  if (['processing', 'fragmenting', 'transcribing', 'summarizing', 'consolidating'].includes(v)) return 'bg-blue-100 text-blue-700';
  return 'bg-gray-100 text-gray-700';
};

const detectMaterial = (file: File): Material => {
  const ext = String(file.name.split('.').pop() || '').toLowerCase();
  const mime = String(file.type || '').toLowerCase();
  if (mime.includes('pdf') || ext === 'pdf') return 'pdf';
  if (ext === 'doc') return 'doc';
  if (ext === 'docx') return 'docx';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.includes('spreadsheet') || ['csv', 'xls', 'xlsx'].includes(ext)) return 'spreadsheet';
  if (mime.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'yml', 'yaml', 'csv'].includes(ext)) return 'txt';
  return 'other';
};

const readAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
  reader.readAsDataURL(file);
});

const isUuidLike = (value: any) => typeof value === 'string' && UUID_LIKE_RE.test(value.trim());

const initialForm = (userProfile?: UserProfile | null): UploadFormState => ({
  title: '',
  materialType: 'other',
  ventureId: '',
  area: '',
  project: '',
  sensitivity: 'internal',
  tags: '',
  ownerName: userProfile?.name || '',
  language: 'pt-BR',
  desiredAction: 'store_only',
  isConsultable: false
});

const CIDView: React.FC<CIDViewProps> = ({ workspaceId, ownerUserId, userProfile, ventures = [], onBack }) => {
  const scopedWorkspaceId = workspaceId?.trim() || userProfile?.workspaceId?.trim() || '';

  const [activeTab, setActiveTab] = useState<CidTab>('upload');
  const [form, setForm] = useState<UploadFormState>(() => initialForm(userProfile));
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');

  const [assets, setAssets] = useState<CidAsset[]>([]);
  const [assetFiles, setAssetFiles] = useState<CidAssetFile[]>([]);
  const [jobs, setJobs] = useState<CidProcessingJob[]>([]);
  const [chunks, setChunks] = useState<CidChunk[]>([]);
  const [outputs, setOutputs] = useState<CidOutput[]>([]);
  const [cidTags, setCidTags] = useState<Array<{ id: string; name: string }>>([]);

  const [selectedAssetId, setSelectedAssetId] = useState('');
  
  // States para a nova busca no backend
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [insight, setInsight] =useState('');
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);

  useEffect(() => {
    setForm((prev) => ({ ...prev, ownerName: prev.ownerName || userProfile?.name || '' }));
  }, [userProfile]);

  useEffect(() => {
    if (!selectedFiles.length) return;
    if (selectedFiles.length === 1) {
      const file = selectedFiles[0];
      setForm((prev) => ({
        ...prev,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
        materialType: detectMaterial(file)
      }));
    } else {
      setForm((prev) => ({ ...prev, materialType: 'other' }));
    }
  }, [selectedFiles]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    if (!scopedWorkspaceId) return;

    unsubs.push(onSnapshot(
      query(collection(db, 'cid_assets'), where('workspaceId', '==', scopedWorkspaceId), orderBy('createdAt', 'desc')),
      (snap) => setAssets(snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as CidAsset) })))
    ));

    unsubs.push(onSnapshot(
      query(collection(db, 'cid_asset_files'), where('workspaceId', '==', scopedWorkspaceId), orderBy('createdAt', 'desc')),
      (snap) => setAssetFiles(snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as CidAssetFile) })))
    ));

    unsubs.push(onSnapshot(
      query(collection(db, 'cid_processing_jobs'), where('workspaceId', '==', scopedWorkspaceId), orderBy('createdAt', 'desc')),
      (snap) => setJobs(snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as CidProcessingJob) })))
    ));

    unsubs.push(onSnapshot(
      query(collection(db, 'cid_chunks'), where('workspaceId', '==', scopedWorkspaceId), orderBy('createdAt', 'desc')),
      (snap) => setChunks(snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as CidChunk) })))
    ));

    unsubs.push(onSnapshot(
      query(collection(db, 'cid_outputs'), where('workspaceId', '==', scopedWorkspaceId), orderBy('createdAt', 'desc')),
      (snap) => setOutputs(snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as CidOutput) })))
    ));

    unsubs.push(onSnapshot(
      query(collection(db, 'cid_tags'), where('workspaceId', '==', scopedWorkspaceId), orderBy('name', 'asc')),
      (snap) => setCidTags(snap.docs.map((d: any) => ({ id: d.id, name: String((d.data() as any).name || '') })))
    ));

    return () => unsubs.forEach((unsub) => unsub());
  }, [scopedWorkspaceId]);

  useEffect(() => {
    if (!assets.length) {
      setSelectedAssetId('');
      return;
    }
    if (!selectedAssetId || !assets.some((a) => a.id === selectedAssetId)) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  // Efeito para debounce da busca
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchText]);

  // Efeito para executar a busca no backend
  useEffect(() => {
    if (debouncedSearchText.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      try {
        const response = await fetch('/.netlify/functions/cid-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchText: debouncedSearchText,
            workspaceId: scopedWorkspaceId
          }),
        });
        if (!response.ok) {
          throw new Error('A busca no back-end falhou.');
        }
        const result = await response.json();
        setSearchResults(result.data || []);
      } catch (error) {
        console.error('Erro ao buscar na aba de inteligência:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchText, scopedWorkspaceId]);


  const selectedAsset = useMemo(() => assets.find((a) => a.id === selectedAssetId) || null, [assets, selectedAssetId]);
  const selectedAssetFiles = useMemo(() => assetFiles.filter((x) => x.assetId === selectedAssetId), [assetFiles, selectedAssetId]);
  const assetFileMap = useMemo(() => {
    const map = new Map<string, CidAssetFile[]>();
    assetFiles.forEach((file) => {
      const current = map.get(file.assetId) || [];
      current.push(file);
      map.set(file.assetId, current);
    });
    return map;
  }, [assetFiles]);
  const selectedChunks = useMemo(
    () => chunks.filter((x) => x.assetId === selectedAssetId).sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0)),
    [chunks, selectedAssetId]
  );
  const selectedOutputs = useMemo(() => outputs.filter((x) => x.assetId === selectedAssetId), [outputs, selectedAssetId]);

  const outputByType = useMemo(() => {
    const map = new Map<string, CidOutput>();
    selectedOutputs.forEach((out) => {
      if (!map.has(out.outputType)) map.set(out.outputType, out);
    });
    return map;
  }, [selectedOutputs]);

  const processingRows = useMemo(() => {
    return jobs
      .map((job) => ({ job, asset: assets.find((a) => a.id === job.assetId) }))
      .sort((a, b) => toDate(b.job.createdAt).getTime() - toDate(a.job.createdAt).getTime());
  }, [jobs, assets]);

  const totalPartsCount = useMemo(() => {
    return jobs.reduce((sum, job) => {
      const total = Math.max(
        Number(job.totalParts || 0),
        Number(job.completedParts || 0) + Number(job.pendingParts || 0),
        Number(job.completedParts || 0)
      );
      return sum + total;
    }, 0);
  }, [jobs]);

  const selectedProcessingRow = useMemo(
    () => processingRows.find((row) => (row.asset?.id || row.job.assetId) === selectedAssetId) || null,
    [processingRows, selectedAssetId]
  );
  const selectedAssetSizeBytes = useMemo(
    () => resolveAssetSizeBytes(selectedAsset, selectedAssetFiles),
    [selectedAsset, selectedAssetFiles]
  );
  const selectedFilesTotalBytes = useMemo(
    () => selectedFiles.reduce((sum, file) => sum + Number(file.size || 0), 0),
    [selectedFiles]
  );
  const hasFilesAboveOfficialLimit = useMemo(
    () => selectedFiles.some((file) => Number(file.size || 0) > CID_STORAGE_LIMIT_BYTES),
    [selectedFiles]
  );

  useEffect(() => {
    if (activeTab !== 'processing') return;
    const activeRow = processingRows.find((row) =>
      ['queued', 'fragmenting', 'processing', 'transcribing', 'summarizing', 'consolidating'].includes(String(row.job.status || '').toLowerCase())
    );
    if (activeRow?.asset?.id && activeRow.asset.id !== selectedAssetId) {
      setSelectedAssetId(activeRow.asset.id);
    }
  }, [activeTab, processingRows, selectedAssetId]);

  const selectedTotalParts = Math.max(
    Number(selectedProcessingRow?.job.totalParts || 0),
    Number(selectedAsset?.totalParts || 0),
    selectedChunks.length
  );

  const resolveOwnerUserId = () => {
    if (ownerUserId) return ownerUserId;
    if (userProfile?.uid) return userProfile.uid;
    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.user?.id || null;
    } catch {
      return null;
    }
  };

  const ensureTags = async (assetId: string, tagNames: string[]) => {
    for (const tagName of tagNames) {
      const normalized = tagName.trim();
      if (!normalized) continue;

      const existing = cidTags.find((t) => t.name.toLowerCase() === normalized.toLowerCase());
      let tagId = existing?.id;

      if (!tagId) {
        try {
          const ref = await addDoc(collection(db, 'cid_tags'), {
            workspaceId: scopedWorkspaceId,
            name: normalized,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          tagId = ref.id;
        } catch (error) {
          console.warn('Falha ao criar tag CID:', error);
        }
      }

      if (!tagId) continue;

      try {
        await addDoc(collection(db, 'cid_asset_tags'), {
          workspaceId: scopedWorkspaceId,
          assetId,
          tagId,
          createdAt: new Date()
        });
      } catch (error) {
        console.warn('Falha ao vincular tag CID:', error);
      }
    }
  };
  
  const initiateCidProcessing = async (file: File, queuePosition: number, batchId: string | null): Promise<{ ok: boolean, assetId?: string }> => {
    const materialType = selectedFiles.length === 1 ? form.materialType : detectMaterial(file);
    const desiredAction = form.desiredAction;
    const createdAt = new Date();
    const title = selectedFiles.length === 1 ? (form.title.trim() || file.name) : file.name;
    const ownerId = resolveOwnerUserId();
    const safeVentureId = isUuidLike(form.ventureId) ? form.ventureId : null;
    const needsInlinePreview = file.size <= INLINE_PREVIEW_MAX_BYTES && (materialType === 'image' || materialType === 'pdf');
    const dataUrl = needsInlinePreview ? await readAsDataUrl(file) : '';

    const assetRef = await addDoc(collection(db, 'cid_assets'), {
      workspaceId: scopedWorkspaceId,
      ventureId: safeVentureId,
      title,
      materialType,
      area: form.area.trim(),
      project: form.project.trim(),
      sensitivity: form.sensitivity.trim(),
      ownerUserId: ownerId,
      ownerName: form.ownerName.trim(),
      language: form.language.trim(),
      desiredAction,
      sourceKind: 'upload',
      isConsultable: form.isConsultable,
      status: 'received',
      progressPct: 0,
      createdAt,
      updatedAt: createdAt,
      payload: { originalFilename: file.name, originalSizeBytes: file.size, originalMimeType: file.type }
    });

    const assetId = assetRef.id;
    const storagePath = buildCidStoragePath({ workspaceId: scopedWorkspaceId, assetId, createdAt, fileName: file.name });

    try {
      await uploadBlobToSupabaseStorage({ bucket: 'cid-assets', path: storagePath, blob: file, mimeType: file.type || 'application/octet-stream' });
      await addDoc(collection(db, 'cid_asset_files'), {
        assetId,
        workspaceId: scopedWorkspaceId,
        bucket: 'cid-assets',
        path: storagePath,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        status: 'stored',
        createdAt,
        updatedAt: createdAt,
        payload: { inlinePreviewDataUrl: needsInlinePreview ? dataUrl : null }
      });
    } catch (error: any) {
      await updateDoc(doc(db, 'cid_assets', assetId), { status: 'error', payload: { processingError: error.message } });
      throw error;
    }

    if (batchId) {
      await addDoc(collection(db, 'cid_batch_items'), { workspaceId: scopedWorkspaceId, batchId, assetId, status: 'queued' });
    }

    const tagNames = String(form.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (tagNames.length) await ensureTags(assetId, tagNames);

    await addDoc(collection(db, 'cid_processing_jobs'), {
      assetId,
      workspaceId: scopedWorkspaceId,
      batchId,
      jobType: 'ingestion',
      actionPlan: { desiredAction, shouldTranscribe: desiredAction.includes('transcribe'), shouldSummarize: desiredAction.includes('summarize') },
      queuePosition,
      status: 'queued',
      createdAt,
      updatedAt: createdAt
    });

    await updateDoc(doc(db, 'cid_assets', assetId), { status: 'queued', updatedAt: new Date() });

    try {
      fetch('/.netlify/functions/cid-processor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId }),
      });
      return { ok: true, assetId };
    } catch (error: any) {
       await updateDoc(doc(db, 'cid_assets', assetId), { status: 'error', payload: { processingError: `Falha ao iniciar processamento no back-end: ${error.message}` } });
       return { ok: false, assetId };
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!isUuidLike(scopedWorkspaceId)) {
      setFeedback('Workspace do usuario nao foi resolvido corretamente. Recarregue o app e tente de novo.');
      return;
    }
    if (!selectedFiles.length) {
      setFeedback('Selecione ao menos um arquivo.');
      return;
    }

    setIsSubmitting(true);
    setFeedback('Iniciando upload e processamento no CID...');

    try {
      let batchId: string | null = null;
      if (selectedFiles.length > 1) {
        const batchRef = await addDoc(collection(db, 'cid_batches'), {
          workspaceId: scopedWorkspaceId,
          ventureId: isUuidLike(form.ventureId) ? form.ventureId : null,
          title: `Lote CID • ${new Date().toLocaleString('pt-BR')}`,
          source: 'upload',
          status: 'open',
          totalItems: selectedFiles.length,
          createdBy: resolveOwnerUserId(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        batchId = batchRef.id;
      }

      let processed = 0;
      let failed = 0;

      for (let i = 0; i < selectedFiles.length; i += 1) {
        const result = await initiateCidProcessing(selectedFiles[i], i + 1, batchId);
        if (result.ok) processed += 1;
        else failed += 1;
      }

      if (batchId) {
        await updateDoc(doc(db, 'cid_batches', batchId), {
          status: 'processing',
          processedItems: processed,
          failedItems: failed,
          updatedAt: new Date()
        });
      }

      setFeedback(`Upload(s) iniciado(s). O processamento continuará em segundo plano. Sucessos: ${processed}. Falhas na iniciação: ${failed}.`);
      setSelectedFiles([]);
      setForm(initialForm(userProfile));
      setActiveTab('processing');
    } catch (error: any) {
      setFeedback(`Falha no fluxo de upload do CID: ${String(error?.message || 'erro desconhecido')}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateIntelligenceInsight = async () => {
    if (isGeneratingInsight) return;
    const corpus = searchResults.map((row) => `${row.assetTitle} | ${row.source}\n${row.text}`).join('\n\n').trim();
    if (!corpus) {
      setInsight('Sem conteúdo na busca atual para sintetizar.');
      return;
    }

    setIsGeneratingInsight(true);
    try {
        setInsight('Funcionalidade de síntese precisa ser migrada para um endpoint de back-end.');
    } catch {
      setInsight('Falha ao gerar síntese.');
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const tabs: Array<{ id: CidTab; label: string }> = [
    { id: 'upload', label: 'Upload' },
    { id: 'library', label: 'Biblioteca' },
    { id: 'processing', label: 'Processamento' },
    { id: 'intelligence', label: 'Inteligência' }
  ];

  const inlineFile = selectedAssetFiles[0];
  const inlinePreviewDataUrl = String(inlineFile?.payload?.inlinePreviewDataUrl || '');
  const isImagePreview = inlineFile?.mimeType?.startsWith('image/');
  const isPdfPreview = inlineFile?.mimeType?.includes('pdf');

  return (
    <div className="h-full flex flex-col bg-[#F6F8FB] overflow-hidden">
      <header className="h-20 px-6 md:px-10 flex items-center justify-between border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 flex items-center justify-center transition-colors"
            >
              <BackIcon className="w-5 h-5" />
            </button>
          )}
          <div>
            <p className="text-[10px] font-black tracking-[0.32em] text-gray-400 uppercase">CID</p>
            <h1 className="text-lg md:text-xl font-bold text-gray-900">Centro de Inteligência Documental</h1>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-gray-100 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="md:hidden px-4 py-3 border-b border-gray-100 bg-white">
        <div className="grid grid-cols-2 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${activeTab === tab.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {activeTab === 'upload' && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">
            <form onSubmit={handleUpload} className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 md:p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-800">
                <CloudUploadIcon className="w-5 h-5" />
                <h2 className="text-sm font-black uppercase tracking-wider">Upload e Pipeline</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Arquivos</label>
                  <input
                    type="file"
                    multiple
                    onChange={(ev) => setSelectedFiles(Array.from(ev.target.files || []))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2"
                    accept=".pdf,.doc,.docx,.txt,.md,.json,.xml,.csv,.xls,.xlsx,image/*,audio/*,video/*"
                  />
                  {!!selectedFiles.length && (
                    <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                      <p className="text-xs text-gray-600 font-semibold">
                        {selectedFiles.length} arquivo(s) selecionado(s) • total {formatBytes(selectedFilesTotalBytes)}
                      </p>
                    </div>
                  )}
                  <div className="mt-2 space-y-1">
                    <p className="text-[11px] text-gray-500">
                      Limite oficial do bucket: <span className="font-semibold text-gray-700">{formatBytes(CID_STORAGE_LIMIT_BYTES)}</span>.
                    </p>
                    {hasFilesAboveOfficialLimit && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        Arquivo acima do limite. O processamento no back-end pode falhar.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Título</label>
                  <input value={form.title} onChange={(ev) => setForm((prev) => ({ ...prev, title: ev.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Tipo</label>
                  <select value={form.materialType} onChange={(ev) => setForm((prev) => ({ ...prev, materialType: ev.target.value as Material }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="pdf">PDF</option>
                    <option value="doc">DOC</option>
                    <option value="docx">DOCX</option>
                    <option value="txt">TXT</option>
                    <option value="spreadsheet">Planilha</option>
                    <option value="image">Imagem</option>
                    <option value="audio">Áudio</option>
                    <option value="video">Vídeo</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Venture</label>
                  <select value={form.ventureId} onChange={(ev) => setForm((prev) => ({ ...prev, ventureId: ev.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="">Sem vínculo</option>
                    {ventures.map((venture) => <option key={venture.id} value={venture.id}>{venture.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Área</label>
                  <input value={form.area} onChange={(ev) => setForm((prev) => ({ ...prev, area: ev.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Projeto</label>
                  <input value={form.project} onChange={(ev) => setForm((prev) => ({ ...prev, project: ev.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Sensibilidade</label>
                  <select value={form.sensitivity} onChange={(ev) => setForm((prev) => ({ ...prev, sensitivity: ev.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="public">Public</option>
                    <option value="internal">Internal</option>
                    <option value="restricted">Restricted</option>
                    <option value="confidential">Confidential</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Responsável</label>
                  <input value={form.ownerName} onChange={(ev) => setForm((prev) => ({ ...prev, ownerName: ev.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Idioma</label>
                  <input value={form.language} onChange={(ev) => setForm((prev) => ({ ...prev, language: ev.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Ação</label>
                  <select value={form.desiredAction} onChange={(ev) => setForm((prev) => ({ ...prev, desiredAction: ev.target.value as DesiredAction }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="store_only">Só armazenar</option>
                    <option value="store_transcribe">Armazenar + transcrever</option>
                    <option value="store_summarize">Armazenar + resumir</option>
                    <option value="store_transcribe_summarize">Armazenar + transcrever + resumir</option>
                    <option value="store_consolidate">Armazenar + consolidar</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Tags (vírgula)</label>
                  <input value={form.tags} onChange={(ev) => setForm((prev) => ({ ...prev, tags: ev.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500">O processamento agora ocorre no back-end.</p>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 disabled:opacity-60">
                  {isSubmitting ? 'Iniciando...' : 'Enviar para CID'}
                </button>
              </div>
              {feedback && <div className="text-xs rounded-xl bg-gray-100 text-gray-700 px-3 py-2 border border-gray-200">{feedback}</div>}
            </form>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-800">Resumo Rápido</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-100 p-3"><p className="text-[10px] uppercase tracking-wider text-gray-400 font-black">Ativos</p><p className="text-xl font-bold text-gray-900">{assets.length}</p></div>
                <div className="rounded-xl border border-gray-100 p-3"><p className="text-[10px] uppercase tracking-wider text-gray-400 font-black">Processos</p><p className="text-xl font-bold text-gray-900">{jobs.length}</p></div>
                <div className="rounded-xl border border-gray-100 p-3"><p className="text-[10px] uppercase tracking-wider text-gray-400 font-black">Partes</p><p className="text-xl font-bold text-gray-900">{Math.max(totalPartsCount, chunks.length)}</p></div>
                <div className="rounded-xl border border-gray-100 p-3"><p className="text-[10px] uppercase tracking-wider text-gray-400 font-black">Saidas</p><p className="text-xl font-bold text-gray-900">{outputs.length}</p></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'library' && (
           <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-1 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wider text-gray-800 mb-3">Biblioteca CID</h2>
              <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => setSelectedAssetId(asset.id)}
                    className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${selectedAssetId === asset.id ? 'border-gray-300 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
                  >
                    <p className="text-sm font-semibold text-gray-900 truncate">{asset.title}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{toLabel(asset.materialType)} • {fmt(asset.createdAt)} • {formatBytes(resolveAssetSizeBytes(asset, assetFileMap.get(asset.id) || []))}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(asset.status)}`}>{toLabel(asset.status)}</span>
                      <span className="text-[10px] text-gray-500 font-bold">{asset.progressPct || 0}%</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-4 md:p-5 shadow-sm space-y-4">
              {selectedAsset ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{selectedAsset.title}</h3>
                    </div>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${statusBadge(selectedAsset.status)}`}>{toLabel(selectedAsset.status)}</span>
                  </div>
                  {/* Conteúdo detalhado do asset... */}
                </>
              ) : <div className="text-sm text-gray-500">Selecione um asset para visualizar.</div>}
            </div>
          </div>
        )}

        {activeTab === 'processing' && (
          <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-gray-100 p-4 md:p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wider text-gray-800 mb-3">Fila e Processamento</h2>
            <div className="overflow-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 uppercase tracking-wider">
                    <th className="py-2 pr-3">Asset</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Progresso</th>
                    <th className="py-2 pr-3">Tamanho</th>
                    <th className="py-2 pr-3">Criado</th>
                    <th className="py-2 pr-3">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {processingRows.map(({ job, asset }) => (
                    <tr key={job.id} onClick={() => asset && setSelectedAssetId(asset.id)} className={`border-t border-gray-100 cursor-pointer ${selectedAssetId === asset?.id ? 'bg-gray-50' : 'hover:bg-gray-50/70'}`}>
                      <td className="py-2 pr-3 font-semibold text-gray-800">{asset?.title || job.assetId}</td>
                      <td className="py-2 pr-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(job.status)}`}>{toLabel(job.status)}</span></td>
                      <td className="py-2 pr-3 w-[190px]"><div className="w-full h-2 rounded-full bg-gray-100"><div className="h-full bg-gray-800" style={{ width: `${job.progressPct || 0}%` }} /></div></td>
                      <td className="py-2 pr-3 text-gray-600">{formatBytes(resolveAssetSizeBytes(asset, asset ? (assetFileMap.get(asset.id) || []) : []))}</td>
                      <td className="py-2 pr-3 text-gray-600">{fmt(job.createdAt)}</td>
                      <td className="py-2 pr-3 text-red-600 max-w-[220px] truncate" title={job.errorMessage || ''}>{job.errorMessage || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'intelligence' && (
          <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-4 md:p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <SearchIcon className="w-4 h-4 text-gray-500" />
                <input value={searchText} onChange={(ev) => setSearchText(ev.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="Buscar em todo o CID (mín. 3 caracteres)..." />
              </div>
              <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                {isSearching && <div className="text-xs text-gray-500 p-3">Buscando...</div>}
                {!isSearching && !searchResults.length && (
                    <div className="text-xs text-gray-500 rounded-xl bg-gray-50 border border-gray-100 p-3">
                        {debouncedSearchText.length < 3 ? 'Digite ao menos 3 caracteres para buscar.' : 'Nenhum resultado para a busca atual.'}
                    </div>
                )}
                {searchResults.map((row, idx) => (
                  <div key={`${row.assetId}-${row.source}-${idx}`} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-900 truncate">{row.assetTitle}</p><span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{row.source}</span></div>
                    <p className="text-xs text-gray-500 mb-1">{fmt(row.createdAt)}</p>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{row.text.slice(0, 420) || '-'}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-800">Síntese Inteligente</h3>
              <p className="text-xs text-gray-500">Gera uma consolidação com base no resultado da busca.</p>
              <button onClick={generateIntelligenceInsight} disabled={isGeneratingInsight} className="w-full px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 disabled:opacity-60">{isGeneratingInsight ? 'Gerando...' : 'Gerar Síntese'}</button>
              <div className="rounded-xl border border-gray-100 p-3 min-h-[220px]"><p className="text-[11px] uppercase tracking-widest font-black text-gray-500 mb-2">Resultado</p><p className="text-xs text-gray-700 whitespace-pre-wrap">{insight || 'Ainda sem síntese.'}</p></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CIDView;
