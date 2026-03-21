import { callAiProxy } from './aiProxy';
import { ModelProvider } from '../types';

export type ProviderHealthItem = {
  ok: boolean;
  latencyMs: number;
  message: string;
};

export type ProvidersHealthMap = Record<'gemini' | 'deepseek' | 'openai' | 'claude' | 'llama_local', ProviderHealthItem>;

export type ProvidersHealthResponse = {
  providers: ProvidersHealthMap;
  checkedAt: string;
};

const resolveLlamaHealthUrl = () => {
  const raw = String(import.meta.env.VITE_LOCAL_LLAMA_URL || import.meta.env.VITE_OLLAMA_URL || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/\/+$/, '');
  if (cleaned.endsWith('/api/tags') || cleaned.endsWith('/api/version')) return cleaned;
  if (cleaned.endsWith('/api/chat') || cleaned.endsWith('/v1/chat/completions')) {
    return cleaned.replace(/\/(api\/chat|v1\/chat\/completions)$/i, '/api/tags');
  }
  return `${cleaned}/api/tags`;
};

const checkLlamaLocalFromBrowser = async (): Promise<ProviderHealthItem | null> => {
  const healthUrl = resolveLlamaHealthUrl();
  if (!healthUrl) return null;

  const startedAt = Date.now();
  try {
    const response = await fetch(healthUrl, { method: 'GET' });
    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        message: `Llama local HTTP ${response.status}: ${raw || 'sem detalhe'}`
      };
    }

    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      message: 'Llama local online (checagem direta no navegador)'
    };
  } catch (error: any) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: String(error?.message || 'Llama local offline (checagem navegador)')
    };
  }
};

export const getProvidersHealth = async (): Promise<ProvidersHealthResponse> => {
  const proxyHealth = await callAiProxy<ProvidersHealthResponse>('providers_health', {});

  // Ajuste importante: o Llama local pode estar acessível no navegador,
  // mas inacessível ao runtime do Netlify Functions (cloud).
  // Quando possível, priorizamos a checagem client-side para refletir
  // o estado real de uso no chat local.
  const browserLlamaHealth = await checkLlamaLocalFromBrowser();
  if (!browserLlamaHealth) return proxyHealth;

  return {
    ...proxyHealth,
    providers: {
      ...proxyHealth.providers,
      llama_local: browserLlamaHealth
    }
  };
};

export const providerHealthToBadge = (provider: ModelProvider, health?: Partial<Record<string, ProviderHealthItem>>) => {
  const key = String(provider || '').trim();
  if (!key) return '⚪';
  if (!health || !health[key]) return '⚪';
  return health[key]?.ok ? '🟢' : '🔴';
};
