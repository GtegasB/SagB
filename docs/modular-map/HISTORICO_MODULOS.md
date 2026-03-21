# Historico de Modulos do SagB

Documento de rastreabilidade macro por modulo.

## Formato padrao (usar em todos os modulos)

- Data
- Modulo
- Mudanca
- Tipo (`arquitetura`, `fluxo`, `dados`, `ui`, `infra`, `correcao`)
- Arquivos/tabelas afetados
- Status (`planejado`, `em andamento`, `concluido`)

---

## Entradas iniciais

### 2026-03-13 - Mapeamento modular consolidado

- Modulo: Plataforma geral (todos)
- Mudanca: consolidacao do mapa modular com 13 modulos, blueprint final e prompts por modulo.
- Tipo: arquitetura
- Arquivos/tabelas afetados:
  - `docs/modular-map/README.md`
  - `docs/modular-map/blueprint-final.md`
  - `docs/modular-map/chat-prompts.md`
  - `docs/modular-map/modules/*.md`
- Status: concluido

### 2026-03-20 - Organizacao documental padrao do SagB

- Modulo: Documentacao transversal
- Mudanca: criacao de base de padroes globais para replicacao em novos sistemas do GrupoB.
- Tipo: infra
- Arquivos/tabelas afetados:
  - `docs/README.md`
  - `docs/standards/README.md`
  - `docs/standards/design-system.md`
  - `docs/standards/stack-e-infra.md`
  - `docs/modular-map/HISTORICO_MODULOS.md`
- Status: concluido

### 2026-03-20 - Ajustes tecnicos no chat multiagente (memoria, sessao e governanca)

- Modulo: 03-nucleo-conversacional / 08-memoria-continua / 04-governanca-black-vault-e-metodologia
- Mudanca:
  - abertura de historico por `sessionId` exato no fluxo `ConversationsView -> App -> SystemicVision`;
  - consolidacao de aprendizado com fan-out para todos os agentes participantes da conversa;
  - padronizacao da heranca de contexto global/compliance em providers via `governanceContext`, com merge central no backend (`netlify/functions/ai.mjs`).
- Tipo: fluxo
- Arquivos/tabelas afetados:
  - `App.tsx`
  - `components/SystemicVision.tsx`
  - `services/deepseek.ts`
  - `services/llamaLocal.ts`
  - `services/providerProxy.ts`
  - `netlify/functions/ai.mjs`
  - tabela `agent_memories`
- Status: concluido
