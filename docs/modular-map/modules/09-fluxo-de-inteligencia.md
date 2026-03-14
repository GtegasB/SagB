# Modulo 09 - Fluxo de Inteligencia

## Objetivo

Registrar oficialmente os fluxos de execucao intelectual do sistema, com etapas, atores, status, custos estimados e acao final.

## Papel dentro do SagB

### Fato observado

- O produto usa `services/intelligenceFlow.ts` para gravar o modelo V2.
- `IntelligenceFlowView.tsx` le `intelligence_flows` e `intelligence_flow_steps`.
- Existe tambem `utils/intelligenceFlow.ts` com logica V1 derivada de dados ja existentes.

### Inferencia

- O modulo ja existe de forma real, mas ainda convive com legado conceitual e tecnico.

## Arquivos principais

- `components/IntelligenceFlowView.tsx`
- `services/intelligenceFlow.ts`
- `utils/intelligenceFlow.ts`
- `supabase/migrations/20260312000102_intelligence_flows_v2.sql`
- `docs/FLUXO_INTELIGENCIA_V1_MODELAGEM.md`

## Dependencias

- `intelligence_flows`
- `intelligence_flow_steps`
- `chat_sessions`
- `chat_messages`
- `tasks`
- `agent_quality_events`

## Fluxos principais

1. Criar fluxo no inicio de operacao relevante
2. Adicionar steps por actor/action
3. Finalizar com `final_action`
4. Visualizar timeline e filtros por tipo, status, agente e modelo

## Dados usados

- Participantes
- Status do fluxo
- Etapas e tempos
- Tokens e custo estimado
- Relacao com conversa e acao gerada

## Status atual

- Operacional em V2, com vestigios de V1 no repo.

## O que ja esta pronto

- Schema oficial V2
- Gravacao de passos
- View analitica no frontend
- Uso pelo core conversacional

## O que ainda falta

- Limpar ou aposentar V1 legado
- Ampliar uso para mais modulos alem do chat e task generation
- Melhor documentacao atualizada do modelo V2

## Riscos e lacunas

- Drift entre docs V1 e runtime V2
- Possivel confusao de manutencao entre `utils/intelligenceFlow.ts` e `services/intelligenceFlow.ts`

## Modulos tocados

- Core Conversacional
- CID
- Sensor de Qualidade
- Operacao

## Arquivos de apoio recomendados

- `tests/configuration.test.mjs`
- `docs/FLUXO_INTELIGENCIA_V1_MODELAGEM.md`
