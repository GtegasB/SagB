# Blueprint Final do SagB

## 1. Visao geral do sistema

### Fato observado

- O SagB hoje e uma aplicacao React + Vite + TypeScript com shell principal em `App.tsx`.
- A persistencia passa por um adaptador proprio em `services/supabase.ts`, que faz auth, CRUD e `onSnapshot` por polling em cima do PostgREST do Supabase.
- A IA passa por um proxy backend em `netlify/functions/ai.mjs`, consumido no frontend por `services/aiProxy.ts`.
- O eixo funcional mais forte do produto e um nucleo conversacional multiagente com persistencia de chat, memoria, qualidade e fluxo de inteligencia.
- O sistema tem modulos com schema proprio para Governanca, CID, Memoria Continua, Fluxo de Inteligencia, Qualidade, NAGI/Radar e SagB Bridge.

### Inferencia

- O SagB ja deixou de ser apenas um chat corporativo e hoje funciona como um sistema operacional estrategico em formacao, com um core de conversas e varios satelites de inteligencia.
- O projeto esta em uma fase mista: algumas frentes ja sao produtos internos operacionais, enquanto outras ainda estao em estado de documento canonico + schema preparado.

## 2. Modulos identificados

1. Plataforma Base, Auth e Workspace
2. Home, Dashboard e Hub do Ecossistema
3. Nucleo Conversacional Multiagente
4. Governanca, Black Vault e Metodologia
5. Cadastro e DNA de Agentes
6. Operacao e Frentes de Negocio
7. CID
8. Memoria Continua
9. Fluxo de Inteligencia
10. Sensor de Qualidade
11. NAGI
12. Radar de Conexoes
13. SagB Bridge / Sala dos Programadores

## 3. Explicacao profunda de cada modulo

- Plataforma Base, Auth e Workspace: shell do produto, auth, workspace, acesso a dados, proxy de IA e roteamento macro. Ver `modules/01-plataforma-base-e-shell.md`.
- Home, Dashboard e Hub: camada de leitura executiva e navegacao do ecossistema. Ver `modules/02-home-dashboard-e-hub.md`.
- Nucleo Conversacional Multiagente: centro operacional real do SagB. Ver `modules/03-nucleo-conversacional.md`.
- Governanca, Black Vault e Metodologia: camada normativa e documental que alimenta o comportamento dos agentes. Ver `modules/04-governanca-black-vault-e-metodologia.md`.
- Cadastro e DNA de Agentes: registro, organizacao estrutural e estado operacional dos agentes. Ver `modules/05-cadastro-e-dna-de-agentes.md`.
- Operacao e Frentes de Negocio: telas de conversa, pauta, gestao e frentes de unidade/venture. Ver `modules/06-operacao-e-frentes-de-negocio.md`.
- CID: ingestao documental, fragmentacao, processamento e sintese. Ver `modules/07-cid.md`.
- Memoria Continua: captura e organizacao persistente de reunioes e linhas de memoria. Ver `modules/08-memoria-continua.md`.
- Fluxo de Inteligencia: trilha oficial de execucao e rastreabilidade de fluxos multi-etapa. Ver `modules/09-fluxo-de-inteligencia.md`.
- Sensor de Qualidade: telemetria e deteccao heuristica de qualidade das interacoes. Ver `modules/10-sensor-de-qualidade.md`.
- NAGI: portfolio estrategico de iniciativas. Ver `modules/11-nagi.md`.
- Radar de Conexoes: camada de inteligencia de ecossistema, hoje mais documental do que operacional. Ver `modules/12-radar-de-conexoes.md`.
- SagB Bridge / Sala dos Programadores: ponte planejada entre SagB e VS Code, hoje em estado scaffoldado/documentado. Ver `modules/13-sagb-bridge.md`.

## 4. Dependencias entre modulos

### Dependencias estruturais

- Plataforma Base -> todos os demais modulos.
- Auth/Workspace -> todos os modulos persistidos por `workspace_id`.
- AI Proxy -> nucleo conversacional, gestao, salas de unidade, alinhamento, CID e transcricao.
- Governanca -> injeta contexto em IA, afeta agentes e conhecimento.
- Cadastro de Agentes -> abastece nucleo conversacional, hub, governanca, qualidade e operacao.
- Nucleo Conversacional -> alimenta chat sessions, messages, memories, quality events e intelligence flows.
- Fluxo de Inteligencia -> depende principalmente do Nucleo Conversacional e do CID.
- Sensor de Qualidade -> depende principalmente de conversas persistidas.
- CID e Memoria Continua -> sao modulos paralelos, com potencial de convergencia futura.
- NAGI, Radar e SagB Bridge -> hoje dependem mais de docs e blueprints do que de runtime real.

## 5. O que ja esta solido

- Auth, workspace e persistencia basica funcionam pelo adaptador Supabase.
- O nucleo conversacional persiste sessoes e mensagens, suporta multi-provider, anexos, audio, memoria, handoff e sugestoes de tarefa.
- Governanca tem CRUD real para cultura, compliance, vault e arvore de conhecimento.
- Cadastro de agentes tem editor robusto e importacao em lote.
- CID tem UI, servico, schema e fluxo V1 de ingestao/processamento.
- Memoria Continua tem schema amplo, fallback local e fluxo operacional de captura.
- Fluxo de Inteligencia e Sensor de Qualidade ja possuem tabelas proprias, views e consumo no frontend.
- `npm test` passou com `9/9` testes em `tests/configuration.test.mjs`.

## 6. O que esta incompleto ou difuso

- `data/prompts.ts` exporta camadas de prompt vazias.
- `GovernanceView` mantem `isUnlocked = true`, entao o lock de acesso esta bypassado.
- `utils/intelligenceFlow.ts` descreve um modelo V1 antigo, enquanto o produto usa V2 em `services/intelligenceFlow.ts`.
- NAGI, Radar e SagB Bridge possuem migrations e documentos fortes, mas pouca ou nenhuma ligacao de dados viva no frontend.
- Parte do dashboard e do Hub usa dados sinteticos ou heuristicas estaticas.
- `StartyBView` usa projetos ativos mockados.
- Existe material legado e arquivos de ruido no repo.

## 7. Melhor divisao em chats independentes

1. Chat da Plataforma Base e Shell
2. Chat do Core Conversacional Multiagente
3. Chat da Governanca e Metodologia
4. Chat do Cadastro e DNA de Agentes
5. Chat da Operacao e Frentes de Negocio
6. Chat do CID
7. Chat da Memoria Continua
8. Chat do Fluxo de Inteligencia
9. Chat do Sensor de Qualidade
10. Chat do NAGI
11. Chat do Radar de Conexoes
12. Chat da Sala dos Programadores / SagB Bridge

## 8. Sugestao de estrutura de arquivos para documentar cada modulo

```text
docs/
  modular-map/
    README.md
    blueprint-final.md
    chat-prompts.md
    modules/
      01-plataforma-base-e-shell.md
      02-home-dashboard-e-hub.md
      03-nucleo-conversacional.md
      04-governanca-black-vault-e-metodologia.md
      05-cadastro-e-dna-de-agentes.md
      06-operacao-e-frentes-de-negocio.md
      07-cid.md
      08-memoria-continua.md
      09-fluxo-de-inteligencia.md
      10-sensor-de-qualidade.md
      11-nagi.md
      12-radar-de-conexoes.md
      13-sagb-bridge.md
```

## 9. Prompts prontos para abrir conversas futuras por modulo

- Os prompts completos estao em `chat-prompts.md`.
- Cada prompt ja delimita escopo, arquivos-base, perguntas permitidas e exclusoes.

## 10. Blueprint final de organizacao do projeto

### Ordem recomendada de estudo

1. Plataforma Base e Shell
2. Nucleo Conversacional
3. Governanca
4. Cadastro de Agentes
5. Operacao e Frentes
6. CID
7. Memoria Continua
8. Fluxo de Inteligencia
9. Sensor de Qualidade
10. NAGI
11. Radar de Conexoes
12. SagB Bridge

### Ordem recomendada de implementacao ou manutencao

1. Plataforma Base, porque afeta tudo
2. Core Conversacional, porque e o modulo mais central para negocio
3. Governanca e Agentes, porque definem comportamento do sistema
4. Operacao, porque entrega valor diario
5. CID e Memoria Continua, porque ampliam a base de inteligencia
6. Fluxo e Qualidade, porque consolidam observabilidade
7. NAGI, Radar e Bridge, porque hoje sao frentes mais scaffoldadas
