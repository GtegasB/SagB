# Modulo 05 - Cadastro e DNA de Agentes

## Objetivo

Registrar agentes do ecossistema, sua estrutura organizacional, estados, atributos operacionais e parte do seu DNA configuravel.

## Papel dentro do SagB

### Fato observado

- `AgentFactory.tsx` e um cadastro robusto com importacao CSV/JSON e varios campos estruturais.
- `App.tsx` tambem sincroniza `agents`, `agent_configs`, `agent_memories` e `agent_quality_events`.

### Inferencia

- O SagB trata agentes como entidade central de sistema, nao como simples persona textual.

## Arquivos principais

- `components/AgentFactory.tsx`
- `types.ts`
- `App.tsx`
- `supabase/migrations/20260307000102_agents_rls_hotfix.sql`
- `services/supabase.ts`
- `netlify/functions/ai.mjs` no handler `create_agent_from_scratch`

## Dependencias

- `agents`
- `agent_configs`
- `agent_memories`
- `agent_quality_events`

## Fluxos principais

1. Cadastrar ou editar agente manualmente
2. Importar lote
3. Definir status e metadados estruturais
4. Sincronizar configuracao de DNA em `agent_configs`
5. Usar o agente em chats e modulos do sistema

## Dados usados

- Nome, cargo, role, BU, area, venture
- Stack de modelo, mentor, status e campos customizados
- Avatar e URL publica
- DNA textual em `fullPrompt`

## Status atual

- Operacional, com separacao parcial entre cadastro e DNA.

## O que ja esta pronto

- Cadastro amplo
- Edicao visual
- Importacao em lote
- Uso transversal no app

## O que ainda falta

- Unificar melhor cadastro estrutural e configuracao de DNA
- Clarificar o uso do handler `create_agent_from_scratch`
- Endurecer politicas de seguranca de `agents`

## Riscos e lacunas

- Hotfix de RLS permissivo em `agents`
- Split entre `agents` e `agent_configs` pode gerar deriva
- Nem todo DNA e editado pela mesma superficie

## Modulos tocados

- Core Conversacional
- Governanca
- Hub
- Operacao
- Qualidade

## Arquivos de apoio recomendados

- `docs/CASSIO_HANDOFF_GOVERNANCA_AI_PROXY.md`
- `tests/configuration.test.mjs`
