type AiProxyPayload = Record<string, unknown>;

type AiProxyResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

const AI_PROXY_ENDPOINT = '/api/ai';

export const callAiProxy = async <T>(action: string, payload: AiProxyPayload): Promise<T> => {
  const res = await fetch(AI_PROXY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });

  const json = await res.json().catch(() => null) as AiProxyResponse<T> | null;

  if (!res.ok || !json?.ok) {
    const message = json?.error || `AI proxy request failed (${res.status})`;
    throw new Error(message);
  }

  if (json.data === undefined) {
    throw new Error('AI proxy returned empty payload.');
  }

  return json.data;
};
