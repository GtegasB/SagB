# Fluxo de Inteligência - Modelagem V1 (SAGB)

## Objetivo
Criar uma trilha operacional que mostre como a inteligência percorre o sistema até virar resultado (decisão, tarefa, pauta, conhecimento ou erro).

## Estratégia V1 entregue
- V1 usa **derivação a partir de tabelas já existentes**:
  - `chat_sessions`
  - `chat_messages`
  - `tasks`
  - `topics`
  - `knowledge_nodes`
  - `agent_quality_events`
- Nenhuma migração obrigatória nesta etapa.
- A visão já funciona em produção/local usando os dados atuais.

## Estrutura recomendada para V2 (persistência dedicada)

### Tabela `intelligence_flows`
- `id uuid primary key`
- `workspace_id uuid not null`
- `venture_id uuid null`
- `origin text not null`
- `flow_type text not null` (`conversation`, `handoff`, `decision`, `operation`, `knowledge`, `error`)
- `final_action text not null`
- `status text not null` (`ok`, `pending`, `error`, `waiting`)
- `participants jsonb not null default '[]'::jsonb`
- `source_kind text not null` (`conversation`, `knowledge`, `quality`, `operation`)
- `source_id text null`
- `payload jsonb null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Tabela `intelligence_flow_steps`
- `id uuid primary key`
- `flow_id uuid not null references intelligence_flows(id) on delete cascade`
- `workspace_id uuid not null`
- `step_order int not null`
- `actor_type text not null` (`user`, `agent`, `system`, `cid`, `governance`)
- `actor_name text not null`
- `action_type text not null` (`question`, `analysis`, `handoff`, `response`, `synthesis`, `task`, `agenda`, `decision`, `knowledge`, `error`)
- `status text not null` (`ok`, `pending`, `error`, `waiting`)
- `model_used text null`
- `note text null`
- `event_time timestamptz not null`
- `payload jsonb null`
- `created_at timestamptz not null default now()`

## Regras de evolução
- Cada execução relevante deve gerar 1 registro em `intelligence_flows`.
- Cada etapa do fluxo deve virar linha em `intelligence_flow_steps`.
- `source_kind + source_id` garantem rastreabilidade para replay e auditoria.
- Sempre registrar `workspace_id` para isolamento multi-tenant.
- Ativar RLS por workspace antes de abrir escrita para clientes.
