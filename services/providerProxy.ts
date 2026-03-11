import { callAiProxy } from './aiProxy';
import { ModelProvider } from '../types';

export interface ProxyProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const ACTION_MAP: Record<ModelProvider, string | null> = {
  gemini: null,
  deepseek: null,
  llama_local: null,
  openai: 'openai_chat',
  claude: 'claude_chat',
  qwen: 'qwen_chat'
};

const toUserFacingError = (provider: ModelProvider, rawMessage: string): string => {
  const providerLabel = provider.toUpperCase();
  const lower = (rawMessage || '').toLowerCase();
  if (lower.includes('missing') && lower.includes('api key')) {
    return `[${providerLabel} SEM API KEY NO NETLIFY.]`;
  }
  if (lower.includes('401') || lower.includes('403')) {
    return `[FALHA DE AUTENTICACAO ${providerLabel}. CONFIRA CHAVE E PERMISSOES.]`;
  }
  if (lower.includes('429')) {
    return `[${providerLabel} COM RATE LIMIT. TENTE NOVAMENTE EM INSTANTES.]`;
  }
  if (lower.includes('timeout') || lower.includes('504')) {
    return `[${providerLabel} DEMOROU PARA RESPONDER (TIMEOUT).]`;
  }
  return `[ERRO DE CONEXAO COM ${providerLabel}. VERIFIQUE LOGS DO NETLIFY.]`;
};

export async function* streamProxyProviderResponse(
  provider: ModelProvider,
  messages: ProxyProviderMessage[],
  systemInstruction: string
) {
  const action = ACTION_MAP[provider];
  if (!action) {
    yield { text: `[PROVEDOR ${provider} NAO SUPORTADO NESTE FLUXO.]` };
    return;
  }

  try {
    const response = await callAiProxy<{ text: string }>(action, {
      messages,
      systemInstruction
    });
    yield { text: response.text || '' };
  } catch (error) {
    const rawMessage = String((error as any)?.message || '');
    console.error(`${provider} proxy request failed`, rawMessage || error);
    yield { text: `\n\n${toUserFacingError(provider, rawMessage)}` };
  }
}

