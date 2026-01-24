
import { Agent } from '../types';

// ==================================================================================
// 🧠 KNOWLEDGE ENGINE (RAG LITE & MEMORY)
// ==================================================================================

/**
 * Busca documentos relevantes na base do agente baseando-se no input do usuário.
 * Simula um Vector Search usando keyword matching simples para este ambiente.
 */
export const retrieveRelevantContext = (agent: Agent, userMessage: string): string => {
    if (!agent.globalDocuments || agent.globalDocuments.length === 0) return "";

    const userText = userMessage.toLowerCase();
    const relevantDocs = agent.globalDocuments.filter(doc => {
        // Verifica se palavras-chave do documento (tags ou titulo) estão na mensagem
        const titleMatch = userText.includes(doc.title.toLowerCase());
        const contentMatch = doc.tags.some(tag => userText.includes(tag.toLowerCase()));
        
        // Se a mensagem for muito curta, pode não trazer nada, então trazemos contexto geral se marcado como 'core'
        const isCore = doc.tags.includes('core') || doc.tags.includes('fundamental');
        
        return titleMatch || contentMatch || isCore;
    });

    if (relevantDocs.length === 0) return "";

    return `
[RAG SYSTEM - INFORMAÇÃO RECUPERADA]:
O sistema encontrou os seguintes documentos internos que podem ajudar na resposta. Use-os como fonte de verdade.

${relevantDocs.map(doc => `--- DOCUMENTO: ${doc.title} ---\n${doc.content}`).join('\n\n')}
---------------------------------------------------
`.trim();
};

/**
 * Recupera a memória consolidada (aprendizado) do agente.
 */
export const retrieveLearnedMemory = (agent: Agent): string => {
    if (!agent.learnedMemory || agent.learnedMemory.length === 0) return "";

    return `
[MEMÓRIA DE LONGO PRAZO / APRENDIZADOS ANTERIORES]:
O usuário já lhe ensinou ou corrigiu os seguintes pontos em conversas passadas. Respeite estas instruções acima do seu prompt original.

${agent.learnedMemory.map(m => `- ${m}`).join('\n')}
`.trim();
};

/**
 * Adiciona um documento à base do agente.
 */
export const addDocumentToAgent = (agent: Agent, title: string, content: string): Agent => {
    const newDoc = {
        id: Date.now().toString(),
        title,
        content,
        tags: title.toLowerCase().split(' ') // Gera tags simples baseadas no título
    };

    const updatedDocs = [...(agent.globalDocuments || []), newDoc];
    return { ...agent, globalDocuments: updatedDocs, docCount: updatedDocs.length };
};

/**
 * Adiciona um aprendizado à memória do agente.
 */
export const addLearningToAgent = (agent: Agent, learning: string): Agent => {
    const updatedMemory = [...(agent.learnedMemory || []), learning];
    return { ...agent, learnedMemory: updatedMemory };
};
