
import React, { useEffect, useMemo, useState } from 'react';
import { BackIcon, CloudUploadIcon, SearchIcon } from './Icon';
import { CidAsset, CidAssetFile, CidChunk, CidOutput, CidProcessingJob, UserProfile, Venture } from '../types';
import { addDoc, collection, db, doc, onSnapshot, orderBy, query, updateDoc, where } from '../services/supabase';
import { callAiProxy } from '../services/aiProxy';
import { transcribeAudio } from '../services/gemini';

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

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';
const SESSION_STORAGE_KEY = 'sagb_supabase_session_v1';

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const fmt = (value: any) => toDate(value).toLocaleString('pt-BR');
const toLabel = (value: any) => {
  const raw = String(value || '').replace(/[_-]+/g, ' ').trim().toLowerCase();
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

const splitChunks = (text: string, maxChars = 3500) => {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const blocks = raw.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  let current = '';
  blocks.forEach((block) => {
    if (!current) current = block;
    else if ((current.length + block.length + 2) <= maxChars) current += `\n\n${block}`;
    else {
      out.push(current);
      current = block;
    }
  });
  if (current) out.push(current);
  if (out.length) return out;
  const sliced: string[] = [];
  for (let i = 0; i < raw.length; i += maxChars) {
    sliced.push(raw.slice(i, i + maxChars));
  }
  return sliced;
};

const summarize = async (text: string, mode: 'short' | 'long' | 'consolidation') => {
  const content = String(text || '').trim();
  if (!content) return '';
  const instruction = mode === 'short'
    ? 'Resuma em ate 6 bullets curtos com foco executivo.'
    : mode === 'long'
      ? 'Resuma em secoes: contexto, pontos chave, riscos, proximos passos.'
      : 'Consolide em uma sintese estrategica unica.';
  const prompt = `${instruction}\n\n${content.slice(0, 28000)}`;
  try {
    const data = await callAiProxy<{ text: string }>('gemini_chat', {
      modelId: 'gemini-2.5-flash',
      systemInstruction: 'Voce e o modulo CID do SAGB.',
      temperature: 0.2,
      message: prompt
    });
    return String(data?.text || '').trim();
  } catch {
    return content.slice(0, mode === 'short' ? 900 : 2600);
  }
};

const readAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
  reader.readAsDataURL(file);
});

const dataUrlBase64 = (dataUrl: string) => String(dataUrl || '').split(',')[1] || '';

const isTextLike = (file: File, materialType: Material) => {
  if (materialType === 'txt' || materialType === 'spreadsheet') return true;
  const mime = String(file.type || '').toLowerCase();
  return mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('csv');
};

const canTranscribe = (action: DesiredAction) => action === 'store_transcribe' || action === 'store_transcribe_summarize';
const canSummarize = (action: DesiredAction) => action === 'store_summarize' || action === 'store_transcribe_summarize' || action === 'store_consolidate';

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
  const scopedWorkspaceId = workspaceId?.trim() ? workspaceId : DEFAULT_WORKSPACE_ID;

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
  const [searchText, setSearchText] = useState('');
  const [insight, setInsight] = useState('');
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

  const selectedAsset = useMemo(() => assets.find((a) => a.id === selectedAssetId) || null, [assets, selectedAssetId]);
  const selectedAssetFiles = useMemo(() => assetFiles.filter((x) => x.assetId === selectedAssetId), [assetFiles, selectedAssetId]);
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

  const intelligenceRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const rows = assets.flatMap((asset) => {
      const assetOutputs = outputs.filter((o) => o.assetId === asset.id).map((o) => ({
        assetId: asset.id,
        assetTitle: asset.title,
        source: `output:${o.outputType}`,
        createdAt: o.createdAt,
        text: String(o.contentText || '')
      }));
      const assetChunks = chunks.filter((c) => c.assetId === asset.id).map((c) => ({
        assetId: asset.id,
        assetTitle: asset.title,
        source: `chunk:${c.chunkIndex}`,
        createdAt: c.createdAt,
        text: String(c.textContent || '')
      }));
      return [...assetOutputs, ...assetChunks];
    });

    const filtered = q
      ? rows.filter((row) => row.assetTitle.toLowerCase().includes(q) || row.source.toLowerCase().includes(q) || row.text.toLowerCase().includes(q))
      : rows;

    return filtered
      .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
      .slice(0, 60);
  }, [assets, outputs, chunks, searchText]);

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

  const safeUpdate = async (table: string, id: string, payload: Record<string, any>) => {
    try {
      await updateDoc(doc(db, table, id), payload);
    } catch (error) {
      console.error(`Falha ao atualizar ${table}/${id}`, error);
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

  const readExtractedText = async (file: File, materialType: Material): Promise<string> => {
    if (!isTextLike(file, materialType)) return '';
    try {
      return String(await file.text()).trim();
    } catch {
      return '';
    }
  };

  const processOneFile = async (file: File, queuePosition: number, batchId: string | null) => {
    const materialType = selectedFiles.length === 1 ? form.materialType : detectMaterial(file);
    const desiredAction = form.desiredAction;
    const createdAt = new Date();
    const title = selectedFiles.length === 1 ? (form.title.trim() || file.name) : file.name;
    const ownerId = resolveOwnerUserId();
    const dataUrl = await readAsDataUrl(file);

    const assetRef = await addDoc(collection(db, 'cid_assets'), {
      workspaceId: scopedWorkspaceId,
      ventureId: form.ventureId || null,
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
      totalParts: 0,
      completedParts: 0,
      pendingParts: 0,
      createdAt,
      updatedAt: createdAt,
      payload: {
        originalFilename: file.name,
        originalSizeBytes: file.size,
        originalMimeType: file.type
      }
    });

    const assetId = assetRef.id;

    await addDoc(collection(db, 'cid_asset_files'), {
      assetId,
      workspaceId: scopedWorkspaceId,
      bucket: 'cid-assets',
      path: `inline://${assetId}/${encodeURIComponent(file.name)}`,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      status: 'stored',
      createdAt,
      updatedAt: createdAt,
      payload: {
        inlinePreviewDataUrl: file.size <= 2_000_000 ? dataUrl : null,
        storageMode: file.size <= 2_000_000 ? 'inline_preview' : 'metadata_only'
      }
    });

    if (batchId) {
      await addDoc(collection(db, 'cid_batch_items'), {
        workspaceId: scopedWorkspaceId,
        batchId,
        assetId,
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    const tagNames = String(form.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (tagNames.length) await ensureTags(assetId, tagNames);

    const jobRef = await addDoc(collection(db, 'cid_processing_jobs'), {
      assetId,
      workspaceId: scopedWorkspaceId,
      batchId,
      jobType: 'ingestion',
      actionPlan: {
        desiredAction,
        shouldTranscribe: canTranscribe(desiredAction),
        shouldSummarize: canSummarize(desiredAction)
      },
      queuePosition,
      status: 'queued',
      progressPct: 0,
      totalParts: 0,
      completedParts: 0,
      pendingParts: 0,
      retries: 0,
      maxRetries: 3,
      createdAt,
      updatedAt: createdAt
    });

    const jobId = jobRef.id;

    await safeUpdate('cid_assets', assetId, { status: 'queued', updatedAt: new Date() });

    try {
      await safeUpdate('cid_processing_jobs', jobId, { status: 'fragmenting', startedAt: new Date(), updatedAt: new Date() });
      await safeUpdate('cid_assets', assetId, { status: 'fragmenting', processingStartedAt: new Date(), updatedAt: new Date() });

      const extractedText = await readExtractedText(file, materialType);
      let transcription = '';

      if (canTranscribe(desiredAction) && (materialType === 'audio' || materialType === 'video')) {
        await safeUpdate('cid_processing_jobs', jobId, { status: 'transcribing', updatedAt: new Date() });
        await safeUpdate('cid_assets', assetId, { status: 'transcribing', updatedAt: new Date() });
        transcription = await transcribeAudio(dataUrlBase64(dataUrl), file.type || 'audio/webm');
      }

      const sourceText = String(transcription || extractedText || '').trim();
      const fallbackText = sourceText || `Arquivo sem extração textual automática nesta V1: ${file.name}`;
      const chunkTexts = splitChunks(fallbackText);
      const totalParts = chunkTexts.length || 1;

      await safeUpdate('cid_processing_jobs', jobId, {
        status: 'processing',
        totalParts,
        pendingParts: totalParts,
        progressPct: 10,
        updatedAt: new Date()
      });
      await safeUpdate('cid_assets', assetId, {
        status: 'processing',
        totalParts,
        pendingParts: totalParts,
        progressPct: 10,
        updatedAt: new Date()
      });

      for (let i = 0; i < chunkTexts.length; i += 1) {
        await addDoc(collection(db, 'cid_chunks'), {
          assetId,
          jobId,
          workspaceId: scopedWorkspaceId,
          chunkIndex: i + 1,
          chunkKind: materialType === 'audio' || materialType === 'video' ? 'time_block' : 'text_block',
          textContent: chunkTexts[i],
          status: 'completed',
          retries: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        const completedParts = i + 1;
        const pendingParts = Math.max(totalParts - completedParts, 0);
        const progressPct = Math.min(80, Math.round((completedParts / totalParts) * 80));
        await safeUpdate('cid_processing_jobs', jobId, { completedParts, pendingParts, progressPct, updatedAt: new Date() });
        await safeUpdate('cid_assets', assetId, { completedParts, pendingParts, progressPct, updatedAt: new Date() });
      }

      if (extractedText) {
        await addDoc(collection(db, 'cid_outputs'), {
          assetId,
          jobId,
          workspaceId: scopedWorkspaceId,
          outputType: 'extracted_text',
          contentText: extractedText,
          language: form.language.trim(),
          status: 'ready',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      if (transcription) {
        await addDoc(collection(db, 'cid_outputs'), {
          assetId,
          jobId,
          workspaceId: scopedWorkspaceId,
          outputType: 'transcription',
          contentText: transcription,
          language: form.language.trim(),
          status: 'ready',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      let shortSummary = '';
      let longSummary = '';
      let consolidation = '';

      if (canSummarize(desiredAction) && sourceText) {
        await safeUpdate('cid_processing_jobs', jobId, { status: 'summarizing', progressPct: 85, updatedAt: new Date() });
        await safeUpdate('cid_assets', assetId, { status: 'summarizing', progressPct: 85, updatedAt: new Date() });

        shortSummary = await summarize(sourceText, 'short');
        longSummary = await summarize(sourceText, 'long');

        if (desiredAction === 'store_consolidate') {
          await safeUpdate('cid_processing_jobs', jobId, { status: 'consolidating', progressPct: 92, updatedAt: new Date() });
          await safeUpdate('cid_assets', assetId, { status: 'consolidating', progressPct: 92, updatedAt: new Date() });
          consolidation = await summarize(sourceText, 'consolidation');
        }
      }

      if (shortSummary) {
        await addDoc(collection(db, 'cid_outputs'), {
          assetId,
          jobId,
          workspaceId: scopedWorkspaceId,
          outputType: 'summary_short',
          contentText: shortSummary,
          language: form.language.trim(),
          status: 'ready',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      if (longSummary) {
        await addDoc(collection(db, 'cid_outputs'), {
          assetId,
          jobId,
          workspaceId: scopedWorkspaceId,
          outputType: 'summary_long',
          contentText: longSummary,
          language: form.language.trim(),
          status: 'ready',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      if (consolidation) {
        await addDoc(collection(db, 'cid_outputs'), {
          assetId,
          jobId,
          workspaceId: scopedWorkspaceId,
          outputType: 'consolidation',
          contentText: consolidation,
          language: form.language.trim(),
          status: 'ready',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      const finalStatus = canSummarize(desiredAction) && !sourceText ? 'completed_warning' : 'completed';
      const finalMessage = canSummarize(desiredAction) && !sourceText ? 'Sem texto base para resumo automático nesta V1.' : null;

      await safeUpdate('cid_processing_jobs', jobId, {
        status: finalStatus,
        progressPct: 100,
        completedParts: totalParts,
        pendingParts: 0,
        completedAt: new Date(),
        errorMessage: finalMessage,
        updatedAt: new Date()
      });
      await safeUpdate('cid_assets', assetId, {
        status: finalStatus,
        progressPct: 100,
        completedParts: totalParts,
        pendingParts: 0,
        completedAt: new Date(),
        updatedAt: new Date()
      });

      return { ok: true as const };
    } catch (error: any) {
      const message = String(error?.message || 'Falha no processamento CID.');
      await safeUpdate('cid_processing_jobs', jobId, { status: 'error', failedAt: new Date(), errorMessage: message, updatedAt: new Date() });
      await safeUpdate('cid_assets', assetId, { status: 'error', failedAt: new Date(), updatedAt: new Date(), payload: { processingError: message } });
      return { ok: false as const };
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedFiles.length) {
      setFeedback('Selecione ao menos um arquivo.');
      return;
    }

    const required: Array<[string, string]> = [
      ['title', form.title.trim()],
      ['area', form.area.trim()],
      ['project', form.project.trim()],
      ['sensitivity', form.sensitivity.trim()],
      ['ownerName', form.ownerName.trim()],
      ['language', form.language.trim()],
      ['tags', form.tags.trim()]
    ];

    const missing = required.filter(([, value]) => !value).map(([key]) => key);
    if (selectedFiles.length === 1 && missing.length) {
      setFeedback(`Preencha os metadados obrigatórios: ${missing.join(', ')}.`);
      return;
    }

    setIsSubmitting(true);
    setFeedback('Processando upload no CID...');

    try {
      let batchId: string | null = null;
      if (selectedFiles.length > 1) {
        const batchRef = await addDoc(collection(db, 'cid_batches'), {
          workspaceId: scopedWorkspaceId,
          ventureId: form.ventureId || null,
          title: `Lote CID • ${new Date().toLocaleString('pt-BR')}`,
          source: 'upload',
          status: 'open',
          totalItems: selectedFiles.length,
          processedItems: 0,
          failedItems: 0,
          createdBy: resolveOwnerUserId(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        batchId = batchRef.id;
      }

      let processed = 0;
      let failed = 0;

      for (let i = 0; i < selectedFiles.length; i += 1) {
        const result = await processOneFile(selectedFiles[i], i + 1, batchId);
        if (result.ok) processed += 1;
        else failed += 1;
      }

      if (batchId) {
        await safeUpdate('cid_batches', batchId, {
          status: failed > 0 ? 'completed_warning' : 'completed',
          processedItems: processed,
          failedItems: failed,
          updatedAt: new Date()
        });
      }

      setFeedback(`Upload concluído. Processados: ${processed}. Falhas: ${failed}.`);
      setSelectedFiles([]);
      setForm(initialForm(userProfile));
      setActiveTab('processing');
    } catch (error: any) {
      setFeedback(`Falha no fluxo CID: ${String(error?.message || 'erro desconhecido')}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateIntelligenceInsight = async () => {
    if (isGeneratingInsight) return;
    const corpus = intelligenceRows.map((row) => `${row.assetTitle} | ${row.source}\n${row.text}`).join('\n\n').trim();
    if (!corpus) {
      setInsight('Sem conteúdo processado para sintetizar.');
      return;
    }

    setIsGeneratingInsight(true);
    try {
      setInsight(await summarize(corpus.slice(0, 28000), 'consolidation'));
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
                    <p className="text-xs text-gray-500 mt-2">{selectedFiles.length} arquivo(s): {selectedFiles.map((f) => f.name).join(', ')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Título</label>
                  <input value={form.title} onChange={(ev) => setForm((prev) => ({ ...prev, title: ev.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Tipo de material</label>
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
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Ação desejada</label>
                  <select value={form.desiredAction} onChange={(ev) => setForm((prev) => ({ ...prev, desiredAction: ev.target.value as DesiredAction }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="store_only">Só armazenar</option>
                    <option value="store_transcribe">Armazenar + transcrever</option>
                    <option value="store_summarize">Armazenar + resumir</option>
                    <option value="store_transcribe_summarize">Armazenar + transcrever + resumir</option>
                    <option value="store_consolidate">Armazenar + consolidar</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-1">Tags (separadas por vírgula)</label>
                  <input value={form.tags} onChange={(ev) => setForm((prev) => ({ ...prev, tags: ev.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <label className="md:col-span-2 inline-flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={form.isConsultable} onChange={(ev) => setForm((prev) => ({ ...prev, isConsultable: ev.target.checked }))} />
                  Permitir consulta futura por agentes
                </label>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500">ET 01: upload, fragmentação, transcrição, resumo e status rastreável.</p>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 disabled:opacity-60">
                  {isSubmitting ? 'Processando...' : 'Enviar para CID'}
                </button>
              </div>
              {feedback && <div className="text-xs rounded-xl bg-gray-100 text-gray-700 px-3 py-2 border border-gray-200">{feedback}</div>}
            </form>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-800">Resumo Rápido</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-100 p-3"><p className="text-[10px] uppercase tracking-wider text-gray-400 font-black">Assets</p><p className="text-xl font-bold text-gray-900">{assets.length}</p></div>
                <div className="rounded-xl border border-gray-100 p-3"><p className="text-[10px] uppercase tracking-wider text-gray-400 font-black">Jobs</p><p className="text-xl font-bold text-gray-900">{jobs.length}</p></div>
                <div className="rounded-xl border border-gray-100 p-3"><p className="text-[10px] uppercase tracking-wider text-gray-400 font-black">Chunks</p><p className="text-xl font-bold text-gray-900">{chunks.length}</p></div>
                <div className="rounded-xl border border-gray-100 p-3"><p className="text-[10px] uppercase tracking-wider text-gray-400 font-black">Outputs</p><p className="text-xl font-bold text-gray-900">{outputs.length}</p></div>
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
                    <p className="text-[11px] text-gray-500 mt-1">{toLabel(asset.materialType)} • {fmt(asset.createdAt)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(asset.status)}`}>{toLabel(asset.status)}</span>
                      <span className="text-[10px] text-gray-500 font-bold">{asset.progressPct || 0}%</span>
                    </div>
                  </button>
                ))}
                {!assets.length && <div className="text-xs text-gray-500 rounded-xl bg-gray-50 border border-gray-100 p-3">Nenhum asset no CID ainda.</div>}
              </div>
            </div>

            <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-4 md:p-5 shadow-sm space-y-4">
              {selectedAsset ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{selectedAsset.title}</h3>
                      <p className="text-xs text-gray-500">{toLabel(selectedAsset.materialType)} • {fmt(selectedAsset.createdAt)}</p>
                    </div>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${statusBadge(selectedAsset.status)}`}>{toLabel(selectedAsset.status)}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-xl border border-gray-100 p-2"><span className="text-gray-400">Área</span><p className="font-semibold text-gray-800">{selectedAsset.area || '-'}</p></div>
                    <div className="rounded-xl border border-gray-100 p-2"><span className="text-gray-400">Projeto</span><p className="font-semibold text-gray-800">{selectedAsset.project || '-'}</p></div>
                    <div className="rounded-xl border border-gray-100 p-2"><span className="text-gray-400">Idioma</span><p className="font-semibold text-gray-800">{selectedAsset.language || '-'}</p></div>
                    <div className="rounded-xl border border-gray-100 p-2"><span className="text-gray-400">Ação</span><p className="font-semibold text-gray-800">{toLabel(selectedAsset.desiredAction)}</p></div>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-3">
                    <p className="text-[11px] uppercase tracking-widest font-black text-gray-500 mb-2">Original</p>
                    {inlinePreviewDataUrl && isImagePreview && <img src={inlinePreviewDataUrl} alt={inlineFile?.filename || 'preview'} className="max-h-72 rounded-lg border border-gray-100" />}
                    {inlinePreviewDataUrl && isPdfPreview && <iframe src={inlinePreviewDataUrl} className="w-full h-72 rounded-lg border border-gray-100" title="pdf-preview" />}
                    {!inlinePreviewDataUrl && <p className="text-xs text-gray-500">Preview inline indisponível para este arquivo nesta V1.</p>}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-gray-100 p-3">
                      <p className="text-[11px] uppercase tracking-widest font-black text-gray-500 mb-2">Transcrição</p>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap max-h-44 overflow-auto">{outputByType.get('transcription')?.contentText || 'Sem transcrição.'}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 p-3">
                      <p className="text-[11px] uppercase tracking-widest font-black text-gray-500 mb-2">Resumo Curto</p>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap max-h-44 overflow-auto">{outputByType.get('summary_short')?.contentText || 'Sem resumo curto.'}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-3">
                    <p className="text-[11px] uppercase tracking-widest font-black text-gray-500 mb-2">Resumo Longo / Consolidação</p>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap max-h-56 overflow-auto">{outputByType.get('summary_long')?.contentText || outputByType.get('consolidation')?.contentText || 'Sem conteúdo consolidado.'}</p>
                  </div>
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
                    <th className="py-2 pr-3">Partes</th>
                    <th className="py-2 pr-3">Criado</th>
                    <th className="py-2 pr-3">Início</th>
                    <th className="py-2 pr-3">Conclusão</th>
                    <th className="py-2 pr-3">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {processingRows.map(({ job, asset }) => (
                    <tr key={job.id} className="border-t border-gray-100">
                      <td className="py-2 pr-3 font-semibold text-gray-800">{asset?.title || job.assetId}</td>
                      <td className="py-2 pr-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(job.status)}`}>{toLabel(job.status)}</span></td>
                      <td className="py-2 pr-3 w-[190px]"><div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-gray-800" style={{ width: `${Math.max(0, Math.min(100, job.progressPct || 0))}%` }} /></div><span className="text-[10px] text-gray-500">{job.progressPct || 0}%</span></td>
                      <td className="py-2 pr-3 text-gray-600">{job.completedParts || 0}/{job.totalParts || 0} ({job.pendingParts || 0} pend.)</td>
                      <td className="py-2 pr-3 text-gray-600">{fmt(job.createdAt)}</td>
                      <td className="py-2 pr-3 text-gray-600">{job.startedAt ? fmt(job.startedAt) : '-'}</td>
                      <td className="py-2 pr-3 text-gray-600">{job.completedAt ? fmt(job.completedAt) : '-'}</td>
                      <td className="py-2 pr-3 text-red-600 max-w-[220px] truncate" title={job.errorMessage || ''}>{job.errorMessage || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!processingRows.length && <div className="mt-3 text-xs text-gray-500 rounded-xl bg-gray-50 border border-gray-100 p-3">Nenhum job CID registrado ainda.</div>}
            </div>

            {!!selectedAsset && (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-[11px] uppercase tracking-widest font-black text-gray-500 mb-2">Chunks ({selectedChunks.length})</p>
                  <div className="max-h-52 overflow-auto space-y-2">
                    {selectedChunks.map((chunk) => (
                      <div key={chunk.id} className="rounded-lg border border-gray-100 p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-gray-500">Parte {chunk.chunkIndex}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(chunk.status)}`}>{toLabel(chunk.status)}</span>
                        </div>
                        <p className="text-xs text-gray-600 whitespace-pre-wrap">{String(chunk.textContent || '').slice(0, 240) || '-'}</p>
                      </div>
                    ))}
                    {!selectedChunks.length && <p className="text-xs text-gray-500">Sem chunks para o asset selecionado.</p>}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-[11px] uppercase tracking-widest font-black text-gray-500 mb-2">Outputs ({selectedOutputs.length})</p>
                  <div className="max-h-52 overflow-auto space-y-2">
                    {selectedOutputs.map((out) => (
                      <div key={out.id} className="rounded-lg border border-gray-100 p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-gray-500">{toLabel(out.outputType)}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(out.status || 'ready')}`}>{toLabel(out.status || 'ready')}</span>
                        </div>
                        <p className="text-xs text-gray-600 whitespace-pre-wrap">{String(out.contentText || '').slice(0, 240) || '-'}</p>
                      </div>
                    ))}
                    {!selectedOutputs.length && <p className="text-xs text-gray-500">Sem outputs para o asset selecionado.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'intelligence' && (
          <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-4 md:p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3"><SearchIcon className="w-4 h-4 text-gray-500" /><input value={searchText} onChange={(ev) => setSearchText(ev.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="Buscar por título, chunk ou output..." /></div>
              <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                {intelligenceRows.map((row, idx) => (
                  <div key={`${row.assetId}-${row.source}-${idx}`} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-900 truncate">{row.assetTitle}</p><span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{row.source}</span></div>
                    <p className="text-xs text-gray-500 mb-1">{fmt(row.createdAt)}</p>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{row.text.slice(0, 420) || '-'}</p>
                  </div>
                ))}
                {!intelligenceRows.length && <div className="text-xs text-gray-500 rounded-xl bg-gray-50 border border-gray-100 p-3">Sem resultados para a busca atual.</div>}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-800">Síntese Inteligente</h3>
              <p className="text-xs text-gray-500">Gera uma consolidação executiva com base no resultado atual da busca.</p>
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
