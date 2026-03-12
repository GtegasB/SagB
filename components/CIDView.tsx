import React, { useEffect, useMemo, useState } from 'react';
import { BackIcon, CloudUploadIcon, FileTextIcon, SearchIcon } from './Icon';
import { CidAsset, CidAssetFile, CidChunk, CidOutput, CidProcessingJob, UserProfile, Venture } from '../types';
import { addDoc, collection, db, doc, onSnapshot, orderBy, query, updateDoc, where } from '../services/supabase';
import { callAiProxy } from '../services/aiProxy';
import { transcribeAudio } from '../services/gemini';

type CidTab = 'upload' | 'library' | 'processing' | 'intelligence';
type Material = 'pdf' | 'doc' | 'docx' | 'txt' | 'spreadsheet' | 'image' | 'audio' | 'video' | 'other';
type DesiredAction = 'store_only' | 'store_transcribe' | 'store_summarize' | 'store_transcribe_summarize' | 'store_consolidate';

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
  if (mime.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'yml', 'yaml'].includes(ext)) return 'txt';
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
  return out.length ? out : [raw.slice(0, maxChars)];
};

const summarize = async (text: string, mode: 'short' | 'long' | 'consolidation') => {
  const content = String(text || '').trim();
  if (!content) return '';
  const instruction = mode === 'short'
    ? 'Resuma em ate 6 bullets curtos.'
    : mode === 'long'
      ? 'Resuma em formato analitico, com secoes.'
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
    return content.slice(0, mode === 'short' ? 700 : 2400);
  }
};

const CIDView: React.FC<CIDViewProps> = ({ workspaceId, ownerUserId, userProfile, ventures = [], onBack }) => {
  const scopedWorkspaceId = workspaceId?.trim() ? workspaceId : DEFAULT_WORKSPACE_ID;

  return <div className="flex-1" />;
};

export default CIDView;
