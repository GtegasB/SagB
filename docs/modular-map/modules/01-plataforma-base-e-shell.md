# Modulo 01 - Plataforma Base e Shell

## Objetivo

Garantir entrada no sistema, resolucao do workspace, shell de navegacao, acesso a dados e roteamento para todos os modulos do SagB.

## Papel dentro do SagB

### Fato observado

- `App.tsx` centraliza auth, bootstrap de dados, resolucao de `activeWorkspaceId`, inscricoes em colecoes e roteamento de telas.
- `services/supabase.ts` implementa uma camada propria para auth e CRUD sobre Supabase/PostgREST.
- `netlify/functions/ai.mjs` centraliza acesso aos provedores de IA no backend.

### Inferencia

- Este e o nucleo de plataforma do produto. Se ele falha, os modulos de negocio nao conseguem operar de forma consistente.

## Arquivos principais

- `App.tsx`
- `index.tsx`
- `components/Auth.tsx`
- `components/Sidebar.tsx`
- `services/supabase.ts`
- `services/aiProxy.ts`
- `netlify/functions/ai.mjs`
- `utils/supabaseChat.ts`
- `types.ts`
- `vite.config.ts`
- `netlify.toml`
- `.env.example`
- `package.json`

## Dependencias

- Supabase URL e anon key
- Workspace membership em `workspace_members`
- Tabelas `users`, `agents`, `agent_configs`, `topics`, `tasks`, `ventures`
- Netlify Functions
- Provedores Gemini, DeepSeek, OpenAI, Claude, Qwen e Llama local

## Fluxos principais

1. Login ou registro em `Auth.tsx`
2. Restauracao de sessao local em `services/supabase.ts`
3. Resolucao do usuario e memberships em `App.tsx`
4. Definicao do workspace ativo
5. Assinatura por polling das entidades principais
6. Injecao de contexto de IA em runtime
7. Render da rota ativa via `renderContent()`

## Dados usados

- `users`
- `workspace_members`
- `agents`
- `agent_configs`
- `tasks`
- `topics`
- `ventures`
- tabelas de governanca
- `chat_sessions` e `chat_messages`

## Status atual

- Forte e funcional, mas altamente centralizado.

## O que ja esta pronto

- Auth basico
- Bootstrap do app
- Navegacao principal
- Proxy de IA no backend
- Camada unica de persistencia
- Configuracao de deploy e build

## O que ainda falta

- Reduzir tamanho e responsabilidade do `App.tsx`
- Substituir polling por realtime ou por estrategia mais fina
- Uniformizar mensagens de erro e docs de versao
- Endurecer auth e edge cases de workspace

## Riscos e lacunas

- `services/supabase.ts` e muito critico e grande
- Polling pode gerar custo, atraso visual e comportamento inconsistente
- `Auth.tsx` ainda traz sinais de legado de Firebase/Google
- `README.md`, `metadata.json` e o runtime nao estao 100% alinhados entre si

## Modulos tocados

- Todos

## Arquivos de apoio recomendados

- `tests/configuration.test.mjs`
- `docs/CASSIO_HANDOFF_GOVERNANCA_AI_PROXY.md`
- `supabase/run_all_migrations.sql`
