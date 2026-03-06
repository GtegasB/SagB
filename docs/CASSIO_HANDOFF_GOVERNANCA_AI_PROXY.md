# Handoff Tecnico - Governanca + AI Proxy

## 1) Contexto do incidente

O erro reportado no modulo de Governanca apareceu em duas fases:

1. `Workspace nao definido. Atualize seu perfil ou associacao.`
2. `Falha ao salvar Cultura Global.`

No console, tambem apareceram erros de tabelas inexistentes e erro de coluna.

---

## 2) Causas raiz identificadas

### 2.1 Runtime error no adapter Supabase
- Erro: `ReferenceError: json is not defined`
- Efeito: quebrava leitura de `workspace_members`, impedindo derivacao de `workspaceId`.
- Impacto: bloqueava fluxos de Governanca.

### 2.2 Mapeamento camelCase -> snake_case incompleto
- Payload da Governanca enviava campos como `createdBy`/`updatedBy`.
- Banco espera `created_by`/`updated_by`.
- Efeito: insert/update falhava em `governance_global_culture`.

### 2.3 Schema de Governanca incompleto no Supabase
- Tabelas faltantes em producao:
  - `knowledge_nodes`
  - `vault_items`
  - e outras do pacote de governanca
- Efeito: 404/400 no PostgREST para leitura/escrita.

### 2.4 Chaves de IA expostas no frontend (risco de seguranca)
- Chamadas diretas para Gemini/DeepSeek no browser.
- Efeito: risco de vazamento de segredo.

---

## 3) Correcoes aplicadas

## 3.1 Commit `194c5b1`
- Moveu chamadas de IA para backend:
  - `netlify/functions/ai.mjs`
  - endpoint frontend: `/api/ai`
- Criou cliente proxy:
  - `services/aiProxy.ts`
- Refatorou servicos:
  - `services/gemini.ts`
  - `services/deepseek.ts`
- Ajustou Netlify:
  - redirect `/api/ai -> /.netlify/functions/ai`
  - functions dir no `netlify.toml`
- Harden em `services/supabase.ts`:
  - tratamento correto de erro HTTP
  - melhorias de polling/query/order
- Adicionou testes de configuracao:
  - `tests/configuration.test.mjs`

## 3.2 Commit `5393b91`
- Corrigiu mapeamento de payload de governanca para snake_case:
  - `createdBy -> created_by`
  - `updatedBy -> updated_by`
  - suporte coerente para `created_at` e `updated_at`
- Arquivo principal:
  - `services/supabase.ts`

---

## 4) Passos obrigatorios de banco (Supabase)

IMPORTANTE: no SQL Editor, deve colar o conteudo SQL completo, nao o nome do arquivo.

Arquivo de migracao:
- `supabase/run_all_migrations.sql`

## 4.1 Como executar
1. Abrir `supabase/run_all_migrations.sql` no repo.
2. Copiar todo o conteudo.
3. Colar no SQL Editor da Supabase.
4. Executar `Run`.

## 4.2 Query de verificacao

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'governance_global_culture',
    'governance_compliance_rules',
    'vault_items',
    'knowledge_nodes',
    'knowledge_attachments',
    'workspace_members',
    'audit_events'
  )
order by table_name;
```

Esperado: retornar as 7 tabelas.

---

## 5) Variaveis de ambiente

## 5.1 Frontend (build)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 5.2 Server-side (Netlify Functions)
- `GEMINI_API_KEY`
- `DEEPSEEK_API_KEY`

Observacao:
- `VITE_GEMINI_API_KEY` e `VITE_DEEPSEEK_API_KEY` ficaram apenas como compatibilidade temporaria no backend.
- O objetivo e usar somente as chaves server-side.

---

## 6) Deploy e validacao

## 6.1 Deploy
1. Garantir `main` atualizado.
2. Confirmar deploy da Netlify finalizado.
3. Fazer hard refresh no browser (`Ctrl+F5`).

## 6.2 Smoke test
1. Login com usuario com `workspace_members`.
2. Abrir Governanca > Cultura Atual.
3. Editar conteudo e salvar.
4. Confirmar ausencia de alertas de erro.

## 6.3 Sinais de sucesso
- Sem erro `json is not defined`.
- Sem erro `Workspace nao definido`.
- Sem erro `Could not find table ... in schema cache`.
- Sem erro `createdBy column` no PostgREST.

---

## 7) Troubleshooting rapido

Se falhar novamente:

1. Verificar schema:
- executar query de `information_schema.tables`.

2. Verificar membership do usuario:
```sql
select workspace_id, user_id, role, status
from public.workspace_members
where user_id = '<auth_user_id>';
```

3. Verificar logs de rede:
- request para `rest/v1/governance_global_culture`
- request para `rest/v1/workspace_members`
- request para `/api/ai` (quando houver chamada IA)

4. Verificar variaveis no provedor:
- Netlify: `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`
- App: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## 8) Arquivos-chave para manutencao

- `services/supabase.ts`
- `services/gemini.ts`
- `services/deepseek.ts`
- `services/aiProxy.ts`
- `netlify/functions/ai.mjs`
- `netlify.toml`
- `supabase/run_all_migrations.sql`
- `tests/configuration.test.mjs`

