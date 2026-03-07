import { callAiProxy } from './aiProxy';

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const MAX_MESSAGES = 24;
const MAX_TOTAL_CHARS = 24000;
const MAX_SYSTEM_CHARS = 16000;
const PRIMARY_MAX_TOKENS = 1800;
const FALLBACK_MAX_TOKENS = 900;

const compactHistory = (messages: DeepSeekMessage[]): DeepSeekMessage[] => {
  const cleaned = (messages || [])
    .filter((m) => m && typeof m.content === 'string')
    .map((m) => ({ ...m, content: m.content.trim() }))
    .filter((m) => m.content.length > 0);

  const sliced = cleaned.slice(-MAX_MESSAGES);
  let total = 0;
  const compacted: DeepSeekMessage[] = [];

  for (let i = sliced.length - 1; i >= 0; i -= 1) {
    const msg = sliced[i];
    const remaining = MAX_TOTAL_CHARS - total;
    if (remaining <= 0) break;

    const content = msg.content.length > remaining
      ? msg.content.slice(msg.content.length - remaining)
      : msg.content;

    compacted.unshift({ role: msg.role, content });
    total += content.length;
  }

  return compacted;
};

const toUserFacingError = (rawMessage: string): string => {
  const lower = (rawMessage || '').toLowerCase();
  if (lower.includes('401') || lower.includes('403') || lower.includes('api key')) {
    return '[ERRO DE AUTENTICAÇÃO DEEPSEEK. VERIFIQUE A CHAVE NO NETLIFY.]';
  }
  if (lower.includes('429')) {
    return '[DEEPSEEK COM LIMITE TEMPORÁRIO DE REQUISIÇÕES (RATE LIMIT). TENTE NOVAMENTE EM ALGUNS SEGUNDOS.]';
  }
  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('504')) {
    return '[DEEPSEEK DEMOROU PARA RESPONDER (TIMEOUT). TENTE NOVAMENTE.]';
  }
  if (lower.includes('context') || lower.includes('max') || lower.includes('token') || lower.includes('400')) {
    return '[REQUISIÇÃO MUITO GRANDE PARA O DEEPSEEK. REDUZA O TAMANHO DA MENSAGEM/HISTÓRICO.]';
  }
  if (lower.includes('500') || lower.includes('502') || lower.includes('503')) {
    return '[INSTABILIDADE TEMPORÁRIA NA API DO DEEPSEEK. TENTE NOVAMENTE.]';
  }
  return '[ERRO DE CONEXÃO COM DEEPSEEK. VERIFIQUE LOGS DO NETLIFY PARA DETALHE.]';
};

const isTimeoutLikeError = (rawMessage: string): boolean => {
  const lower = (rawMessage || '').toLowerCase();
  return lower.includes('timed out') || lower.includes('timeout') || lower.includes('504');
};

const compactSystemInstruction = (systemInstruction: string): string => {
  const normalized = String(systemInstruction || '').trim();
  if (normalized.length <= MAX_SYSTEM_CHARS) return normalized;
  return normalized.slice(0, MAX_SYSTEM_CHARS);
};

const getLatestUserMessage = (messages: DeepSeekMessage[]): string => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === 'user' && typeof message.content === 'string' && message.content.trim()) {
      return message.content.trim();
    }
  }
  return '';
};

const buildGroundedInstruction = (baseInstruction: string, latestUserMessage: string): string => {
  const userContext = latestUserMessage
    ? `\n[PEDIDO MAIS RECENTE DO USUARIO - PRIORIDADE MAXIMA]:\n${latestUserMessage}\n`
    : '';

  return `
${baseInstruction}

[REGRAS DE ATERRAMENTO DE CONTEXTO]:
1. Priorize o pedido MAIS RECENTE do usuario.
2. Nao reutilize projeto/caso antigo se o usuario mudou o contexto.
3. Se houver conflito entre historico antigo e pedido atual, siga o pedido atual.
4. Se faltar dado critico, pergunte antes de concluir.
${userContext}
`.trim();
};

const truncateMessageContent = (messages: DeepSeekMessage[], maxCharsPerMessage: number): DeepSeekMessage[] => (
  messages.map((message) => {
    const content = String(message.content || '');
    if (content.length <= maxCharsPerMessage) return message;
    return { ...message, content: content.slice(content.length - maxCharsPerMessage) };
  })
);

const requestDeepSeek = async (
  messages: DeepSeekMessage[],
  systemInstruction: string,
  maxTokens: number
) => callAiProxy<{ text: string }>('deepseek_chat', {
  messages,
  systemInstruction,
  maxTokens
});

export async function* streamDeepSeekResponse(
  messages: DeepSeekMessage[],
  systemInstruction: string
) {
  const latestUserMessage = getLatestUserMessage(messages);
  const groundedSystemInstruction = buildGroundedInstruction(systemInstruction, latestUserMessage);
  const compactedSystemInstruction = compactSystemInstruction(groundedSystemInstruction);
  try {
    const compactedMessages = compactHistory(messages);
    const response = await requestDeepSeek(compactedMessages, compactedSystemInstruction, PRIMARY_MAX_TOKENS);

    yield { text: response.text || '' };
  } catch (error) {
    const firstMessage = String((error as any)?.message || '');

    if (isTimeoutLikeError(firstMessage)) {
      try {
        const reducedMessages = truncateMessageContent(compactHistory(messages).slice(-10), 1200);
        const retryResponse = await requestDeepSeek(reducedMessages, compactedSystemInstruction, FALLBACK_MAX_TOKENS);
        yield { text: retryResponse.text || '' };
        return;
      } catch (retryError) {
        const retryMessage = String((retryError as any)?.message || '');
        console.error('DeepSeek proxy request failed after retry', retryMessage || retryError);
        yield { text: `\n\n${toUserFacingError(retryMessage || firstMessage)}` };
        return;
      }
    }

    console.error('DeepSeek proxy request failed', firstMessage || error);
    yield { text: `\n\n${toUserFacingError(firstMessage)}` };
  }
}
