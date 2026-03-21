import { callAiProxy } from './aiProxy';
import { getRuntimeAiContext } from './gemini';

export interface LlamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const LOCAL_LLAMA_URL = String(
  import.meta.env.VITE_LOCAL_LLAMA_URL ||
  import.meta.env.VITE_OLLAMA_URL ||
  ''
).trim();
const LOCAL_LLAMA_MODEL = String(import.meta.env.VITE_LOCAL_LLAMA_MODEL || 'llama3.1:8b').trim();
const LOCAL_LLAMA_API_KEY = String(import.meta.env.VITE_LOCAL_LLAMA_API_KEY || '').trim();
const LOCAL_LLAMA_USE_PROXY = String(import.meta.env.VITE_LOCAL_LLAMA_USE_PROXY || '').trim().toLowerCase() === 'true';
const LOCAL_LLAMA_TIMEOUT_MS = Number(import.meta.env.VITE_LOCAL_LLAMA_TIMEOUT_MS || 0) || 0;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const composeRuntimeGovernancePayload = (baseInstruction: string): { instruction: string; governanceContext: { constitution?: string; context?: string; compliance?: string } } => {
  const runtime = getRuntimeAiContext();
  return {
    instruction: String(baseInstruction || '').trim(),
    governanceContext: {
    constitution: runtime.constitution,
    context: runtime.context,
    compliance: runtime.compliance
    }
  };
};

const composeRuntimeSystemInstruction = (baseInstruction: string): string => {
  const runtime = getRuntimeAiContext();
  const sections = [String(baseInstruction || '').trim()];
  if (runtime.constitution?.trim()) {
    sections.push(`[CONSTITUICAO GLOBAL]\n${runtime.constitution.trim()}`);
  }
  if (runtime.compliance?.trim()) {
    sections.push(`[COMPLIANCE GLOBAL - OBRIGATORIO]\n${runtime.compliance.trim()}`);
  }
  if (runtime.context?.trim()) {
    sections.push(`[CONTEXTO GLOBAL]\n${runtime.context.trim()}`);
  }

  return sections.filter(Boolean).join('\n\n').trim();
};

const resolveChatEndpoint = (rawUrl: string): string => {
  const cleaned = rawUrl.replace(/\/+$/, '');
  if (!cleaned) return '';
  if (cleaned.endsWith('/api/chat') || cleaned.endsWith('/v1/chat/completions')) return cleaned;
  return `${cleaned}/api/chat`;
};

const withTimeoutSignal = (timeoutMs: number): AbortController | null => {
  if (!timeoutMs || timeoutMs <= 0) return null;
  const controller = new AbortController();
  setTimeout(() => controller.abort('timeout'), timeoutMs);
  return controller;
};

const toUserFacingError = (rawMessage: string): string => {
  const lower = (rawMessage || '').toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('econnrefused')) {
    return '[LLAMA LOCAL INDISPONIVEL. INICIE O OLLAMA E CONFIRA VITE_LOCAL_LLAMA_URL.]';
  }
  if (lower.includes('401') || lower.includes('403') || lower.includes('api key')) {
    return '[ERRO DE AUTENTICACAO LLAMA LOCAL. VERIFIQUE A CHAVE/API GATEWAY LOCAL.]';
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return '[ENDPOINT LLAMA LOCAL NAO ENCONTRADO. VERIFIQUE A URL (EX: http://127.0.0.1:11434).]';
  }
  if (lower.includes('timeout') || lower.includes('aborted') || lower.includes('timed out')) {
    return '[LLAMA LOCAL DEMOROU PARA RESPONDER. TENTE NOVAMENTE OU AUMENTE O TIMEOUT.]';
  }
  return '[ERRO DE CONEXAO COM LLAMA LOCAL. VERIFIQUE LOGS E CONFIGURACAO.]';
};

const normalizeMessages = (messages: LlamaMessage[], systemInstruction: string) => {
  const cleaned = Array.isArray(messages)
    ? messages
      .filter((item) => item && typeof item.content === 'string' && item.content.trim().length > 0)
      .map((item) => ({ role: item.role, content: item.content.trim() }))
    : [];

  if (systemInstruction?.trim()) {
    return [{ role: 'system' as const, content: systemInstruction.trim() }, ...cleaned];
  }
  return cleaned;
};

const requestLlamaViaLocal = async (
  messages: LlamaMessage[],
  systemInstruction: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<{ text: string }> => {
  const endpoint = resolveChatEndpoint(LOCAL_LLAMA_URL);
  if (!endpoint) {
    throw new Error('VITE_LOCAL_LLAMA_URL não configurada.');
  }

  const model = options?.model || LOCAL_LLAMA_MODEL || 'llama3.1:8b';
  const normalizedMessages = normalizeMessages(messages, systemInstruction);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (LOCAL_LLAMA_API_KEY) headers.Authorization = `Bearer ${LOCAL_LLAMA_API_KEY}`;

  const controller = withTimeoutSignal(LOCAL_LLAMA_TIMEOUT_MS);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    signal: controller?.signal,
    body: endpoint.endsWith('/v1/chat/completions')
      ? JSON.stringify({
        model,
        messages: normalizedMessages,
        stream: false,
        temperature: typeof options?.temperature === 'number' ? options.temperature : 0.4,
        max_tokens: typeof options?.maxTokens === 'number' ? options.maxTokens : 1800
      })
      : JSON.stringify({
        model,
        messages: normalizedMessages,
        stream: false,
        options: {
          temperature: typeof options?.temperature === 'number' ? options.temperature : 0.4,
          num_predict: typeof options?.maxTokens === 'number' ? options.maxTokens : 1800
        }
      })
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`Local Llama request failed (${response.status}): ${raw}`);
  }

  const data = await response.json().catch(() => ({}));
  const text = String(
    data?.message?.content ||
    data?.response ||
    data?.choices?.[0]?.message?.content ||
    ''
  ).trim();
  return { text };
};

const requestLlamaViaProxy = async (
  messages: LlamaMessage[],
  systemInstruction: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<{ text: string }> => {
  const composed = composeRuntimeGovernancePayload(systemInstruction);
  return callAiProxy<{ text: string }>('llama_local_chat', {
    messages,
    systemInstruction: composed.instruction,
    governanceContext: composed.governanceContext,
    model: options?.model || LOCAL_LLAMA_MODEL || 'llama3.1:8b',
    temperature: typeof options?.temperature === 'number' ? options.temperature : 0.4,
    maxTokens: typeof options?.maxTokens === 'number' ? options.maxTokens : 1800
  });
};

const requestWithRetry = async (
  messages: LlamaMessage[],
  systemInstruction: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<{ text: string }> => {
  const attempts = 2;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (LOCAL_LLAMA_USE_PROXY) {
        return await requestLlamaViaProxy(messages, systemInstruction, options);
      }
      const localSystemInstruction = composeRuntimeSystemInstruction(systemInstruction);
      return await requestLlamaViaLocal(messages, localSystemInstruction, options);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(250 * attempt);
      }
    }
  }
  throw lastError;
};

export async function* streamLlamaLocalResponse(
  messages: LlamaMessage[],
  systemInstruction: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
) {
  try {
    const response = await requestWithRetry(messages, systemInstruction, options);
    yield { text: response.text || '' };
  } catch (error) {
    const rawMessage = String((error as any)?.message || '');
    console.error('Llama local request failed', rawMessage || error);
    yield { text: `\n\n${toUserFacingError(rawMessage)}` };
  }
}

