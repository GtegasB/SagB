# Modulo 02 - Home, Dashboard e Hub

## Objetivo

Dar leitura executiva do sistema e servir como mapa de entrada do ecossistema.

## Papel dentro do SagB

### Fato observado

- `DashboardHome.tsx` consome `agents`, `tasks`, `businessUnits`, `chat_sessions`, `chat_messages` e `intelligence_flows`.
- `HubView.tsx` organiza unidades de negocio, ventures, metodologias e agentes.

### Inferencia

- Este modulo funciona como cockpit de visao geral e descoberta, mais do que como motor de operacao profunda.

## Arquivos principais

- `components/DashboardHome.tsx`
- `components/HubView.tsx`
- `App.tsx`

## Dependencias

- Business units iniciais de `App.tsx`
- `agents`
- `tasks`
- `chat_sessions`
- `chat_messages`
- `intelligence_flows`

## Fluxos principais

1. Entrada na aba `home`
2. Leitura de indicadores gerais
3. Navegacao para modulos e unidades
4. Entrada na aba `ecosystem` ou `hub`
5. Exploracao por unidade, frente e agentes

## Dados usados

- Estrutura de BUs inicial em memoria
- Agentes ativos
- Tarefas
- Conversas
- Fluxos de inteligencia

## Status atual

- Operacional, mas com mistura de dados reais e estimados.

## O que ja esta pronto

- Home com KPIs e atalhos
- Hub com visualizacao por unidade
- Navegacao para agentes e modulos

## O que ainda falta

- Indicadores 100% confiaveis e rastreaveis
- Dados reais para conselho/auditoria
- Revisao da modelagem de ecossistema para reduzir hardcodes

## Riscos e lacunas

- Algumas metricas sao sinteticas
- `HubView` usa filtros e membros estaticos
- Existe risco de ids fixos em filtro de conselho nao refletirem o cadastro real

## Modulos tocados

- Cadastro de Agentes
- Operacao
- Core Conversacional
- NAGI e Radar por navegacao

## Arquivos de apoio recomendados

- `types.ts`
- `App.tsx`
