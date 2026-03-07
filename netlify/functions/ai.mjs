import { GoogleGenAI, Type } from '@google/genai';

const json = (statusCode, payload) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(payload)
});

const pickGeminiKey = () => {
  return (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
};

const pickDeepSeekKey = () => {
  return (process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || '').trim();
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getGeminiClient = () => {
  const key = pickGeminiKey();
  if (!key) {
    throw new Error('Missing Gemini API key in function environment.');
  }
  return new GoogleGenAI({ apiKey: key });
};

const normalizeMessageParts = (message) => {
  if (typeof message === 'string') return [{ text: message }];
  if (!Array.isArray(message)) return [{ text: '' }];

  const parts = message
    .map((part) => {
      if (typeof part?.text === 'string') return { text: part.text };
      if (part?.inlineData?.mimeType && part?.inlineData?.data) {
        return { inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data } };
      }
      return null;
    })
    .filter(Boolean);

  return parts.length > 0 ? parts : [{ text: '' }];
};

const normalizeHistory = (history) => {
  if (!Array.isArray(history)) return [];
  return history
    .map((item) => {
      if (!Array.isArray(item?.parts)) return null;
      const role = item?.role === 'model' ? 'model' : item?.role === 'user' ? 'user' : null;
      if (!role) return null;
      const parts = normalizeMessageParts(item.parts);
      return { role, parts };
    })
    .filter(Boolean);
};

const parseJsonArray = (text, fallback = []) => {
  try {
    const parsed = JSON.parse(text || '[]');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const parseJsonObject = (text, fallback = {}) => {
  try {
    const parsed = JSON.parse(text || '{}');
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const AGENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    universalId: { type: Type.STRING },
    version: { type: Type.STRING },
    company: { type: Type.STRING },
    officialRole: { type: Type.STRING },
    overview: {
      type: Type.OBJECT,
      properties: {
        centralPhrase: { type: Type.STRING },
        impactROI: { type: Type.STRING },
        centralPrinciple: { type: Type.STRING }
      }
    },
    decisionRoadmap: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { fatalQuestion: { type: Type.STRING } } }
    },
    protocols: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, action: { type: Type.STRING } } }
    },
    firewall: {
      type: Type.OBJECT,
      properties: {
        prohibited: { type: Type.ARRAY, items: { type: Type.STRING } },
        escalation: { type: Type.STRING }
      }
    },
    fullPrompt: { type: Type.STRING }
  },
  required: ['name', 'version', 'officialRole', 'overview', 'decisionRoadmap', 'protocols', 'firewall', 'fullPrompt']
};

const handleGeminiChat = async (payload) => {
  const ai = getGeminiClient();
  const model = payload.modelId || 'gemini-2.5-flash';
  const temperature = typeof payload.temperature === 'number' ? payload.temperature : 0.4;
  const history = normalizeHistory(payload.history);
  const userContent = { role: 'user', parts: normalizeMessageParts(payload.message) };
  const contents = [...history, userContent];

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: payload.systemInstruction || '',
      temperature
    }
  });

  return { text: response.text || '' };
};

const handleDeepSeekChat = async (payload) => {
  const apiKey = pickDeepSeekKey();
  if (!apiKey) {
    throw createHttpError(500, 'Missing DeepSeek API key in function environment.');
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const fullMessages = [
    { role: 'system', content: payload.systemInstruction || '' },
    ...messages
  ];

  const maxAttempts = 3;
  const transientStatus = new Set([408, 409, 429, 500, 502, 503, 504]);
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('deepseek-timeout'), 45000);

    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: payload.model || 'deepseek-chat',
          messages: fullMessages,
          stream: false,
          temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.5,
          max_tokens: typeof payload.maxTokens === 'number' ? payload.maxTokens : 2000
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        const requestId = response.headers.get('x-request-id') || '';
        const suffix = requestId ? ` [request_id=${requestId}]` : '';
        const message = `DeepSeek request failed (${response.status})${suffix}: ${errText}`;

        if (transientStatus.has(response.status) && attempt < maxAttempts) {
          await wait(300 * attempt);
          continue;
        }

        throw createHttpError(response.status, message);
      }

      const data = await response.json().catch(() => ({}));
      return { text: data?.choices?.[0]?.message?.content || '' };
    } catch (error) {
      clearTimeout(timeoutId);

      const isAbort =
        error?.name === 'AbortError' ||
        String(error?.message || '').toLowerCase().includes('abort');
      if (isAbort) {
        const timeoutErr = createHttpError(504, 'DeepSeek request timed out after 45s.');
        if (attempt < maxAttempts) {
          lastError = timeoutErr;
          await wait(300 * attempt);
          continue;
        }
        throw timeoutErr;
      }

      lastError = error;
      const statusCode = Number(error?.statusCode || 0);
      if (attempt < maxAttempts && transientStatus.has(statusCode)) {
        await wait(300 * attempt);
        continue;
      }
      throw error;
    }
  }

  throw lastError || createHttpError(500, 'DeepSeek request failed unexpectedly.');
};

const handleTranscribeAudio = async (payload) => {
  const ai = getGeminiClient();
  const mimeType = payload.mimeType || 'audio/webm';
  const base64Audio = payload.base64Audio || '';

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Audio } },
        { text: 'Transcreva o audio fielmente.' }
      ]
    },
    config: { temperature: 0.0 }
  });

  return { text: response.text || '' };
};

const handleConsolidateChatMemory = async (payload) => {
  const ai = getGeminiClient();
  const chatHistory = payload.chatHistory || '';

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `
ATENCAO SISTEMA DE TREINAMENTO:
Voce e um auditor de qualidade de IA.
Analise o historico de conversa abaixo entre o Usuario (Rodrigues) e o Agente.
Extraia APENAS novos fatos, correcoes de comportamento, regras de negocio ou preferencias que o usuario ensinou ao agente.
Ignore cumprimentos ou conversa fiada.
Se nao houver nada relevante para aprender, retorne "Nenhum aprendizado novo".

HISTORICO:
${chatHistory}

SAIDA:
Lista concisa de aprendizados (bullet points).
`.trim(),
    config: { temperature: 0.1 }
  });

  return { text: response.text || '' };
};

const handleGenerateTitleOptions = async (payload) => {
  const ai = getGeminiClient();
  const messagesText = payload.messagesText || '';

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `
ATENCAO: Voce e um assistente executivo.
Analise a conversa e sugira 3 opcoes de Titulos.
PADRAO: "PalavraChave | Descricao".
CONVERSA:
${messagesText}
Retorne JSON Array de strings.
`.trim(),
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      temperature: 0.4
    }
  });

  return { titles: parseJsonArray(response.text, []) };
};

const handleGenerateTaskSuggestions = async (payload) => {
  const ai = getGeminiClient();
  const contextText = payload.contextText || '';

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `
ATENCAO: Sugira 3 nomes curtos para Tarefa (Pauta) baseados no contexto.
Comece com Verbo no Infinitivo.
CONTEXTO:
${contextText}
Retorne JSON Array de strings.
`.trim(),
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      temperature: 0.4
    }
  });

  return { tasks: parseJsonArray(response.text, []) };
};

const handleCreateAgentFromScratch = async (payload) => {
  const ai = getGeminiClient();
  const prompt = payload.prompt || '';

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `ARQUITETO PIETRO: Gere o DNA V1.0 para: "${prompt}".`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: AGENT_SCHEMA,
      temperature: 0.2
    }
  });

  return { agent: parseJsonObject(response.text, {}) };
};

const actionHandlers = {
  gemini_chat: handleGeminiChat,
  deepseek_chat: handleDeepSeekChat,
  transcribe_audio: handleTranscribeAudio,
  consolidate_chat_memory: handleConsolidateChatMemory,
  generate_title_options: handleGenerateTitleOptions,
  generate_task_suggestions: handleGenerateTaskSuggestions,
  create_agent_from_scratch: handleCreateAgentFromScratch
};

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body.' });
  }

  const action = payload?.action;
  const actionHandler = actionHandlers[action];

  if (!actionHandler) {
    return json(400, { ok: false, error: `Unknown action: ${action || 'none'}` });
  }

  try {
    const data = await actionHandler(payload);
    return json(200, { ok: true, data });
  } catch (error) {
    console.error(`[ai function] action=${action}`, error);
    const statusCode = Number(error?.statusCode || 500);
    return json(statusCode, { ok: false, error: error?.message || 'AI function error.' });
  }
}
