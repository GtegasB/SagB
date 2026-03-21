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

const pickOpenAIKey = () => {
  return (process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '').trim();
};

const pickAnthropicKey = () => {
  return (process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || '').trim();
};

const pickQwenKey = () => {
  return (process.env.QWEN_API_KEY || process.env.VITE_QWEN_API_KEY || '').trim();
};

const pickOpenAIBaseUrl = () => {
  return (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions').trim();
};

const pickQwenBaseUrl = () => {
  return (process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions').trim();
};

const pickLlamaLocalUrl = () => {
  return (
    process.env.LLAMA_LOCAL_URL ||
    process.env.OLLAMA_URL ||
    process.env.LLAMA_API_URL ||
    process.env.VITE_LOCAL_LLAMA_URL ||
    ''
  ).trim();
};

const pickLlamaLocalModel = () => {
  return (
    process.env.LLAMA_LOCAL_MODEL ||
    process.env.VITE_LOCAL_LLAMA_MODEL ||
    'llama3.1:8b'
  ).trim();
};

const pickLlamaLocalApiKey = () => {
  return (process.env.LLAMA_LOCAL_API_KEY || process.env.VITE_LOCAL_LLAMA_API_KEY || '').trim();
};

const hasGeminiKey = () => Boolean(pickGeminiKey());

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const timedFetch = async (url, options = {}, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

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

const requestDeepSeekCompletion = async (payload) => {
  const apiKey = pickDeepSeekKey();
  if (!apiKey) {
    throw createHttpError(500, 'Missing DeepSeek API key in function environment.');
  }

  const governanceContext = normalizeGovernanceContext(payload);
  const mergedSystemInstruction = mergeSystemInstructionWithGovernance(payload.systemInstruction || '', governanceContext);

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const fullMessages = [
    { role: 'system', content: mergedSystemInstruction },
    ...messages
  ];

  const maxAttempts = 3;
  const transientStatus = new Set([408, 409, 429, 500, 502, 503, 504]);
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
          max_tokens: typeof payload.maxTokens === 'number' ? payload.maxTokens : 1200
        })
      });

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
      const choice = data?.choices?.[0] || {};
      const completionTokens = Number(data?.usage?.completion_tokens || 0) || null;
      return {
        text: choice?.message?.content || '',
        finishReason: choice?.finish_reason || null,
        completionTokens,
        requestedMaxTokens: typeof payload.maxTokens === 'number' ? payload.maxTokens : 1200
      };
    } catch (error) {
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

const normalizeTextMessages = (payload) => {
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const cleaned = messages
    .filter((message) => message && typeof message.content === 'string')
    .map((message) => ({
      role: message.role === 'system' ? 'system' : message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || '').trim()
    }))
    .filter((message) => message.content.length > 0);

  const governanceContext = normalizeGovernanceContext(payload);
  const mergedSystemInstruction = mergeSystemInstructionWithGovernance(payload?.systemInstruction || '', governanceContext);
  if (mergedSystemInstruction) {
    return [{ role: 'system', content: mergedSystemInstruction }, ...cleaned];
  }
  return cleaned;
};

const normalizeGovernanceContext = (payload = {}) => {
  const raw = payload?.governanceContext && typeof payload.governanceContext === 'object'
    ? payload.governanceContext
    : {};

  const constitution = String(raw.constitution || '').trim();
  const compliance = String(raw.compliance || '').trim();
  const context = String(raw.context || '').trim();

  return {
    constitution: constitution || null,
    compliance: compliance || null,
    context: context || null
  };
};

const mergeSystemInstructionWithGovernance = (systemInstruction, governanceContext) => {
  const sections = [String(systemInstruction || '').trim()];
  if (governanceContext?.constitution) {
    sections.push(`[CONSTITUICAO GLOBAL]\n${governanceContext.constitution}`);
  }
  if (governanceContext?.compliance) {
    sections.push(`[COMPLIANCE GLOBAL - OBRIGATORIO]\n${governanceContext.compliance}`);
  }
  if (governanceContext?.context) {
    sections.push(`[CONTEXTO GLOBAL]\n${governanceContext.context}`);
  }
  return sections.filter(Boolean).join('\n\n').trim();
};

const requestOpenAICompletion = async (payload) => {
  const apiKey = pickOpenAIKey();
  if (!apiKey) {
    throw createHttpError(500, 'Missing OpenAI API key in function environment.');
  }

  const response = await fetch(pickOpenAIBaseUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: payload.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: normalizeTextMessages(payload),
      temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.4,
      max_tokens: typeof payload.maxTokens === 'number' ? payload.maxTokens : 1800,
      stream: false
    })
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw createHttpError(response.status, `OpenAI request failed (${response.status}): ${raw}`);
  }

  const data = await response.json().catch(() => ({}));
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  return { text };
};

const requestClaudeCompletion = async (payload) => {
  const apiKey = pickAnthropicKey();
  if (!apiKey) {
    throw createHttpError(500, 'Missing Anthropic API key in function environment.');
  }

  const allMessages = normalizeTextMessages(payload);
  const systemMessages = allMessages.filter((message) => message.role === 'system').map((message) => message.content);
  const messages = allMessages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content
    }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: payload.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
      system: systemMessages.join('\n\n'),
      messages,
      temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.4,
      max_tokens: typeof payload.maxTokens === 'number' ? payload.maxTokens : 1800
    })
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw createHttpError(response.status, `Claude request failed (${response.status}): ${raw}`);
  }

  const data = await response.json().catch(() => ({}));
  const text = Array.isArray(data?.content)
    ? data.content
      .filter((item) => item?.type === 'text' && typeof item?.text === 'string')
      .map((item) => item.text)
      .join('\n')
      .trim()
    : '';
  return { text };
};

const requestQwenCompletion = async (payload) => {
  const apiKey = pickQwenKey();
  if (!apiKey) {
    throw createHttpError(500, 'Missing Qwen API key in function environment.');
  }

  const response = await fetch(pickQwenBaseUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: payload.model || process.env.QWEN_MODEL || 'qwen-plus',
      messages: normalizeTextMessages(payload),
      temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.4,
      max_tokens: typeof payload.maxTokens === 'number' ? payload.maxTokens : 1800,
      stream: false
    })
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw createHttpError(response.status, `Qwen request failed (${response.status}): ${raw}`);
  }

  const data = await response.json().catch(() => ({}));
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  return { text };
};

const resolveLlamaEndpoint = (rawUrl) => {
  const cleaned = String(rawUrl || '').replace(/\/+$/, '');
  if (!cleaned) return '';
  if (cleaned.endsWith('/api/chat') || cleaned.endsWith('/v1/chat/completions')) return cleaned;
  return `${cleaned}/api/chat`;
};

const normalizeLlamaMessages = (payload) => {
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const normalized = messages
    .filter((message) => message && typeof message.content === 'string')
    .map((message) => ({
      role: message.role === 'system' ? 'system' : message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content.trim()
    }))
    .filter((message) => message.content.length > 0);

  const governanceContext = normalizeGovernanceContext(payload);
  const mergedSystemInstruction = mergeSystemInstructionWithGovernance(payload?.systemInstruction || '', governanceContext);
  if (mergedSystemInstruction) {
    return [{ role: 'system', content: mergedSystemInstruction }, ...normalized];
  }
  return normalized;
};

const requestLlamaLocalCompletion = async (payload) => {
  const endpoint = resolveLlamaEndpoint(pickLlamaLocalUrl());
  if (!endpoint) {
    throw createHttpError(500, 'Missing LLAMA_LOCAL_URL/OLLAMA_URL in function environment.');
  }

  const model = payload.model || pickLlamaLocalModel() || 'llama3.1:8b';
  const apiKey = pickLlamaLocalApiKey();
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const messages = normalizeLlamaMessages(payload);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: endpoint.endsWith('/v1/chat/completions')
      ? JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.4,
        max_tokens: typeof payload.maxTokens === 'number' ? payload.maxTokens : 1800
      })
      : JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.4,
          num_predict: typeof payload.maxTokens === 'number' ? payload.maxTokens : 1800
        }
      })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw createHttpError(response.status, `Llama local request failed (${response.status}): ${errText}`);
  }

  const data = await response.json().catch(() => ({}));
  const text = String(
    data?.message?.content ||
    data?.response ||
    data?.choices?.[0]?.message?.content ||
    ''
  );

  return { text };
};

const runHealthCheck = async (label, checker) => {
  const startedAt = Date.now();
  try {
    await checker();
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      message: `${label} online`
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: String(error?.message || `${label} offline`)
    };
  }
};

const checkGeminiHealth = async () => {
  const key = pickGeminiKey();
  if (!key) throw new Error('Gemini sem API key');
  const response = await timedFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, {
    method: 'GET'
  }, 9000);
  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`Gemini HTTP ${response.status}: ${raw}`);
  }
};

const checkDeepSeekHealth = async () => {
  const apiKey = pickDeepSeekKey();
  if (!apiKey) throw new Error('DeepSeek sem API key');
  const response = await timedFetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
      temperature: 0
    })
  }, 10000);
  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`DeepSeek HTTP ${response.status}: ${raw}`);
  }
};

const checkOpenAIHealth = async () => {
  const apiKey = pickOpenAIKey();
  if (!apiKey) throw new Error('OpenAI sem API key');
  const response = await timedFetch(pickOpenAIBaseUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
      temperature: 0,
      stream: false
    })
  }, 10000);
  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`OpenAI HTTP ${response.status}: ${raw}`);
  }
};

const checkClaudeHealth = async () => {
  const apiKey = pickAnthropicKey();
  if (!apiKey) throw new Error('Claude sem API key');
  const response = await timedFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
      temperature: 0
    })
  }, 10000);
  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`Claude HTTP ${response.status}: ${raw}`);
  }
};

const checkLlamaHealth = async () => {
  const endpoint = resolveLlamaEndpoint(pickLlamaLocalUrl());
  if (!endpoint) throw new Error('Llama local sem URL configurada');
  const model = pickLlamaLocalModel() || 'llama3.1:8b';
  const apiKey = pickLlamaLocalApiKey();
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await timedFetch(endpoint, {
    method: 'POST',
    headers,
    body: endpoint.endsWith('/v1/chat/completions')
      ? JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0,
        stream: false
      })
      : JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        stream: false,
        options: {
          num_predict: 1,
          temperature: 0
        }
      })
  }, 10000);

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`Llama local HTTP ${response.status}: ${raw}`);
  }
};

const handleProvidersHealth = async () => {
  const [gemini, deepseek, openai, claude, llama_local] = await Promise.all([
    runHealthCheck('Gemini', checkGeminiHealth),
    runHealthCheck('DeepSeek', checkDeepSeekHealth),
    runHealthCheck('OpenAI', checkOpenAIHealth),
    runHealthCheck('Claude', checkClaudeHealth),
    runHealthCheck('Llama', checkLlamaHealth)
  ]);

  return {
    providers: {
      gemini,
      deepseek,
      openai,
      claude,
      llama_local
    },
    checkedAt: new Date().toISOString()
  };
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
  return requestDeepSeekCompletion(payload);
};

const handleLlamaLocalChat = async (payload) => {
  return requestLlamaLocalCompletion(payload);
};

const handleOpenAIChat = async (payload) => {
  return requestOpenAICompletion(payload);
};

const handleClaudeChat = async (payload) => {
  return requestClaudeCompletion(payload);
};

const handleQwenChat = async (payload) => {
  return requestQwenCompletion(payload);
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
  const chatHistory = payload.chatHistory || '';
  const prompt = `
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
`.trim();

  if (!hasGeminiKey()) {
    const deepseekResponse = await requestDeepSeekCompletion({
      model: 'deepseek-chat',
      systemInstruction: 'Voce e um auditor de aprendizagem de agentes.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 2000
    });
    return { text: deepseekResponse.text || '' };
  }

  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { temperature: 0.1 }
  });

  return { text: response.text || '' };
};

const handleGenerateTitleOptions = async (payload) => {
  const messagesText = payload.messagesText || '';
  const prompt = `
ATENCAO: Voce e um assistente executivo.
Analise a conversa e sugira 3 opcoes de Titulos.
PADRAO: "PalavraChave | Descricao".
CONVERSA:
${messagesText}
Retorne JSON Array de strings.
`.trim();

  if (!hasGeminiKey()) {
    const deepseekResponse = await requestDeepSeekCompletion({
      model: 'deepseek-chat',
      systemInstruction: 'Responda estritamente no formato solicitado.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      maxTokens: 700
    });
    return { titles: parseJsonArray(deepseekResponse.text, []) };
  }

  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
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
  const contextText = payload.contextText || '';
  const prompt = `
ATENCAO: Sugira 3 nomes curtos para Tarefa (Pauta) baseados no contexto.
Comece com Verbo no Infinitivo.
CONTEXTO:
${contextText}
Retorne JSON Array de strings.
`.trim();

  if (!hasGeminiKey()) {
    const deepseekResponse = await requestDeepSeekCompletion({
      model: 'deepseek-chat',
      systemInstruction: 'Responda estritamente no formato solicitado.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      maxTokens: 700
    });
    return { tasks: parseJsonArray(deepseekResponse.text, []) };
  }

  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
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
  const prompt = payload.prompt || '';
  if (!hasGeminiKey()) {
    const deepseekResponse = await requestDeepSeekCompletion({
      model: 'deepseek-chat',
      systemInstruction: 'Voce e um arquiteto de agentes. Retorne apenas JSON valido.',
      messages: [{ role: 'user', content: `ARQUITETO PIETRO: Gere o DNA V1.0 para: "${prompt}".` }],
      temperature: 0.2,
      maxTokens: 3500
    });
    return { agent: parseJsonObject(deepseekResponse.text, {}) };
  }

  const ai = getGeminiClient();

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
  llama_local_chat: handleLlamaLocalChat,
  openai_chat: handleOpenAIChat,
  claude_chat: handleClaudeChat,
  qwen_chat: handleQwenChat,
  transcribe_audio: handleTranscribeAudio,
  consolidate_chat_memory: handleConsolidateChatMemory,
  generate_title_options: handleGenerateTitleOptions,
  generate_task_suggestions: handleGenerateTaskSuggestions,
  create_agent_from_scratch: handleCreateAgentFromScratch
  ,
  providers_health: handleProvidersHealth
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
