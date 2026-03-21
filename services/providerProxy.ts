import { callAiProxy } from './aiProxy';
import { ModelProvider } from '../types';
import { getRuntimeAiContext } from './gemini';

export interface ProxyProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const ACTION_MAP: Partial<Record<ModelProvider, string>> = {
  openai: 'openai_chat',
  claude: 'claude_chat'
};

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
    const composed = composeRuntimeGovernancePayload(systemInstruction);
    const response = await callAiProxy<{ text: string }>(action, {
      messages,
      systemInstruction: composed.instruction,
      governanceContext: composed.governanceContext
    });
    yield { text: response.text || '' };
  } catch (error) {
    const rawMessage = String((error as any)?.message || '');
    console.error(`${provider} proxy request failed`, rawMessage || error);
    yield { text: `\n\n${toUserFacingError(provider, rawMessage)}` };
  }
}

