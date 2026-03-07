import { callAiProxy } from './aiProxy';

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const MAX_MESSAGES = 24;
const MAX_TOTAL_CHARS = 24000;

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

export async function* streamDeepSeekResponse(
  messages: DeepSeekMessage[],
  systemInstruction: string
) {
  try {
    const compactedMessages = compactHistory(messages);
    const response = await callAiProxy<{ text: string }>('deepseek_chat', {
      messages: compactedMessages,
      systemInstruction
    });

    yield { text: response.text || '' };
  } catch (error) {
    const message = String((error as any)?.message || '');
    console.error('DeepSeek proxy request failed', message || error);
    yield { text: `\n\n${toUserFacingError(message)}` };
  }
}
