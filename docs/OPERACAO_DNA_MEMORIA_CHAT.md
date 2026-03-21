# Operação em Produção: DNA, Memória e Chat (SagB)

Este guia consolida como operar, com segurança, a arquitetura de **DNA em camadas**, **memória persistente** e **chat multi-provider** no SagB.

## 1) Objetivo da arquitetura

- Garantir que o comportamento do agente em runtime use uma fonte consistente:
  - **DNA individual** (override do agente)
  - **DNA efetivo** (snapshot pronto para inferência)
  - **governança global** (constituição/compliance/contexto)
- Evitar divergência entre estado local e banco (Supabase).
- Tornar o SagB apto como canal principal de operação de IA.

## 2) Tabelas envolvidas

### DNA
- `agent_dna_profiles`
  - override individual por agente (`individual_prompt`)
- `agent_dna_effective`
  - snapshot efetivo (`effective_prompt`) usado no runtime

### Suporte de agente e conversa
- `agent_configs` (prompt base/documentos)
- `agent_memories` (aprendizados persistidos)
- `chat_sessions`
- `chat_messages`

## 3) Fluxo de resolução de prompt

O runtime resolve instrução do agente na seguinte ordem:

1. `effectivePrompt`
2. `dnaIndividualPrompt`
3. `fullPrompt`

Implementado em `services/agentDna.ts`:
- `resolveAgentBasePrompt(...)`
- `composeEffectivePrompt(...)`
- `resolveAgentInstruction(...)`

## 4) Fluxo de gravação (Governança)

Ao atualizar agente pela Governança (`App.tsx` / `handleUpdateAgentData`):

1. Atualiza cadastro-base de `agents` (best-effort)
2. Salva `agent_configs`
3. Salva `agent_dna_profiles` (individual)
4. Salva `agent_dna_effective` (snapshot final com governança)

Isso garante sincronização de DNA por camadas e reidratação consistente.

## 5) Fluxo de leitura (runtime/chat)

- `App.tsx` mantém subscriptions para:
  - `agent_configs`
  - `agent_dna_profiles`
  - `agent_dna_effective`
  - `agent_memories`
- Na hidratação de agentes:
  - injeta `dnaIndividualPrompt`
  - injeta `effectivePrompt` (ou fallback com composição)
  - monta `learnedMemory` do banco
- `SystemicVision.tsx` usa `resolveAgentBasePrompt(...)` em todos os providers.

## 6) Memória: política operacional

- **Fonte de verdade:** `agent_memories` (Supabase)
- Evitar atualizar memória final só em estado local.
- Consolidação de aprendizado deve persistir no banco e depender de reidratação.

## 7) Migrations (ordem recomendada)

### Caminho recomendado (versionado)
Aplicar migrations em ordem cronológica da pasta `supabase/migrations/`, incluindo:

- `20260320000101_agent_dna_layers.sql`

### Caminho “all-in-one”
Se usar `supabase/run_all_migrations.sql`, ele já contempla:

- criação de `agent_dna_profiles`
- criação de `agent_dna_effective`
- índices
- **RLS + policies** para DNA (alinhado com migration dedicada)

## 8) Checklist de go-live

- [ ] migrations aplicadas sem erro
- [ ] tabelas DNA existentes no schema `public`
- [ ] políticas RLS ativas para DNA
- [ ] edição de DNA pela governança persistindo em profiles/effective
- [ ] chat respondendo com prompt efetivo
- [ ] consolidação de memória persistindo em `agent_memories`
- [ ] reidratação após refresh mantendo comportamento do agente

## 9) Troubleshooting rápido

- Erro de tabela ausente `public.agent_dna_profiles`/`public.agent_dna_effective`:
  - aplicar migration de DNA ou `run_all_migrations.sql` atualizado.
- Agente “perde” comportamento após refresh:
  - validar escrita em `agent_dna_effective` e leitura no hydration.
- Diferença entre resposta em providers:
  - confirmar que todos os fluxos usam `resolveAgentBasePrompt(...)`.
