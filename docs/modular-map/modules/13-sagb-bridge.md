# Modulo 13 - SagB Bridge / Sala dos Programadores

## Objetivo

Conectar o SagB ao VS Code por meio de uma ponte operacional para tarefas tecnicas, execucao local e devolutiva de status.

## Papel dentro do SagB

### Fato observado

- `ProgrammersRoomView.tsx` mostra o blueprint do modulo e cards de briefing.
- `data/sagbBridgeBlueprint.ts` sustenta a tela.
- Existe migration `20260313_sagb_bridge_core.sql` com tabelas `dev_projects`, `dev_tasks`, `dev_task_runs`, `dev_developer_sessions` e `dev_task_launches`.

### Inferencia

- O modulo esta em fase de especificacao forte + schema pronto, mas ainda sem backend operativo e sem extensao VS Code neste repo.

## Arquivos principais

- `components/ProgrammersRoomView.tsx`
- `data/sagbBridgeBlueprint.ts`
- `docs/Estrutura_SagB/SagB_Bridge_Extensao_VSCode`
- `supabase/migrations/20260313_sagb_bridge_core.sql`
- `tests/configuration.test.mjs`

## Dependencias

- Blueprint estatico
- Futuro backend `/api/dev`
- Futura extensao `grupob.sagb-bridge`
- Tabelas `dev_*`

## Fluxos principais

1. Abrir Sala dos Programadores
2. Ler overview, contracts, operations e quality
3. Copiar briefing mestre ou cards
4. Projetar backend e extensao a partir do blueprint

## Dados usados

- Dados estaticos do blueprint
- Schema futuro para operacao tecnica

## Status atual

- Scaffoldado/documentado.

## O que ja esta pronto

- Documento canonico forte
- Tela de briefing
- Migration base de dados
- Teste de configuracao cobrindo a existencia do schema

## O que ainda falta

- Backend de projetos, tasks, launches e runs
- Integracao real da Sala Dev com dados vivos
- Extensao VS Code
- Fluxo ponta a ponta SagB -> VS Code -> SagB

## Riscos e lacunas

- Pode ser confundido com modulo pronto, quando ainda esta na fase de contrato arquitetural
- O valor do modulo depende de componentes fora deste repo

## Modulos tocados

- Plataforma Base
- Operacao
- Futuras tarefas e historico tecnico

## Arquivos de apoio recomendados

- `docs/Estrutura_SagB/SagB_Bridge_Extensao_VSCode`
- `supabase/migrations/20260313_sagb_bridge_core.sql`
