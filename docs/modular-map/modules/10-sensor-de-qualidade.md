# Modulo 10 - Sensor de Qualidade

## Objetivo

Detectar eventos de qualidade, correcoes, handoffs, repeticoes e indicadores de eficiencia das interacoes do sistema.

## Papel dentro do SagB

### Fato observado

- `services/qualitySensor.ts` detecta eventos heuristicos a partir das mensagens.
- `QualitySensorView.tsx` le `agent_quality_events` e cruza dados com `chat_sessions` e `chat_messages`.

### Inferencia

- Este modulo e a primeira camada de observabilidade do comportamento do SagB, ainda mais heuristica do que deterministica.

## Arquivos principais

- `components/QualitySensorView.tsx`
- `services/qualitySensor.ts`
- `supabase/migrations/20260311_agent_quality_events.sql`

## Dependencias

- `agent_quality_events`
- `chat_sessions`
- `chat_messages`
- `agents`

## Fluxos principais

1. Observar mensagens do core conversacional
2. Detectar eventos
3. Estimar tokens, custo e latencia
4. Persistir evento
5. Visualizar dashboards por tipo, agente, conversa e modelo

## Dados usados

- Tipo e severidade do evento
- Excerpt
- Agent id e nome
- Conversa relacionada
- Tokens e custo estimado

## Status atual

- Operacional e util, mas heuristico.

## O que ja esta pronto

- Tabela dedicada
- Deteccao automatica
- Dashboard com cortes por evento, agente e conversa

## O que ainda falta

- Maior precisao
- Regras mais calibradas por modulo
- Separar melhor custo real de custo estimado

## Riscos e lacunas

- Falsos positivos e falsos negativos
- Dependencia da qualidade do historico de chat salvo

## Modulos tocados

- Core Conversacional
- Fluxo de Inteligencia
- Operacao analitica do sistema

## Arquivos de apoio recomendados

- `types.ts`
- `services/intelligenceFlow.ts`
