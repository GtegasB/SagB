
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { Buffer } from 'buffer';

// Constantes
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB, um limite prático para a função
const CID_CHUNK_MAX_CHARS = 12000;

// Helpers
const json = (statusCode, payload) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(payload),
});

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL or service role key is missing.');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
};

const getGeminiClient = () => {
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!key) {
    throw new Error('Missing Gemini API key.');
  }
  return new GoogleGenAI(key);
};

const safeUpdate = async (supabase, table, id, payload) => {
  const { error } = await supabase.from(table).update(payload).eq('id', id);
  if (error) {
    console.error(`Falha ao atualizar ${table}/${id}`, error);
    // Não joga o erro para não parar o fluxo principal, mas loga.
  }
};

// --- Funções Portadas e Adaptadas ---

const sanitizeUtf16Text = (value) => {
  // (Lógica de CIDView.tsx)
  const raw = String(value || '');
  if (!raw) return '';
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    const next = i + 1 < raw.length ? raw.charCodeAt(i + 1) : null;
    if (code >= 0xD800 && code <= 0xDBFF) {
      if (next !== null && next >= 0xDC00 && next <= 0xDFFF) {
        out += raw[i] + raw[i + 1];
        i += 1;
      } else {
        out += '\uFFFD';
      }
      continue;
    }
    if (code >= 0xDC00 && code <= 0xDFFF) {
      out += '\uFFFD';
      continue;
    }
    out += raw[i];
  }
  return out;
};

const sliceUtf16Safe = (value, start, end) => {
    // (Lógica de CIDView.tsx)
    // ... (implementação completa seria necessária aqui)
    return value.slice(start, end);
};

const splitChunks = (text, maxChars = CID_CHUNK_MAX_CHARS) => {
  // (Lógica de CIDView.tsx, simplificada)
  const raw = sanitizeUtf16Text(String(text || '')).trim();
  if (!raw) return [];
  const chunks = [];
  for (let i = 0; i < raw.length; i += maxChars) {
    chunks.push(raw.substring(i, i + maxChars));
  }
  return chunks;
};

const transcribeMedia = async (fileBuffer, mimeType) => {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: fileBuffer.toString('base64') } },
          { text: 'Transcreva o audio fielmente.' }
        ]
      },
      config: { temperature: 0.0 }
    });
    return sanitizeUtf16Text(response.text || '');
  } catch (error) {
    console.error('Falha na transcrição com Gemini:', error);
    return '';
  }
};

const summarize = async (text, mode) => {
    // (Lógica de CIDView.tsx)
    // ...
    return `Resumo (${mode}) para: ${text.substring(0, 100)}...`;
};

// --- Handler Principal ---

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method Not Allowed' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' });
  }

  const { assetId } = payload;
  if (!assetId) {
    return json(400, { ok: false, error: 'Missing assetId' });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const failJob = async (message) => {
    console.error(`[CID Processor] Falha: ${message}`, { assetId });
    await safeUpdate(supabaseAdmin, 'cid_assets', assetId, {
      status: 'error',
      updated_at: new Date().toISOString(),
      payload: { processingError: message },
    });
    // Também atualiza o job correspondente se houver
    await supabaseAdmin
        .from('cid_processing_jobs')
        .update({ status: 'error', error_message: message, failed_at: new Date().toISOString() })
        .eq('asset_id', assetId);
  };

  try {
    // 1. Obter Asset e Arquivo
    const { data: asset, error: assetError } = await supabaseAdmin.from('cid_assets').select('*').eq('id', assetId).single();
    if (assetError || !asset) throw new Error(`Asset ${assetId} não encontrado.`);

    const { data: assetFile, error: fileError } = await supabaseAdmin.from('cid_asset_files').select('*').eq('asset_id', assetId).single();
    if (fileError || !assetFile) throw new Error(`Arquivo para o asset ${assetId} não encontrado.`);
    
    // Validação de tamanho
    if (assetFile.size_bytes > MAX_FILE_SIZE_BYTES) {
        throw new Error(`Arquivo excede o limite de ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB para processamento no back-end.`);
    }

    await safeUpdate(supabaseAdmin, 'cid_assets', assetId, { status: 'processing', processing_started_at: new Date().toISOString() });
    const { data: job, error: jobError } = await supabaseAdmin
        .from('cid_processing_jobs')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('asset_id', assetId)
        .select()
        .single();
    if (jobError) console.warn(`Não foi possível encontrar um job para o asset ${assetId}`);
    const jobId = job?.id;

    // 2. Download do Arquivo
    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage.from(assetFile.bucket).download(assetFile.path);
    if (downloadError) throw new Error(`Falha no download do arquivo: ${downloadError.message}`);

    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());

    // 3. Extração de Texto / Transcrição
    let sourceText = '';
    const canTranscribe = asset.desired_action === 'store_transcribe' || asset.desired_action === 'store_transcribe_summarize';

    if (canTranscribe && (asset.material_type === 'audio' || asset.material_type === 'video')) {
        await safeUpdate(supabaseAdmin, 'cid_assets', assetId, { status: 'transcribing' });
        if (jobId) await safeUpdate(supabaseAdmin, 'cid_processing_jobs', jobId, { status: 'transcribing' });
        sourceText = await transcribeMedia(fileBuffer, assetFile.mime_type);
        if (sourceText) {
             await supabaseAdmin.from('cid_outputs').insert({ asset_id: assetId, job_id: jobId, workspace_id: asset.workspace_id, output_type: 'transcription', content_text: sourceText, language: asset.language });
        }
    } else if (asset.material_type === 'txt' || assetFile.mime_type.startsWith('text/')) {
        sourceText = sanitizeUtf16Text(fileBuffer.toString('utf-8'));
         await supabaseAdmin.from('cid_outputs').insert({ asset_id: assetId, job_id: jobId, workspace_id: asset.workspace_id, output_type: 'extracted_text', content_text: sourceText, language: asset.language });
    } else {
        // Lógica para outros tipos de arquivo (PDF, DOCX) não está implementada.
        // Por enquanto, consideramos como texto vazio e o job terminará com aviso.
    }
    
    // 4. Fragmentação (Chunks)
    await safeUpdate(supabaseAdmin, 'cid_assets', assetId, { status: 'fragmenting' });
    if (jobId) await safeUpdate(supabaseAdmin, 'cid_processing_jobs', jobId, { status: 'fragmenting' });

    const chunkTexts = splitChunks(sourceText);
    const totalParts = chunkTexts.length;
    
    for (let i = 0; i < totalParts; i++) {
        await supabaseAdmin.from('cid_chunks').insert({
            asset_id: assetId,
            job_id: jobId,
            workspace_id: asset.workspace_id,
            chunk_index: i + 1,
            text_content: chunkTexts[i],
            status: 'completed'
        });
    }
    await safeUpdate(supabaseAdmin, 'cid_assets', assetId, { total_parts: totalParts, completed_parts: totalParts, pending_parts: 0, progress_pct: 80 });

    // 5. Geração de Resumos
    const canSummarize = asset.desired_action === 'store_summarize' || asset.desired_action === 'store_transcribe_summarize' || asset.desired_action === 'store_consolidate';
    if (canSummarize && sourceText) {
        await safeUpdate(supabaseAdmin, 'cid_assets', assetId, { status: 'summarizing' });
        if (jobId) await safeUpdate(supabaseAdmin, 'cid_processing_jobs', jobId, { status: 'summarizing' });
        
        const shortSummary = await summarize(sourceText, 'short');
        await supabaseAdmin.from('cid_outputs').insert({ asset_id: assetId, job_id: jobId, workspace_id: asset.workspace_id, output_type: 'summary_short', content_text: shortSummary, language: asset.language });
    }

    // 6. Finalização
    const finalStatus = !sourceText ? 'completed_warning' : 'completed';
    const finalMessage = !sourceText ? 'Não foi possível extrair texto ou transcrever o conteúdo para processamento completo.' : null;

    await safeUpdate(supabaseAdmin, 'cid_assets', assetId, { status: finalStatus, progress_pct: 100, completed_at: new Date().toISOString(), payload: { ...(asset.payload || {}), processingWarning: finalMessage } });
    if (jobId) await safeUpdate(supabaseAdmin, 'cid_processing_jobs', jobId, { status: finalStatus, error_message: finalMessage, progress_pct: 100, completed_at: new Date().toISOString() });

    console.log(`[CID Processor] Sucesso para o assetId: ${assetId}`);
    return json(200, { ok: true, message: `Asset ${assetId} processed successfully.` });

  } catch (error) {
    await failJob(error.message);
    return json(500, { ok: false, error: error.message || 'Internal Server Error' });
  }
}
