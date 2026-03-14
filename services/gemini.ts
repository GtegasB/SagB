import {
  GLOBAL_LAYER,
  CONTEXT_LAYER,
  PIETRO_CORE,
  CASSIO_CORE,
  KLAUS_CORE
} from "../data/prompts";
import { callAiProxy } from "./aiProxy";

type ChatPart = {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
};

type ChatHistoryItem = {
  role: 'user' | 'model';
  parts: ChatPart[];
};

type StreamChunk = { text: string };

type SessionSendPayload = {
  message: string | Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
};

const normalizeMessageParts = (message: SessionSendPayload['message']): ChatPart[] => {
  if (typeof message === 'string') {
    return [{ text: message }];
  }

  return message
    .map((part) => {
      if (part?.inlineData?.mimeType && part?.inlineData?.data) {
        return { inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data } };
      }
      if (typeof part?.text === 'string') {
        return { text: part.text };
      }
      return null;
    })
    .filter((part): part is ChatPart => Boolean(part));
};

const normalizeHistory = (history?: any[]): ChatHistoryItem[] => {
  if (!Array.isArray(history)) return [];

  return history
    .map((item) => {
      const role = item?.role === 'model' ? 'model' : item?.role === 'user' ? 'user' : null;
      if (!role || !Array.isArray(item?.parts)) return null;
      const parts = item.parts
        .map((part: any) => {
          if (typeof part?.text === 'string') return { text: part.text };
          if (part?.inlineData?.mimeType && part?.inlineData?.data) {
            return { inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data } };
          }
          return null;
        })
        .filter((part: ChatPart | null): part is ChatPart => Boolean(part));

      if (parts.length === 0) return null;
      return { role, parts } as ChatHistoryItem;
    })
    .filter((item: ChatHistoryItem | null): item is ChatHistoryItem => Boolean(item));
};

const singleChunkStream = async function* (text: string): AsyncGenerator<StreamChunk> {
  yield { text: text || '' };
};

class BackendChatSession {
  private history: ChatHistoryItem[];
  private modelId: string;
  private systemInstruction: string;
  private temperature: number;

  constructor(options: {
    modelId: string;
    systemInstruction: string;
    temperature: number;
    history?: ChatHistoryItem[];
  }) {
    this.history = [...(options.history || [])];
    this.modelId = options.modelId;
    this.systemInstruction = options.systemInstruction;
    this.temperature = options.temperature;
  }

  async sendMessageStream({ message }: SessionSendPayload) {
    const response = await callAiProxy<{ text: string }>('gemini_chat', {
      modelId: this.modelId,
      systemInstruction: this.systemInstruction,
      temperature: this.temperature,
      history: this.history,
      message
    });

    const userTurn: ChatHistoryItem = {
      role: 'user',
      parts: normalizeMessageParts(message)
    };

    this.history.push(userTurn);
    this.history.push({
      role: 'model',
      parts: [{ text: response.text || '' }]
    });

    return singleChunkStream(response.text || '');
  }
}

type RuntimeAiContext = {
  constitution?: string;
  context?: string;
  compliance?: string;
  agentIdentityByKey?: Record<string, string>;
};

let runtimeAiContext: RuntimeAiContext = {};

export const setRuntimeAiContext = (next: RuntimeAiContext) => {
  runtimeAiContext = {
    ...runtimeAiContext,
    ...next,
    agentIdentityByKey: {
      ...(runtimeAiContext.agentIdentityByKey || {}),
      ...(next.agentIdentityByKey || {})
    }
  };
};

const buildInstruction = (coreIdentity: string, agentKey?: string): string => {
  const constitution = runtimeAiContext.constitution || GLOBAL_LAYER;
  const context = runtimeAiContext.context || CONTEXT_LAYER;
  const compliance = runtimeAiContext.compliance
    ? `[DIRETRIZES E COMPLIANCE GLOBAL - OBRIGATORIO]:\n${runtimeAiContext.compliance}`
    : "";

  let identity = coreIdentity;
  if (agentKey) {
    const mappedIdentity = runtimeAiContext.agentIdentityByKey?.[agentKey];
    if (mappedIdentity) identity = mappedIdentity;
  }

  return `
${identity}

${constitution}

${compliance}

${context}
`.trim();
};

export const createPietroInstruction = (): string => buildInstruction(PIETRO_CORE, 'ca006gpb');
export const createCassioInstruction = (): string => buildInstruction(CASSIO_CORE, 'ca045tgs');
export const createKlausInstruction = (): string => buildInstruction(KLAUS_CORE, 'ca044tgs');

export { GLOBAL_LAYER as GLOBAL_GOVERNANCE_RULES, DEFAULT_PIETRO_PROMPT, DEFAULT_CASSIO_PROMPT, KLAUS_PROMPT, NEWTON_PROMPT } from "../data/prompts";

let mainChatSession: BackendChatSession | null = null;

export const startMainSession = (context: string = "", customInstruction: string | null = null) => {
  const instruction = `
${customInstruction || createPietroInstruction()}
[SITUACAO DA SALA]:
${context || 'Sala de Comando Central.'}
`.trim();

  mainChatSession = new BackendChatSession({
    modelId: 'gemini-2.5-flash',
    systemInstruction: instruction,
    temperature: 0.2
  });

  return mainChatSession;
};

export const startPietroSession = (participantsContext: string = "") => {
  return startMainSession(participantsContext, createPietroInstruction());
};

export const startKlausSession = () => {
  return new BackendChatSession({
    modelId: 'gemini-2.5-flash',
    systemInstruction: createKlausInstruction(),
    temperature: 0.3
  });
};

export const sendMessageStream = async (message: string, participantsContext: string = "") => {
  if (!mainChatSession) startPietroSession(participantsContext);
  if (!mainChatSession) throw new Error("Session not initialized");

  return mainChatSession.sendMessageStream({ message });
};

export const startAgentSession = (
  agentId: string,
  systemInstruction: string,
  knowledgeBase: string[] = [],
  modelId: string = 'gemini-2.5-flash',
  history?: any[],
  userContext?: { name: string, nickname: string, role: string },
  ragContext?: string,
  longTermMemory?: string,
  docsInventory?: string
) => {
  const constitution = runtimeAiContext.constitution || GLOBAL_LAYER;
  const compliance = runtimeAiContext.compliance
    ? `\n[PROTOCOLOS DE COMPLIANCE E SEGURANCA (BLOQUEIO)]:\n${runtimeAiContext.compliance}\n`
    : "";

  const kbContext = knowledgeBase.length > 0
    ? `\n[MEMORIA DE SESSAO / ARQUIVOS ANEXADOS]:\n${knowledgeBase.map((k, i) => `--- DOC ${i + 1} ---\n${k}`).join('\n')}\n`
    : "";

  const userInjection = userContext
    ? `\n[INTERLOCUTOR ATUAL]:\nNome: ${userContext.name}\nComo chamar: ${userContext.nickname}\nCargo: ${userContext.role}\nOBS: Trate-o sempre pelo apelido ou sobrenome de forma natural.`
    : "";

  const inventoryInjection = docsInventory
    ? `\n[MEUS DOCUMENTOS E ACESSOS VINCULADOS]:\nVoce tem permissao de leitura nos seguintes documentos do Cofre:\n${docsInventory}\n(O conteudo sera fornecido sob demanda se relevante).`
    : "";

  const finalInstruction = `
${systemInstruction}

${constitution}

${compliance}

${userInjection}

${inventoryInjection}

${longTermMemory || ""}

${ragContext || ""}

${kbContext}

[PROTOCOLO DE ORQUESTRACAO / SUMMON]:
Se o usuario pedir explicitamente para "chamar", "convocar" ou "colocar" outra pessoa/agente na conversa:
1. Responda confirmando a acao naturalmente (Ex: "Certo, chamando o Pietro agora.").
2. IMEDIATAMENTE APOS a confirmacao, adicione a tag oculta: <<<CALL: Nome do Agente>>>
Exemplo: "Entendido, Rodrigues. O Klaus entrara na sala. <<<CALL: Klaus Wagner>>>"
Nao simule o dialogo do novo agente ainda. Apenas emita o comando.

[ID DO AGENTE]: ${agentId}
`.trim();

  return new BackendChatSession({
    modelId,
    systemInstruction: finalInstruction,
    temperature: 0.4,
    history: normalizeHistory(history)
  });
};

export const consolidateChatMemory = async (chatHistory: string): Promise<string> => {
  try {
    const response = await callAiProxy<{ text: string }>('consolidate_chat_memory', { chatHistory });
    return response.text || "";
  } catch (e) {
    console.error("Erro ao consolidar memoria", e);
    return "";
  }
};

export const generateTitleOptions = async (messagesText: string): Promise<string[]> => {
  try {
    const response = await callAiProxy<{ titles: string[] }>('generate_title_options', { messagesText });
    const titles = Array.isArray(response.titles) ? response.titles : [];
    return titles.slice(0, 3);
  } catch (e) {
    console.error("Erro no Auto-Title", e);
    return ["Sistema | Nova Pauta", "Geral | Conversa", "Pendente | Topico"];
  }
};

export const generateTaskSuggestions = async (contextText: string): Promise<string[]> => {
  try {
    const response = await callAiProxy<{ tasks: string[] }>('generate_task_suggestions', { contextText });
    const tasks = Array.isArray(response.tasks) ? response.tasks : [];
    return tasks.slice(0, 3);
  } catch (e) {
    console.error("Erro no Auto-Task", e);
    return [];
  }
};

const LOCAL_TRANSCRIBE_PROVIDER = String(import.meta.env.VITE_TRANSCRIBE_PROVIDER || '').trim().toLowerCase();
const RESOLVED_TRANSCRIBE_PROVIDER = LOCAL_TRANSCRIBE_PROVIDER || (import.meta.env.DEV ? 'local_whisper' : 'proxy');
const PROXY_TRANSCRIBE_FALLBACK_ENABLED = ['1', 'true', 'yes', 'on'].includes(String(import.meta.env.VITE_TRANSCRIBE_PROXY_FALLBACK || '').trim().toLowerCase());
const LOCAL_WHISPER_URL = String(import.meta.env.VITE_LOCAL_WHISPER_URL || '').trim();
const LOCAL_WHISPER_MODEL = String(import.meta.env.VITE_LOCAL_WHISPER_MODEL || 'whisper-1').trim();
const LOCAL_WHISPER_LANGUAGE = String(import.meta.env.VITE_LOCAL_WHISPER_LANGUAGE || 'pt').trim();
const LOCAL_WHISPER_API_KEY = String(import.meta.env.VITE_LOCAL_WHISPER_API_KEY || '').trim();
const LOCAL_WHISPER_TIMEOUT_MS = Math.max(30_000, Number(import.meta.env.VITE_LOCAL_WHISPER_TIMEOUT_MS || 180_000));
let warnedMissingLocalWhisperUrl = false;

const resolveLocalWhisperEndpoint = (rawUrl: string): string => {
  const cleaned = rawUrl.replace(/\/+$/, '');
  if (!cleaned) return '';
  if (cleaned.endsWith('/v1/audio/transcriptions')) return cleaned;
  return `${cleaned}/v1/audio/transcriptions`;
};

const decodeBase64ToBlob = (base64Audio: string, mimeType: string): Blob => {
  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'audio/webm' });
};

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao converter audio normalizado.'));
    reader.readAsDataURL(blob);
  });
  return dataUrl.split(',')[1] || '';
};

const blobToDataUrl = async (blob: Blob): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao converter arquivo para data URL.'));
    reader.readAsDataURL(blob);
  });
};

const getAudioContextCtor = (): typeof AudioContext | null => {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || ((window as any).webkitAudioContext as typeof AudioContext | undefined) || null;
};

const extractBaseName = (fileName?: string) => {
  const rawName = String(fileName || 'recording').trim();
  const safeName = rawName.split(/[\\/]/).pop() || 'recording';
  return safeName.replace(/\.[^/.]+$/, '') || 'recording';
};

const mixToMono = (audioBuffer: AudioBuffer): Float32Array => {
  if (audioBuffer.numberOfChannels <= 1) return audioBuffer.getChannelData(0).slice();

  const mono = new Float32Array(audioBuffer.length);
  for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
    const channel = audioBuffer.getChannelData(channelIndex);
    for (let sampleIndex = 0; sampleIndex < audioBuffer.length; sampleIndex += 1) {
      mono[sampleIndex] += channel[sampleIndex] / audioBuffer.numberOfChannels;
    }
  }
  return mono;
};

const trimMonoSilence = (input: Float32Array, sampleRate: number, threshold = 0.006, padMs = 180) => {
  if (!input.length) return input;

  let start = 0;
  let end = input.length - 1;

  while (start < input.length && Math.abs(input[start]) < threshold) start += 1;
  while (end > start && Math.abs(input[end]) < threshold) end -= 1;

  if (start >= end) return input;

  const padSamples = Math.max(1, Math.round((sampleRate * padMs) / 1000));
  const trimmedStart = Math.max(0, start - padSamples);
  const trimmedEnd = Math.min(input.length, end + padSamples + 1);
  const trimmed = input.slice(trimmedStart, trimmedEnd);

  // Evita cortar demais quando a fala é muito curta ou baixa.
  if (trimmed.length < Math.round(sampleRate * 0.35)) return input;
  return trimmed;
};

const resampleMonoChannel = (input: Float32Array, sourceRate: number, targetRate: number) => {
  if (!input.length || sourceRate === targetRate) return input;
  const targetLength = Math.max(1, Math.round((input.length * targetRate) / sourceRate));
  const output = new Float32Array(targetLength);

  for (let index = 0; index < targetLength; index += 1) {
    const position = (index * (input.length - 1)) / Math.max(targetLength - 1, 1);
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const weight = position - left;
    output[index] = input[left] * (1 - weight) + input[right] * weight;
  }

  return output;
};

const encodeMonoWav = (samples: Float32Array, sampleRate: number) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

const normalizeAudioForLocalWhisper = async (base64Audio: string, mimeType: string, fileName?: string) => {
  if (String(mimeType || '').toLowerCase().includes('wav')) {
    return { base64Audio, mimeType: 'audio/wav', fileName: `${extractBaseName(fileName)}.wav`, durationSeconds: 0 };
  }

  const AudioContextCtor = getAudioContextCtor();
  if (!AudioContextCtor) {
    return { base64Audio, mimeType, fileName, durationSeconds: 0 };
  }

  const sourceBlob = decodeBase64ToBlob(base64Audio, mimeType);
  const sourceBuffer = await sourceBlob.arrayBuffer();
  const audioContext = new AudioContextCtor();

  try {
    const decoded = await audioContext.decodeAudioData(sourceBuffer.slice(0));
    const mono = mixToMono(decoded);
    const trimmed = trimMonoSilence(mono, decoded.sampleRate);
    const resampled = resampleMonoChannel(trimmed, decoded.sampleRate, 16000);
    const wavBlob = encodeMonoWav(resampled, 16000);
    return {
      base64Audio: await blobToBase64(wavBlob),
      mimeType: 'audio/wav',
      fileName: `${extractBaseName(fileName)}.wav`,
      durationSeconds: resampled.length / 16000
    };
  } catch (error) {
    console.warn('Falha ao normalizar audio para WAV antes do Whisper local.', error);
    return { base64Audio, mimeType, fileName, durationSeconds: 0 };
  } finally {
    await audioContext.close().catch(() => undefined);
  }
};

const inferAudioExtension = (mimeType: string, fileName?: string): string => {
  const rawName = String(fileName || '').trim();
  const safeName = rawName.split(/[?#]/, 1)[0];
  const namedExtension = safeName.includes('.') ? safeName.split('.').pop() : '';
  if (namedExtension && /^[a-z0-9]{2,5}$/i.test(namedExtension)) return namedExtension.toLowerCase();

  const normalized = String(mimeType || '').trim().toLowerCase();
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('mp4')) return 'm4a';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('ogg')) return 'ogg';
  if (normalized.includes('aac')) return 'aac';
  if (normalized.includes('flac')) return 'flac';
  return 'webm';
};

const transcribeAudioViaLocalWhisper = async (base64Audio: string, mimeType: string, fileName?: string): Promise<string> => {
  const endpoint = resolveLocalWhisperEndpoint(LOCAL_WHISPER_URL);
  if (!endpoint) return '';

  const normalizedAudio = await normalizeAudioForLocalWhisper(base64Audio, mimeType, fileName);
  const formData = new FormData();
  const audioBlob = decodeBase64ToBlob(normalizedAudio.base64Audio, normalizedAudio.mimeType);
  const extension = inferAudioExtension(normalizedAudio.mimeType, normalizedAudio.fileName);
  formData.append('file', audioBlob, `recording.${extension}`);
  formData.append('model', LOCAL_WHISPER_MODEL || 'whisper-1');
  if (LOCAL_WHISPER_LANGUAGE) formData.append('language', LOCAL_WHISPER_LANGUAGE);

  const headers: Record<string, string> = {};
  if (LOCAL_WHISPER_API_KEY) headers.Authorization = `Bearer ${LOCAL_WHISPER_API_KEY}`;

  const requestTimeoutMs = Math.max(
    LOCAL_WHISPER_TIMEOUT_MS,
    Math.round((Number(normalizedAudio.durationSeconds || 0) * 1500) + 90_000)
  );
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutHandle = controller
    ? window.setTimeout(() => controller.abort(new DOMException('Local Whisper timeout', 'AbortError')), requestTimeoutMs)
    : null;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller?.signal
    });

    if (!response.ok) {
      const rawError = await response.text().catch(() => '');
      throw new Error(`Local Whisper transcription failed (${response.status}): ${rawError}`);
    }

    const json = await response.json().catch(() => ({}));
    const text = String(json?.text || json?.transcript || '').trim();
    return text;
  } catch (error: any) {
    if (error instanceof TypeError) {
      throw new Error(`Nao foi possivel conectar ao Whisper local em ${LOCAL_WHISPER_URL}.`);
    }
    if (error?.name === 'AbortError') {
      throw new Error(`Local Whisper transcription timed out after ${Math.round(requestTimeoutMs / 1000)}s.`);
    }
    throw error;
  } finally {
    if (timeoutHandle !== null) window.clearTimeout(timeoutHandle);
  }
};

const transcribeBlobViaLocalWhisper = async (blob: Blob, mimeType: string, fileName?: string): Promise<string> => {
  const endpoint = resolveLocalWhisperEndpoint(LOCAL_WHISPER_URL);
  if (!endpoint) return '';

  const extension = inferAudioExtension(mimeType, fileName);
  const targetBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType || blob.type || 'application/octet-stream' });
  const formData = new FormData();
  formData.append('file', targetBlob, fileName || `media.${extension}`);
  formData.append('model', LOCAL_WHISPER_MODEL || 'whisper-1');
  if (LOCAL_WHISPER_LANGUAGE) formData.append('language', LOCAL_WHISPER_LANGUAGE);

  const headers: Record<string, string> = {};
  if (LOCAL_WHISPER_API_KEY) headers.Authorization = `Bearer ${LOCAL_WHISPER_API_KEY}`;

  const requestTimeoutMs = Math.max(
    LOCAL_WHISPER_TIMEOUT_MS,
    Math.round((Number(targetBlob.size || 0) / 1024 / 1024) * 45_000) + 120_000
  );
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutHandle = controller
    ? window.setTimeout(() => controller.abort(new DOMException('Local Whisper timeout', 'AbortError')), requestTimeoutMs)
    : null;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller?.signal
    });

    if (!response.ok) {
      const rawError = await response.text().catch(() => '');
      throw new Error(`Local Whisper transcription failed (${response.status}): ${rawError}`);
    }

    const json = await response.json().catch(() => ({}));
    return String(json?.text || json?.transcript || '').trim();
  } catch (error: any) {
    if (error instanceof TypeError) {
      throw new Error(`Nao foi possivel conectar ao Whisper local em ${LOCAL_WHISPER_URL}.`);
    }
    if (error?.name === 'AbortError') {
      throw new Error(`Local Whisper transcription timed out after ${Math.round(requestTimeoutMs / 1000)}s.`);
    }
    throw error;
  } finally {
    if (timeoutHandle !== null) window.clearTimeout(timeoutHandle);
  }
};

const transcribeAudioViaProxy = async (base64Audio: string, mimeType: string): Promise<string> => {
  const response = await callAiProxy<{ text: string }>('transcribe_audio', { base64Audio, mimeType });
  return String(response?.text || '').trim();
};

export const transcribeAudio = async (base64Audio: string, mimeType: string = 'audio/webm', fileName?: string): Promise<string> => {
  const wantsLocalWhisper = RESOLVED_TRANSCRIBE_PROVIDER === 'local_whisper' || Boolean(LOCAL_WHISPER_URL);
  let localWhisperError: Error | null = null;

  if (wantsLocalWhisper) {
    if (!LOCAL_WHISPER_URL) {
      if (!warnedMissingLocalWhisperUrl) {
        console.warn('Transcrição local ativa, mas VITE_LOCAL_WHISPER_URL não está configurada.');
        warnedMissingLocalWhisperUrl = true;
      }
      localWhisperError = new Error('Transcrição local ativa, mas VITE_LOCAL_WHISPER_URL não está configurada.');
    } else {
      try {
        const localText = await transcribeAudioViaLocalWhisper(base64Audio, mimeType, fileName);
        if (localText) return localText;
        localWhisperError = new Error('Local Whisper retornou transcrição vazia.');
      } catch (error: any) {
        console.warn("Local Whisper audio transcription failed", error);
        localWhisperError = error instanceof Error ? error : new Error(String(error?.message || error || 'Falha no Local Whisper.'));
      }
    }
  }

  try {
    const shouldUseProxy = RESOLVED_TRANSCRIBE_PROVIDER === 'proxy' || (Boolean(localWhisperError) && PROXY_TRANSCRIBE_FALLBACK_ENABLED);
    if (shouldUseProxy) {
      const proxyText = await transcribeAudioViaProxy(base64Audio, mimeType);
      if (proxyText) return proxyText;
      if (localWhisperError) {
        throw new Error(`${localWhisperError.message} Fallback via proxy retornou transcrição vazia.`);
      }
      return "";
    }
  } catch (error: any) {
    console.warn("Proxy audio transcription failed", error);
    if (localWhisperError) {
      const proxyMessage = String(error?.message || 'Falha no fallback via proxy.');
      throw new Error(`${localWhisperError.message} Fallback via proxy falhou: ${proxyMessage}`);
    }
    return "";
  }

  if (localWhisperError && RESOLVED_TRANSCRIBE_PROVIDER === 'local_whisper') throw localWhisperError;
  if (RESOLVED_TRANSCRIBE_PROVIDER !== 'proxy') return "";
  return "";
};

export const transcribeMediaBlob = async (blob: Blob, mimeType: string = 'audio/webm', fileName?: string): Promise<string> => {
  const normalizedMimeType = String(mimeType || blob.type || 'audio/webm').trim();
  const wantsLocalWhisper = RESOLVED_TRANSCRIBE_PROVIDER === 'local_whisper' || Boolean(LOCAL_WHISPER_URL);
  let localWhisperError: Error | null = null;

  if (wantsLocalWhisper) {
    if (!LOCAL_WHISPER_URL) {
      localWhisperError = new Error('Transcrição local ativa, mas VITE_LOCAL_WHISPER_URL não está configurada.');
    } else {
      try {
        const localText = await transcribeBlobViaLocalWhisper(blob, normalizedMimeType, fileName);
        if (localText) return localText;
        localWhisperError = new Error('Local Whisper retornou transcrição vazia.');
      } catch (error: any) {
        console.warn('Local Whisper blob transcription failed', error);
        localWhisperError = error instanceof Error ? error : new Error(String(error?.message || error || 'Falha no Local Whisper.'));
      }
    }
  }

  const shouldUseProxy = RESOLVED_TRANSCRIBE_PROVIDER === 'proxy' || (Boolean(localWhisperError) && PROXY_TRANSCRIBE_FALLBACK_ENABLED);
  if (!shouldUseProxy) {
    if (localWhisperError && RESOLVED_TRANSCRIBE_PROVIDER === 'local_whisper') throw localWhisperError;
    return '';
  }

  try {
    const dataUrl = await blobToDataUrl(blob);
    const base64Audio = dataUrl.split(',')[1] || '';
    const proxyText = await transcribeAudioViaProxy(base64Audio, normalizedMimeType);
    if (proxyText) return proxyText;
    if (localWhisperError) {
      throw new Error(`${localWhisperError.message} Fallback via proxy retornou transcrição vazia.`);
    }
    return '';
  } catch (error: any) {
    console.warn('Proxy blob transcription failed', error);
    if (localWhisperError) {
      throw new Error(`${localWhisperError.message} Fallback via proxy falhou: ${String(error?.message || error || 'erro desconhecido')}`);
    }
    throw error instanceof Error ? error : new Error(String(error?.message || error || 'Falha ao transcrever arquivo.'));
  }
};

export const createAgentFromScratch = async (prompt: string) => {
  const response = await callAiProxy<{ agent: Record<string, any> }>('create_agent_from_scratch', { prompt });
  return response.agent || {};
};
