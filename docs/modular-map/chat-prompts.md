# Prompts por Modulo

Todos os prompts abaixo assumem que o assistente deve trabalhar apenas com fatos observados no codigo, SQL, docs e testes do repo.

## 1. Plataforma Base e Shell

```text
Quero trabalhar apenas no modulo Plataforma Base e Shell do SagB.

Escopo:
- App.tsx
- services/supabase.ts
- services/aiProxy.ts
- netlify/functions/ai.mjs
- components/Auth.tsx
- components/Sidebar.tsx
- utils/supabaseChat.ts
- config de build, env e deploy

Objetivo desta conversa:
- analisar ou melhorar auth, workspace, shell, persistencia, proxy de IA, roteamento e infraestrutura base

Regras:
- nao entrar em CID, Memoria Continua, Radar, NAGI ou SagB Bridge, a menos que a dependencia seja direta
- separar fato observado de inferencia
- sempre apontar impacto cruzado nos outros modulos
```

## 2. Core Conversacional Multiagente

```text
Quero trabalhar apenas no Core Conversacional Multiagente do SagB.

Escopo:
- components/SystemicVision.tsx
- components/ChatMessage.tsx
- components/Avatar.tsx
- services/gemini.ts
- services/deepseek.ts
- services/llamaLocal.ts
- services/providerProxy.ts
- services/knowledge.ts
- services/intelligenceFlow.ts
- services/qualitySensor.ts

Objetivo desta conversa:
- entender, refatorar ou expandir o chat multiagente, handoff, memoria, audio, anexos e persistencia de conversa

Regras:
- nao discutir governanca estrutural ou CID em profundidade, salvo quando afetarem o chat
- apontar sempre riscos de regressao em sessoes, mensagens, qualidade e fluxo
```

## 3. Governanca e Metodologia

```text
Quero trabalhar apenas no modulo de Governanca, Black Vault e Metodologia do SagB.

Escopo:
- components/GovernanceView.tsx
- components/MethodologyView.tsx
- tabelas governance_global_culture, governance_compliance_rules, vault_items, knowledge_nodes, knowledge_attachments, agent_configs
- docs de handoff relacionados

Objetivo desta conversa:
- revisar estrutura normativa, conhecimento, documentos globais, DNA de agente e impactos no runtime

Regras:
- separar o que ja esta operacional do que ainda e lacuna
- nao misturar com backlog, unit rooms ou frentes de negocio
```

## 4. Cadastro e DNA de Agentes

```text
Quero trabalhar apenas no modulo de Cadastro e DNA de Agentes do SagB.

Escopo:
- components/AgentFactory.tsx
- tipos e campos de Agent em types.ts
- fluxo de agents e agent_configs usado em App.tsx e GovernanceView

Objetivo desta conversa:
- revisar cadastro, importacao, status, taxonomia, estrutura organizacional e qualidade dos dados dos agentes

Regras:
- tratar os agentes como entidade de plataforma, nao como simples avatar de chat
- apontar sempre o que esta em agents e o que esta em agent_configs
```

## 5. Operacao e Frentes de Negocio

```text
Quero trabalhar apenas no modulo de Operacao e Frentes de Negocio do SagB.

Escopo:
- components/ConversationsView.tsx
- components/BacklogView.tsx
- components/ManagementView.tsx
- components/UnitView.tsx
- components/AlignmentView.tsx
- components/VenturesView.tsx
- components/ThreeForBView.tsx
- components/StartyBView.tsx
- components/AudacusView.tsx
- canais requests e redir em App.tsx

Objetivo desta conversa:
- entender ou evoluir as superfices de trabalho diario, salas por unidade, golden seal, ventures e frentes especificas

Regras:
- nao redesenhar o core conversacional inteiro dentro desta conversa
- deixar claro o que e dado real e o que e mock ou heuristica
```

## 6. CID

```text
Quero trabalhar apenas no modulo CID do SagB.

Escopo:
- components/CIDView.tsx
- supabase/migrations/20260312_cid_center.sql
- services/gemini.ts quando usado para resumo ou consolidacao do CID
- transcricao via ai proxy
- docs/Estrutura_SagB/CID_Centro_de_Inteligencia_Documental

Objetivo desta conversa:
- entender, melhorar ou expandir ingestao documental, jobs, chunks, outputs e inteligencia do CID

Regras:
- nao misturar com Memoria Continua, exceto em integracoes explicitas
- tratar o CID como pipeline de conhecimento, nao como upload simples
```

## 7. Memoria Continua

```text
Quero trabalhar apenas no modulo Memoria Continua do SagB.

Escopo:
- components/ContinuousMemoryView.tsx
- services/continuousMemory.ts
- supabase/migrations/20260313_continuous_memory.sql
- docs/WHISPER_LOCAL_TRANSCRICAO.md
- tools/local_whisper_server.py

Objetivo desta conversa:
- revisar captura, persistencia, classificacao, extracoes, timeline e modo local/remoto da Memoria Continua

Regras:
- nao transformar esta conversa em conversa de CID
- apontar sempre quando algo e heuristico e quando e persistido de fato
```

## 8. Fluxo de Inteligencia

```text
Quero trabalhar apenas no modulo Fluxo de Inteligencia do SagB.

Escopo:
- components/IntelligenceFlowView.tsx
- services/intelligenceFlow.ts
- utils/intelligenceFlow.ts
- supabase/migrations/20260312_intelligence_flows_v2.sql
- docs/FLUXO_INTELIGENCIA_V1_MODELAGEM.md

Objetivo desta conversa:
- entender o modelo oficial V2, o uso atual nos chats e a divergencia com o legado V1

Regras:
- distinguir sempre V1 legado vs V2 operacional
- nao misturar a conversa com regras gerais de qualidade ou governanca, salvo dependencia direta
```

## 9. Sensor de Qualidade

```text
Quero trabalhar apenas no modulo Sensor de Qualidade do SagB.

Escopo:
- components/QualitySensorView.tsx
- services/qualitySensor.ts
- supabase/migrations/20260311_agent_quality_events.sql

Objetivo desta conversa:
- revisar deteccao heuristica, eventos, indicadores, custos estimados e uso operacional do sensor

Regras:
- lembrar que parte das metricas e estimada
- focar em qualidade observavel e telemetria, nao em UX geral do chat
```

## 10. NAGI

```text
Quero trabalhar apenas no modulo NAGI do SagB.

Escopo:
- components/NAGIView.tsx
- iniciativas e rotas do portfolio NAGI
- migracao nagi_radar_core apenas quando relevante

Objetivo desta conversa:
- organizar o portfolio de iniciativas, maturidade, status e relacao entre modulo real e tese estrategica

Regras:
- deixar claro o que e portfolio estatico e o que ja e modulo operacional vivo
- nao absorver Radar ou CID por completo sem necessidade
```

## 11. Radar de Conexoes

```text
Quero trabalhar apenas no modulo Radar de Conexoes do SagB.

Escopo:
- components/RadarConnectionsView.tsx
- data/radarConnectionsBlueprint.ts
- docs/Estrutura_SagB/Radar_de_Conexoes
- migracao nagi_radar_core quando necessario

Objetivo desta conversa:
- revisar a tese, o blueprint atual, a distancia entre documento e implementacao e os proximos passos reais

Regras:
- separar claramente UI documental, schema preparado e engine ainda nao implementada
- nao misturar com NAGI generico sem deixar as fronteiras claras
```

## 12. SagB Bridge / Sala dos Programadores

```text
Quero trabalhar apenas no modulo SagB Bridge / Sala dos Programadores do SagB.

Escopo:
- components/ProgrammersRoomView.tsx
- data/sagbBridgeBlueprint.ts
- docs/Estrutura_SagB/SagB_Bridge_Extensao_VSCode
- supabase/migrations/20260313_sagb_bridge_core.sql
- testes de configuracao ligados ao bridge

Objetivo desta conversa:
- revisar a ponte SagB x VS Code, a modelagem de backend, a sala dev e os proximos passos de implementacao

Regras:
- distinguir sempre o que ja esta implementado na web do que ainda esta apenas em blueprint e migration
- nao assumir que a extensao VS Code existe no repo atual
```
