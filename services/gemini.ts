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
const LOCAL_WHISPER_URL = String(import.meta.env.VITE_LOCAL_WHISPER_URL || '').trim();
const LOCAL_WHISPER_MODEL = String(import.meta.env.VITE_LOCAL_WHISPER_MODEL || 'whisper-1').trim();
const LOCAL_WHISPER_LANGUAGE = String(import.meta.env.VITE_LOCAL_WHISPER_LANGUAGE || 'pt').trim();
const LOCAL_WHISPER_API_KEY = String(import.meta.env.VITE_LOCAL_WHISPER_API_KEY || '').trim();
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

const transcribeAudioViaLocalWhisper = async (base64Audio: string, mimeType: string): Promise<string> => {
  const endpoint = resolveLocalWhisperEndpoint(LOCAL_WHISPER_URL);
  if (!endpoint) return '';

  const formData = new FormData();
  const audioBlob = decodeBase64ToBlob(base64Audio, mimeType);
  const extension = (mimeType || 'audio/webm').includes('wav') ? 'wav' : 'webm';
  formData.append('file', audioBlob, `recording.${extension}`);
  formData.append('model', LOCAL_WHISPER_MODEL || 'whisper-1');
  if (LOCAL_WHISPER_LANGUAGE) formData.append('language', LOCAL_WHISPER_LANGUAGE);

  const headers: Record<string, string> = {};
  if (LOCAL_WHISPER_API_KEY) headers.Authorization = `Bearer ${LOCAL_WHISPER_API_KEY}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: formData
  });

  if (!response.ok) {
    const rawError = await response.text().catch(() => '');
    throw new Error(`Local Whisper transcription failed (${response.status}): ${rawError}`);
  }

  const json = await response.json().catch(() => ({}));
  const text = String(json?.text || json?.transcript || '').trim();
  return text;
};

export const transcribeAudio = async (base64Audio: string, mimeType: string = 'audio/webm'): Promise<string> => {
  const wantsLocalWhisper = RESOLVED_TRANSCRIBE_PROVIDER === 'local_whisper' || Boolean(LOCAL_WHISPER_URL);

  if (wantsLocalWhisper) {
    if (!LOCAL_WHISPER_URL) {
      if (!warnedMissingLocalWhisperUrl) {
        console.warn('Transcrição local ativa, mas VITE_LOCAL_WHISPER_URL não está configurada.');
        warnedMissingLocalWhisperUrl = true;
      }
      return "";
    }
    try {
      return await transcribeAudioViaLocalWhisper(base64Audio, mimeType);
    } catch (error) {
      console.warn("Local Whisper audio transcription failed", error);
      // Em modo local, evita cascata de erro de API remota quando a intenção é 100% local.
      if (RESOLVED_TRANSCRIBE_PROVIDER === 'local_whisper') return "";
    }
  }

  if (RESOLVED_TRANSCRIBE_PROVIDER !== 'proxy') return "";

  try {
    const response = await callAiProxy<{ text: string }>('transcribe_audio', { base64Audio, mimeType });
    return response.text || "";
  } catch (error) {
    console.warn("Gemini audio transcription failed", error);
    return "";
  }
};

export const createAgentFromScratch = async (prompt: string) => {
  const response = await callAiProxy<{ agent: Record<string, any> }>('create_agent_from_scratch', { prompt });
  return response.agent || {};
};
