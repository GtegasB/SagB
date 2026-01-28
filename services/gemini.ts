
import { GoogleGenAI, Chat, Type, Content } from "@google/genai";
import {
  GLOBAL_LAYER,
  CONTEXT_LAYER,
  PIETRO_CORE,
  CASSIO_CORE,
  KLAUS_CORE,
  NEWTON_CORE
} from "../data/prompts";

// ==================================================================================
// 🧠 MONTADOR DE DNA (3 CAMADAS + COMPLIANCE)
// ==================================================================================

const buildInstruction = (coreIdentity: string, agentKey?: string): string => {
  const storedConstitution = typeof localStorage !== 'undefined' ? localStorage.getItem('grupob_global_constitution_v1') : null;
  const constitution = storedConstitution || GLOBAL_LAYER;

  const storedContext = typeof localStorage !== 'undefined' ? localStorage.getItem('grupob_global_context_v1') : null;
  const context = storedContext || CONTEXT_LAYER;

  // NOVO: COMPLIANCE LAYER
  const storedCompliance = typeof localStorage !== 'undefined' ? localStorage.getItem('grupob_global_compliance_v1') : null;
  const compliance = storedCompliance ? `[DIRETRIZES E COMPLIANCE GLOBAL - OBRIGATÓRIO]:\n${storedCompliance}` : "";

  let identity = coreIdentity;
  if (agentKey) {
    const storedIdentity = typeof localStorage !== 'undefined' ? localStorage.getItem(agentKey) : null;
    if (storedIdentity) identity = storedIdentity;
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

// ==================================================================================
// 🔴 ZONA DE INFRAESTRUTURA (CONEXÃO GOOGLE)
// ==================================================================================

let client: GoogleGenAI | null = null;
let mainChatSession: Chat | null = null;

const getClient = (): GoogleGenAI => {
  if (!client) {
    let apiKey = process.env.API_KEY || "";
    apiKey = apiKey.replace(/"/g, '').trim();

    if (!apiKey || apiKey.length < 10) {
      console.error("CRITICAL: Google API Key invalida ou vazia. Verifique vite.config.ts.");
    } else {
      console.log("DEBUG: Inicializando Gemini com chave prefixo:", apiKey.substring(0, 8));
    }

    try {
      client = new GoogleGenAI({ apiKey: apiKey });
    } catch (e) {
      console.error("DEBUG: Erro ao instanciar GoogleGenAI:", e);
      throw e;
    }
  }
  return client;
};

export const startMainSession = (context: string = "", customInstruction: string | null = null) => {
  const ai = getClient();

  const instruction = `
${customInstruction || createPietroInstruction()}
[SITUAÇÃO DA SALA]:
${context || 'Sala de Comando Central.'}
`.trim();

  mainChatSession = ai.chats.create({
    model: 'gemini-2.0-flash-exp',
    config: {
      systemInstruction: instruction,
      temperature: 0.2
    }
  });
  return mainChatSession;
};

export const startPietroSession = (participantsContext: string = "") => {
  return startMainSession(participantsContext, createPietroInstruction());
}

export const startKlausSession = () => {
  const ai = getClient();
  return ai.chats.create({
    model: 'gemini-2.0-flash-exp',
    config: {
      systemInstruction: createKlausInstruction(),
      temperature: 0.3
    }
  });
}

export const sendMessageStream = async (message: string, participantsContext: string = "") => {
  if (!mainChatSession) startPietroSession(participantsContext);
  if (!mainChatSession) throw new Error("Session not initialized");

  return mainChatSession.sendMessageStream({ message });
};

// ATUALIZAÇÃO V2.1.0 - Suporte a Global Compliance Injection
export const startAgentSession = (
  agentId: string,
  systemInstruction: string,
  knowledgeBase: string[] = [],
  modelId: string = 'gemini-2.0-flash-exp',
  history?: Content[],
  userContext?: { name: string, nickname: string, role: string },
  ragContext?: string, // Documentos recuperados automaticamente
  longTermMemory?: string, // Memória consolidada
  docsInventory?: string // NOVO: Lista de nomes de documentos acessíveis
) => {
  const ai = getClient();

  const storedConstitution = typeof localStorage !== 'undefined' ? localStorage.getItem('grupob_global_constitution_v1') : null;
  const constitution = storedConstitution || GLOBAL_LAYER;

  // COMPLIANCE INJECTION
  const storedCompliance = typeof localStorage !== 'undefined' ? localStorage.getItem('grupob_global_compliance_v1') : null;
  const compliance = storedCompliance ? `\n[PROTOCOLOS DE COMPLIANCE E SEGURANÇA (BLOQUEIO)]:\n${storedCompliance}\n` : "";

  // Memória de Sessão (Manual/Legado) - Agora o RAG Context tem prioridade, mas mantemos para compatibilidade
  const kbContext = knowledgeBase.length > 0
    ? `\n[MEMÓRIA DE SESSÃO / ARQUIVOS ANEXADOS]:\n${knowledgeBase.map((k, i) => `--- DOC ${i + 1} ---\n${k}`).join('\n')}\n`
    : "";

  // INJEÇÃO DE INTERLOCUTOR
  const userInjection = userContext
    ? `\n[INTERLOCUTOR ATUAL]:\nNome: ${userContext.name}\nComo chamar: ${userContext.nickname}\nCargo: ${userContext.role}\nOBS: Trate-o sempre pelo apelido ou sobrenome de forma natural.`
    : "";

  // INJEÇÃO DE INVENTÁRIO (O QUE EU SEI QUE EXISTE)
  const inventoryInjection = docsInventory
    ? `\n[MEUS DOCUMENTOS E ACESSOS VINCULADOS]:\nVocê tem permissão de leitura nos seguintes documentos do Cofre:\n${docsInventory}\n(O conteúdo será fornecido sob demanda se relevante).`
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

[PROTOCOLO DE ORQUESTRAÇÃO / SUMMON]:
Se o usuário pedir explicitamente para "chamar", "convocar" ou "colocar" outra pessoa/agente na conversa:
1. Responda confirmando a ação naturalmente (Ex: "Certo, chamando o Pietro agora.").
2. IMEDIATAMENTE APÓS a confirmação, adicione a tag oculta: <<<CALL: Nome do Agente>>>
Exemplo: "Entendido, Rodrigues. O Klaus entrará na sala. <<<CALL: Klaus Wagner>>>"
Não simule o diálogo do novo agente ainda. Apenas emita o comando.

[ID DO AGENTE]: ${agentId}
`.trim();

  return ai.chats.create({
    model: modelId,
    config: {
      systemInstruction: finalInstruction,
      temperature: 0.4
    },
    history: history
  });
};

// NOVA FUNÇÃO: CONSOLIDAR MEMÓRIA (TREINAMENTO)
export const consolidateChatMemory = async (chatHistory: string): Promise<string> => {
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: `
ATENÇÃO SISTEMA DE TREINAMENTO:
Você é um auditor de qualidade de IA.
Analise o histórico de conversa abaixo entre o Usuário (Rodrigues) e o Agente.
Extraia APENAS novos fatos, correções de comportamento, regras de negócio ou preferências que o usuário ensinou ao agente.
Ignore cumprimentos ou conversa fiada.
Se não houver nada relevante para aprender, retorne "Nenhum aprendizado novo".

HISTÓRICO:
${chatHistory}

SAÍDA:
Lista concisa de aprendizados (bullet points).
`.trim(),
      config: {
        temperature: 0.1
      }
    });
    return response.text || "";
  } catch (e) {
    console.error("Erro ao consolidar memória", e);
    return "";
  }
};

export const generateTitleOptions = async (messagesText: string): Promise<string[]> => {
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: `
ATENÇÃO: Você é um assistente executivo.
Analise a conversa e sugira 3 opções de Títulos.
PADRÃO: "PalavraChave | Descrição".
CONVERSA:
${messagesText}
Retorne JSON Array de strings.
`.trim(),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        temperature: 0.4
      }
    });
    const titles = JSON.parse(response.text || "[]");
    return Array.isArray(titles) ? titles.slice(0, 3) : ["Geral | Nova Conversa", "Pauta | Assunto Pendente", "Sistema | Discussão Aberta"];
  } catch (e) {
    console.error("Erro no Auto-Title", e);
    return ["Sistema | Nova Pauta", "Geral | Conversa", "Pendente | Tópico"];
  }
};

export const generateTaskSuggestions = async (contextText: string): Promise<string[]> => {
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: `
ATENÇÃO: Sugira 3 nomes curtos para Tarefa (Pauta) baseados no contexto.
Comece com Verbo no Infinitivo.
CONTEXTO:
${contextText}
Retorne JSON Array de strings.
`.trim(),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        temperature: 0.4
      }
    });
    const tasks = JSON.parse(response.text || "[]");
    return Array.isArray(tasks) ? tasks.slice(0, 3) : [];
  } catch (e) {
    console.error("Erro no Auto-Task", e);
    return [];
  }
};

export const transcribeAudio = async (base64Audio: string, mimeType: string = 'audio/webm'): Promise<string> => {
  const ai = getClient();
  const promptText = "Transcreva o áudio fielmente.";
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Audio } },
          { text: promptText }
        ]
      },
      config: { temperature: 0.0 }
    });
    return response.text || "";
  } catch (error) {
    console.warn("Gemini 2.0 Flash Audio failed...", error);
    return "";
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
  required: ["name", "version", "officialRole", "overview", "decisionRoadmap", "protocols", "firewall", "fullPrompt"]
};

export const createAgentFromScratch = async (prompt: string) => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: `ARQUITETO PIETRO: Gere o DNA V1.0 para: "${prompt}".`,
    config: {
      responseMimeType: "application/json",
      responseSchema: AGENT_SCHEMA,
      temperature: 0.2
    }
  });
  return JSON.parse(response.text || "{}");
};
