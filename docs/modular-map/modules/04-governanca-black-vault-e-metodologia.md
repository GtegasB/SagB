# Modulo 04 - Governanca, Black Vault e Metodologia

## Objetivo

Formalizar cultura, compliance, documentos, vault e configuracoes de conhecimento que moldam o comportamento dos agentes e do sistema.

## Papel dentro do SagB

### Fato observado

- `GovernanceView.tsx` tem secoes para constituicao, backup, black vault, compliance, inteligencia, contexto e metodologia.
- `MethodologyView.tsx` opera a arvore de `knowledge_nodes`.
- O runtime de IA consome dados deste modulo via `setRuntimeAiContext`.

### Inferencia

- Este modulo e a camada normativa e documental do SagB, nao apenas um CMS.

## Arquivos principais

- `components/GovernanceView.tsx`
- `components/MethodologyView.tsx`
- `services/knowledge.ts`
- `supabase/migrations/20240207000102_governance_core.sql`
- `supabase/migrations/20240207000103_governance_knowledge.sql`
- `supabase/migrations/20240207000101_governance_audit_members.sql`
- `docs/CASSIO_HANDOFF_GOVERNANCA_AI_PROXY.md`

## Dependencias

- `governance_global_culture`
- `governance_compliance_rules`
- `vault_items`
- `knowledge_nodes`
- `knowledge_attachments`
- `agent_configs`
- `agents`

## Fluxos principais

1. Editar cultura global
2. Editar regras de compliance
3. Gerir itens do Black Vault
4. Construir metodologia em arvore
5. Autorizar documentos por agente
6. Exportar backup consolidado

## Dados usados

- Markdown de cultura e regras
- Docs e pastas de metodologia
- Permissoes de documento por agente
- Metadados de vault

## Status atual

- Operacional e integrado ao runtime, com alguns atalhos inseguros.

## O que ja esta pronto

- CRUD real de cultura e compliance
- CRUD de documentos em arvore
- Backup consolidado em JSON
- Vinculo de docs globais ao DNA de agente

## O que ainda falta

- Lock real de acesso a areas sensiveis
- Audit trail exposto na UI
- Modelo de permissoes mais explicito
- Integracao mais rica com anexos e indexacao

## Riscos e lacunas

- `isUnlocked = true` em runtime
- Backup pode concentrar dados sensiveis demais
- `audit_events` existe no schema, mas nao sustenta um modulo visivel

## Modulos tocados

- Core Conversacional
- Cadastro e DNA de Agentes
- Plataforma Base

## Arquivos de apoio recomendados

- `supabase/run_all_migrations.sql`
- `types.ts`
