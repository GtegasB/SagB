# Modulo 03 - Nucleo Conversacional Multiagente

## Objetivo

Conduzir as conversas do SagB com agentes, multi-provider, persistencia, memoria, handoff, anexos, audio e instrumentacao.

## Papel dentro do SagB

### Fato observado

- `components/SystemicVision.tsx` e a maior e mais rica superficie funcional do sistema.
- Ele cria e le sessoes, mensagens, participantes, memoria aprendida, eventos de qualidade e fluxos de inteligencia.

### Inferencia

- Este e o verdadeiro coracao operacional do SagB atual.

## Arquivos principais

- `components/SystemicVision.tsx`
- `components/ChatMessage.tsx`
- `components/Avatar.tsx`
- `utils/avatars.ts`
- `services/gemini.ts`
- `services/deepseek.ts`
- `services/llamaLocal.ts`
- `services/providerProxy.ts`
- `services/knowledge.ts`
- `services/qualitySensor.ts`
- `services/intelligenceFlow.ts`
- `utils/supabaseChat.ts`
- `netlify/functions/ai.mjs`
- `data/prompts.ts`

## Dependencias

- `chat_sessions`
- `chat_messages`
- `agent_memories`
- `agent_quality_events`
- `intelligence_flows`
- `intelligence_flow_steps`
- `agents`
- `agent_configs`
- contexto de governanca
- provedores de IA

## Fluxos principais

1. Abrir ou criar sessao
2. Persistir mensagem do usuario
3. Escolher provider/modelo
4. Montar contexto de runtime com governanca e DNA
5. Gerar resposta simples ou multiagente
6. Persistir mensagem bot
7. Detectar qualidade e registrar eventos
8. Criar ou atualizar fluxo de inteligencia
9. Sugerir titulo, tarefas ou consolidar memoria

## Dados usados

- Historico da sessao
- Documentos autorizados do agente
- Memorias do agente
- Cultura e compliance globais
- Telemetria estimada de tokens e custos

## Status atual

- Muito forte funcionalmente, mas monolitico.

## O que ja esta pronto

- Conversa persistida
- Multi-provider
- Anexos e audio
- Handoff e convocacao de agentes
- Memoria consolidada
- Sugestao de tarefas
- Instrumentacao de qualidade e fluxo

## O que ainda falta

- Reduzir tamanho de `SystemicVision.tsx`
- Isolar melhor regras de provider, UI e orquestracao
- Fortalecer RAG alem de heuristicas por palavra-chave
- Tornar prompts estruturais realmente preenchidos

## Riscos e lacunas

- `data/prompts.ts` esta vazio, enfraquecendo o stack de identidade
- Muitas responsabilidades estao concentradas em um componente so
- Outras telas reimplementam chat de forma paralela e menos padronizada

## Modulos tocados

- Governanca
- Agentes
- Operacao
- Fluxo de Inteligencia
- Sensor de Qualidade

## Arquivos de apoio recomendados

- `docs/CASSIO_HANDOFF_GOVERNANCA_AI_PROXY.md`
- `docs/WHISPER_LOCAL_TRANSCRICAO.md`
